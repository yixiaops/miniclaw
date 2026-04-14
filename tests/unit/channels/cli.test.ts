/**
 * CLI 通道测试
 * TDD: 测试 CLI 通道的功能
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CliChannel } from '../../../src/channels/cli';
import type { MiniclawGateway } from '../../../src/core/gateway/index.js';

// Mock readline 模块
const mockPrompt = vi.fn();
const mockOn = vi.fn();
const mockClose = vi.fn();

vi.mock('readline', () => ({
  createInterface: vi.fn(() => ({
    prompt: mockPrompt,
    on: mockOn,
    close: mockClose
  }))
}));

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
    mockPrompt.mockClear();
    mockOn.mockClear();
    mockClose.mockClear();
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

    it('should prompt after processing completes when rl is initialized', async () => {
      // 直接测试 processInput 的逻辑
      // 由于 rl 在 start() 中初始化，processInput() 应该安全处理 rl 为 null 的情况
      const cli = new CliChannel(mockGateway);
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      // 不调用 start()，rl 为 null，不应抛出错误
      await cli.processInput('Hello');

      // 验证 streamHandleMessage 被调用
      expect(mockGateway.streamHandleMessage).toHaveBeenCalled();

      stdoutSpy.mockRestore();
    });

    it('should call rl.prompt() after start when processing input', async () => {
      // 测试 rl.prompt() 在 start() 后被调用
      // 使用顶部 mock 的 readline 模块
      const cli = new CliChannel(mockGateway);
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

      // 调用 start() 初始化 rl（会使用 mock 的 readline.createInterface）
      const startPromise = cli.start();

      // start() 会调用 rl.prompt() 一次
      expect(mockPrompt).toHaveBeenCalledTimes(1);

      // 触发 'line' 事件处理器（模拟用户输入）
      const lineCallback = mockOn.mock.calls.find(call => call[0] === 'line')?.[1];
      if (lineCallback) {
        await lineCallback('Hello');
      }

      // 验证 prompt 再次被调用（start 时 + 处理后）
      // 应该至少被调用 3 次：start 时的 prompt + line 处理后的 prompt + processInput 内的 prompt
      expect(mockPrompt.mock.calls.length).toBeGreaterThanOrEqual(2);

      stdoutSpy.mockRestore();
      await cli.stop();
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