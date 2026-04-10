/**
 * ls 工具测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { lsTool } from '../../../src/tools/ls';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('lsTool', () => {
  const testDir = join(tmpdir(), 'miniclaw-ls-test');

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    // 创建测试结构
    mkdirSync(join(testDir, 'subdir1'), { recursive: true });
    mkdirSync(join(testDir, 'subdir2'), { recursive: true });
    writeFileSync(join(testDir, 'file1.txt'), 'content1');
    writeFileSync(join(testDir, 'file2.js'), 'content2');
    writeFileSync(join(testDir, 'subdir1', 'nested.txt'), 'nested');
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(lsTool.name).toBe('ls');
    });

    it('should have label and description', () => {
      expect(lsTool.label).toContain('目录');
      expect(lsTool.description).toContain('列出');
    });

    it('should have parameters schema', () => {
      expect(lsTool.parameters).toBeDefined();
      expect(lsTool.parameters.properties.path).toBeDefined();
      expect(lsTool.parameters.properties.ignore).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should list directory contents', async () => {
      const result = await lsTool.execute('', {
        path: testDir,
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('file1.txt');
      expect(result.content[0].text).toContain('file2.js');
      expect(result.content[0].text).toContain('subdir1');
      expect(result.content[0].text).toContain('subdir2');
      expect(result.details.count).toBe(4);
      expect(result.details.directories).toBe(2);
      expect(result.details.files).toBe(2);
    });

    it('should show directories first then files', async () => {
      const result = await lsTool.execute('', {
        path: testDir,
      });

      const text = result.content[0].text;
      const lines = text.split('\n');

      // 找到文件和目录的位置
      let lastDirIndex = -1;
      let firstFileIndex = -1;

      lines.forEach((line, index) => {
        if (line.includes('📁')) lastDirIndex = index;
        if (line.includes('📄') && firstFileIndex === -1) firstFileIndex = index;
      });

      // 目录应该在文件之前
      if (lastDirIndex !== -1 && firstFileIndex !== -1) {
        expect(lastDirIndex).toBeLessThan(firstFileIndex);
      }
    });

    it('should show directory icons', async () => {
      const result = await lsTool.execute('', {
        path: testDir,
      });

      expect(result.content[0].text).toContain('📁');
    });

    it('should show file icons', async () => {
      const result = await lsTool.execute('', {
        path: testDir,
      });

      expect(result.content[0].text).toContain('📄');
    });

    it('should show file sizes', async () => {
      const result = await lsTool.execute('', {
        path: testDir,
      });

      // 文件大小应该显示（例如 "8 B"）
      expect(result.content[0].text).toMatch(/\d+ B/);
    });

    it('should show modification dates', async () => {
      const result = await lsTool.execute('', {
        path: testDir,
      });

      // 日期格式应该包含年月日
      expect(result.content[0].text).toMatch(/\d{4}/);
    });

    it('should ignore specified patterns', async () => {
      mkdirSync(join(testDir, 'node_modules'), { recursive: true });
      mkdirSync(join(testDir, '.git'), { recursive: true });

      const result = await lsTool.execute('', {
        path: testDir,
        ignore: ['node_modules', '.git'],
      });

      expect(result.content[0].text).not.toContain('node_modules');
      expect(result.content[0].text).not.toContain('.git');
    });

    it('should use default ignore patterns', async () => {
      mkdirSync(join(testDir, 'node_modules'), { recursive: true });
      mkdirSync(join(testDir, '.git'), { recursive: true });
      mkdirSync(join(testDir, 'dist'), { recursive: true });

      const result = await lsTool.execute('', {
        path: testDir,
      });

      // 默认忽略 node_modules, .git, dist
      expect(result.content[0].text).not.toContain('node_modules');
      expect(result.content[0].text).not.toContain('.git');
      expect(result.content[0].text).not.toContain('dist');
    });

    it('should handle non-existent directory', async () => {
      const result = await lsTool.execute('', {
        path: '/nonexistent/path/that/does/not/exist',
      });

      expect(result.content[0].text).toContain('失败');
      expect(result.details.count).toBe(0);
    });

    it('should handle empty directory', async () => {
      const emptyDir = join(testDir, 'empty');
      mkdirSync(emptyDir, { recursive: true });

      const result = await lsTool.execute('', {
        path: emptyDir,
      });

      expect(result.details.count).toBe(0);
      expect(result.details.files).toBe(0);
      expect(result.details.directories).toBe(0);
    });

    it('should return details with path', async () => {
      const result = await lsTool.execute('', {
        path: testDir,
      });

      expect(result.details.path).toBe(testDir);
    });
  });
});