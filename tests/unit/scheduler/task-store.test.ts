/**
 * TaskStore 单元测试
 *
 * 测试 JSON 文件持久化存储
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { ScheduledTask, TaskStatus } from '../../../src/scheduler/types.js';
import fs from 'fs';
import path from 'path';

// 测试用的临时存储路径
const TEST_STORE_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'test-tasks.json');

// Mock 任务数据
const createMockTask = (id: string): ScheduledTask => ({
  taskId: id,
  userId: 'test-user',
  channel: 'cli',
  content: '测试任务',
  summary: '测试',
  executeTime: '2026-05-16T09:00:00Z',
  taskType: 'one-time',
  actionType: 'reminder',
  status: 'pending',
  createdAt: '2026-05-15T10:00:00Z',
  retryCount: 0,
});

describe('TaskStore', () => {
  let store: TaskStore;

  beforeEach(() => {
    // 清理测试文件
    if (fs.existsSync(TEST_STORE_PATH)) {
      fs.unlinkSync(TEST_STORE_PATH);
    }
    store = new TaskStore(TEST_STORE_PATH);
  });

  afterEach(() => {
    // 清理测试文件
    if (fs.existsSync(TEST_STORE_PATH)) {
      fs.unlinkSync(TEST_STORE_PATH);
    }
  });

  describe('初始化', () => {
    it('should create empty store file if not exists', () => {
      const newStore = new TaskStore(TEST_STORE_PATH);
      expect(fs.existsSync(TEST_STORE_PATH)).toBe(true);
      const data = JSON.parse(fs.readFileSync(TEST_STORE_PATH, 'utf-8'));
      expect(data.tasks).toEqual([]);
    });

    it('should load existing tasks from file', () => {
      // 预写入测试数据
      const existingTasks = [createMockTask('existing-1')];
      fs.writeFileSync(TEST_STORE_PATH, JSON.stringify({ tasks: existingTasks }));

      const existingStore = new TaskStore(TEST_STORE_PATH);
      const tasks = existingStore.getAll();
      expect(tasks.length).toBe(1);
      expect(tasks[0].taskId).toBe('existing-1');
    });
  });

  describe('CRUD 操作', () => {
    it('should create and save a new task', () => {
      const task = createMockTask('new-task');
      const saved = store.create(task);

      expect(saved).toEqual(task);
      expect(store.getAll().length).toBe(1);

      // 验证持久化
      const data = JSON.parse(fs.readFileSync(TEST_STORE_PATH, 'utf-8'));
      expect(data.tasks.length).toBe(1);
    });

    it('should get task by taskId', () => {
      const task = createMockTask('get-test');
      store.create(task);

      const found = store.getById('get-test');
      expect(found).toBeDefined();
      expect(found?.taskId).toBe('get-test');
    });

    it('should return undefined for non-existent taskId', () => {
      const found = store.getById('non-existent');
      expect(found).toBeUndefined();
    });

    it('should update task status', () => {
      const task = createMockTask('update-test');
      store.create(task);

      const updated = store.update('update-test', { status: 'executed' });
      expect(updated).toBeDefined();
      expect(updated?.status).toBe('executed');

      // 验证持久化
      const found = store.getById('update-test');
      expect(found?.status).toBe('executed');
    });

    it('should delete task by taskId', () => {
      const task = createMockTask('delete-test');
      store.create(task);

      const deleted = store.delete('delete-test');
      expect(deleted).toBe(true);
      expect(store.getAll().length).toBe(0);
    });

    it('should return false when deleting non-existent task', () => {
      const deleted = store.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('查询操作', () => {
    beforeEach(() => {
      store.create({ ...createMockTask('user1-task1'), userId: 'user1' });
      store.create({ ...createMockTask('user1-task2'), userId: 'user1' });
      store.create({ ...createMockTask('user2-task1'), userId: 'user2' });
    });

    it('should filter tasks by userId', () => {
      const user1Tasks = store.getByUserId('user1');
      expect(user1Tasks.length).toBe(2);
      expect(user1Tasks.every(t => t.userId === 'user1')).toBe(true);
    });

    it('should filter tasks by status', () => {
      store.update('user1-task1', { status: 'executed' });
      const pendingTasks = store.getByStatus('pending');
      expect(pendingTasks.length).toBe(2);
    });

    it('should filter pending tasks for user', () => {
      store.update('user1-task1', { status: 'executed' });
      const user1Pending = store.getPendingByUserId('user1');
      expect(user1Pending.length).toBe(1);
    });
  });

  describe('去重检查', () => {
    it('should find similar task within time window', () => {
      const task1 = createMockTask('similar-1');
      task1.summary = '开会';
      task1.executeTime = '2026-05-16T09:00:00Z';
      store.create(task1);

      // 同一时间窗口内的相似任务
      const similarTime = '2026-05-16T09:15:00Z'; // 15分钟差异
      const existing = store.findSimilarTask('test-user', '开会', similarTime);
      expect(existing).toBeDefined();
    });

    it('should not find task outside time window', () => {
      const task1 = createMockTask('similar-2');
      task1.summary = '开会';
      task1.executeTime = '2026-05-16T09:00:00Z';
      store.create(task1);

      // 超出时间窗口（60分钟）
      const outsideTime = '2026-05-16T10:00:00Z';
      const existing = store.findSimilarTask('test-user', '开会', outsideTime);
      expect(existing).toBeUndefined();
    });
  });

  describe('错误处理', () => {
    it('should handle corrupted JSON file gracefully', () => {
      fs.writeFileSync(TEST_STORE_PATH, 'invalid json content');

      // 应该不抛出错误，而是创建新的空存储
      const corruptedStore = new TaskStore(TEST_STORE_PATH);
      expect(corruptedStore.getAll()).toEqual([]);
    });
  });
});