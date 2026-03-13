/**
 * 网页抓取工具
 * 抓取指定 URL 的网页内容
 */
import { Type, type Static } from '@sinclair/typebox';

/**
 * 工具参数 schema
 */
const WebFetchParamsSchema = Type.Object({
  url: Type.String({ description: '要抓取的网页 URL' }),
  timeout: Type.Optional(Type.Number({ description: '超时时间（毫秒），默认 30000' }))
});

type WebFetchParams = Static<typeof WebFetchParamsSchema>;

/**
 * 工具详情类型
 */
export interface WebFetchDetails {
  url: string;
}

/**
 * 网页抓取工具定义
 */
export const webFetchTool = {
  name: 'web_fetch',
  label: '抓取网页',
  description: '抓取指定 URL 的网页内容',
  parameters: WebFetchParamsSchema,

  /**
   * 执行网页抓取
   */
  async execute(
    _toolCallId: string,
    params: WebFetchParams,
    _signal?: AbortSignal
  ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: WebFetchDetails }> {
    const { url, timeout = 30000 } = params;

    // 验证 URL
    try {
      new URL(url);
    } catch {
      return {
        content: [{ type: 'text', text: `无效的 URL: ${url}` }],
        details: { url }
      };
    }

    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // 发起请求
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Miniclaw/0.1.0)'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: `HTTP 错误: ${response.status} ${response.statusText}` }],
          details: { url }
        };
      }

      // 获取内容
      const content = await response.text();

      return {
        content: [{ type: 'text', text: content }],
        details: { url }
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return {
            content: [{ type: 'text', text: `请求超时 (${timeout}ms)` }],
            details: { url }
          };
        }
        return {
          content: [{ type: 'text', text: `请求失败: ${err.message}` }],
          details: { url }
        };
      }
      return {
        content: [{ type: 'text', text: `请求失败: ${String(err)}` }],
        details: { url }
      };
    }
  }
};