/**
 * 文件模式匹配搜索工具
 * 使用 glob 模式搜索文件，返回匹配的文件路径列表
 */
import { glob } from 'fast-glob';
import { statSync } from 'fs';
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const GlobParamsSchema = Type.Object({
  pattern: Type.String({ description: 'glob 模式，如 **/*.ts、src/**/*.js' }),
  path: Type.Optional(Type.String({ description: '搜索目录，默认当前工作目录' }))
});

type GlobParams = Static<typeof GlobParamsSchema>;

/**
 * 工具详情类型
 */
export interface GlobDetails {
  pattern: string;
  path?: string;
  count: number;
}

/**
 * glob 工具定义
 */
export const globTool = {
  name: 'glob',
  label: '文件搜索',
  description: '使用 glob 模式搜索文件，返回匹配的文件路径列表（按修改时间排序，最新的在前）。',
  parameters: GlobParamsSchema,

  /**
   * 执行文件搜索
   */
  async execute(
    _toolCallId: string,
    params: GlobParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: GlobDetails }> {
    const { pattern, path } = params;

    try {
      // 执行 glob 搜索
      const files = await glob(pattern, {
        cwd: path || process.cwd(),
        absolute: true,
        onlyFiles: true,
        ignore: ['node_modules/**', '.git/**', 'dist/**']
      });

      // 按修改时间排序（最新的在前）
      const sortedFiles = files.sort((a, b) => {
        try {
          const statA = statSync(a);
          const statB = statSync(b);
          return statB.mtimeMs - statA.mtimeMs;
        } catch {
          return 0;
        }
      });

      // 格式化输出
      const output = sortedFiles.length > 0
        ? `找到 ${sortedFiles.length} 个匹配文件:\n${sortedFiles.map(f => `- ${f}`).join('\n')}`
        : `未找到匹配文件 (pattern: ${pattern})`;

      return {
        content: [{ type: 'text', text: output }],
        details: {
          pattern,
          path,
          count: sortedFiles.length
        }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `文件搜索失败: ${errorMsg}` }],
        details: { pattern, path, count: 0 }
      };
    }
  }
};