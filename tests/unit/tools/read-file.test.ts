/**
 * 文件读取工具测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileTool } from '../../../src/tools/read-file';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('readFileTool', () => {
  const testDir = join(tmpdir(), 'miniclaw-test-read');
  
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
      expect(readFileTool.name).toBe('read_file');
    });

    it('should have description', () => {
      expect(readFileTool.description).toContain('读取');
    });

    it('should have parameters schema', () => {
      expect(readFileTool.parameters).toBeDefined();
      expect(readFileTool.parameters.type).toBe('object');
      expect(readFileTool.parameters.properties.path).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should read file content successfully', async () => {
      const testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'Hello, Miniclaw!');
      
      const result = await readFileTool.execute({ path: testFile });
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello, Miniclaw!');
    });

    it('should return error for non-existent file', async () => {
      const result = await readFileTool.execute({ path: '/non/existent/file.txt' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('文件不存在');
    });

    it('should read multi-line file', async () => {
      const testFile = join(testDir, 'multiline.txt');
      writeFileSync(testFile, 'Line 1\nLine 2\nLine 3');
      
      const result = await readFileTool.execute({ path: testFile });
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle UTF-8 content', async () => {
      const testFile = join(testDir, 'utf8.txt');
      writeFileSync(testFile, '你好，世界！🌍');
      
      const result = await readFileTool.execute({ path: testFile });
      
      expect(result.success).toBe(true);
      expect(result.content).toBe('你好，世界！🌍');
    });
  });
});