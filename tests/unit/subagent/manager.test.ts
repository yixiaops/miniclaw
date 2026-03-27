/**
 * @fileoverview 子代理管理器测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentManager } from '../../../src/core/subagent/manager.js';
import type { AgentRegistry } from '../../../src/core/agent/registry.js';
import type { AgentConfig } from '../../../src/core/config.js';

/**
 * 创建 mock AgentRegistry
 */
function createMockRegistry(): AgentRegistry {
  const configs = new Map<string, AgentConfig>();
  
  // 默认配置 main 允许创建 etf 和 policy
  configs.set('main', {
    id: 'main',
    name: 'Main Agent',
    subagents: {
      allowAgents: ['etf', 'policy']
    }
  });
  
  configs.set('etf', {
    id: 'etf',
    name: 'ETF Agent'
  });
  
  configs.set('policy', {
    id: 'policy',
    name: 'Policy Agent'
  });

  return {
    getConfig: (agentId: string) => configs.get(agentId),
    getAgentTypes: () => Array.from(configs.keys()),
    canSpawnSubagent: (parentAgentId: string, childAgentId: string) => {
      const config = configs.get(parentAgentId);
      if (!config?.subagents?.allowAgents) return false;
      return config.subagents.allowAgents.includes(childAgentId);
    },
    getOrCreate: vi.fn(),
    get: vi.fn(),
    destroy: vi.fn(),
    loadConfigs: vi.fn(),
    getMaxSubagentConcurrent: () => 5,
    getAgentId: vi.fn(),
    count: () => 0,
    getSessionKeys: () => [],
    destroyAll: vi.fn(),
    cleanupIdle: vi.fn(),
    getLastAccessTime: () => 0
  } as unknown as AgentRegistry;
}

