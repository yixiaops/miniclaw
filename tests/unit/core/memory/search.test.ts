/**
 * @fileoverview MemorySearchManager 单元测试
 * 
 * 测试记忆搜索管理器
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySearchManager } from '../../../../src/core/memory/search.js';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('MemorySearchManager', () => {
  let testDir: string;
  let manager: MemorySearchManager;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `miniclaw-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    manager = new MemorySearchManager(testDir);
  });

  afterEach(async () => {
    // 清理测试目录
    await rm(testDir, { recursive: true, force: true });
  });

  describe('search()', () => {
    it('应该搜索 sessions 和 memory 两个来源', async () => {
      // 准备：创建 session 文件
      const sessionsDir = join(testDir, 'sessions');
      await mkdir(sessionsDir, { recursive: true });
      await writeFile(
        join(sessionsDir, 'session-1.json'),
        JSON.stringify({
          sessionKey: 'session-1',
          messages: [{ role: 'user', content: 'session 中的 ETF 关键词' }],
          updatedAt: new Date().toISOString()
        })
      );

      // 准备：创建 memory 文件
      const memoryDir = join(testDir, 'memory');
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'notes.md'), 'memory 中的 ETF 关键词');

      // 执行
      const results = await manager.search('ETF');

      // 验证：两个来源都有结果
      expect(results.length).toBeGreaterThanOrEqual(2);
      const sources = results.map(r => r.source);
      expect(sources).toContain('sessions');
      expect(sources).toContain('memory');
    });

    it('应该支持只搜索 sessions', async () => {
      const sessionsDir = join(testDir, 'sessions');
      await mkdir(sessionsDir, { recursive: true });
      await writeFile(
        join(sessionsDir, 'session-1.json'),
        JSON.stringify({
          sessionKey: 'session-1',
          messages: [{ role: 'user', content: '关键词 test' }],
          updatedAt: new Date().toISOString()
        })
      );

      const memoryDir = join(testDir, 'memory');
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'notes.md'), '另一个 test');

      const results = await manager.search('test', { sources: ['sessions'] });

      expect(results.length).toBe(1);
      expect(results[0].source).toBe('sessions');
    });

    it('应该支持只搜索 memory', async () => {
      const sessionsDir = join(testDir, 'sessions');
      await mkdir(sessionsDir, { recursive: true });
      await writeFile(
        join(sessionsDir, 'session-1.json'),
        JSON.stringify({
          sessionKey: 'session-1',
          messages: [{ role: 'user', content: '关键词 test' }],
          updatedAt: new Date().toISOString()
        })
      );

      const memoryDir = join(testDir, 'memory');
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'notes.md'), '另一个 test');

      const results = await manager.search('test', { sources: ['memory'] });

      expect(results.length).toBe(1);
      expect(results[0].source).toBe('memory');
    });

    it('应该尊重 maxResults 限制', async () => {
      const memoryDir = join(testDir, 'memory');
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'test.md'), 'test\n'.repeat(20));

      const results = await manager.search('test', { maxResults: 5 });

      expect(results.length).toBe(5);
    });

    it('应该处理空目录', async () => {
      const results = await manager.search('任何关键词');

      expect(results).toEqual([]);
    });
  });

  describe('readFile()', () => {
    it('应该读取文件内容', async () => {
      const memoryDir = join(testDir, 'memory');
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'test.md'), '第一行\n第二行\n第三行');

      const result = await manager.readFile({ path: 'memory/test.md' });

      expect(result.text).toBe('第一行\n第二行\n第三行');
      expect(result.path).toBe('memory/test.md');
    });

    it('应该支持分页读取（from）', async () => {
      const memoryDir = join(testDir, 'memory');
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'test.md'), '第一行\n第二行\n第三行\n第四行');

      const result = await manager.readFile({ path: 'memory/test.md', from: 2 });

      expect(result.text).toBe('第二行\n第三行\n第四行');
    });

    it('应该支持分页读取（lines）', async () => {
      const memoryDir = join(testDir, 'memory');
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'test.md'), '第一行\n第二行\n第三行\n第四行');

      const result = await manager.readFile({ path: 'memory/test.md', from: 2, lines: 2 });

      expect(result.text).toBe('第二行\n第三行');
    });

    it('应该拒绝路径遍历攻击', async () => {
      await expect(
        manager.readFile({ path: '../etc/passwd' })
      ).rejects.toThrow('Invalid path');
    });

    it('应该处理不存在的文件', async () => {
      await expect(
        manager.readFile({ path: 'memory/not-exist.md' })
      ).rejects.toThrow();
    });
  });
});