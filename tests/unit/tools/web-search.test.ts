/**
 * @fileoverview web_search 工具测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webSearchTool } from '../../../src/tools/web-search';

describe('web_search tool', () => {
  const originalEnv = process.env.BRAVE_SEARCH_API_KEY;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.BRAVE_SEARCH_API_KEY = originalEnv;
    } else {
      delete process.env.BRAVE_SEARCH_API_KEY;
    }
  });

  it('should have correct tool name', () => {
    expect(webSearchTool.name).toBe('web_search');
  });

  it('should have tool description', () => {
    expect(webSearchTool.description).toBeTruthy();
    expect(webSearchTool.description.length).toBeGreaterThan(10);
  });

  it('should return error when API key not configured', async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;

    const result = await webSearchTool.execute('test-1', { query: 'test' });

    expect(result.content[0].type).toBe('text');
    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain('not configured');
    expect(parsed.results).toEqual([]);
  });

  it('should return search results for valid query', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';

    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'Test Result', url: 'https://example.com', description: 'Test snippet' }
          ]
        }
      })
    });
    global.fetch = mockFetch;

    const result = await webSearchTool.execute('test-1', { query: 'test query' });

    expect(mockFetch).toHaveBeenCalled();
    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].title).toBe('Test Result');
    expect(parsed.results[0].url).toBe('https://example.com');
  });

  it('should respect count parameter', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            { title: 'Result 1', url: 'https://example1.com', description: 'Snippet 1' },
            { title: 'Result 2', url: 'https://example2.com', description: 'Snippet 2' },
            { title: 'Result 3', url: 'https://example3.com', description: 'Snippet 3' }
          ]
        }
      })
    });
    global.fetch = mockFetch;

    await webSearchTool.execute('test-1', { query: 'test', count: 2 });

    // Check that count was passed to API
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('count=2');
  });

  it('should return empty array when no results', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: []
        }
      })
    });
    global.fetch = mockFetch;

    const result = await webSearchTool.execute('test-1', { query: 'nonexistent query xyz123' });

    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.results).toEqual([]);
  });

  it('should handle API errors gracefully', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
    });
    global.fetch = mockFetch;

    const result = await webSearchTool.execute('test-1', { query: 'test' });

    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain('429');
    expect(parsed.results).toEqual([]);
  });

  it('should include country parameter when provided', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        web: { results: [] }
      })
    });
    global.fetch = mockFetch;

    await webSearchTool.execute('test-1', { query: 'test', country: 'CN' });

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('country=CN');
  });

  it('should handle network errors gracefully', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    global.fetch = mockFetch;

    const result = await webSearchTool.execute('test-1', { query: 'test' });

    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain('Network error');
    expect(parsed.results).toEqual([]);
  });

  it('should handle non-Error thrown values', async () => {
    process.env.BRAVE_SEARCH_API_KEY = 'test-api-key';

    const mockFetch = vi.fn().mockRejectedValue('Unknown error string');
    global.fetch = mockFetch;

    const result = await webSearchTool.execute('test-1', { query: 'test' });

    const text = result.content[0].text;
    const parsed = JSON.parse(text);
    expect(parsed.error).toContain('Unknown error string');
    expect(parsed.results).toEqual([]);
  });
});