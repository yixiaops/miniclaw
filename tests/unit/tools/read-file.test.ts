/**
 * 文件读取工具测试
 * 测试 read_file 工具的各项功能
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileTool } from '../../../src/tools/read-file';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('readFileTool', () => {
  const testDir = join(tmpdir(), 'miniclaw-test-read');
  
  // 测试前创建临时目录
  beforeEach(() => {
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
  });
  
  // 测试后清理临时目录
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
      
      // 执行读取操作
      const result = await readFileTool.execute('', { path: testFile });
      
      // 验证返回结构
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Hello, Miniclaw!');
      expect(result.details.path).toBe(testFile);
    });

    it('should return error for non-existent file', async () => {
      // 读取不存在的文件
      const result = await readFileTool.execute('', { path: '/non/existent/file.txt' });
      
      // 验证返回错误消息
      expect(result.content[0].text).toContain('文件不存在');
    });

    it('should read multi-line file', async () => {
      const testFile = join(testDir, 'multiline.txt');
      writeFileSync(testFile, 'Line 1\nLine 2\nLine 3');
      
      // 执行读取操作
      const result = await readFileTool.execute('', { path: testFile });
      
      // 验证多行内容正确读取
      expect(result.content[0].text).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should handle UTF-8 content', async () => {
      const testFile = join(testDir, 'utf8.txt');
      writeFileSync(testFile, '你好，世界！🌍');
      
      // 执行读取操作
      const result = await readFileTool.execute('', { path: testFile });
      
      // 验证 UTF-8 内容正确读取
      expect(result.content[0].text).toBe('你好，世界！🌍');
    });
  });
});