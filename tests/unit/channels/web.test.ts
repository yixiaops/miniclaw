/**
 * WebChat 通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
        port: 3000,
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
  });
});