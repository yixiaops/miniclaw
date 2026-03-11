/**
 * CLI 通道测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CliChannel } from '../../../src/channels/cli';
import { MiniclawAgent } from '../../../src/core/agent';
import type { Config } from '../../../src/core/config';

// Mock MiniclawAgent
vi.mock('../../../src/core/agent');

describe('CliChannel', () => {
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

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create CLI channel with agent', () => {
      const cli = new CliChannel(mockAgent);
      expect(cli).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start CLI interface', async () => {
      const cli = new CliChannel(mockAgent);
      
      // start() 应该返回一个 Promise，不会自动退出
      expect(cli.start).toBeDefined();
    });
  });

  describe('processInput', () => {
    it('should process user input and return response', async () => {
      const cli = new CliChannel(mockAgent);
      
      const response = await cli.processInput('Hello');
      
      expect(mockAgent.chat).toHaveBeenCalledWith('Hello');
      expect(response).toBe('Test response');
    });

    it('should handle exit command', async () => {
      const cli = new CliChannel(mockAgent);
      
      const result = await cli.processInput('/exit');
      
      // exit 返回特殊标识
      expect(result).toBe('__EXIT__');
    });

    it('should handle reset command', async () => {
      const cli = new CliChannel(mockAgent);
      
      await cli.processInput('/reset');
      
      expect(mockAgent.reset).toHaveBeenCalled();
    });

    it('should handle help command', async () => {
      const cli = new CliChannel(mockAgent);
      
      const result = await cli.processInput('/help');
      
      expect(result).toContain('命令');
    });
  });
});