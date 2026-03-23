/**
 * @fileoverview memory_search 工具
 *
 * 搜索对话历史和知识库。
 *
 * @module tools/memory-search
 */

import { Type, type Static } from '@sinclair/typebox';
import { MemorySearchManager } from '../core/memory/search.js';

/**
 * 工具参数 Schema
 */
const MemorySearchParamsSchema = Type.Object({
  query: Type.String({ description: '搜索关键词' }),
  maxResults: Type.Optional(Type.Number({ description: '最大结果数（默认 10）' })),
  sources: Type.Optional(Type.Array(Type.String(), { description: '搜索来源: sessions 或 memory' })),
});

type MemorySearchParams = Static<typeof MemorySearchParamsSchema>;

/**
 * memory_search 工具
 *
 * 搜索对话历史和知识库。在回答关于之前工作、决策、日期、人物、偏好等问题前，必须先调用此工具。
 */
export const memorySearchTool = {
  name: 'memory_search',
  label: '搜索记忆',
  description: `搜索对话历史和知识库。在回答关于之前工作、决策、日期、人物、偏好等问题前，必须先调用此工具。

支持搜索：
- sessions: 对话历史（~/.miniclaw/sessions/*.json）
- memory: 知识库文件（~/.miniclaw/memory/*.md）

返回匹配的内容片段，包含路径和行号。`,
  parameters: MemorySearchParamsSchema,

  /**
   * 执行搜索
   */
  async execute(_toolCallId: string, params: MemorySearchParams) {
    // 支持测试环境变量
    const storageDir = process.env.MINICLAW_TEST_DIR || undefined;
    const manager = new MemorySearchManager(storageDir);

    try {
      const results = await manager.search(params.query, {
        maxResults: params.maxResults,
        sources: params.sources as ('sessions' | 'memory')[] | undefined,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
        details: { count: results.length }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMsg, results: [] }) }],
        details: { error: errorMsg }
      };
    }
  }
};