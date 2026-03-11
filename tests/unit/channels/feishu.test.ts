/**
 * 飞书通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeishuChannel } from '../../../src/channels/feishu';
import { MiniclawAgent } from '../../../src/core/agent';
import type { Config } from '../../../src/core/config';

// Mock MiniclawAgent
vi.mock('../../../src/core/agent');

describe('FeishuChannel', () => {
  let mockConfig: Config;
  let mockAgent: MiniclawAgent;

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

    mockAgent = {
      chat: vi.fn().mockResolvedValue({ content: 'Test response' }),
      streamChat: vi.fn(),
      getHistory: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
      registerTool: vi.fn(),
      getTools: vi.fn().mockReturnValue([])
    } as any;
  });

  describe('constructor', () => {
    it('should create Feishu channel with agent and config', () => {
      const feishu = new FeishuChannel(mockAgent, mockConfig);
      expect(feishu).toBeDefined();
    });

    it('should throw error if feishu config is missing', () => {
      const configWithoutFeishu = { ...mockConfig, feishu: undefined };
      
      expect(() => new FeishuChannel(mockAgent, configWithoutFeishu)).toThrow();
    });
  });

  describe('start', () => {
    it('should start WebSocket connection', async () => {
      const feishu = new FeishuChannel(mockAgent, mockConfig);
      
      // start 应该初始化 WebSocket 连接
      expect(feishu.start).toBeDefined();
    });
  });

  describe('stop', () => {
    it('should stop WebSocket connection', () => {
      const feishu = new FeishuChannel(mockAgent, mockConfig);
      
      expect(feishu.stop).toBeDefined();
    });
  });

  describe('processMessage', () => {
    it('should process text message and return response', async () => {
      const feishu = new FeishuChannel(mockAgent, mockConfig);
      
      const response = await feishu.processMessage({
        messageId: 'test_msg_id',
        messageType: 'text',
        content: 'Hello',
        senderId: 'ou_test_user'
      });
      
      expect(mockAgent.chat).toHaveBeenCalledWith('Hello');
      expect(response).toBeDefined();
    });

    it('should handle empty message', async () => {
      const feishu = new FeishuChannel(mockAgent, mockConfig);
      
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
      const feishu = new FeishuChannel(mockAgent, mockConfig);
      
      // sendReply 应该能够发送回复
      expect(feishu.sendReply).toBeDefined();
    });
  });
});