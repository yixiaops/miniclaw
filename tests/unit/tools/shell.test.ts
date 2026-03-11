/**
 * Shell 执行工具测试
 * TDD: Red 阶段 - 先写失败的测试
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
      const result = await shellTool.execute({ command: 'echo "Hello"' });
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Hello');
    });

    it('should capture stdout', async () => {
      const result = await shellTool.execute({ command: 'echo "test output"' });
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test output');
      expect(result.stderr).toBe('');
    });

    it('should handle command with output', async () => {
      const result = await shellTool.execute({ command: 'echo "test output"' });
      
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('test output');
    });

    it('should return exit code 0 for successful command', async () => {
      const result = await shellTool.execute({ command: 'exit 0' });
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should return non-zero exit code for failed command', async () => {
      const result = await shellTool.execute({ command: 'exit 1' });
      
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('should handle invalid command', async () => {
      const result = await shellTool.execute({ command: 'nonexistent_command_xyz' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle command with arguments', async () => {
      const result = await shellTool.execute({ command: 'ls -la' });
      
      expect(result.success).toBe(true);
    });
  });
});