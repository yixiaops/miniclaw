/**
 * 网页搜索工具
 * 使用 DuckDuckGo Instant Answer API 进行搜索
 */
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const WebSearchParamsSchema = Type.Object({
  query: Type.String({ description: '搜索关键词' }),
  maxResults: Type.Optional(
    Type.Number({
      description: '最大返回结果数量（默认 5，范围 1-10）',
      minimum: 1,
      maximum: 10
    })
  )
});

type WebSearchParams = Static<typeof WebSearchParamsSchema>;

/**
 * DuckDuckGo API 响应结构
 */
interface DuckDuckGoResponse {
  Abstract?: string;
  AbstractText?: string;
  AbstractSource?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: Array<{
    Text?: string;
    FirstURL?: string;
  }>;
  Results?: Array<{
    Text?: string;
    FirstURL?: string;
  }>;
}

/**
 * 内部搜索结果结构
 */
interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source?: string;
}

/**
 * 工具详情类型
 */
export interface WebSearchDetails {
  query: string;
  count?: number;
  error?: boolean;
}

/**
 * 解析 DuckDuckGo RelatedTopics 中的标题
 * 格式通常是 "Title - Description" 或 "Title"
 */
function parseTopicText(text: string): { title: string; snippet: string } {
  const dashIndex = text.indexOf(' - ');
  if (dashIndex > 0) {
    return {
      title: text.slice(0, dashIndex).trim(),
      snippet: text.slice(dashIndex + 3).trim()
    };
  }
  return { title: text.trim(), snippet: '' };
}

/**
 * 网页搜索工具定义
 */
export const webSearchTool = {
  name: 'web_search',
  label: '搜索网页',
  description: '搜索网页信息，返回相关结果（使用 DuckDuckGo）',
  parameters: WebSearchParamsSchema,

  /**
   * 执行网页搜索
   */
  async execute(
    _toolCallId: string,
    params: WebSearchParams,
    signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: WebSearchDetails }> {
    const { query, maxResults = 5 } = params;

    // 空查询检查
    if (!query || query.trim() === '') {
      return {
        content: [{ type: 'text', text: '请提供搜索关键词' }],
        details: { query: '', error: true }
      };
    }

    // maxResults 边界处理
    const effectiveMaxResults = Math.max(1, Math.min(10, maxResults));

    // 构建 DuckDuckGo API URL
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

    // 创建超时控制器
    const timeoutController = new AbortController();
    const timeoutMs = 10000;
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      // 合并外部 signal 和超时 signal
      const combinedSignal = signal
        ? AbortSignal.any([signal, timeoutController.signal])
        : timeoutController.signal;

      // 发起请求
      const response = await fetch(url, {
        signal: combinedSignal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Miniclaw/0.1.0)'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: '搜索服务暂时不可用，请稍后重试' }],
          details: { query, error: true }
        };
      }

      // 解析响应
      let data: DuckDuckGoResponse;
      try {
        data = (await response.json()) as DuckDuckGoResponse;
      } catch {
        return {
          content: [{ type: 'text', text: '搜索服务返回异常数据，请稍后重试' }],
          details: { query, error: true }
        };
      }

      // 收集结果
      const results: WebSearchResult[] = [];

      // 添加摘要（如果有）
      if (data.AbstractText || data.Abstract) {
        results.push({
          title: data.Heading || '摘要',
          snippet: data.AbstractText || data.Abstract || '',
          url: data.AbstractURL || '',
          source: data.AbstractSource
        });
      }

      // 添加相关主题
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics) {
          if (results.length >= effectiveMaxResults) break;
          if (topic.Text && topic.FirstURL) {
            const parsed = parseTopicText(topic.Text);
            results.push({
              title: parsed.title,
              snippet: parsed.snippet,
              url: topic.FirstURL
            });
          }
        }
      }

      // 添加额外结果
      if (data.Results) {
        for (const result of data.Results) {
          if (results.length >= effectiveMaxResults) break;
          if (result.Text && result.FirstURL) {
            const parsed = parseTopicText(result.Text);
            results.push({
              title: parsed.title,
              snippet: parsed.snippet,
              url: result.FirstURL
            });
          }
        }
      }

      // 无结果处理
      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `未找到与 "${query}" 相关的结果` }],
          details: { query, count: 0 }
        };
      }

      // 格式化结果
      const lines: string[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        lines.push(`\n## ${i + 1}. ${r.title}`);
        if (r.snippet) {
          lines.push(r.snippet);
        }
        if (r.url) {
          lines.push(`链接: ${r.url}`);
        }
        if (r.source) {
          lines.push(`来源: ${r.source}`);
        }
      }

      return {
        content: [{ type: 'text', text: `找到 ${results.length} 条与 "${query}" 相关的结果：${lines.join('\n')}` }],
        details: { query, count: results.length }
      };
    } catch (err) {
      clearTimeout(timeoutId);

      if (err instanceof Error) {
        // 处理中止错误
        if (err.name === 'AbortError') {
          // 检查是超时还是外部中止
          if (timeoutController.signal.aborted && !signal?.aborted) {
            return {
              content: [{ type: 'text', text: '搜索请求超时，请稍后重试' }],
              details: { query, error: true }
            };
          }
          // 外部中止，不返回错误（请求被主动取消）
          return {
            content: [{ type: 'text', text: '搜索请求已取消' }],
            details: { query, error: true }
          };
        }

        // 网络错误
        return {
          content: [{ type: 'text', text: `搜索请求失败: ${err.message}` }],
          details: { query, error: true }
        };
      }

      return {
        content: [{ type: 'text', text: `搜索请求失败: ${String(err)}` }],
        details: { query, error: true }
      };
    }
  }
};