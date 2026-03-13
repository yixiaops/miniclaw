/**
 * 网页抓取工具测试
 * 测试 web_fetch 工具的各项功能
 */
import { describe, it, expect } from 'vitest';
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
  });
});