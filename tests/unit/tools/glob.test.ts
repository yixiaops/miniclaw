/**
 * glob 工具测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { globTool } from '../../../src/tools/glob';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('globTool', () => {
  const testDir = join(tmpdir(), 'miniclaw-glob-test');

  beforeEach(() => {
    // 创建测试目录结构
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    // 创建测试文件
    writeFileSync(join(testDir, 'file1.ts'), 'content1');
    writeFileSync(join(testDir, 'file2.ts'), 'content2');
    writeFileSync(join(testDir, 'file.js'), 'content3');
    mkdirSync(join(testDir, 'subdir'), { recursive: true });
    writeFileSync(join(testDir, 'subdir', 'nested.ts'), 'nested');
    writeFileSync(join(testDir, 'subdir', 'nested.js'), 'nested-js');

    // 等待文件系统同步
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(globTool.name).toBe('glob');
    });

    it('should have label and description', () => {
      expect(globTool.label).toContain('搜索');
      expect(globTool.description).toContain('glob');
    });

    it('should have parameters schema', () => {
      expect(globTool.parameters).toBeDefined();
      expect(globTool.parameters.properties.pattern).toBeDefined();
      expect(globTool.parameters.properties.path).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should find files matching pattern', async () => {
      const result = await globTool.execute('', {
        pattern: '**/*.ts',
        path: testDir,
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('file1.ts');
      expect(result.content[0].text).toContain('file2.ts');
      expect(result.content[0].text).toContain('nested.ts');
      expect(result.details.count).toBe(3);
    });

    it('should find files in current directory only', async () => {
      const result = await globTool.execute('', {
        pattern: '*.ts',
        path: testDir,
      });

      expect(result.details.count).toBe(2); // file1.ts, file2.ts
      expect(result.content[0].text).toContain('file1.ts');
      expect(result.content[0].text).not.toContain('nested.ts');
    });

    it('should find js files', async () => {
      const result = await globTool.execute('', {
        pattern: '**/*.js',
        path: testDir,
      });

      expect(result.details.count).toBe(2);
    });

    it('should return empty result for no matches', async () => {
      const result = await globTool.execute('', {
        pattern: '**/*.nonexistent',
        path: testDir,
      });

      expect(result.details.count).toBe(0);
      expect(result.content[0].text).toContain('未找到匹配文件');
    });

    it('should work without path parameter (uses cwd)', async () => {
      const result = await globTool.execute('', {
        pattern: '*.json',
      });

      // 应该在 cwd 中查找
      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should ignore node_modules by default', async () => {
      // 创建 node_modules 目录
      mkdirSync(join(testDir, 'node_modules'), { recursive: true });
      writeFileSync(join(testDir, 'node_modules', 'ignored.ts'), 'should be ignored');

      const result = await globTool.execute('', {
        pattern: '**/*.ts',
        path: testDir,
      });

      expect(result.content[0].text).not.toContain('node_modules');
    });

    it('should ignore .git by default', async () => {
      mkdirSync(join(testDir, '.git'), { recursive: true });
      writeFileSync(join(testDir, '.git', 'config.ts'), 'should be ignored');

      const result = await globTool.execute('', {
        pattern: '**/*.ts',
        path: testDir,
      });

      expect(result.content[0].text).not.toContain('.git');
    });

    it('should handle invalid path gracefully', async () => {
      const result = await globTool.execute('', {
        pattern: '**/*.ts',
        path: '/nonexistent/path/that/does/not/exist',
      });

      // 应该返回错误或空结果，而不是抛出异常
      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });

    it('should return details with pattern and path', async () => {
      const result = await globTool.execute('', {
        pattern: '*.ts',
        path: testDir,
      });

      expect(result.details.pattern).toBe('*.ts');
      expect(result.details.path).toBe(testDir);
      expect(result.details.count).toBe(2);
    });
  });
});