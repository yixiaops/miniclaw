/**
 * 飞书通道测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeishuChannel } from '../../../src/channels/feishu.js';

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
    feishu: { appId: 'cli_test', appSecret: 'test_secret' },
  }),
  handleMessage: vi.fn().mockResolvedValue({ content: 'Test reply' }),
};

describe('FeishuChannel', () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.clearAllMocks();
  });

  describe('构造函数', () => {
    it('should create Feishu channel with gateway', () => {
      const channel = new FeishuChannel(mockGateway as any);
      expect(channel).toBeDefined();
    });

    it('should throw error if feishu config is missing', () => {
      const gatewayNoConfig = {
        getConfig: () => ({}),
      };
      expect(() => new FeishuChannel(gatewayNoConfig as any)).toThrow('Feishu configuration is required');
    });
  });

  describe('start', () => {
    it('should start WebSocket connection', async () => {
      const channel = new FeishuChannel(mockGateway as any);
      await channel.start();
      expect(channel.isRunning()).toBe(true);
      channel.stop();
    });
  });

  describe('stop', () => {
    it('should stop WebSocket connection', async () => {
      const channel = new FeishuChannel(mockGateway as any);
      await channel.start();
      channel.stop();
      expect(channel.isRunning()).toBe(false);
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      const channel = new FeishuChannel(mockGateway as any);
      expect(channel.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      const channel = new FeishuChannel(mockGateway as any);
      await channel.start();
      expect(channel.isRunning()).toBe(true);
      channel.stop();
    });
  });

  describe('组件访问', () => {
    it('should provide client access', () => {
      const channel = new FeishuChannel(mockGateway as any);
      expect(channel.getClient()).toBeDefined();
    });

    it('should provide websocket access', () => {
      const channel = new FeishuChannel(mockGateway as any);
      expect(channel.getWebSocket()).toBeDefined();
    });

    it('should provide deduplicator access', () => {
      const channel = new FeishuChannel(mockGateway as any);
      expect(channel.getDeduplicator()).toBeDefined();
    });
  });
});