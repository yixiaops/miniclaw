/**
 * @fileoverview SimpleMemoryStorage 单元测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SimpleMemoryStorage } from '../../../../src/core/memory/simple.js';
import type { Message } from '../../../../src/core/memory/simple.js';
import { mkdtemp, rm, readFile, access } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SimpleMemoryStorage', () => {
  let storage: SimpleMemoryStorage;
  let tempDir: string;

  beforeEach(async () => {
    // 创建临时目录用于测试
    tempDir = await mkdtemp(join(tmpdir(), 'miniclaw-memory-test-'));
    storage = new SimpleMemoryStorage(tempDir);
  });

  afterEach(async () => {
    // 清理临时目录
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('save', () => {
    it('应该保存对话历史', async () => {
      const sessionKey = 'agent:main:main';
      const messages: Message[] = [
        { role: 'user', content: '你好' },
        { role: 'assistant', content: '你好！' }
      ];

      await storage.save(sessionKey, messages);

      // 验证文件已创建
      const loaded = await storage.load(sessionKey);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].role).toBe('user');
      expect(loaded[0].content).toBe('你好');
    });

    it('应该保存空消息列表', async () => {
      const sessionKey = 'agent:main:empty';
      const messages: Message[] = [];

      await storage.save(sessionKey, messages);

      const loaded = await storage.load(sessionKey);
      expect(loaded).toHaveLength(0);
    });

    it('应该覆盖已存在的对话历史', async () => {
      const sessionKey = 'agent:main:overwrite';
      const messages1: Message[] = [
        { role: 'user', content: '第一条' }
      ];
      const messages2: Message[] = [
        { role: 'user', content: '第二条' },
        { role: 'assistant', content: '回复' }
      ];

      await storage.save(sessionKey, messages1);
      await storage.save(sessionKey, messages2);

      const loaded = await storage.load(sessionKey);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].content).toBe('第二条');
    });
  });

  describe('load', () => {
    it('应该加载对话历史', async () => {
      const sessionKey = 'agent:main:load';
      const messages: Message[] = [
        { role: 'user', content: '问题' },
        { role: 'assistant', content: '回答' }
      ];

      await storage.save(sessionKey, messages);
      const loaded = await storage.load(sessionKey);

      expect(loaded).toHaveLength(2);
      expect(loaded[0].content).toBe('问题');
      expect(loaded[1].content).toBe('回答');
    });

    it('不存在的 Session 应该返回空数组', async () => {
      const loaded = await storage.load('agent:main:nonexistent');
      expect(loaded).toEqual([]);
    });
  });

  describe('delete', () => {
    it('应该删除对话历史', async () => {
      const sessionKey = 'agent:main:delete';
      const messages: Message[] = [
        { role: 'user', content: '要删除的消息' }
      ];

      await storage.save(sessionKey, messages);
      await storage.delete(sessionKey);

      const loaded = await storage.load(sessionKey);
      expect(loaded).toEqual([]);
    });

    it('删除不存在的 Session 应该静默处理', async () => {
      // 不应该抛出错误
      await expect(storage.delete('agent:main:nonexistent')).resolves.not.toThrow();
    });
  });

  describe('listSessions', () => {
    it('应该列出所有 Session', async () => {
      await storage.save('agent:main:session1', [{ role: 'user', content: '1' }]);
      await storage.save('agent:main:session2', [{ role: 'user', content: '2' }]);
      await storage.save('agent:main:session3', [{ role: 'user', content: '3' }]);

      const sessions = await storage.listSessions();

      expect(sessions.length).toBe(3);
      expect(sessions).toContain('agent:main:session1');
      expect(sessions).toContain('agent:main:session2');
      expect(sessions).toContain('agent:main:session3');
    });

    it('空存储应该返回空数组', async () => {
      const sessions = await storage.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('sessionKey 编码', () => {
    it('应该正确处理包含特殊字符的 sessionKey', async () => {
      const sessionKey = 'agent:main:channel:feishu:peer:ou_123';
      const messages: Message[] = [
        { role: 'user', content: '特殊字符测试' }
      ];

      await storage.save(sessionKey, messages);
      const loaded = await storage.load(sessionKey);

      expect(loaded).toHaveLength(1);
      expect(loaded[0].content).toBe('特殊字符测试');
    });
  });
});