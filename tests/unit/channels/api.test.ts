/**
 * API 通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiChannel } from '../../../src/channels/api';
import type { MiniclawGateway } from '../../../src/core/gateway/index.js';
import type { Config } from '../../../src/core/config';

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
        port: 3000,
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
  });
});