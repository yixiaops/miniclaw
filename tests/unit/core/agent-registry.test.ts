/**
 * @fileoverview AgentRegistry 单元测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentRegistry } from '../../../src/core/agent/registry.js';
import type { MiniclawAgent } from '../../../src/core/agent/index.js';
import type { Config } from '../../../src/core/config.js';

// Mock MiniclawAgent
const createMockAgent = (id: string): MiniclawAgent => {
  return {
    getHistory: vi.fn(() => []),
    reset: vi.fn(),
    chat: vi.fn(),
    streamChat: vi.fn(),
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
  }
};

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let createAgentFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createAgentFn = vi.fn((sessionKey: string) => createMockAgent(sessionKey));
    registry = new AgentRegistry(mockConfig, createAgentFn);
  });

  afterEach(() => {
    registry.destroyAll();
  });

  describe('getOrCreate', () => {
    it('应该创建新 Agent', () => {
      const sessionKey = 'agent:main:main';
      const agent = registry.getOrCreate(sessionKey);

      expect(agent).toBeDefined();
      // 新签名: (sessionKey, config, agentId, agentConfig, isSubagent)
      expect(createAgentFn).toHaveBeenCalledWith(sessionKey, mockConfig, 'main', undefined, false);
      expect(createAgentFn).toHaveBeenCalledTimes(1);
    });

    it('应该复用已存在的 Agent', () => {
      const sessionKey = 'agent:main:channel:cli';
      const agent1 = registry.getOrCreate(sessionKey);
      const agent2 = registry.getOrCreate(sessionKey);

      expect(agent1).toBe(agent2);
      expect(createAgentFn).toHaveBeenCalledTimes(1);
    });

    it('应该为不同的 sessionKey 创建不同的 Agent', () => {
      const agent1 = registry.getOrCreate('agent:main:main');
      const agent2 = registry.getOrCreate('agent:main:channel:cli');

      expect(agent1).not.toBe(agent2);
      expect(createAgentFn).toHaveBeenCalledTimes(2);
    });

    it('当达到最大数量时应该抛出错误', () => {
      // 创建 maxAgents 个 Agent
      const maxAgents = 50;
      for (let i = 0; i < maxAgents; i++) {
        registry.getOrCreate(`agent:main:channel:cli:peer:${i}`);
      }

      // 尝试创建第 maxAgents + 1 个 Agent
      expect(() => registry.getOrCreate('agent:main:channel:cli:peer:overflow'))
        .toThrow('Maximum number of agents reached');
    });
  });

  describe('get', () => {
    it('应该返回已存在的 Agent', () => {
      const sessionKey = 'agent:main:main';
      const created = registry.getOrCreate(sessionKey);
      const retrieved = registry.get(sessionKey);

      expect(retrieved).toBe(created);
    });

    it('应该为不存在的 Agent 返回 undefined', () => {
      const result = registry.get('agent:main:nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('应该销毁指定的 Agent', () => {
      const sessionKey = 'agent:main:main';
      registry.getOrCreate(sessionKey);

      registry.destroy(sessionKey);

      expect(registry.get(sessionKey)).toBeUndefined();
      expect(registry.count()).toBe(0);
    });

    it('销毁不存在的 Agent 应该静默处理', () => {
      expect(() => registry.destroy('agent:main:nonexistent')).not.toThrow();
    });
  });

  describe('count', () => {
    it('应该返回当前 Agent 数量', () => {
      expect(registry.count()).toBe(0);

      registry.getOrCreate('agent:main:main');
      expect(registry.count()).toBe(1);

      registry.getOrCreate('agent:main:channel:cli');
      expect(registry.count()).toBe(2);
    });

    it('销毁后应该更新数量', () => {
      registry.getOrCreate('agent:main:main');
      registry.getOrCreate('agent:main:channel:cli');

      registry.destroy('agent:main:main');
      expect(registry.count()).toBe(1);
    });
  });

  describe('getSessionKeys', () => {
    it('应该返回所有 sessionKey', () => {
      registry.getOrCreate('agent:main:main');
      registry.getOrCreate('agent:main:channel:cli');

      const keys = registry.getSessionKeys();

      expect(keys).toContain('agent:main:main');
      expect(keys).toContain('agent:main:channel:cli');
      expect(keys.length).toBe(2);
    });

    it('空注册表应该返回空数组', () => {
      const keys = registry.getSessionKeys();
      expect(keys).toEqual([]);
    });
  });

  describe('cleanupIdle', () => {
    it('应该清理空闲时间超过阈值的 Agent', async () => {
      const sessionKey = 'agent:main:main';
      registry.getOrCreate(sessionKey);

      // 直接修改内部 lastAccessedAt 为很久以前
      const agentsMap = (registry as any).agents as Map<string, { lastAccessedAt: number }>;
      const entry = agentsMap.get(sessionKey);
      if (entry) {
        entry.lastAccessedAt = Date.now() - 10000;
      }

      registry.cleanupIdle(5000);

      // 使用 count 和 getSessionKeys 验证，避免 get 方法更新 lastAccessedAt
      expect(registry.count()).toBe(0);
      expect(registry.getSessionKeys()).not.toContain(sessionKey);
    });

    it('不应该清理活跃的 Agent', async () => {
      const sessionKey = 'agent:main:main';
      registry.getOrCreate(sessionKey);

      // lastAccessedAt 是最近的，不需要修改
      registry.cleanupIdle(5000);

      expect(registry.count()).toBe(1);
      expect(registry.getSessionKeys()).toContain(sessionKey);
    });
  });

  describe('destroyAll', () => {
    it('应该销毁所有 Agent', () => {
      registry.getOrCreate('agent:main:main');
      registry.getOrCreate('agent:main:channel:cli');
      registry.getOrCreate('agent:main:channel:feishu');

      registry.destroyAll();

      expect(registry.count()).toBe(0);
      expect(registry.getSessionKeys()).toEqual([]);
    });
  });
});