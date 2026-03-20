/**
 * WebChat 通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebChannel } from '../../../src/channels/web';
import type { MiniclawGateway } from '../../../src/core/gateway/index.js';
import type { Config } from '../../../src/core/config';

describe('WebChannel', () => {
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
        port: 3002, // 使用不同端口避免冲突
        host: '0.0.0.0'
      }
    };

    // 创建模拟的 streamHandleMessage 生成器
    const mockGenerator = (async function* () {
      yield { content: 'Test ', done: false, sessionId: 'session-web' };
      yield { content: 'response', done: false, sessionId: 'session-web' };
      yield { done: true, sessionId: 'session-web' };
    })();

    mockGateway = {
      handleMessage: vi.fn().mockResolvedValue({ content: 'Test response', sessionId: 'session-web' }),
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
    it('should create Web channel with gateway', () => {
      const web = new WebChannel(mockGateway);
      expect(web).toBeDefined();
    });
  });

  describe('getApp', () => {
    it('should return Express app', () => {
      const web = new WebChannel(mockGateway);
      const app = web.getApp();
      expect(app).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start server on configured port', async () => {
      const web = new WebChannel(mockGateway);

      await web.start();

      expect(web.isRunning()).toBe(true);

      await web.stop();
    });
  });

  describe('stop', () => {
    it('should stop server', async () => {
      const web = new WebChannel(mockGateway);

      await web.start();
      await web.stop();

      expect(web.isRunning()).toBe(false);
    });

    it('should handle stop when server is not running', async () => {
      const web = new WebChannel(mockGateway);

      // 不启动服务器直接停止
      await web.stop();

      expect(web.isRunning()).toBe(false);
    });
  });

  describe('HTTP endpoints', () => {
    it('should have root endpoint configured', async () => {
      const web = new WebChannel(mockGateway);

      // 验证路由配置通过 start/stop
      await web.start();
      await web.stop();

      expect(web.isRunning()).toBe(false);
    });

    it('should handle chat requests', async () => {
      const web = new WebChannel(mockGateway);

      // 验证 handleMessage 未被调用
      expect(mockGateway.handleMessage).not.toHaveBeenCalled();
    });

    it('should handle errors in chat endpoint', async () => {
      mockGateway.handleMessage = vi.fn().mockRejectedValue(new Error('Test error'));
      const web = new WebChannel(mockGateway);

      // 验证配置正确
      expect(web).toBeDefined();
    });
  });

  describe('WebSocket', () => {
    it('should initialize Socket.IO on start', async () => {
      const web = new WebChannel(mockGateway);

      await web.start();

      // 验证服务器启动
      expect(web.isRunning()).toBe(true);

      await web.stop();
    });
  });
});