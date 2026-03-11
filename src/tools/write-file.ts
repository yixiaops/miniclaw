/**
 * 文件写入工具
 * 将内容写入指定路径的文件
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * 工具参数类型
 */
export interface WriteFileParams {
  /** 文件路径 */
  path: string;
  /** 文件内容 */
  content: string;
}

/**
 * 工具返回类型
 */
export interface WriteFileResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 文件写入工具定义
 */
export const writeFileTool = {
  name: 'write_file',
  description: '将内容写入指定路径的文件',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: '要写入的文件路径'
      },
      content: {
        type: 'string',
        description: '要写入的内容'
      }
    },
    required: ['path', 'content']
  },

  /**
   * 执行文件写入
   */
  async execute(params: WriteFileParams): Promise<WriteFileResult> {
    const { path, content } = params;

    try {
      // 确保目录存在
      const dir = dirname(path);
      mkdirSync(dir, { recursive: true });
      
      // 写入文件
      writeFileSync(path, content, 'utf-8');
      
      return {
        success: true
      };
    } catch (err) {
      return {
        success: false,
        error: `写入文件失败: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }
};