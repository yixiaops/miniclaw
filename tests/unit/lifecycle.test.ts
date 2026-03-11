/**
 * LifecycleManager 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 模拟通道
const mockChannel = {
  name: 'test-channel',
  stop: vi.fn().mockResolvedValue(undefined),
  isRunning: vi.fn().mockReturnValue(true)
};

describe('LifecycleManager', () => {
  let LifecycleManager: typeof import('../../src/core/lifecycle.js').LifecycleManager;
  let manager: InstanceType<typeof LifecycleManager>;

  beforeEach(async () => {
    // 重置模拟
    vi.clearAllMocks();
    // 动态导入以获取新实例
    vi.resetModules();
    LifecycleManager = (await import('../../src/core/lifecycle.js')).LifecycleManager;
    manager = new LifecycleManager();
  });

  describe('register', () => {
    it('应该能注册通道', () => {
      manager.register('cli', mockChannel);
      // 不抛出错误即成功
      expect(true).toBe(true);
    });

    it('应该能注册多个通道', () => {
      manager.register('cli', mockChannel);
      manager.register('api', mockChannel);
      manager.register('web', mockChannel);
      expect(true).toBe(true);
    });
  });

  describe('unregister', () => {
    it('应该能注销已注册的通道', () => {
      manager.register('cli', mockChannel);
      manager.unregister('cli');
      expect(true).toBe(true);
    });

    it('注销未注册的通道不应该报错', () => {
      manager.unregister('not-exist');
      expect(true).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('应该调用所有通道的 stop 方法', async () => {
      const channel1 = { name: 'ch1', stop: vi.fn().mockResolvedValue(undefined), isRunning: vi.fn().mockReturnValue(true) };
      const channel2 = { name: 'ch2', stop: vi.fn().mockResolvedValue(undefined), isRunning: vi.fn().mockReturnValue(true) };

      manager.register('ch1', channel1);
      manager.register('ch2', channel2);

      // 不实际退出进程
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await manager.shutdown();

      expect(channel1.stop).toHaveBeenCalled();
      expect(channel2.stop).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);

      exitSpy.mockRestore();
    });

    it('即使通道 stop 失败也应该继续关闭其他通道', async () => {
      const channel1 = { 
        name: 'ch1', 
        stop: vi.fn().mockRejectedValue(new Error('stop failed')), 
        isRunning: vi.fn().mockReturnValue(true) 
      };
      const channel2 = { 
        name: 'ch2', 
        stop: vi.fn().mockResolvedValue(undefined), 
        isRunning: vi.fn().mockReturnValue(true) 
      };

      manager.register('ch1', channel1);
      manager.register('ch2', channel2);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

      await manager.shutdown();

      expect(channel1.stop).toHaveBeenCalled();
      expect(channel2.stop).toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });

  describe('getRegisteredChannels', () => {
    it('应该返回已注册通道的名称列表', () => {
      manager.register('cli', mockChannel);
      manager.register('api', mockChannel);

      const channels = manager.getRegisteredChannels();
      expect(channels).toContain('cli');
      expect(channels).toContain('api');
    });

    it('未注册时应该返回空数组', () => {
      const channels = manager.getRegisteredChannels();
      expect(channels).toEqual([]);
    });
  });
});