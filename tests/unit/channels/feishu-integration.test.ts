/**
 * 飞书通道集成测试
 * T1.3 事件处理集成测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeishuChannel } from '../../../src/channels/feishu.js';
import { FeishuClient } from '../../../src/channels/feishu-client.js';
import { FeishuWebSocket } from '../../../src/channels/feishu-websocket.js';
import { MessageDeduplicator } from '../../../src/channels/feishu-dedup.js';

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static autoOpen = true;

  url: string;
  readyState: number = 0;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    if (MockWebSocket.autoOpen) {
      setTimeout(() => {
        this.readyState = 1;
        if (this.onopen) this.onopen();
      }, 0);
    }
  }

  close() {
    this.readyState = 3;
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

// Mock fetch for token and sendMessage
const mockFetch = vi.fn();
mockFetch.mockImplementation(async (url: string) => {
  // Token API
  if (url.includes('tenant_access_token')) {
    return {
      ok: true,
      json: async () => ({ code: 0, tenant_access_token: 't-test', expire: 7200 }),
    };
  }
  // Send message API
  if (url.includes('/im/v1/messages')) {
    return {
      ok: true,
      json: async () => ({ code: 0, data: { message_id: 'om_reply_test' } }),
    };
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
    MockWebSocket.instances = [];
    vi.clearAllMocks();
    channel = new FeishuChannel(mockGateway as any);
  });

  afterEach(() => {
    channel.stop();
  });

  describe('组件集成', () => {
    it('should create FeishuClient', async () => {
      await channel.start();
      const client = channel.getClient();
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(FeishuClient);
    });

    it('should create FeishuWebSocket', async () => {
      await channel.start();
      const ws = channel.getWebSocket();
      expect(ws).toBeDefined();
      expect(ws).toBeInstanceOf(FeishuWebSocket);
    });

    it('should create MessageDeduplicator', async () => {
      await channel.start();
      const dedup = channel.getDeduplicator();
      expect(dedup).toBeDefined();
      expect(dedup).toBeInstanceOf(MessageDeduplicator);
    });
  });

  describe('消息处理流程', () => {
    it('should handle incoming message', async () => {
      await channel.start();

      // 模拟 WebSocket 消息
      MockWebSocket.instances[0]?.onmessage!({
        data: JSON.stringify({
          type: 'im.message.receive_v1',
          data: {
            message: {
              message_id: 'om_test123',
              chat_id: 'oc_test',
              chat_type: 'p2p',
              content: '{"text":"Hello"}',
              sender: { sender_id: { user_id: 'ou_test' } },
            },
          },
        }),
      });

      // Gateway 应该被调用
      expect(mockGateway.handleMessage).toHaveBeenCalledWith({
        channel: 'feishu',
        userId: 'ou_test',
        groupId: undefined,
        content: 'Hello',
      });
    });

    it('should deduplicate messages', async () => {
      await channel.start();

      // 发送相同消息两次
      const messageData = {
        type: 'im.message.receive_v1',
        data: {
          message: {
            message_id: 'om_dup_test',
            chat_id: 'oc_test',
            chat_type: 'p2p',
            content: '{"text":"Test"}',
            sender: { sender_id: { user_id: 'ou_test' } },
          },
        },
      };

      MockWebSocket.instances[0]?.onmessage!({
        data: JSON.stringify(messageData),
      });

      MockWebSocket.instances[0]?.onmessage!({
        data: JSON.stringify(messageData),
      });

      // Gateway 只应该被调用一次（去重）
      expect(mockGateway.handleMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('启动/停止', () => {
    it('should start all components', async () => {
      await channel.start();
      expect(channel.isRunning()).toBe(true);
      expect(MockWebSocket.instances.length).toBe(1);
    });

    it('should stop all components', async () => {
      await channel.start();
      channel.stop();
      expect(channel.isRunning()).toBe(false);
    });
  });
});