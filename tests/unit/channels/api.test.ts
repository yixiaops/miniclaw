/**
 * API 通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiChannel } from '../../../src/channels/api';
import { MiniclawAgent } from '../../../src/core/agent';
import type { Config } from '../../../src/core/config';

// Mock MiniclawAgent
vi.mock('../../../src/core/agent');

describe('ApiChannel', () => {
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
    it('should create API channel with agent and config', () => {
      const api = new ApiChannel(mockAgent, mockConfig);
      expect(api).toBeDefined();
    });
  });

  describe('getApp', () => {
    it('should return Express app', () => {
      const api = new ApiChannel(mockAgent, mockConfig);
      const app = api.getApp();
      expect(app).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start server on configured port', async () => {
      const api = new ApiChannel(mockAgent, mockConfig);
      
      await api.start();
      
      // 验证服务器启动
      expect(api.isRunning()).toBe(true);
      
      // 关闭服务器
      await api.stop();
    });
  });

  describe('stop', () => {
    it('should stop server', async () => {
      const api = new ApiChannel(mockAgent, mockConfig);
      
      await api.start();
      await api.stop();
      
      expect(api.isRunning()).toBe(false);
    });
  });
});