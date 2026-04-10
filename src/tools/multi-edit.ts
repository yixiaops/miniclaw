/**
 * 批量文件编辑工具
 * 对文件进行多处编辑（原子操作）
 */
import { readFileSync, writeFileSync } from 'fs';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 单个编辑操作
 */
const EditOperationSchema = Type.Object({
  old_string: Type.String({ description: '要替换的文本' }),
  new_string: Type.String({ description: '替换后的文本' }),
  replace_all: Type.Optional(Type.Boolean({ description: '替换所有匹配项' }))
});

/**
 * 工具参数 schema
 */
const MultiEditParamsSchema = Type.Object({
  path: Type.String({ description: '文件路径' }),
  edits: Type.Array(EditOperationSchema, { description: '编辑操作列表' })
});

type MultiEditParams = Static<typeof MultiEditParamsSchema>;

/**
 * 工具详情类型
 */
export interface MultiEditDetails {
  path: string;
  totalReplacements: number;
  editCount: number;
}

/**
 * multi_edit 工具定义
 */
export const multiEditTool = {
  name: 'multi_edit',
  label: '批量编辑',
  description: '对文件进行多处编辑。所有编辑操作必须成功，否则全部失败（原子操作）。编辑之间不能重叠。',
  parameters: MultiEditParamsSchema,

  /**
   * 执行批量编辑
   */
  async execute(
    _toolCallId: string,
    params: MultiEditParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: MultiEditDetails }> {
    const { path, edits } = params;

    if (edits.length === 0) {
      return {
        content: [{ type: 'text', text: '编辑操作列表为空' }],
        details: { path, totalReplacements: 0, editCount: 0 }
      };
    }

    try {
      // 读取文件内容
      let content = readFileSync(path, 'utf-8');
      const originalContent = content;
      let totalReplacements = 0;
      const results: string[] = [];

      // 依次执行每个编辑操作
      for (let i = 0; i < edits.length; i++) {
        const { old_string, new_string, replace_all = false } = edits[i];

        // 检查 old_string 是否存在
        if (!content.includes(old_string)) {
          // 恢复原始内容
          writeFileSync(path, originalContent, 'utf-8');
          return {
            content: [{
              type: 'text',
              text: `编辑 #${i + 1} 失败: 未找到要替换的文本 "${old_string.substring(0, 50)}..."，已恢复原始文件内容。`
            }],
            details: { path, totalReplacements: 0, editCount: i }
          };
        }

        // 检查唯一性（如果不是 replace_all）
        if (!replace_all) {
          const matches = content.split(old_string).length - 1;
          if (matches > 1) {
            // 恢复原始内容
            writeFileSync(path, originalContent, 'utf-8');
            return {
              content: [{
                type: 'text',
                text: `编辑 #${i + 1} 失败: 找到 ${matches} 处匹配，old_string 必须唯一匹配。已恢复原始文件内容。`
              }],
              details: { path, totalReplacements: 0, editCount: i }
            };
          }
        }

        // 执行替换
        if (replace_all) {
          const parts = content.split(old_string);
          const count = parts.length - 1;
          content = parts.join(new_string);
          totalReplacements += count;
          results.push(`#${i + 1}: 替换 ${count} 处`);
        } else {
          content = content.replace(old_string, new_string);
          totalReplacements += 1;
          results.push(`#${i + 1}: 替换 1 处`);
        }
      }

      // 写入文件
      writeFileSync(path, content, 'utf-8');

      return {
        content: [{
          type: 'text',
          text: `批量编辑完成:\n${results.join('\n')}\n共替换 ${totalReplacements} 处`
        }],
        details: {
          path,
          totalReplacements,
          editCount: edits.length
        }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `批量编辑失败: ${errorMsg}` }],
        details: { path, totalReplacements: 0, editCount: 0 }
      };
    }
  }
};