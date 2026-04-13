/**
 * CLI 通道测试
 * TDD: 测试 CLI 通道的功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CliChannel } from '../../../src/channels/cli';
import type { MiniclawGateway } from '../../../src/core/gateway/index.js';

describe('CliChannel', () => {
  let mockGateway: MiniclawGateway;
  let mockAgent: any;

  beforeEach(() => {
    // 创建模拟的 streamHandleMessage 生成器
    const mockGenerator = (async function* () {
      yield { content: 'Test ', done: false, sessionId: 'session-cli' };
      yield { content: 'response', done: false, sessionId: 'session-cli' };
      yield { done: true, sessionId: 'session-cli' };
    })();

    // 创建模拟的 Agent
    mockAgent = {
      chat: vi.fn().mockResolvedValue({ content: 'Test response' }),
      streamChat: vi.fn().mockReturnValue(mockGenerator),
      getHistory: vi.fn().mockReturnValue([]),
      reset: vi.fn(),
      registerTool: vi.fn(),
      getTools: vi.fn().mockReturnValue([]),
      setModel: vi.fn(),
      getModelConfig: vi.fn().mockReturnValue({
        model: 'qwen-plus',
        provider: 'bailian',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      })
    };

    mockGateway = {
      handleMessage: vi.fn().mockResolvedValue({ content: 'Test response', sessionId: 'session-cli' }),
      streamHandleMessage: vi.fn().mockReturnValue(mockGenerator),
      getOrCreateAgent: vi.fn().mockReturnValue({ agent: mockAgent, sessionId: 'session-cli' }),
      getStatus: vi.fn().mockReturnValue({ agentCount: 0, sessionCount: 0 }),
      destroySession: vi.fn(),
      cleanup: vi.fn(),
      getRouter: vi.fn(),
      getSessionManager: vi.fn(),
      getAgentRegistry: vi.fn(),
      getConfig: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create CLI channel with gateway', () => {
      const cli = new CliChannel(mockGateway);
      expect(cli).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start CLI interface', async () => {
      const cli = new CliChannel(mockGateway);

      // start() 应该返回一个 Promise，不会自动退出
      expect(cli.start).toBeDefined();
    });
  });

  describe('processInput', () => {
    it('should process user input via streamHandleMessage', async () => {
      const cli = new CliChannel(mockGateway);

      // 捕获 stdout
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await cli.processInput('Hello');

      expect(mockGateway.streamHandleMessage).toHaveBeenCalled();

      stdoutSpy.mockRestore();
    });

    it('should handle exit command', async () => {
      const cli = new CliChannel(mockGateway);

      // 模拟 process.exit
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await cli.processInput('/exit');

      // exit 命令会调用 process.exit(0)
      expect(exitSpy).toHaveBeenCalledWith(0);

      exitSpy.mockRestore();
    });

    it('should handle quit command', async () => {
      const cli = new CliChannel(mockGateway);

      // quit 命令会被识别为命令
      await cli.processInput('/quit');

      // 验证 getOrCreateAgent 被调用
      expect(mockGateway.getOrCreateAgent).toHaveBeenCalled();
    });

    it('should handle reset command', async () => {
      const cli = new CliChannel(mockGateway);

      // reset 命令会调用 agent.reset()
      await cli.processInput('/reset');

      // reset 命令会调用 getOrCreateAgent
      expect(mockGateway.getOrCreateAgent).toHaveBeenCalled();
      expect(mockAgent.reset).toHaveBeenCalled();
    });

    it('should handle help command', async () => {
      const cli = new CliChannel(mockGateway);

      // 捕获 console.log
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.processInput('/help');

      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should handle /model command without args to show current model', async () => {
      const cli = new CliChannel(mockGateway);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.processInput('/model');

      expect(mockAgent.getModelConfig).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should handle /model command with args to switch model', async () => {
      const cli = new CliChannel(mockGateway);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.processInput('/model qwen-max');

      expect(mockAgent.setModel).toHaveBeenCalledWith('qwen-max');
      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });

    it('should handle /clear command', async () => {
      const cli = new CliChannel(mockGateway);

      const clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {});

      await cli.processInput('/clear');

      expect(clearSpy).toHaveBeenCalled();

      clearSpy.mockRestore();
    });

    it('should handle unknown command', async () => {
      const cli = new CliChannel(mockGateway);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await cli.processInput('/unknown');

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('未知命令'));

      logSpy.mockRestore();
    });

    it('should handle tool execution status in stream', async () => {
      // 创建带有工具状态的生成器
      const toolGenerator = (async function* () {
        yield { toolName: 'test-tool', toolStatus: 'start', done: false };
        yield { toolName: 'test-tool', toolStatus: 'end', done: false };
        yield { content: 'Tool result', done: false };
        yield { done: true };
      })();

      mockGateway.streamHandleMessage = vi.fn().mockReturnValue(toolGenerator);

      const cli = new CliChannel(mockGateway);
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await cli.processInput('Use the tool');

      expect(stdoutSpy).toHaveBeenCalled();

      stdoutSpy.mockRestore();
    });

    it('should handle empty string input', async () => {
      const cli = new CliChannel(mockGateway);

      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      // 空字符串会被当作普通消息处理
      await cli.processInput('');

      // 空内容也会触发 streamHandleMessage
      expect(mockGateway.streamHandleMessage).toHaveBeenCalled();

      stdoutSpy.mockRestore();
    });

    it('should prompt after processing completes', async () => {
      const cli = new CliChannel(mockGateway);
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      await cli.processInput('Hello');

      // 验证最后输出包含换行符（后续会调用 prompt）
      const calls = stdoutSpy.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[0]).toContain('\n');

      stdoutSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop CLI', async () => {
      const cli = new CliChannel(mockGateway);

      await cli.stop();

      expect(cli.isRunning()).toBe(false);
    });

    it('should be idempotent - calling stop multiple times', async () => {
      const cli = new CliChannel(mockGateway);

      await cli.stop();
      await cli.stop();

      expect(cli.isRunning()).toBe(false);
    });
  });
});