/**
 * 网页抓取工具测试
 * TDD: Red 阶段 - 先写失败的测试
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
      const result = await webFetchTool.execute({ 
        url: 'https://example.com' 
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });

    it('should return error for invalid URL', async () => {
      const result = await webFetchTool.execute({ 
        url: 'not-a-valid-url' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return error for non-existent domain', async () => {
      const result = await webFetchTool.execute({ 
        url: 'https://non-existent-domain-xyz-123.com' 
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle timeout parameter', async () => {
      const result = await webFetchTool.execute({ 
        url: 'https://example.com',
        timeout: 5000
      });
      
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });
});