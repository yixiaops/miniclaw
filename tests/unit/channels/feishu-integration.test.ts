/**
 * 飞书通道集成测试
 * 使用飞书 SDK
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeishuChannel } from '../../../src/channels/feishu.js';

// Mock fetch
const mockFetch = vi.fn();
mockFetch.mockImplementation(async (url: string) => {
  if (url.includes('tenant_access_token')) {
    return { ok: true, json: async () => ({ code: 0, tenant_access_token: 't-test', expire: 7200 }) };
  }
  if (url.includes('/im/v1/messages')) {
    return { ok: true, json: async () => ({ code: 0, data: { message_id: 'om_test' } }) };
  }
  return { ok: true, json: async () => ({}) };
});
vi.stubGlobal('fetch', mockFetch);

// Mock Gateway
const mockGateway = {
  getConfig: () => ({
    feishu: {
      appId: 'cli_test',
      appSecret: 'test_secret',
    },
  }),
  handleMessage: vi.fn().mockResolvedValue({ content: 'Reply from gateway' }),
};

describe('FeishuChannel Integration', () => {
  let channel: FeishuChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    channel = new FeishuChannel(mockGateway as any);
  });

  afterEach(() => {
    channel.stop();
    vi.clearAllMocks();
  });

  describe('组件初始化', () => {
    it('should create FeishuClient', () => {
      const client = channel.getClient();
      expect(client).toBeDefined();
    });

    it('should create FeishuWebSocket', () => {
      const ws = channel.getWebSocket();
      expect(ws).toBeDefined();
    });

    it('should create MessageDeduplicator', () => {
      const dedup = channel.getDeduplicator();
      expect(dedup).toBeDefined();
    });
  });

  describe('启动/停止', () => {
    it('should not be running initially', () => {
      expect(channel.isRunning()).toBe(false);
    });

    it('should stop cleanly', () => {
      channel.stop();
      expect(channel.isRunning()).toBe(false);
    });
  });
});