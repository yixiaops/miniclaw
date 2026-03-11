/**
 * CLI 命令处理测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('CLI Commands', () => {
  let commandHandler: (input: string) => Promise<boolean>;
  let mockLifecycle: { shutdown: vi.Mock };

  beforeEach(async () => {
    vi.resetModules();
    
    // 创建模拟的生命周期管理器
    mockLifecycle = {
      shutdown: vi.fn().mockResolvedValue(undefined)
    };

    // 模拟 globalLifecycle
    vi.doMock('../../src/core/lifecycle.js', () => ({
      globalLifecycle: mockLifecycle
    }));

    // 动态导入命令处理模块
    const { handleCliCommand } = await import('../../src/channels/cli-commands.js');
    commandHandler = handleCliCommand;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('/exit 命令', () => {
    it('应该识别 /exit 命令并调用 shutdown', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      
      const result = await commandHandler('/exit');
      
      expect(result).toBe(true);
      expect(mockLifecycle.shutdown).toHaveBeenCalled();
      
      exitSpy.mockRestore();
    });

    it('应该识别 /quit 命令并调用 shutdown', async () => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
      
      const result = await commandHandler('/quit');
      
      expect(result).toBe(true);
      expect(mockLifecycle.shutdown).toHaveBeenCalled();
      
      exitSpy.mockRestore();
    });
  });

  describe('/help 命令', () => {
    it('应该识别 /help 命令', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const result = await commandHandler('/help');
      
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('/reset 命令', () => {
    it('应该识别 /reset 命令', async () => {
      const result = await commandHandler('/reset');
      
      expect(result).toBe(true);
    });
  });

  describe('/model 命令', () => {
    it('不带参数时应该显示当前模型', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // 需要传入 mock agent
      const mockAgent = {
        getModelConfig: () => ({ provider: 'bailian', model: 'qwen-plus', baseUrl: 'https://api.example.com' }),
        setModel: vi.fn()
      };
      
      const result = await commandHandler('/model', mockAgent as any);
      
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('带参数时应该切换模型', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const result = await commandHandler('/model qwen-plus');
      
      expect(result).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });

  describe('未知命令', () => {
    it('应该返回 false 表示不是命令', async () => {
      const result = await commandHandler('hello world');
      
      expect(result).toBe(false);
    });

    it('未知的 / 开头命令应该提示', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const result = await commandHandler('/unknown');
      
      expect(result).toBe(true);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('未知命令'));
      
      consoleSpy.mockRestore();
    });
  });

  describe('命令列表', () => {
    it('应该包含所有支持的命令', async () => {
      const { CLI_COMMANDS } = await import('../../src/channels/cli-commands.js');
      
      // 命令 key 不含 / 前缀
      expect(CLI_COMMANDS).toHaveProperty('exit');
      expect(CLI_COMMANDS).toHaveProperty('quit');
      expect(CLI_COMMANDS).toHaveProperty('help');
      expect(CLI_COMMANDS).toHaveProperty('reset');
      expect(CLI_COMMANDS).toHaveProperty('model');
    });
  });
});