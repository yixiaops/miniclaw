/**
 * @fileoverview KnowledgeSearcher 单元测试
 * 
 * 测试知识库文件搜索功能
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { KnowledgeSearcher } from '../../../../src/core/memory/knowledge-searcher.js';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('KnowledgeSearcher', () => {
  let testDir: string;
  let memoryDir: string;
  let searcher: KnowledgeSearcher;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `miniclaw-test-${Date.now()}`);
    memoryDir = join(testDir, 'memory');
    searcher = new KnowledgeSearcher(memoryDir);
  });

  afterEach(async () => {
    // 清理测试目录
    await rm(testDir, { recursive: true, force: true });
  });

  describe('search()', () => {
    it('应该读取 .md 文件并搜索内容', async () => {
      // 准备：创建知识库文件
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'notes.md'), '# 笔记\n\n这是关于 ETF 的笔记内容。');

      // 执行
      const results = await searcher.search('ETF');

      // 验证
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toContain('ETF');
      expect(results[0].source).toBe('memory');
    });

    it('应该支持大小写不敏感搜索', async () => {
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'test.md'), '关键词是 Target');

      // 小写搜索
      const results = await searcher.search('target');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toContain('Target');
    });

    it('应该返回正确的行号（1-indexed）', async () => {
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'test.md'), '第一行\n第二行\n第三行有关键词 target\n第四行');

      const results = await searcher.search('target');

      expect(results.length).toBe(1);
      expect(results[0].startLine).toBe(3);
      expect(results[0].endLine).toBe(3);
    });

    it('应该搜索多个文件', async () => {
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'file1.md'), '关键词 test');
      await writeFile(join(memoryDir, 'file2.md'), '另一个 test');

      const results = await searcher.search('test');

      expect(results.length).toBe(2);
      expect(results[0].path).not.toBe(results[1].path);
    });

    it('应该忽略非 .md 文件', async () => {
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'notes.md'), '关键词 test');
      await writeFile(join(memoryDir, 'data.txt'), '另一个 test');

      const results = await searcher.search('test');

      // 只应该找到 .md 文件中的内容
      expect(results.length).toBe(1);
      expect(results[0].path).toContain('notes.md');
    });

    it('应该尊重 maxResults 限制', async () => {
      await mkdir(memoryDir, { recursive: true });
      await writeFile(join(memoryDir, 'test.md'), 'test\n'.repeat(10));

      const results = await searcher.search('test', { maxResults: 3 });

      expect(results.length).toBe(3);
    });

    it('应该处理空目录', async () => {
      // 目录不存在
      const results = await searcher.search('任何关键词');

      expect(results).toEqual([]);
    });

    it('应该自动创建目录（如果不存在）', async () => {
      // 执行搜索（会自动创建目录）
      await searcher.search('test');

      // 验证目录已创建
      const { existsSync } = await import('fs');
      expect(existsSync(memoryDir)).toBe(true);
    });
  });
});