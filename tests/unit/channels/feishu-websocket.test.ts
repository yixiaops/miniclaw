/**
 * 飞书 WebSocket 连接测试
 * T1.2 WebSocket 连接测试（简化版）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FeishuWebSocket } from '../../../src/channels/feishu-websocket.js';
import { FeishuClient } from '../../../src/channels/feishu-client.js';

// Mock WebSocket - 同步触发
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static autoOpen = false;

  url: string;
  readyState: number = 0;
  onopen: (() => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    
    // 自动触发连接成功
    if (MockWebSocket.autoOpen) {
      setTimeout(() => {
        this.readyState = 1;
        if (this.onopen) this.onopen();
      }, 0);
    }
  }

  close(code: number = 1000) {
    this.readyState = 3;
    if (this.onclose) this.onclose({ code });
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

describe('FeishuWebSocket', () => {
  const config = { appId: 'cli_test', appSecret: 'test_secret' };
  let client: FeishuClient;

  beforeEach(() => {
    MockWebSocket.instances = [];
    MockWebSocket.autoOpen = true;
    client = new FeishuClient(config);
    vi.spyOn(client, 'getAccessToken').mockResolvedValue('t-test-token');
  });

  afterEach(() => {
    MockWebSocket.autoOpen = false;
    vi.clearAllMocks();
  });

  describe('连接管理', () => {
    it('should create WebSocket instance', async () => {
      const ws = new FeishuWebSocket(config, client);
      await ws.start();
      
      expect(MockWebSocket.instances.length).toBe(1);
      expect(MockWebSocket.instances[0].url).toContain('wss://ws.feishu.cn');
      ws.stop();
    });

    it('should report connected state', async () => {
      const ws = new FeishuWebSocket(config, client);
      await ws.start();
      
      expect(ws.isConnected()).toBe(true);
      ws.stop();
    });

    it('should stop connection', async () => {
      const ws = new FeishuWebSocket(config, client);
      await ws.start();
      ws.stop();
      
      expect(ws.isConnected()).toBe(false);
    });
  });

  describe('消息回调', () => {
    it('should register message callback', async () => {
      const ws = new FeishuWebSocket(config, client);
      const callback = vi.fn();
      ws.onMessage(callback);
      
      await ws.start();
      
      // 模拟消息
      MockWebSocket.instances[0].onmessage!({
        data: JSON.stringify({
          type: 'im.message.receive_v1',
          data: {
            message: {
              message_id: 'om_123',
              chat_id: 'oc_123',
              chat_type: 'p2p',
              content: '{"text":"test"}',
              sender: { sender_id: { user_id: 'ou_123' } },
            },
          },
        }),
      });
      
      expect(callback).toHaveBeenCalled();
      ws.stop();
    });
  });

  describe('配置选项', () => {
    it('should accept maxRetries option', async () => {
      const ws = new FeishuWebSocket(config, client, { maxRetries: 3 });
      await ws.start();
      ws.stop();
    });
  });
});