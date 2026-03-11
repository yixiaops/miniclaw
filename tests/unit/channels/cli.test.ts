/**
 * CLI 通道测试
 * TDD: 测试 CLI 通道的功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CliChannel } from '../../../src/channels/cli';
import type { MiniclawAgent } from '../../../src/core/agent';
import type { Config } from '../../../src/core/config';

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

    // 创建模拟的 streamChat 生成器
    const mockGenerator = (async function* () {
      yield { content: 'Test ', done: false };
      yield { content: 'response', done: false };
      yield { done: true };
    })();

    mockAgent = {
      chat: vi.fn().mockResolvedValue({ content: 'Test response' }),
      streamChat: vi.fn().mockReturnValue(mockGenerator),
      getHistory: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
      registerTool: vi.fn(),
      getTools: vi.fn().mockReturnValue([]),
      getModelConfig: vi.fn().mockReturnValue({
        provider: 'bailian',
        model: 'qwen-plus',
        baseUrl: 'https://api.example.com'
      }),
      setModel: vi.fn()
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
    it('should process user input via streamChat', async () => {
      const cli = new CliChannel(mockAgent);
      
      // 捕获 stdout
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
      
      await cli.processInput('Hello');
      
      expect(mockAgent.streamChat).toHaveBeenCalledWith('Hello');
      
      stdoutSpy.mockRestore();
    });

    it('should handle exit command', async () => {
      const cli = new CliChannel(mockAgent);
      
      // 模拟 process.exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      
      await cli.processInput('/exit');
      
      // exit 命令会调用 process.exit(0)
      expect(exitSpy).toHaveBeenCalledWith(0);
      
      exitSpy.mockRestore();
    });

    it('should handle reset command', async () => {
      const cli = new CliChannel(mockAgent);
      
      await cli.processInput('/reset');
      
      expect(mockAgent.reset).toHaveBeenCalled();
    });

    it('should handle help command', async () => {
      const cli = new CliChannel(mockAgent);
      
      // 捕获 console.log
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await cli.processInput('/help');
      
      expect(logSpy).toHaveBeenCalled();
      
      logSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop CLI', async () => {
      const cli = new CliChannel(mockAgent);
      
      await cli.stop();
      
      expect(cli.isRunning()).toBe(false);
    });
  });
});