/**
 * @fileoverview SimpleMemoryStorage 单元测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SimpleMemoryStorage } from '../../../../src/core/memory/simple.js';
import type { Message } from '../../../../src/core/memory/simple.js';
import { SessionCompressor } from '../../../../src/memory/session/compressor.js';
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

  describe('压缩触发', () => {
    it('should trigger compression on load if messages > threshold', async () => {
      // 创建 Mock Compressor
      const mockCompressor = {
        compress: vi.fn().mockImplementation(async (session: { messages: Message[] }) => {
          // 模拟压缩：保留最近 50 条
          return {
            messages: session.messages.slice(-50)
          };
        })
      } as unknown as SessionCompressor;

      // 创建带压缩器的存储实例（阈值 200）
      const storageWithCompressor = new SimpleMemoryStorage(tempDir, {
        compressor: mockCompressor,
        compressionThreshold: 200
      });

      // 创建超过阈值的消息（250 条）
      const sessionKey = 'agent:main:compress-test';
      const messages: Message[] = [];
      for (let i = 0; i < 250; i++) {
        messages.push({ role: 'user', content: `消息 ${i}` });
      }

      // 先保存
      await storageWithCompressor.save(sessionKey, messages);

      // 加载（应该触发压缩）
      const loaded = await storageWithCompressor.load(sessionKey);

      // 验证压缩器被调用
      expect(mockCompressor.compress).toHaveBeenCalledTimes(1);
      expect(loaded.length).toBe(50); // 压缩后保留 50 条
    });

    it('should write compressed session back to file', async () => {
      const mockCompressor = {
        compress: vi.fn().mockImplementation(async (session: { messages: Message[] }) => {
          // 模拟压缩：保留最近 50 条
          return {
            messages: session.messages.slice(-50)
          };
        })
      } as unknown as SessionCompressor;

      const storageWithCompressor = new SimpleMemoryStorage(tempDir, {
        compressor: mockCompressor,
        compressionThreshold: 200
      });

      const sessionKey = 'agent:main:compress-write';
      const messages: Message[] = [];
      for (let i = 0; i < 250; i++) {
        messages.push({ role: 'user', content: `消息 ${i}` });
      }

      await storageWithCompressor.save(sessionKey, messages);
      await storageWithCompressor.load(sessionKey);

      // 再次加载，验证文件已更新（压缩后的内容）
      // 需要重置 mock
      mockCompressor.compress.mockClear();

      const loadedAgain = await storageWithCompressor.load(sessionKey);

      // 第一次加载已经写回压缩后的数据，第二次加载不会触发压缩（只有 50 条）
      expect(mockCompressor.compress).not.toHaveBeenCalled();
      expect(loadedAgain.length).toBe(50);
    });

    it('should not compress on load if messages <= threshold', async () => {
      const mockCompressor = {
        compress: vi.fn()
      } as unknown as SessionCompressor;

      const storageWithCompressor = new SimpleMemoryStorage(tempDir, {
        compressor: mockCompressor,
        compressionThreshold: 200
      });

      const sessionKey = 'agent:main:no-compress';
      const messages: Message[] = [];
      for (let i = 0; i < 100; i++) {
        messages.push({ role: 'user', content: `消息 ${i}` });
      }

      await storageWithCompressor.save(sessionKey, messages);
      const loaded = await storageWithCompressor.load(sessionKey);

      // 不应该触发压缩
      expect(mockCompressor.compress).not.toHaveBeenCalled();
      expect(loaded.length).toBe(100);
    });
  });
});