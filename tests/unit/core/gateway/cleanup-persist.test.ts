/**
 * @fileoverview Gateway.cleanup() 持久化测试
 *
 * 测试 Gateway.cleanup() 在销毁资源前调用 memoryManager.persist()
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Config } from '../../../../src/core/config.js';
import type { MiniclawAgent } from '../../../../src/core/agent/index.js';
import type { MemoryManager } from '../../../../src/memory/manager.js';

// Mock MiniclawAgent
const createMockAgent = (): MiniclawAgent => {
  return {
    getHistory: vi.fn(() => []),
    reset: vi.fn(),
    chat: vi.fn(async () => ({ content: '测试响应' })),
    streamChat: vi.fn(async function* () {
      yield { content: '测试', done: false };
      yield { content: '响应', done: false };
      yield { done: true };
    }),
    registerTool: vi.fn(),
    getTools: vi.fn(() => []),
    clearTools: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    abort: vi.fn(),
    getConfig: vi.fn(),
    getSystemPrompt: vi.fn(),
    setSystemPrompt: vi.fn(),
    getModelConfig: vi.fn(),
    setModel: vi.fn()
  } as unknown as MiniclawAgent;
};

// Mock MemoryManager
const createMockMemoryManager = (): MemoryManager => {
  return {
    initialize: vi.fn(async () => {}),
    write: vi.fn(async () => 'memory-id'),
    search: vi.fn(async () => []),
    promote: vi.fn(async () => null),
    promoteAll: vi.fn(async () => []),
    cleanup: vi.fn(async () => ({ expired: 0, promoted: 0, cleaned: 0 })),
    persist: vi.fn(async () => {}),
    getStatus: vi.fn(() => ({
      shortTermCount: 0,
      longTermCount: 0,
      bySession: {},
      avgImportance: 0,
      ttlRunning: false
    })),
    destroy: vi.fn()
  } as unknown as MemoryManager;
};

// Mock Config
const mockConfig: Config = {
  bailian: {
    apiKey: 'test-api-key',
    model: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  memory: {
    enabled: true
  }
};

describe('Gateway.cleanup() persist', () => {
  let MiniclawGateway: typeof import('../../../../src/core/gateway/index.js').MiniclawGateway;
  let gateway: InstanceType<typeof MiniclawGateway>;
  let createAgentFn: ReturnType<typeof vi.fn>;
  let mockMemoryManager: MemoryManager;

  beforeEach(async () => {
    // 动态导入模块
    const gatewayModule = await import('../../../../src/core/gateway/index.js');
    MiniclawGateway = gatewayModule.MiniclawGateway;

    createAgentFn = vi.fn(() => createMockAgent());
    mockMemoryManager = createMockMemoryManager();

    gateway = new MiniclawGateway(mockConfig, {
      createAgentFn,
      memoryManager: mockMemoryManager
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanup with memoryManager', () => {
    it('should call memoryManager.persist() before destroying resources', async () => {
      // 先创建一个 session 以激活 gateway
      const ctx = {
        channel: 'cli',
        content: '你好'
      };
      await gateway.handleMessage(ctx);

      // 获取 persist mock
      const persistMock = vi.mocked(mockMemoryManager.persist);

      // 执行 cleanup
      await gateway.cleanup();

      // 验证 persist 被调用
      expect(persistMock).toHaveBeenCalled();
    });

    it('should call persist before destroy operations', async () => {
      const ctx = {
        channel: 'cli',
        content: '你好'
      };
      await gateway.handleMessage(ctx);

      const persistMock = vi.mocked(mockMemoryManager.persist);

      // 执行 cleanup
      await gateway.cleanup();

      // persist 应该被调用一次
      expect(persistMock).toHaveBeenCalledTimes(1);
    });

    it('should not throw when persist fails (silent degradation)', async () => {
      const ctx = {
        channel: 'cli',
        content: '你好'
      };
      await gateway.handleMessage(ctx);

      // 让 persist 抛出异常
      const persistMock = vi.mocked(mockMemoryManager.persist);
      persistMock.mockRejectedValueOnce(new Error('Persist failed'));

      // cleanup 不应该抛出异常
      await expect(gateway.cleanup()).resolves.not.toThrow();
    });

    it('should still cleanup resources even when memoryManager is undefined', async () => {
      // 创建没有 memoryManager 的 gateway
      const noMemoryGateway = new MiniclawGateway(mockConfig, {
        createAgentFn
      });

      const ctx = {
        channel: 'cli',
        content: '你好'
      };

      await noMemoryGateway.handleMessage(ctx);
      await noMemoryGateway.cleanup();

      const status = noMemoryGateway.getStatus();
      expect(status.agentCount).toBe(0);
      expect(status.sessionCount).toBe(0);
    });

    it('should cleanup all resources after persist', async () => {
      const ctx = {
        channel: 'cli',
        content: '你好'
      };
      await gateway.handleMessage(ctx);

      await gateway.cleanup();

      const status = gateway.getStatus();
      expect(status.agentCount).toBe(0);
      expect(status.sessionCount).toBe(0);
    });
  });
});