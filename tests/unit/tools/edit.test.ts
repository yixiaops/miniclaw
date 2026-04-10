/**
 * edit 工具测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { editTool } from '../../../src/tools/edit';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('editTool', () => {
  const testDir = join(tmpdir(), 'miniclaw-edit-test');

  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(editTool.name).toBe('edit');
    });

    it('should have label and description', () => {
      expect(editTool.label).toContain('编辑');
      expect(editTool.description).toContain('替换');
    });

    it('should have parameters schema', () => {
      expect(editTool.parameters).toBeDefined();
      expect(editTool.parameters.properties.path).toBeDefined();
      expect(editTool.parameters.properties.old_string).toBeDefined();
      expect(editTool.parameters.properties.new_string).toBeDefined();
      expect(editTool.parameters.properties.replace_all).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should replace single occurrence', async () => {
      const testFile = join(testDir, 'single.txt');
      writeFileSync(testFile, 'Hello Universe\nThis is a test\nGoodbye Galaxy');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'Hello Universe',
        new_string: 'Hello World',
      });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('已替换');
      expect(result.details.replacements).toBe(1);

      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('Hello World\nThis is a test\nGoodbye Galaxy');
    });

    it('should replace with replace_all option', async () => {
      const testFile = join(testDir, 'multiple.txt');
      writeFileSync(testFile, 'World World World');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'World',
        new_string: 'Universe',
        replace_all: true,
      });

      expect(result.details.replacements).toBe(3);

      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('Universe Universe Universe');
    });

    it('should return error for multiple matches without replace_all', async () => {
      const testFile = join(testDir, 'multi-error.txt');
      writeFileSync(testFile, 'abc abc abc');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'abc',
        new_string: 'replaced',
      });

      expect(result.content[0].text).toContain('匹配');
      expect(result.details.replacements).toBe(0);
    });

    it('should return error for non-existent old_string', async () => {
      const testFile = join(testDir, 'notfound.txt');
      writeFileSync(testFile, 'Hello World');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'NonExistent',
        new_string: 'Replaced',
      });

      expect(result.content[0].text).toContain('未找到');
      expect(result.details.replacements).toBe(0);
    });

    it('should handle non-existent file', async () => {
      const result = await editTool.execute('', {
        path: join(testDir, 'nonexistent.txt'),
        old_string: 'test',
        new_string: 'replaced',
      });

      expect(result.content[0].text).toContain('失败');
      expect(result.details.replacements).toBe(0);
    });

    it('should handle multi-line replacement', async () => {
      const testFile = join(testDir, 'multiline.txt');
      writeFileSync(testFile, 'Line 1\nOld Block\nLine 2\nLine 3');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'Old Block\nLine 2',
        new_string: 'New Block\nModified',
      });

      expect(result.details.replacements).toBe(1);

      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('Line 1\nNew Block\nModified\nLine 3');
    });

    it('should handle special characters', async () => {
      const testFile = join(testDir, 'special.txt');
      writeFileSync(testFile, 'Test $100 [value] here');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: '$100 [value]',
        new_string: '€200 [replaced]',
      });

      expect(result.details.replacements).toBe(1);

      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('Test €200 [replaced] here');
    });

    it('should handle UTF-8 content', async () => {
      const testFile = join(testDir, 'utf8.txt');
      writeFileSync(testFile, '你好世界！🌍');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: '你好',
        new_string: '您好',
      });

      expect(result.details.replacements).toBe(1);

      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('您好世界！🌍');
    });

    it('should handle empty replacement (deletion)', async () => {
      const testFile = join(testDir, 'delete.txt');
      writeFileSync(testFile, 'Hello DELETE World');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'DELETE ',
        new_string: '',
      });

      expect(result.details.replacements).toBe(1);

      const content = readFileSync(testFile, 'utf-8');
      expect(content).toBe('Hello World');
    });

    it('should truncate long old_string in output', async () => {
      const testFile = join(testDir, 'long.txt');
      const longText = 'A'.repeat(200);
      writeFileSync(testFile, `${longText} World`);

      const result = await editTool.execute('', {
        path: testFile,
        old_string: longText,
        new_string: 'Hello',
      });

      expect(result.content[0].text).toContain('...');
      expect(result.details.replacements).toBe(1);
    });

    it('should truncate long new_string in output', async () => {
      const testFile = join(testDir, 'long-new.txt');
      writeFileSync(testFile, 'Old text');

      const longReplacement = 'B'.repeat(200);
      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'Old text',
        new_string: longReplacement,
      });

      expect(result.content[0].text).toContain('...');
      expect(result.details.replacements).toBe(1);
    });

    it('should handle exact match (unique)', async () => {
      const testFile = join(testDir, 'unique.txt');
      writeFileSync(testFile, 'function test() { return "test"; }');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'function test() { return "test"; }',
        new_string: 'function test() { return "modified"; }',
      });

      expect(result.details.replacements).toBe(1);
      expect(readFileSync(testFile, 'utf-8')).toBe('function test() { return "modified"; }');
    });

    it('should return details with path', async () => {
      const testFile = join(testDir, 'details.txt');
      writeFileSync(testFile, 'test content');

      const result = await editTool.execute('', {
        path: testFile,
        old_string: 'test',
        new_string: 'modified',
      });

      expect(result.details.path).toBe(testFile);
    });
  });
});