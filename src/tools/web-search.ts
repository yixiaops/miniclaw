/**
 * @fileoverview 网页搜索工具
 *
 * 使用 Brave Search API 搜索网页信息。
 *
 * @module tools/web-search
 */

import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 Schema
 */
const WebSearchParamsSchema = Type.Object({
  query: Type.String({ description: '搜索关键词' }),
  count: Type.Optional(Type.Number({ minimum: 1, maximum: 10, description: '结果数量 (1-10，默认 5)' })),
  country: Type.Optional(Type.String({ description: '国家代码 (US, CN, etc.)' })),
});

type WebSearchParams = Static<typeof WebSearchParamsSchema>;

/**
 * 搜索结果
 */
interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * web_search 工具
 *
 * 搜索网页获取最新信息。返回标题、链接和摘要。
 */
export const webSearchTool = {
  name: 'web_search',
  label: '网页搜索',
  description: `搜索网页获取最新信息。

参数：
- query: 搜索关键词
- count: 结果数量 (1-10，默认 5)
- country: 国家代码 (US, CN, etc.)

返回搜索结果列表，包含标题、链接和摘要。`,
  parameters: WebSearchParamsSchema,

  /**
   * 执行搜索
   */
  async execute(_toolCallId: string, params: WebSearchParams) {
    // 检查 API Key
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'BRAVE_SEARCH_API_KEY not configured',
            results: []
          })
        }],
        details: { error: 'API key not configured' }
      };
    }

    // 构建请求
    const count = params.count ?? 5;
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', params.query);
    url.searchParams.set('count', String(count));
    if (params.country) {
      url.searchParams.set('country', params.country);
    }

    try {
      // 调用 Brave Search API
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(5000),
      });

      // 处理错误响应
      if (!response.ok) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: `API error: ${response.status}`,
              results: []
            })
          }],
          details: { error: `API error: ${response.status}` }
        };
      }

      // 解析响应
      const data = await response.json() as any;
      const results: WebSearchResult[] = (data?.web?.results ?? []).map((r: any) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ results }, null, 2)
        }],
        details: { count: results.length }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: errorMsg,
            results: []
          })
        }],
        details: { error: errorMsg }
      };
    }
  }
};