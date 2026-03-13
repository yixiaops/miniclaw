/**
 * Shell 执行工具测试
 * 测试 shell 工具的各项功能
 */
import { describe, it, expect } from 'vitest';
import { shellTool } from '../../../src/tools/shell';

describe('shellTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(shellTool.name).toBe('shell');
    });

    it('should have description', () => {
      expect(shellTool.description).toContain('执行');
    });

    it('should have parameters schema', () => {
      expect(shellTool.parameters).toBeDefined();
      expect(shellTool.parameters.properties.command).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute simple command', async () => {
      // 执行简单命令
      const result = await shellTool.execute('', { command: 'echo "Hello"' });
      
      // 验证返回结构
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Hello');
      expect(result.details.exitCode).toBe(0);
    });

    it('should capture stdout', async () => {
      // 执行命令并捕获输出
      const result = await shellTool.execute('', { command: 'echo "test output"' });
      
      // 验证输出内容
      expect(result.content[0].text).toContain('test output');
      expect(result.details.exitCode).toBe(0);
    });

    it('should handle command with output', async () => {
      // 执行带输出的命令
      const result = await shellTool.execute('', { command: 'echo "test output"' });
      
      // 验证输出
      expect(result.content[0].text).toContain('test output');
    });

    it('should return exit code 0 for successful command', async () => {
      // 执行成功命令
      const result = await shellTool.execute('', { command: 'exit 0' });
      
      // 验证退出码为 0
      expect(result.details.exitCode).toBe(0);
    });

    it('should return non-zero exit code for failed command', async () => {
      // 执行失败命令
      const result = await shellTool.execute('', { command: 'exit 1' });
      
      // 验证退出码非 0
      expect(result.details.exitCode).toBe(1);
    });

    it('should handle invalid command', async () => {
      // 执行不存在的命令
      const result = await shellTool.execute('', { command: 'nonexistent_command_xyz' });
      
      // 验证返回错误信息
      expect(result.content[0].text).toBeDefined();
      expect(result.details.exitCode).not.toBe(0);
    });

    it('should handle command with arguments', async () => {
      // 执行带参数的命令
      const result = await shellTool.execute('', { command: 'ls -la' });
      
      // 验证命令成功执行
      expect(result.details.exitCode).toBe(0);
    });
  });
});