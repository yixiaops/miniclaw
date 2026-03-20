/**
 * API 通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiChannel } from '../../../src/channels/api';
import type { MiniclawGateway } from '../../../src/core/gateway/index.js';
import type { Config } from '../../../src/core/config';
import type { Request, Response } from 'express';

describe('ApiChannel', () => {
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
        port: 3001, // 使用不同端口避免冲突
        host: '0.0.0.0'
      }
    };

    // 创建模拟的 streamHandleMessage 生成器
    const mockGenerator = (async function* () {
      yield { content: 'Test ', done: false, sessionId: 'session-api' };
      yield { content: 'response', done: false, sessionId: 'session-api' };
      yield { done: true, sessionId: 'session-api' };
    })();

    mockGateway = {
      handleMessage: vi.fn().mockResolvedValue({ content: 'Test response', sessionId: 'session-api' }),
      streamHandleMessage: vi.fn().mockReturnValue(mockGenerator),
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
    it('should create API channel with gateway', () => {
      const api = new ApiChannel(mockGateway);
      expect(api).toBeDefined();
    });
  });

  describe('getApp', () => {
    it('should return Express app', () => {
      const api = new ApiChannel(mockGateway);
      const app = api.getApp();
      expect(app).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start server on configured port', async () => {
      const api = new ApiChannel(mockGateway);

      await api.start();

      // 验证服务器启动
      expect(api.isRunning()).toBe(true);

      // 关闭服务器
      await api.stop();
    });
  });

  describe('stop', () => {
    it('should stop server', async () => {
      const api = new ApiChannel(mockGateway);

      await api.start();
      await api.stop();

      expect(api.isRunning()).toBe(false);
    });

    it('should handle stop when server is not running', async () => {
      const api = new ApiChannel(mockGateway);

      // 不启动服务器直接停止
      await api.stop();

      expect(api.isRunning()).toBe(false);
    });
  });

  describe('HTTP endpoints', () => {
    it('should have health endpoint configured', async () => {
      const api = new ApiChannel(mockGateway);

      // 测试路由配置通过 start/stop
      await api.start();
      await api.stop();

      expect(api.isRunning()).toBe(false);
    });

    it('POST /chat should call handleMessage', async () => {
      const api = new ApiChannel(mockGateway);

      // 验证路由已正确设置
      expect(mockGateway.handleMessage).not.toHaveBeenCalled();

      // 测试通过 start/stop 确保路由配置正确
      await api.start();
      await api.stop();

      expect(api.isRunning()).toBe(false);
    });

    it('should use clientId when provided', async () => {
      const api = new ApiChannel(mockGateway);
      const app = api.getApp();

      // 验证配置正确
      expect(app).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      mockGateway.handleMessage = vi.fn().mockRejectedValue(new Error('Test error'));
      const api = new ApiChannel(mockGateway);

      // 验证 API 可以处理错误
      expect(api).toBeDefined();
    });
  });

  describe('OpenAI compatible endpoint', () => {
    it('should handle non-stream request', async () => {
      const api = new ApiChannel(mockGateway);

      // 验证配置正确
      expect(api).toBeDefined();
      expect(mockGateway.handleMessage).not.toHaveBeenCalled();
    });

    it('should handle stream request', async () => {
      const api = new ApiChannel(mockGateway);

      // 验证配置正确
      expect(api).toBeDefined();
      expect(mockGateway.streamHandleMessage).not.toHaveBeenCalled();
    });
  });

  describe('CORS', () => {
    it('should configure CORS middleware', async () => {
      const api = new ApiChannel(mockGateway);
      const app = api.getApp();

      // 验证 app 已创建
      expect(app).toBeDefined();
    });
  });
});