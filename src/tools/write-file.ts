/**
 * 文件写入工具
 * 将内容写入指定路径的文件
 */
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const WriteFileParamsSchema = Type.Object({
  path: Type.String({ description: '要写入的文件路径' }),
  content: Type.String({ description: '要写入的内容' })
});

type WriteFileParams = Static<typeof WriteFileParamsSchema>;

/**
 * 工具详情类型
 */
export interface WriteFileDetails {
  path: string;
  created: boolean;  // true: 新创建, false: 追加到已有文件
}

/**
 * 文件写入工具定义
 */
export const writeFileTool = {
  name: 'write_file',
  label: '写入文件',
  description: '将内容写入指定路径的文件。如果文件已存在则追加内容，不存在则创建新文件。自动创建所需目录。',
  parameters: WriteFileParamsSchema,

  /**
   * 执行文件写入
   */
  async execute(
    _toolCallId: string,
    params: WriteFileParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: WriteFileDetails }> {
    const { path, content } = params;

    try {
      // 确保目录存在
      const dir = dirname(path);
      mkdirSync(dir, { recursive: true });

      // 检查文件是否存在
      const fileExists = existsSync(path);

      if (fileExists) {
        // 文件已存在，追加内容
        appendFileSync(path, content, 'utf-8');
        return {
          content: [{ type: 'text', text: `内容已追加到文件: ${path}` }],
          details: { path, created: false }
        };
      } else {
        // 文件不存在，创建新文件
        writeFileSync(path, content, 'utf-8');
        return {
          content: [{ type: 'text', text: `文件已创建并写入: ${path}` }],
          details: { path, created: true }
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `写入文件失败: ${errorMsg}` }],
        details: { path, created: false }
      };
    }
  }
};