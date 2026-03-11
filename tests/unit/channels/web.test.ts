/**
 * WebChat 通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebChannel } from '../../../src/channels/web';
import { MiniclawAgent } from '../../../src/core/agent';
import type { Config } from '../../../src/core/config';

// Mock MiniclawAgent
vi.mock('../../../src/core/agent');

describe('WebChannel', () => {
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
    it('should create Web channel with agent and config', () => {
      const web = new WebChannel(mockAgent, mockConfig);
      expect(web).toBeDefined();
    });
  });

  describe('getApp', () => {
    it('should return Express app', () => {
      const web = new WebChannel(mockAgent, mockConfig);
      const app = web.getApp();
      expect(app).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start server on configured port', async () => {
      const web = new WebChannel(mockAgent, mockConfig);
      
      await web.start();
      
      expect(web.isRunning()).toBe(true);
      
      await web.stop();
    });
  });

  describe('stop', () => {
    it('should stop server', async () => {
      const web = new WebChannel(mockAgent, mockConfig);
      
      await web.start();
      await web.stop();
      
      expect(web.isRunning()).toBe(false);
    });
  });
});