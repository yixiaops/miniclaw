/**
 * 飞书通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  afterEach(() => {
    vi.clearAllMocks();
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

      expect(() => new FeishuChannel(gatewayWithoutFeishu)).toThrow('Feishu configuration is required');
    });
  });

  describe('start', () => {
    it('should start WebSocket connection', async () => {
      const feishu = new FeishuChannel(mockGateway);

      await feishu.start();

      expect(feishu.isRunning()).toBe(true);

      feishu.stop();
    });
  });

  describe('stop', () => {
    it('should stop WebSocket connection', async () => {
      const feishu = new FeishuChannel(mockGateway);

      await feishu.start();
      feishu.stop();

      expect(feishu.isRunning()).toBe(false);
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
      expect(response?.msgType).toBe('text');
      expect(response?.content).toBe('Test response');
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

    it('should handle whitespace-only message', async () => {
      const feishu = new FeishuChannel(mockGateway);

      const response = await feishu.processMessage({
        messageId: 'test_msg_id',
        messageType: 'text',
        content: '   ',
        senderId: 'ou_test_user'
      });

      expect(response).toBeNull();
    });

    it('should return unsupported message for non-text types', async () => {
      const feishu = new FeishuChannel(mockGateway);

      const response = await feishu.processMessage({
        messageId: 'test_msg_id',
        messageType: 'image',
        content: 'image_key',
        senderId: 'ou_test_user'
      });

      expect(response).toBeDefined();
      expect(response?.msgType).toBe('text');
      expect(response?.content).toBe('暂不支持此类型消息');
    });

    it('should handle post message type', async () => {
      const feishu = new FeishuChannel(mockGateway);

      const response = await feishu.processMessage({
        messageId: 'test_msg_id',
        messageType: 'post',
        content: 'post_content',
        senderId: 'ou_test_user'
      });

      expect(response?.content).toBe('暂不支持此类型消息');
    });

    it('should handle file message type', async () => {
      const feishu = new FeishuChannel(mockGateway);

      const response = await feishu.processMessage({
        messageId: 'test_msg_id',
        messageType: 'file',
        content: 'file_key',
        senderId: 'ou_test_user'
      });

      expect(response?.content).toBe('暂不支持此类型消息');
    });

    it('should pass groupId when chatId is provided', async () => {
      const feishu = new FeishuChannel(mockGateway);

      await feishu.processMessage({
        messageId: 'test_msg_id',
        messageType: 'text',
        content: 'Hello',
        senderId: 'ou_test_user',
        chatId: 'oc_test_chat'
      });

      expect(mockGateway.handleMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 'oc_test_chat'
        })
      );
    });
  });

  describe('sendReply', () => {
    it('should send text reply', async () => {
      const feishu = new FeishuChannel(mockGateway);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await feishu.sendReply('msg_id', { msgType: 'text', content: 'Reply content' });

      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      const feishu = new FeishuChannel(mockGateway);
      expect(feishu.isRunning()).toBe(false);
    });

    it('should return true after start', async () => {
      const feishu = new FeishuChannel(mockGateway);
      await feishu.start();
      expect(feishu.isRunning()).toBe(true);
      feishu.stop();
    });
  });
});