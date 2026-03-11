/**
 * Shell 执行工具
 * 执行 Shell 命令并返回结果
 */
import { execSync } from 'child_process';

/**
 * 工具参数类型
 */
export interface ShellParams {
  /** 要执行的命令 */
  command: string;
}

/**
 * 工具返回类型
 */
export interface ShellResult {
  /** 是否成功（exit code 为 0） */
  success: boolean;
  /** 标准输出 */
  stdout: string;
  /** 标准错误 */
  stderr: string;
  /** 退出码 */
  exitCode: number;
  /** 错误信息（执行失败时） */
  error?: string;
}

/**
 * Shell 执行工具定义
 */
export const shellTool = {
  name: 'shell',
  description: '执行 Shell 命令',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: '要执行的 Shell 命令'
      }
    },
    required: ['command']
  },

  /**
   * 执行 Shell 命令
   */
  async execute(params: ShellParams): Promise<ShellResult> {
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
        success: true,
        stdout: stdout || '',
        stderr: '',
        exitCode: 0
      };
    } catch (err: any) {
      // 命令执行失败
      const stdout = err.stdout?.toString() || '';
      const stderr = err.stderr?.toString() || '';
      const exitCode = err.status ?? 1;

      return {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode,
        error: err.message
      };
    }
  }
};