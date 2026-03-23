/**
 * @fileoverview memory_get 工具测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { memoryGetTool } from '../../../src/tools/memory-get';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('memory_get tool', () => {
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
    expect(memoryGetTool.name).toBe('memory_get');
  });

  it('应该有工具描述', () => {
    expect(memoryGetTool.description).toBeTruthy();
    expect(memoryGetTool.description.length).toBeGreaterThan(10);
  });

  it('应该读取文件内容', async () => {
    const memoryDir = join(testDir, 'memory');
    await mkdir(memoryDir, { recursive: true });
    await writeFile(join(memoryDir, 'test.md'), '第一行\n第二行\n第三行');

    const result = await memoryGetTool.execute('tool-call-1', { 
      path: 'memory/test.md' 
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('第一行\n第二行\n第三行');
  });

  it('应该支持分页读取（from）', async () => {
    const memoryDir = join(testDir, 'memory');
    await mkdir(memoryDir, { recursive: true });
    await writeFile(join(memoryDir, 'test.md'), '第一行\n第二行\n第三行\n第四行');

    const result = await memoryGetTool.execute('tool-call-1', { 
      path: 'memory/test.md',
      from: 2
    });

    expect(result.content[0].text).toBe('第二行\n第三行\n第四行');
  });

  it('应该支持分页读取（lines）', async () => {
    const memoryDir = join(testDir, 'memory');
    await mkdir(memoryDir, { recursive: true });
    await writeFile(join(memoryDir, 'test.md'), '第一行\n第二行\n第三行\n第四行');

    const result = await memoryGetTool.execute('tool-call-1', { 
      path: 'memory/test.md',
      from: 2,
      lines: 2
    });

    expect(result.content[0].text).toBe('第二行\n第三行');
  });

  it('应该拒绝路径遍历攻击', async () => {
    const result = await memoryGetTool.execute('tool-call-1', { path: '../etc/passwd' });
    
    expect(result.content[0].text).toContain('错误');
    expect(result.details.error).toContain('Invalid path');
  });
});