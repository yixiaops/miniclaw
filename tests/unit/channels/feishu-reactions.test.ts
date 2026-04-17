/**
 * 飞书表情回应测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeishuReactions } from '../../../src/channels/feishu-reactions.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FeishuReactions', () => {
  const config = {
    appId: 'cli_test',
    appSecret: 'test_secret',
  };

  let reactions: FeishuReactions;

  beforeEach(() => {
    reactions = new FeishuReactions(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('创建表情回应', () => {
    // 获取 token
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-test-token',
          expire: 7200,
        }),
      });
      await reactions.getAccessToken();
      mockFetch.mockReset();
    });

    // 成功添加表情回应
    it('should add reaction to message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: { reaction_id: 'rm_test123' },
        }),
      });

      const result = await reactions.addReaction('om_msg123', 'SMILE');

      expect(result.reactionId).toBe('rm_test123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.feishu.cn/open-apis/im/v1/messages/om_msg123/reactions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer t-test-token',
          }),
          body: JSON.stringify({ reaction_type: { emoji_type: 'SMILE' } }),
        })
      );
    });

    // 表情回应失败不应抛出错误（静默失败）
    it('should not throw error when add reaction fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 230001,
          msg: 'reaction failed',
        }),
      });

      // 不应抛出错误，返回空 reactionId
      const result = await reactions.addReaction('om_msg123', 'SMILE');
      expect(result.reactionId).toBe('');
    });

    // 网络错误时静默失败
    it('should handle network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await reactions.addReaction('om_msg123', 'SMILE');
      expect(result.reactionId).toBe('');
    });
  });

  describe('删除表情回应', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-test-token',
          expire: 7200,
        }),
      });
      await reactions.getAccessToken();
      mockFetch.mockReset();
    });

    // 成功删除表情回应
    it('should delete reaction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
        }),
      });

      const success = await reactions.deleteReaction('om_msg123', 'rm_test123');
      expect(success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.feishu.cn/open-apis/im/v1/messages/om_msg123/reactions/rm_test123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            Authorization: 'Bearer t-test-token',
          }),
        })
      );
    });

    // 删除失败静默处理
    it('should return false when delete fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 230001,
          msg: 'delete failed',
        }),
      });

      const success = await reactions.deleteReaction('om_msg123', 'rm_test123');
      expect(success).toBe(false);
    });
  });

  describe('便捷方法', () => {
    beforeEach(async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-test-token',
          expire: 7200,
        }),
      });
      await reactions.getAccessToken();
      mockFetch.mockReset();
    });

    // addProcessingReaction 便捷方法
    it('should add processing reaction with SMILE emoji', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: { reaction_id: 'rm_smile123' },
        }),
      });

      const result = await reactions.addProcessingReaction('om_msg123');
      expect(result.reactionId).toBe('rm_smile123');
    });
  });

  describe('token 管理', () => {
    // token 缓存
    it('should cache token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-cached-token',
          expire: 7200,
        }),
      });

      const token1 = await reactions.getAccessToken();
      const token2 = await reactions.getAccessToken();

      expect(token1).toBe('t-cached-token');
      expect(token2).toBe('t-cached-token');
      // API 只调用一次（token 缓存）
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // 清空缓存
    it('should clear token cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-new-token',
          expire: 7200,
        }),
      });

      await reactions.getAccessToken();
      reactions.clearTokenCache();
      const token = await reactions.getAccessToken();

      expect(token).toBe('t-new-token');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});