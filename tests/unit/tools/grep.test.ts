/**
 * grep 工具测试
 */
import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { grepTool } from '../../../src/tools/grep';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';

describe('grepTool', () => {
  const testDir = join(tmpdir(), 'miniclaw-grep-test');

  // 检查 rg 是否可用
  let hasRg = false;
  beforeAll(async () => {
    try {
      execSync('rg --version', { encoding: 'utf-8' });
      hasRg = true;
    } catch {
      hasRg = false;
    }
  });

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    // 创建测试文件
    writeFileSync(join(testDir, 'file1.txt'), 'Hello World\nThis is a test file\nHello again');
    writeFileSync(join(testDir, 'file2.txt'), 'Another file\nWith different content\nNo hello here');
    writeFileSync(join(testDir, 'case.txt'), 'UPPERCASE\nlowercase\nMixedCase');
    mkdirSync(join(testDir, 'subdir'), { recursive: true });
    writeFileSync(join(testDir, 'subdir', 'nested.txt'), 'Nested file\nWith hello inside');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(grepTool.name).toBe('grep');
    });

    it('should have label and description', () => {
      expect(grepTool.label).toContain('搜索');
      expect(grepTool.description).toContain('ripgrep');
    });

    it('should have parameters schema', () => {
      expect(grepTool.parameters).toBeDefined();
      expect(grepTool.parameters.properties.pattern).toBeDefined();
      expect(grepTool.parameters.properties.path).toBeDefined();
      expect(grepTool.parameters.properties.output_mode).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should find matching content', async () => {
      if (!hasRg) {
        console.log('Skipping: rg not installed');
        return;
      }
      const result = await grepTool.execute('', {
        pattern: 'Hello',
        path: testDir,
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Hello');
      expect(result.details.matches).toBeGreaterThan(0);
    });

    it('should return files_with_matches mode', async () => {
      if (!hasRg) {
        console.log('Skipping: rg not installed');
        return;
      }
      const result = await grepTool.execute('', {
        pattern: 'Hello',
        path: testDir,
        output_mode: 'files_with_matches',
      });

      expect(result.content[0].text).toContain('file1.txt');
      expect(result.content[0].text).toContain('nested.txt');
    });

    it('should support case-insensitive search', async () => {
      if (!hasRg) {
        console.log('Skipping: rg not installed');
        return;
      }
      const result = await grepTool.execute('', {
        pattern: 'hello',
        path: join(testDir, 'case.txt'),
        '-i': true,
      });

      // 应该不区分大小写匹配
      expect(result.content[0].text.toLowerCase()).toContain('hello');
    });

    it('should support line numbers', async () => {
      if (!hasRg) {
        console.log('Skipping: rg not installed');
        return;
      }
      const result = await grepTool.execute('', {
        pattern: 'Hello',
        path: join(testDir, 'file1.txt'),
        '-n': true,
      });

      // 行号应该以数字:开头
      expect(result.content[0].text).toMatch(/\d+:/);
    });

    it('should support count mode', async () => {
      if (!hasRg) {
        console.log('Skipping: rg not installed');
        return;
      }
      const result = await grepTool.execute('', {
        pattern: 'Hello',
        path: testDir,
        output_mode: 'count',
      });

      expect(result.content[0].text).toMatch(/\d+/);
    });

    it('should support glob filter', async () => {
      if (!hasRg) {
        console.log('Skipping: rg not installed');
        return;
      }
      const result = await grepTool.execute('', {
        pattern: 'Hello',
        path: testDir,
        glob: '*.txt',
      });

      expect(result.details.matches).toBeGreaterThan(0);
    });

    it('should limit output with head_limit', async () => {
      const result = await grepTool.execute('', {
        pattern: '.*', // 匹配所有行
        path: join(testDir, 'file1.txt'),
        head_limit: 1,
      });

      // 应该只有一行（或包含截断提示）
      const lines = result.content[0].text.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
    });

    it('should return not found for no matches', async () => {
      const result = await grepTool.execute('', {
        pattern: 'NonExistentPattern12345',
        path: testDir,
      });

      expect(result.content[0].text).toContain('未找到匹配内容');
      expect(result.details.matches).toBe(0);
    });

    it('should handle invalid path gracefully', async () => {
      const result = await grepTool.execute('', {
        pattern: 'test',
        path: '/nonexistent/path',
      });

      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should work without path parameter (uses cwd)', async () => {
      const result = await grepTool.execute('', {
        pattern: 'test',
      });

      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should return details with pattern and path', async () => {
      const result = await grepTool.execute('', {
        pattern: 'Hello',
        path: testDir,
      });

      expect(result.details.pattern).toBe('Hello');
      expect(result.details.path).toBe(testDir);
    });

    it('should handle special characters in pattern', async () => {
      if (!hasRg) {
        console.log('Skipping: rg not installed');
        return;
      }
      writeFileSync(join(testDir, 'special.txt'), 'test [value] here');

      const result = await grepTool.execute('', {
        pattern: '\\[value\\]',
        path: join(testDir, 'special.txt'),
      });

      expect(result.details.matches).toBeGreaterThan(0);
    });
  });
});