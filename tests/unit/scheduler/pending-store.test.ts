/**
 * PendingMessageStore 单元测试
 *
 * 测试待推送消息存储
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PendingMessageStore } from '../../../src/scheduler/pending-store.js';
import { PendingMessage } from '../../../src/scheduler/types.js';
import fs from 'fs';
import path from 'path';

// 测试用的临时存储路径
const TEST_STORE_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'test-pending-messages.json');

// Mock 消息数据
const createMockMessage = (id: string): PendingMessage => ({
  messageId: id,
  taskId: 'test-task',
  userId: 'test-user',
  channel: 'cli',
  content: '测试消息',
  createdAt: '2026-05-15T10:00:00Z',
  retryCount: 0,
});

describe('PendingMessageStore', () => {
  let store: PendingMessageStore;

  beforeEach(() => {
    // 清理测试文件
    if (fs.existsSync(TEST_STORE_PATH)) {
      fs.unlinkSync(TEST_STORE_PATH);
    }
    store = new PendingMessageStore(TEST_STORE_PATH);
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(TEST_STORE_PATH)) {
      fs.unlinkSync(TEST_STORE_PATH);
    }
  });

  describe('初始化', () => {
    it('should create empty store file if not exists', () => {
      const newStore = new PendingMessageStore(TEST_STORE_PATH);
      expect(fs.existsSync(TEST_STORE_PATH)).toBe(true);
      const data = JSON.parse(fs.readFileSync(TEST_STORE_PATH, 'utf-8'));
      expect(data.messages).toEqual([]);
    });

    it('should load existing messages from file', () => {
      // 预写入测试数据
      const existingMessages = [createMockMessage('existing-1')];
      fs.writeFileSync(TEST_STORE_PATH, JSON.stringify({ messages: existingMessages }));

      const existingStore = new PendingMessageStore(TEST_STORE_PATH);
      const messages = existingStore.getAll();
      expect(messages.length).toBe(1);
      expect(messages[0].messageId).toBe('existing-1');
    });
  });

  describe('CRUD 操作', () => {
    it('should add a pending message', () => {
      const message = createMockMessage('new-msg');
      const saved = store.add(message);

      expect(saved).toEqual(message);
      expect(store.getAll().length).toBe(1);
    });

    it('should get message by messageId', () => {
      const message = createMockMessage('get-test');
      store.add(message);

      const found = store.getById('get-test');
      expect(found).toBeDefined();
      expect(found?.messageId).toBe('get-test');
    });

    it('should remove message after delivery', () => {
      const message = createMockMessage('remove-test');
      store.add(message);

      const removed = store.remove('remove-test');
      expect(removed).toBe(true);
      expect(store.getAll().length).toBe(0);
    });

    it('should return false when removing non-existent message', () => {
      const removed = store.remove('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('查询操作', () => {
    beforeEach(() => {
      store.add(createMockMessage('msg1'));
      store.add({ ...createMockMessage('msg2'), userId: 'user1' });
      store.add({ ...createMockMessage('msg3'), userId: 'user2' });
    });

    it('should filter messages by userId', () => {
      const user1Messages = store.getByUserId('user1');
      expect(user1Messages.length).toBe(1);
    });

    it('should filter messages by channel', () => {
      store.add({ ...createMockMessage('web-msg'), channel: 'web' });
      const webMessages = store.getByChannel('web');
      expect(webMessages.length).toBe(1);
    });

    it('should get messages ordered by createdAt', () => {
      store.add({
        ...createMockMessage('early'),
        createdAt: '2026-05-15T08:00:00Z',
      });
      store.add({
        ...createMockMessage('late'),
        createdAt: '2026-05-15T12:00:00Z',
      });

      const ordered = store.getOrderedByTime();
      expect(ordered[0].messageId).toBe('early');
    });
  });

  describe('重试机制', () => {
    it('should increment retry count', () => {
      const message = createMockMessage('retry-test');
      store.add(message);

      store.incrementRetry('retry-test');
      const updated = store.getById('retry-test');
      expect(updated?.retryCount).toBe(1);
    });

    it('should not increment retry beyond max (3)', () => {
      const message = { ...createMockMessage('max-retry'), retryCount: 3 };
      store.add(message);

      store.incrementRetry('max-retry');
      const updated = store.getById('max-retry');
      expect(updated?.retryCount).toBe(3); // 不超过最大值
    });

    it('should get messages ready for retry', () => {
      store.add({ ...createMockMessage('retry-1'), retryCount: 0 });
      store.add({ ...createMockMessage('retry-2'), retryCount: 1 });
      store.add({ ...createMockMessage('retry-3'), retryCount: 3 }); // 已达最大值

      const retryable = store.getRetryable();
      expect(retryable.length).toBe(2); // retry-1 和 retry-2
    });
  });

  describe('清理过期消息', () => {
    it('should remove expired messages', () => {
      // 计算超过 24 小时的时间
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 小时前

      const expiredMessage = {
        ...createMockMessage('expired'),
        createdAt: expiredDate.toISOString(),
      };
      store.add(expiredMessage);

      store.add(createMockMessage('fresh'));

      const removedCount = store.cleanExpired(24 * 60 * 60 * 1000); // 24小时
      expect(removedCount).toBe(1);
      expect(store.getAll().length).toBe(1);
    });
  });

  describe('错误处理', () => {
    it('should handle corrupted JSON file gracefully', () => {
      fs.writeFileSync(TEST_STORE_PATH, 'invalid json content');

      // 应该不抛出错误，而是创建新的空存储
      const corruptedStore = new PendingMessageStore(TEST_STORE_PATH);
      expect(corruptedStore.getAll()).toEqual([]);
    });
  });
});