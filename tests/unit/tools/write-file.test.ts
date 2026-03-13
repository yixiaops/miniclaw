/**
 * 文件写入工具测试
 * 测试 write_file 工具的各项功能
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileTool } from '../../../src/tools/write-file';
import { readFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('writeFileTool', () => {
  const testDir = join(tmpdir(), 'miniclaw-test-write');
  
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
      
      // 执行写入操作
      const result = await writeFileTool.execute('', { 
        path: testFile, 
        content: 'Hello, Miniclaw!' 
      });
      
      // 验证返回结构
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('成功');
      
      // 验证文件实际写入
      expect(readFileSync(testFile, 'utf-8')).toBe('Hello, Miniclaw!');
    });

    it('should create directory if not exists', async () => {
      const testFile = join(testDir, 'subdir', 'test.txt');
      
      // 执行写入操作（目录不存在）
      const result = await writeFileTool.execute('', { 
        path: testFile, 
        content: 'Nested file' 
      });
      
      // 验证返回结构
      expect(result.content[0].text).toContain('成功');
      
      // 验证文件实际写入
      expect(readFileSync(testFile, 'utf-8')).toBe('Nested file');
    });

    it('should overwrite existing file', async () => {
      const testFile = join(testDir, 'overwrite.txt');
      
      // 第一次写入
      await writeFileTool.execute('', { path: testFile, content: 'Old content' });
      
      // 第二次写入（覆盖）
      await writeFileTool.execute('', { path: testFile, content: 'New content' });
      
      // 验证文件被覆盖
      expect(readFileSync(testFile, 'utf-8')).toBe('New content');
    });

    it('should write UTF-8 content', async () => {
      const testFile = join(testDir, 'utf8.txt');
      
      // 写入 UTF-8 内容
      const result = await writeFileTool.execute('', { 
        path: testFile, 
        content: '你好，世界！🌍' 
      });
      
      // 验证返回结构
      expect(result.content[0].text).toContain('成功');
      
      // 验证 UTF-8 内容正确写入
      expect(readFileSync(testFile, 'utf-8')).toBe('你好，世界！🌍');
    });

    it('should return error message for invalid path', async () => {
      // 尝试写入无效路径
      const result = await writeFileTool.execute('', { 
        path: '/root/forbidden/test.txt', 
        content: 'test' 
      });
      
      // 验证返回结构
      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
    });
  });
});