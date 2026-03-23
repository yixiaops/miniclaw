/**
 * @fileoverview memory_get 工具
 *
 * 从记忆文件中读取指定片段。
 *
 * @module tools/memory-get
 */

import { Type, type Static } from '@sinclair/typebox';
import { MemorySearchManager } from '../core/memory/search.js';

/**
 * 工具参数 Schema
 */
const MemoryGetParamsSchema = Type.Object({
  path: Type.String({ description: '文件路径（相对于 ~/.miniclaw/）' }),
  from: Type.Optional(Type.Number({ description: '起始行号（从 1 开始）' })),
  lines: Type.Optional(Type.Number({ description: '读取行数' })),
});

type MemoryGetParams = Static<typeof MemoryGetParamsSchema>;

/**
 * memory_get 工具
 *
 * 从记忆文件中读取指定片段。配合 memory_search 使用，获取完整上下文。
 */
export const memoryGetTool = {
  name: 'memory_get',
  label: '获取记忆内容',
  description: `从记忆文件中读取指定片段。配合 memory_search 使用，获取完整上下文。

参数：
- path: 文件路径（如 memory/notes.md 或 sessions/xxx.json）
- from: 起始行号（从 1 开始）
- lines: 读取行数

返回指定范围的内容。`,
  parameters: MemoryGetParamsSchema,

  /**
   * 执行读取
   */
  async execute(_toolCallId: string, params: MemoryGetParams) {
    // 支持测试环境变量
    const storageDir = process.env.MINICLAW_TEST_DIR || undefined;
    const manager = new MemorySearchManager(storageDir);

    try {
      const result = await manager.readFile({
        path: params.path,
        from: params.from,
        lines: params.lines,
      });

      return {
        content: [{ type: 'text', text: result.text }],
        details: { path: result.path }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: `错误: ${errorMsg}` }],
        details: { error: errorMsg }
      };
    }
  }
};