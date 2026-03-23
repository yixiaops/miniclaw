/**
 * @fileoverview memory_search 工具测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { memorySearchTool } from '../../../src/tools/memory-search';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('memory_search tool', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `miniclaw-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
    process.env.MINICLAW_TEST_DIR = testDir;
  });

  afterEach(async () => {
    delete process.env.MINICLAW_TEST_DIR;
    await rm(testDir, { recursive: true, force: true });
  });

  it('应该有正确的工具名称', () => {
    expect(memorySearchTool.name).toBe('memory_search');
  });

  it('应该有工具描述', () => {
    expect(memorySearchTool.description).toBeTruthy();
    expect(memorySearchTool.description.length).toBeGreaterThan(10);
  });

  it('应该返回搜索结果', async () => {
    // 准备测试数据
    const memoryDir = join(testDir, 'memory');
    await mkdir(memoryDir, { recursive: true });
    await writeFile(join(memoryDir, 'test.md'), '这是关于 ETF 的笔记');

    const result = await memorySearchTool.execute('tool-call-1', { query: 'ETF' });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    
    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('应该返回空数组当没有匹配', async () => {
    const result = await memorySearchTool.execute('tool-call-1', { query: '不存在的关键词' });

    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed).toEqual([]);
  });

  it('应该尊重 maxResults 参数', async () => {
    const memoryDir = join(testDir, 'memory');
    await mkdir(memoryDir, { recursive: true });
    await writeFile(join(memoryDir, 'test.md'), 'test\n'.repeat(20));

    const result = await memorySearchTool.execute('tool-call-1', { 
      query: 'test', 
      maxResults: 5 
    });

    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.length).toBeLessThanOrEqual(5);
  });
});