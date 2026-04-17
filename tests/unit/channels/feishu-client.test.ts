/**
 * 飞书客户端测试
 * T1.1 飞书客户端测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeishuClient } from '../../../src/channels/feishu-client.js';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('FeishuClient', () => {
  const config = {
    appId: 'cli_test',
    appSecret: 'test_secret',
  };

  let client: FeishuClient;

  beforeEach(() => {
    client = new FeishuClient(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('获取 token', () => {
    // 成功获取 token
    it('should get tenant_access_token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-test-token',
          expire: 7200,
        }),
      });

      const token = await client.getAccessToken();

      expect(token).toBe('t-test-token');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    // token 缓存
    it('should cache token and not call API twice', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-test-token',
          expire: 7200,
        }),
      });

      // 第一次调用
      const token1 = await client.getAccessToken();
      expect(token1).toBe('t-test-token');

      // 第二次调用（应该使用缓存）
      const token2 = await client.getAccessToken();
      expect(token2).toBe('t-test-token');

      // API 只调用一次
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // API 错误处理
    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 10001,
          msg: 'app_id or app_secret invalid',
        }),
      });

      await expect(client.getAccessToken()).rejects.toThrow();
    });

    // 网络错误处理
    it('should throw error when network fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getAccessToken()).rejects.toThrow('Network error');
    });
  });

  describe('发送消息', () => {
    beforeEach(async () => {
      // 先获取 token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-test-token',
          expire: 7200,
        }),
      });
      await client.getAccessToken();
      mockFetch.mockReset();
    });

    // 发送文本消息成功
    it('should send text message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: { message_id: 'om_test123' },
        }),
      });

      const result = await client.sendMessage({
        receiveId: 'ou_test',
        msgType: 'text',
        content: 'Hello',
      });

      expect(result.messageId).toBe('om_test123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=user_id',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer t-test-token',
          }),
        })
      );
    });

    // 发送群聊消息
    it('should send message to group chat', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: { message_id: 'om_group123' },
        }),
      });

      const result = await client.sendMessage({
        receiveId: 'oc_test_group',
        msgType: 'text',
        content: 'Hello group',
      });

      expect(result.messageId).toBe('om_group123');
    });

    // 回复话题
    it('should reply to topic thread', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: { message_id: 'om_reply123' },
        }),
      });

      const result = await client.sendMessage({
        receiveId: 'oc_test_group',
        msgType: 'text',
        content: 'Reply to topic',
        replyToMessageId: 'om_topic_root',
      });

      expect(result.messageId).toBe('om_reply123');
    });

    // 发送消息失败
    it('should throw error when send fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 230001,
          msg: 'message send failed',
        }),
      });

      await expect(
        client.sendMessage({
          receiveId: 'ou_test',
          msgType: 'text',
          content: 'Hello',
        })
      ).rejects.toThrow();
    });
  });

  describe('token 刷新', () => {
    // 过期前刷新（简化测试）
    it('should be able to refresh token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 't-refreshed-token',
          expire: 7200,
        }),
      });

      // 强制刷新（清空缓存）
      client.clearTokenCache();
      const token = await client.getAccessToken();

      expect(token).toBe('t-refreshed-token');
    });
  });
});