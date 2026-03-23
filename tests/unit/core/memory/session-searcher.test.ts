/**
 * @fileoverview SessionSearcher 单元测试
 * 
 * 测试对话历史搜索功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionSearcher } from '../../../../src/core/memory/session-searcher.js';
import { SimpleMemoryStorage } from '../../../../src/core/memory/simple.js';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SessionSearcher', () => {
  let testDir: string;
  let storage: SimpleMemoryStorage;
  let searcher: SessionSearcher;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `miniclaw-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    
    const sessionsDir = join(testDir, 'sessions');
    storage = new SimpleMemoryStorage(sessionsDir);
    searcher = new SessionSearcher(storage);
  });

  afterEach(async () => {
    // 清理测试目录
    await rm(testDir, { recursive: true, force: true });
  });

  describe('search()', () => {
    it('应该使用 SimpleMemoryStorage 加载消息', async () => {
      // 准备：保存一些测试消息
      await storage.save('session-1', [
        { role: 'user', content: '你好，我想了解 ETF' },
        { role: 'assistant', content: 'ETF 是交易型开放式指数基金' }
      ]);

      // 执行：搜索关键词
      const results = await searcher.search('ETF');

      // 验证：返回匹配结果
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toContain('ETF');
      expect(results[0].source).toBe('sessions');
    });

    it('应该支持大小写不敏感搜索', async () => {
      await storage.save('session-1', [
        { role: 'user', content: 'ETF 是什么' }
      ]);

      // 小写搜索
      const results = await searcher.search('etf');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toContain('ETF');
    });

    it('应该返回正确的 snippet', async () => {
      await storage.save('session-1', [
        { role: 'user', content: '第一行' },
        { role: 'assistant', content: '第二行包含关键词 target' },
        { role: 'user', content: '第三行' }
      ]);

      const results = await searcher.search('target');

      expect(results.length).toBe(1);
      expect(results[0].snippet).toBe('第二行包含关键词 target');
    });

    it('应该尊重 maxResults 限制', async () => {
      await storage.save('session-1', [
        { role: 'user', content: '关键词 test' },
        { role: 'assistant', content: '关键词 test' },
        { role: 'user', content: '关键词 test' },
        { role: 'assistant', content: '关键词 test' },
        { role: 'user', content: '关键词 test' }
      ]);

      const results = await searcher.search('test', { maxResults: 3 });

      expect(results.length).toBe(3);
    });

    it('应该支持按 sessionKey 过滤', async () => {
      await storage.save('session-1', [
        { role: 'user', content: '关键词 target' }
      ]);
      await storage.save('session-2', [
        { role: 'user', content: '另一个 target' }
      ]);

      const results = await searcher.search('target', { sessionKey: 'session-1' });

      expect(results.length).toBe(1);
      expect(results[0].path).toContain('session-1');
    });

    it('应该处理空的 session 列表', async () => {
      const results = await searcher.search('任何关键词');

      expect(results).toEqual([]);
    });

    it('应该处理没有匹配的情况', async () => {
      await storage.save('session-1', [
        { role: 'user', content: '你好世界' }
      ]);

      const results = await searcher.search('不存在的关键词');

      expect(results).toEqual([]);
    });
  });
});