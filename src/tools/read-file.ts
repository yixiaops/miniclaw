/**
 * 文件读取工具
 * 读取指定路径的文件内容
 */
import { readFileSync, existsSync } from 'fs';

/**
 * 工具参数类型
 */
export interface ReadFileParams {
  /** 文件路径 */
  path: string;
}

/**
 * 工具返回类型
 */
export interface ReadFileResult {
  /** 是否成功 */
  success: boolean;
  /** 文件内容（成功时） */
  content?: string;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 文件读取工具定义
 */
export const readFileTool = {
  name: 'read_file',
  description: '读取指定路径的文件内容',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要读取的文件路径'
      }
    },
    required: ['path']
  },

  /**
   * 执行文件读取
   */
  async execute(params: ReadFileParams): Promise<ReadFileResult> {
    const { path } = params;

    // 检查文件是否存在
    if (!existsSync(path)) {
      return {
        success: false,
        error: `文件不存在: ${path}`
      };
    }

    try {
      // 读取文件内容
      const content = readFileSync(path, 'utf-8');
      return {
        success: true,
        content
      };
    } catch (err) {
      return {
        success: false,
        error: `读取文件失败: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
};