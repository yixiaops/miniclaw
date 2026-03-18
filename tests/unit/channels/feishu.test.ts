/**
 * 飞书通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeishuChannel } from '../../../src/channels/feishu';
import type { MiniclawGateway } from '../../../src/core/gateway/index.js';
import type { Config } from '../../../src/core/config';

describe('FeishuChannel', () => {
  let mockConfig: Config;
  let mockGateway: MiniclawGateway;

  beforeEach(() => {
    mockConfig = {
      bailian: {
        apiKey: 'test-api-key',
        model: 'qwen-plus',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      },
      server: {
        port: 3000,
        host: '0.0.0.0'
      },
      feishu: {
        appId: 'cli_test_app_id',
        appSecret: 'test_app_secret'
      }
    };

    mockGateway = {
      handleMessage: vi.fn().mockResolvedValue({ content: 'Test response', sessionId: 'session-feishu' }),
      streamHandleMessage: vi.fn(),
      getOrCreateAgent: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ agentCount: 0, sessionCount: 0 }),
      destroySession: vi.fn(),
      cleanup: vi.fn(),
      getRouter: vi.fn(),
      getSessionManager: vi.fn(),
      getAgentRegistry: vi.fn(),
      getConfig: vi.fn().mockReturnValue(mockConfig)
    } as any;
  });

  describe('constructor', () => {
    it('should create Feishu channel with gateway', () => {
      const feishu = new FeishuChannel(mockGateway);
      expect(feishu).toBeDefined();
    });

    it('should throw error if feishu config is missing', () => {
      const configWithoutFeishu = { ...mockConfig, feishu: undefined };
      const gatewayWithoutFeishu = {
        ...mockGateway,
        getConfig: vi.fn().mockReturnValue(configWithoutFeishu)
      } as any;

      expect(() => new FeishuChannel(gatewayWithoutFeishu)).toThrow();
    });
  });

  describe('start', () => {
    it('should start WebSocket connection', async () => {
      const feishu = new FeishuChannel(mockGateway);

      // start 应该初始化 WebSocket 连接
      expect(feishu.start).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop WebSocket connection', () => {
      const feishu = new FeishuChannel(mockGateway);

      expect(feishu.stop).toBeDefined();
    });
  });

  describe('processMessage', () => {
    it('should process text message and return response', async () => {
      const feishu = new FeishuChannel(mockGateway);

      const response = await feishu.processMessage({
        messageId: 'test_msg_id',
        messageType: 'text',
        content: 'Hello',
        senderId: 'ou_test_user'
      });

      expect(mockGateway.handleMessage).toHaveBeenCalled();
      expect(response).toBeDefined();
    });

    it('should handle empty message', async () => {
      const feishu = new FeishuChannel(mockGateway);

      const response = await feishu.processMessage({
        messageId: 'test_msg_id',
        messageType: 'text',
        content: '',
        senderId: 'ou_test_user'
      });

      expect(response).toBeNull();
    });
  });

  describe('sendReply', () => {
    it('should send text reply', async () => {
      const feishu = new FeishuChannel(mockGateway);

      // sendReply 应该能够发送回复
      expect(feishu.sendReply).toBeDefined();
    });
  });
});