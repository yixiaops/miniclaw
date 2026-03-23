/**
 * 网页抓取工具测试
 * 测试 web_fetch 工具的各项功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webFetchTool } from '../../../src/tools/web-fetch';

describe('webFetchTool', () => {
  describe('tool definition', () => {
    it('should have correct name', () => {
      expect(webFetchTool.name).toBe('web_fetch');
    });

    it('should have description', () => {
      expect(webFetchTool.description).toContain('抓取');
    });

    it('should have parameters schema', () => {
      expect(webFetchTool.parameters).toBeDefined();
      expect(webFetchTool.parameters.properties.url).toBeDefined();
    });
  });

  describe('execute', () => {
    // 跳过需要实际网络的测试
    it.skip('should fetch web page content', async () => {
      // 抓取网页内容
      const result = await webFetchTool.execute('', {
        url: 'https://example.com'
      });

      // 验证返回结构
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBeDefined();
    });

    it('should return error for invalid URL', async () => {
      // 使用无效 URL
      const result = await webFetchTool.execute('', {
        url: 'not-a-valid-url'
      });

      // 验证返回错误消息
      expect(result.content[0].text).toContain('无效');
    });

    it('should return error for non-existent domain', async () => {
      // 使用不存在的域名
      const result = await webFetchTool.execute('', {
        url: 'https://non-existent-domain-xyz-123.com'
      });

      // 验证返回错误消息
      expect(result.content[0].text).toBeDefined();
    });

    it('should handle timeout parameter', async () => {
      // 测试超时参数
      const result = await webFetchTool.execute('', {
        url: 'https://example.com',
        timeout: 5000
      });

      // 验证返回结构
      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it('should return HTTP error for non-ok response', async () => {
      // Mock fetch to return 404
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await webFetchTool.execute('', {
        url: 'https://example.com/not-found'
      });

      expect(result.content[0].text).toContain('HTTP 错误');
      expect(result.content[0].text).toContain('404');

      global.fetch = originalFetch;
    });

    it('should return HTTP error for 500 response', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await webFetchTool.execute('', {
        url: 'https://example.com/error'
      });

      expect(result.content[0].text).toContain('500');

      global.fetch = originalFetch;
    });

    it('should handle AbortError for timeout', async () => {
      const originalFetch = global.fetch;
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await webFetchTool.execute('', {
        url: 'https://example.com/slow',
        timeout: 100
      });

      expect(result.content[0].text).toContain('请求超时');

      global.fetch = originalFetch;
    });

    it('should handle network error', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await webFetchTool.execute('', {
        url: 'https://example.com/error'
      });

      expect(result.content[0].text).toContain('请求失败');
      expect(result.content[0].text).toContain('Network error');

      global.fetch = originalFetch;
    });

    it('should handle non-Error rejection', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue('string error');

      const result = await webFetchTool.execute('', {
        url: 'https://example.com/error'
      });

      expect(result.content[0].text).toContain('请求失败');

      global.fetch = originalFetch;
    });

    it('should return successful content for ok response', async () => {
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html><body>Test content</body></html>')
      });

      const result = await webFetchTool.execute('', {
        url: 'https://example.com'
      });

      expect(result.content[0].text).toContain('Test content');
      expect(result.details.url).toBe('https://example.com');

      global.fetch = originalFetch;
    });
  });
});