describe('SubagentManager', () => {
  let manager: SubagentManager;
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = createMockRegistry();
    manager = new SubagentManager({
      maxConcurrent: 3,
      defaultTimeout: 1000
    }, registry);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('spawn', () => {
    it('should create a subagent with UUID', async () => {
      const id = await manager.spawn({ task: 'Test task' });
      
      expect(id).toBeDefined();
      expect(id).toMatch(/^sub-/);
      expect(id.length).toBeGreaterThan(10);
    });

    it('should create subagent with correct info', async () => {
      const id = await manager.spawn({
        task: 'Test task',
        agentId: 'etf',
        timeout: 5000,
        skills: ['analysis']
      });

      const info = manager.get(id);
      
      expect(info).toBeDefined();
      expect(info?.task).toBe('Test task');
      expect(info?.agentId).toBe('etf');
      expect(info?.status).toBe('pending');
      expect(info?.timeout).toBe(5000);
      expect(info?.skills).toContain('analysis');
    });

    it('should use default timeout if not specified', async () => {
      const id = await manager.spawn({ task: 'Test' });
      const info = manager.get(id);
      
      expect(info?.timeout).toBe(1000);
    });

    it('should throw when max concurrent reached', async () => {
      await manager.spawn({ task: 'Task 1' });
      await manager.spawn({ task: 'Task 2' });
      await manager.spawn({ task: 'Task 3' });

      await expect(manager.spawn({ task: 'Task 4' })).rejects.toThrow(
        'Maximum concurrent subagents reached'
      );
    });

    it('should throw when permission denied', async () => {
      // etf 没有配置 allowAgents，不允许创建子代理
      await expect(manager.spawn({ 
        task: 'Test task', 
        agentId: 'main',
        parentAgentId: 'etf'
      })).rejects.toThrow('not allowed to spawn subagent');
    });

    it('should allow spawn when permission granted', async () => {
      // main 允许创建 etf
      const id = await manager.spawn({ 
        task: 'Test task', 
        agentId: 'etf',
        parentAgentId: 'main'
      });
      
      expect(id).toBeDefined();
    });
  });

  describe('status management', () => {
    it('should start execution', async () => {
      const id = await manager.spawn({ task: 'Test' });
      manager.startExecution(id);
      
      const info = manager.get(id);
      expect(info?.status).toBe('running');
      expect(info?.startedAt).toBeDefined();
    });

    it('should complete subagent', async () => {
      const id = await manager.spawn({ task: 'Test' });
      manager.startExecution(id);
      manager.complete(id, 'Result');
      
      const info = manager.get(id);
      expect(info?.status).toBe('completed');
      expect(info?.result).toBe('Result');
      expect(info?.endedAt).toBeDefined();
    });

    it('should fail subagent', async () => {
      const id = await manager.spawn({ task: 'Test' });
      manager.startExecution(id);
      manager.fail(id, 'Error message');
      
      const info = manager.get(id);
      expect(info?.status).toBe('failed');
      expect(info?.error).toBe('Error message');
    });

    it('should timeout subagent', async () => {
      const id = await manager.spawn({ task: 'Test' });
      manager.startExecution(id);
      manager.timeout(id);
      
      const info = manager.get(id);
      expect(info?.status).toBe('timeout');
      expect(info?.error).toBe('Execution timeout');
    });

    it('should kill subagent', async () => {
      const id = await manager.spawn({ task: 'Test' });
      const result = manager.kill(id);
      
      expect(result).toBe(true);
      const info = manager.get(id);
      expect(info?.status).toBe('killed');
    });

    it('should return false when killing completed subagent', async () => {
      const id = await manager.spawn({ task: 'Test' });
      manager.complete(id, 'Done');
      
      const result = manager.kill(id);
      expect(result).toBe(false);
    });
  });

  describe('query methods', () => {
    it('should get all subagents', async () => {
      await manager.spawn({ task: 'Task 1' });
      await manager.spawn({ task: 'Task 2' });
      
      const all = manager.getAll();
      expect(all.length).toBe(2);
    });

    it('should get active subagents', async () => {
      const id1 = await manager.spawn({ task: 'Task 1' });
      const id2 = await manager.spawn({ task: 'Task 2' });
      
      manager.complete(id1, 'Done');
      
      const active = manager.getActive();
      expect(active.length).toBe(1);
      expect(active[0].id).toBe(id2);
    });

    it('should get active count', async () => {
      await manager.spawn({ task: 'Task 1' });
      await manager.spawn({ task: 'Task 2' });
      
      expect(manager.getActiveCount()).toBe(2);
    });

    it('should check canSpawn', async () => {
      expect(manager.canSpawn()).toBe(true);
      
      await manager.spawn({ task: 'Task 1' });
      await manager.spawn({ task: 'Task 2' });
      await manager.spawn({ task: 'Task 3' });
      
      expect(manager.canSpawn()).toBe(false);
    });
  });

  describe('await', () => {
    it('should wait for completion', async () => {
      const id = await manager.spawn({ task: 'Test' });
      manager.startExecution(id);
      
      // 异步完成
      setTimeout(() => {
        manager.complete(id, 'Result');
      }, 50);

      const result = await manager.await(id, 1000);
      
      expect(result.success).toBe(true);
      expect(result.data).toBe('Result');
      expect(result.status).toBe('completed');
    });

    it('should return error for failed subagent', async () => {
      const id = await manager.spawn({ task: 'Test' });
      manager.startExecution(id);
      manager.fail(id, 'Test error');

      const result = await manager.await(id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
      expect(result.status).toBe('failed');
    });

    it('should timeout if takes too long', async () => {
      const id = await manager.spawn({ task: 'Test', timeout: 50 });
      manager.startExecution(id);

      // 不完成，等待超时
      const result = await manager.await(id, 100);
      
      expect(result.success).toBe(false);
      expect(result.status).toBe('timeout');
    });

    it('should return error for non-existent subagent', async () => {
      const result = await manager.await('nonexistent');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Subagent not found');
    });
  });

  describe('stats', () => {
    it('should return correct stats', async () => {
      const id1 = await manager.spawn({ task: 'Task 1' });
      const id2 = await manager.spawn({ task: 'Task 2' });
      
      manager.complete(id1, 'Done');
      manager.fail(id2, 'Error');

      const stats = manager.getStats();
      
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(0);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.maxConcurrent).toBe(3);
    });
  });

  describe('cleanup', () => {
    it('should remove completed subagents', async () => {
      const id1 = await manager.spawn({ task: 'Task 1' });
      const id2 = await manager.spawn({ task: 'Task 2' });
      
      manager.complete(id1, 'Done');
      
      const removed = manager.cleanup();
      
      expect(removed).toBe(1);
      expect(manager.getAll().length).toBe(1);
      expect(manager.get(id1)).toBeUndefined();
      expect(manager.get(id2)).toBeDefined();
    });
  });

  describe('destroy', () => {
    it('should clear all subagents', async () => {
      await manager.spawn({ task: 'Task 1' });
      await manager.spawn({ task: 'Task 2' });
      
      manager.destroy();
      
      expect(manager.getAll().length).toBe(0);
    });
  });

  describe('stopCleanup', () => {
    it('should stop cleanup timer', async () => {
      // 创建一个有清理定时器的 manager
      const newRegistry = createMockRegistry();
      const managerWithCleanup = new SubagentManager({
        cleanupInterval: 100
      }, newRegistry);
      
      await managerWithCleanup.spawn({ task: 'Test' });
      
      // 停止清理
      managerWithCleanup.stopCleanup();
      
      // 标记为完成
      const all = managerWithCleanup.getAll();
      managerWithCleanup.complete(all[0].id, 'Done');
      
      // 等待超过清理间隔
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 子代理应该还在，因为清理已停止
      expect(managerWithCleanup.getAll().length).toBe(1);
      
      managerWithCleanup.destroy();
    });
  });

  describe('await with subagent deletion', () => {
    it('should handle subagent deleted during await', async () => {
      const id = await manager.spawn({ task: 'Test' });
      manager.startExecution(id);
      
      // 在 await 之前删除 subagent
      manager.destroy();
      
      // 重新创建 manager，之前的 subagent 不存在了
      const newRegistry = createMockRegistry();
      const newManager = new SubagentManager({}, newRegistry);
      const result = await newManager.await(id);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Subagent not found');
      
      newManager.destroy();
    });
  });
});