/**
 * 网页搜索工具测试
 * 测试 web_search 工具的各项功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webSearchTool } from '../../../src/tools/web-search';

describe('webSearchTool', () => {
  // 保存原始 fetch
  const originalFetch = global.fetch;

  // Mock DuckDuckGo 响应数据
  const mockDDGResponse = {
    Abstract: 'Test abstract content',
    AbstractText: 'Test abstract text',
    AbstractSource: 'Wikipedia',
    AbstractURL: 'https://en.wikipedia.org/wiki/Test',
    Heading: 'Test Heading',
    RelatedTopics: [
      { Text: 'Topic 1 - Description of topic 1', FirstURL: 'https://example.com/1' },
      { Text: 'Topic 2 - Description of topic 2', FirstURL: 'https://example.com/2' },
      { Text: 'Topic 3 - Description of topic 3', FirstURL: 'https://example.com/3' }
    ],
    Results: [
      { Text: 'Result 1 - Description', FirstURL: 'https://example.com/result1' }
    ]
  };

  beforeEach(() => {
    // 重置 mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢复原始 fetch
    global.fetch = originalFetch;
  });

  describe('tool definition tests', () => {
    it('should have correct name', () => {
      expect(webSearchTool.name).toBe('web_search');
    });

    it('should have description', () => {
      expect(webSearchTool.description).toContain('搜索');
      expect(webSearchTool.description).toContain('DuckDuckGo');
    });

    it('should have parameters schema', () => {
      expect(webSearchTool.parameters).toBeDefined();
      expect(webSearchTool.parameters.properties.query).toBeDefined();
      expect(webSearchTool.parameters.properties.maxResults).toBeDefined();
      // query 是必填参数
      expect(webSearchTool.parameters.required).toContain('query');
    });
  });

  describe('execute - 正常流程', () => {
    it('should return abstract summary', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDDGResponse)
      });

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Test Heading');
      expect(result.content[0].text).toContain('Test abstract text');
      expect(result.details.query).toBe('test');
      expect(result.details.count).toBeGreaterThan(0);
    });

    it('should return related topics', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDDGResponse)
      });

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      expect(result.content[0].text).toContain('Topic 1');
      expect(result.content[0].text).toContain('https://example.com/1');
    });

    it('should respect maxResults limit', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDDGResponse)
      });

      const result = await webSearchTool.execute('test-id', { query: 'test', maxResults: 2 });

      // 最多返回 2 条结果
      expect(result.details.count).toBeLessThanOrEqual(2);
    });
  });

  describe('execute - 参数边界', () => {
    it('should return error for empty query', async () => {
      const result = await webSearchTool.execute('test-id', { query: '' });

      expect(result.content[0].text).toContain('请提供搜索关键词');
      expect(result.details.error).toBe(true);
    });

    it('should return error for whitespace-only query', async () => {
      const result = await webSearchTool.execute('test-id', { query: '   ' });

      expect(result.content[0].text).toContain('请提供搜索关键词');
      expect(result.details.error).toBe(true);
    });

    it('should auto-correct maxResults=0 to 1', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDDGResponse)
      });

      const result = await webSearchTool.execute('test-id', { query: 'test', maxResults: 0 });

      // maxResults=0 会被修正为 1
      expect(result.details.count).toBeLessThanOrEqual(1);
    });

    it('should auto-correct maxResults>10 to 10', async () => {
      const manyTopicsResponse = {
        ...mockDDGResponse,
        RelatedTopics: Array.from({ length: 20 }, (_, i) => ({
          Text: `Topic ${i + 1} - Description`,
          FirstURL: `https://example.com/${i + 1}`
        }))
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(manyTopicsResponse)
      });

      const result = await webSearchTool.execute('test-id', { query: 'test', maxResults: 20 });

      // maxResults>10 会被修正为 10
      expect(result.details.count).toBeLessThanOrEqual(10);
    });

    it('should use default maxResults=5 when not specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockDDGResponse)
      });

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      // 默认最多 5 条
      expect(result.details.count).toBeLessThanOrEqual(5);
    });
  });

  describe('execute - 错误处理', () => {
    it('should handle network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      expect(result.content[0].text).toContain('搜索请求失败');
      expect(result.content[0].text).toContain('Network error');
      expect(result.details.error).toBe(true);
    });

    it('should handle timeout', async () => {
      // 模拟超时场景：fetch 抛出 AbortError，且 timeoutController.signal.aborted 为 true
      // 这需要通过实际触发超时来测试，这里我们模拟超时控制器的状态
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      // 使用 vi.spyOn 来模拟超时场景
      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, 'setTimeout').mockImplementation((fn: () => void) => {
        // 立即执行超时回调
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      });

      global.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      // 超时或取消都会返回错误
      expect(result.content[0].text).toBeDefined();
      expect(result.details.error).toBe(true);

      vi.restoreAllMocks();
      global.setTimeout = originalSetTimeout;
    });

    it('should handle AbortSignal correctly', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await webSearchTool.execute('test-id', { query: 'test' }, controller.signal);

      // 被中止的请求
      expect(result.content[0].text).toBeDefined();
    });

    it('should handle invalid JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      expect(result.content[0].text).toContain('异常数据');
      expect(result.details.error).toBe(true);
    });

    it('should handle API returning empty object', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      expect(result.content[0].text).toContain('未找到');
      expect(result.details.count).toBe(0);
    });

    it('should handle non-OK response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      expect(result.content[0].text).toContain('暂时不可用');
      expect(result.details.error).toBe(true);
    });

    it('should handle non-Error rejection', async () => {
      global.fetch = vi.fn().mockRejectedValue('string error');

      const result = await webSearchTool.execute('test-id', { query: 'test' });

      expect(result.content[0].text).toContain('搜索请求失败');
      expect(result.details.error).toBe(true);
    });
  });

  describe('execute - 无结果场景', () => {
    it('should return friendly message for obscure keywords', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          Abstract: '',
          AbstractText: '',
          RelatedTopics: [],
          Results: []
        })
      });

      const result = await webSearchTool.execute('test-id', { query: 'xyzabc123不存在的词汇' });

      expect(result.content[0].text).toContain('未找到');
      expect(result.content[0].text).toContain('xyzabc123不存在的词汇');
    });

    it('should include query in friendly message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      });

      const result = await webSearchTool.execute('test-id', { query: '冷门关键词测试' });

      expect(result.content[0].text).toContain('冷门关键词测试');
    });
  });

  describe('execute - URL 编码', () => {
    it('should correctly encode special characters and Chinese', async () => {
      let capturedUrl = '';
      global.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDDGResponse)
        });
      });

      await webSearchTool.execute('test-id', { query: '量子计算 原理' });

      // 验证 URL 编码 - 中文会被编码
      expect(capturedUrl).toContain('%E9%87%8F%E5%AD%90'); // '量子' 的 UTF-8 编码
      expect(capturedUrl).toContain('api.duckduckgo.com');
      expect(capturedUrl).toContain('format=json');
      // 验证 encodeURIComponent 正确编码空格
      expect(capturedUrl).toContain('%20'); // 空格编码
    });

    it('should encode special characters in query', async () => {
      let capturedUrl = '';
      global.fetch = vi.fn().mockImplementation((url: string) => {
        capturedUrl = url;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDDGResponse)
        });
      });

      await webSearchTool.execute('test-id', { query: 'C++ & Java' });

      // 验证特殊字符被编码
      expect(capturedUrl).toContain('C%2B%2B'); // ++ 编码
      expect(capturedUrl).toContain('%26'); // & 编码
    });
  });
});