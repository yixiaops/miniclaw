/**
 * 文件内容编辑工具
 * 对文件进行精确的字符串替换
 */
import { readFileSync, writeFileSync } from 'fs';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const EditParamsSchema = Type.Object({
  path: Type.String({ description: '文件路径' }),
  old_string: Type.String({ description: '要替换的文本（必须唯一匹配）' }),
  new_string: Type.String({ description: '替换后的文本' }),
  replace_all: Type.Optional(Type.Boolean({ description: '替换所有匹配项（默认 false）' }))
});

type EditParams = Static<typeof EditParamsSchema>;

/**
 * 工具详情类型
 */
export interface EditDetails {
  path: string;
  replacements: number;
}

/**
 * edit 工具定义
 */
export const editTool = {
  name: 'edit',
  label: '文件编辑',
  description: '对文件进行精确的字符串替换。必须先读取文件才能编辑。old_string 必须唯一匹配，除非使用 replace_all。',
  parameters: EditParamsSchema,

  /**
   * 执行文件编辑
   */
  async execute(
    _toolCallId: string,
    params: EditParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: EditDetails }> {
    const { path, old_string, new_string, replace_all = false } = params;

    try {
      // 读取文件内容
      const content = readFileSync(path, 'utf-8');

      // 检查 old_string 是否存在
      if (!content.includes(old_string)) {
        return {
          content: [{ type: 'text', text: `未找到要替换的文本: ${old_string.substring(0, 100)}...` }],
          details: { path, replacements: 0 }
        };
      }

      // 检查唯一性（如果不是 replace_all）
      if (!replace_all) {
        const matches = content.split(old_string).length - 1;
        if (matches > 1) {
          return {
            content: [{
              type: 'text',
              text: `找到 ${matches} 处匹配，old_string 必须唯一匹配。请使用更具体的文本，或使用 replace_all=true。`
            }],
            details: { path, replacements: 0 }
          };
        }
      }

      // 执行替换
      let newContent: string;
      let replacementCount: number;

      if (replace_all) {
        // 替换所有匹配
        const parts = content.split(old_string);
        replacementCount = parts.length - 1;
        newContent = parts.join(new_string);
      } else {
        // 替换第一个匹配
        newContent = content.replace(old_string, new_string);
        replacementCount = 1;
      }

      // 写入文件
      writeFileSync(path, newContent, 'utf-8');

      return {
        content: [{
          type: 'text',
          text: `已替换 ${replacementCount} 处匹配:\n旧文本: ${old_string.substring(0, 100)}${old_string.length > 100 ? '...' : ''}\n新文本: ${new_string.substring(0, 100)}${new_string.length > 100 ? '...' : ''}`
        }],
        details: { path, replacements: replacementCount }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `文件编辑失败: ${errorMsg}` }],
        details: { path, replacements: 0 }
      };
    }
  }
};