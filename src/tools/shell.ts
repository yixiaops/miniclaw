/**
 * Shell 执行工具
 * 执行 Shell 命令并返回结果
 */
import { execSync } from 'child_process';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const ShellParamsSchema = Type.Object({
  command: Type.String({ description: '要执行的 Shell 命令' })
});

type ShellParams = Static<typeof ShellParamsSchema>;

/**
 * 工具详情类型
 */
export interface ShellDetails {
  exitCode: number;
}

/**
 * Shell 执行工具定义
 */
export const shellTool = {
  name: 'shell',
  label: '执行命令',
  description: '执行 Shell 命令',
  parameters: ShellParamsSchema,

  /**
   * 执行 Shell 命令
   */
  async execute(
    _toolCallId: string,
    params: ShellParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: ShellDetails }> {
    const { command } = params;

    try {
      // 执行命令
      const stdout = execSync(command, {
        encoding: 'utf-8',
        timeout: 30000, // 30秒超时
        maxBuffer: 10 * 1024 * 1024, // 10MB 缓冲
        stdio: ['pipe', 'pipe', 'pipe']
      });

      return {
        content: [{ type: 'text', text: stdout || '(命令执行成功，无输出)' }],
        details: { exitCode: 0 }
      };
    } catch (err: any) {
      // 命令执行失败
      const stdout = err.stdout?.toString() || '';
      const stderr = err.stderr?.toString() || '';
      const exitCode = err.status ?? 1;

      const output = stdout + (stderr ? `\n错误: ${stderr}` : '');

      return {
        content: [{ type: 'text', text: output || `命令执行失败 (exit code: ${exitCode})` }],
        details: { exitCode }
      };
    }
  }
};