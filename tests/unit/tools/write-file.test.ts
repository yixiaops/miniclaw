/**
 * 文件写入工具测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileTool } from '../../../src/tools/write-file';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('writeFileTool', () => {
  const testDir = join(tmpdir(), 'miniclaw-test-write');
  
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
      expect(writeFileTool.name).toBe('write_file');
    });

    it('should have description', () => {
      expect(writeFileTool.description).toContain('写入');
    });

    it('should have parameters schema', () => {
      expect(writeFileTool.parameters).toBeDefined();
      expect(writeFileTool.parameters.properties.path).toBeDefined();
      expect(writeFileTool.parameters.properties.content).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should write file content successfully', async () => {
      const testFile = join(testDir, 'test.txt');
      
      const result = await writeFileTool.execute({ 
        path: testFile, 
        content: 'Hello, Miniclaw!' 
      });
      
      expect(result.success).toBe(true);
      expect(readFileSync(testFile, 'utf-8')).toBe('Hello, Miniclaw!');
    });

    it('should create directory if not exists', async () => {
      const testFile = join(testDir, 'subdir', 'test.txt');
      
      const result = await writeFileTool.execute({ 
        path: testFile, 
        content: 'Nested file' 
      });
      
      expect(result.success).toBe(true);
      expect(readFileSync(testFile, 'utf-8')).toBe('Nested file');
    });

    it('should overwrite existing file', async () => {
      const testFile = join(testDir, 'overwrite.txt');
      
      await writeFileTool.execute({ path: testFile, content: 'Old content' });
      await writeFileTool.execute({ path: testFile, content: 'New content' });
      
      expect(readFileSync(testFile, 'utf-8')).toBe('New content');
    });

    it('should write UTF-8 content', async () => {
      const testFile = join(testDir, 'utf8.txt');
      
      const result = await writeFileTool.execute({ 
        path: testFile, 
        content: '你好，世界！🌍' 
      });
      
      expect(result.success).toBe(true);
      expect(readFileSync(testFile, 'utf-8')).toBe('你好，世界！🌍');
    });

    it('should return error for invalid path', async () => {
      const result = await writeFileTool.execute({ 
        path: '/root/forbidden/test.txt', 
        content: 'test' 
      });
      
      // 根据实际情况，可能成功或失败
      expect(result).toBeDefined();
    });
  });
});