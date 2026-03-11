/**
 * 网页抓取工具
 * 抓取指定 URL 的网页内容
 */

/**
 * 工具参数类型
 */
export interface WebFetchParams {
  /** 要抓取的 URL */
  url: string;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * 工具返回类型
 */
export interface WebFetchResult {
  /** 是否成功 */
  success: boolean;
  /** 网页内容（成功时） */
  content?: string;
  /** 错误信息（失败时） */
  error?: string;
}

/**
 * 网页抓取工具定义
 */
export const webFetchTool = {
  name: 'web_fetch',
  description: '抓取指定 URL 的网页内容',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '要抓取的网页 URL'
      },
      timeout: {
        type: 'number',
        description: '超时时间（毫秒），默认 30000'
      }
    },
    required: ['url']
  },

  /**
   * 执行网页抓取
   */
  async execute(params: WebFetchParams): Promise<WebFetchResult> {
    const { url, timeout = 30000 } = params;

    // 验证 URL
    try {
      new URL(url);
    } catch {
      return {
        success: false,
        error: `无效的 URL: ${url}`
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
          success: false,
          error: `HTTP 错误: ${response.status} ${response.statusText}`
        };
      }

      // 获取内容
      const content = await response.text();

      return {
        success: true,
        content
      };
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          return {
            success: false,
            error: `请求超时 (${timeout}ms)`
          };
        }
        return {
          success: false,
          error: `请求失败: ${err.message}`
        };
      }
      return {
        success: false,
        error: `请求失败: ${String(err)}`
      };
    }
  }
};