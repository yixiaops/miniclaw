/**
 * 文件写入工具
 * 将内容写入指定路径的文件，支持覆盖和追加模式
 */
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const WriteFileParamsSchema = Type.Object({
  path: Type.String({ description: '要写入的文件路径' }),
  content: Type.String({ description: '要写入的内容' }),
  mode: Type.Optional(Type.Union([
    Type.Literal('overwrite'),
    Type.Literal('append'),
    Type.Literal('create')
  ], { description: '写入模式: overwrite(覆盖), append(追加), create(仅创建新文件)' }))
});

type WriteFileParams = Static<typeof WriteFileParamsSchema>;

/**
 * 工具详情类型
 */
export interface WriteFileDetails {
  path: string;
  mode: 'overwrite' | 'append' | 'create';
  created: boolean;
}

/**
 * 文件写入工具定义
 */
export const writeFileTool = {
  name: 'write_file',
  label: '写入文件',
  description: '将内容写入指定路径的文件。默认覆盖模式(overwrite)，可选追加(append)或仅创建(create)。自动创建所需目录。',
  parameters: WriteFileParamsSchema,

  /**
   * 执行文件写入
   */
  async execute(
    _toolCallId: string,
    params: WriteFileParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: WriteFileDetails }> {
    const { path, content, mode = 'overwrite' } = params;

    try {
      // 确保目录存在
      const dir = dirname(path);
      mkdirSync(dir, { recursive: true });

      // 检查文件是否存在
      const fileExists = existsSync(path);

      switch (mode) {
        case 'overwrite':
          // 覆盖写入（默认模式）
          writeFileSync(path, content, 'utf-8');
          return {
            content: [{ type: 'text', text: `文件已覆盖写入: ${path} (${content.length} 字符)` }],
            details: { path, mode, created: !fileExists }
          };

        case 'append':
          // 追加写入
          if (fileExists) {
            appendFileSync(path, content, 'utf-8');
            return {
              content: [{ type: 'text', text: `内容已追加到文件: ${path}` }],
              details: { path, mode, created: false }
            };
          } else {
            // 文件不存在，创建新文件
            writeFileSync(path, content, 'utf-8');
            return {
              content: [{ type: 'text', text: `文件已创建并写入: ${path}` }],
              details: { path, mode, created: true }
            };
          }

        case 'create':
          // 仅创建新文件
          if (fileExists) {
            return {
              content: [{ type: 'text', text: `文件已存在，未覆盖: ${path}` }],
              details: { path, mode, created: false }
            };
          } else {
            writeFileSync(path, content, 'utf-8');
            return {
              content: [{ type: 'text', text: `文件已创建: ${path}` }],
              details: { path, mode, created: true }
            };
          }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `写入文件失败: ${errorMsg}` }],
        details: { path, mode, created: false }
      };
    }
  }
};