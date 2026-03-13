/**
 * 文件读取工具
 * 读取指定路径的文件内容
 */
import { readFileSync, existsSync } from 'fs';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const ReadFileParamsSchema = Type.Object({
  path: Type.String({ description: '要读取的文件路径' })
});

type ReadFileParams = Static<typeof ReadFileParamsSchema>;

/**
 * 工具详情类型
 */
export interface ReadFileDetails {
  path: string;
}

/**
 * 文件读取工具定义
 */
export const readFileTool = {
  name: 'read_file',
  label: '读取文件',
  description: '读取指定路径的文件内容',
  parameters: ReadFileParamsSchema,

  /**
   * 执行文件读取
   */
  async execute(
    _toolCallId: string,
    params: ReadFileParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: ReadFileDetails }> {
    const { path } = params;

    // 检查文件是否存在
    if (!existsSync(path)) {
      return {
        content: [{ type: 'text', text: `文件不存在: ${path}` }],
        details: { path }
      };
    }

    try {
      // 读取文件内容
      const fileContent = readFileSync(path, 'utf-8');
      return {
        content: [{ type: 'text', text: fileContent }],
        details: { path }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `读取文件失败: ${errorMsg}` }],
        details: { path }
      };
    }
  }
};