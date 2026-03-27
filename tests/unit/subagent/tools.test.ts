/**
 * @fileoverview 子代理工具测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentManager } from '../../../src/core/subagent/manager.js';
import { 
  createSessionsSpawnTool, 
  createSubagentsTool,
  formatSubagentInfo 
} from '../../../src/core/subagent/tools.js';
import type { AgentRegistry } from '../../../src/core/agent/registry.js';
import type { AgentConfig } from '../../../src/core/config.js';

/**
 * 创建 mock AgentRegistry
 */
function createMockRegistry(): AgentRegistry {
  const configs = new Map<string, AgentConfig>();
  
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

describe('SubagentTools', () => {
  let manager: SubagentManager;
  let registry: AgentRegistry;
  let spawnTool: ReturnType<typeof createSessionsSpawnTool>;
  let subagentsTool: ReturnType<typeof createSubagentsTool>;

  beforeEach(() => {
    registry = createMockRegistry();
    manager = new SubagentManager({
      maxConcurrent: 3,
      defaultTimeout: 1000
    }, registry);
    spawnTool = createSessionsSpawnTool({
      manager,
      currentAgentId: 'main'
    });
    subagentsTool = createSubagentsTool(manager);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('sessions_spawn tool', () => {
    it('should have correct name', () => {
      expect(spawnTool.name).toBe('sessions_spawn');
    });

    it('should have tool label', () => {
      expect(spawnTool.label).toBe('创建子代理');
    });

    it('should have tool description', () => {
      expect(spawnTool.description).toBeTruthy();
      expect(spawnTool.description.length).toBeGreaterThan(10);
    });

    it('should return error when max concurrent reached', async () => {
      // 创建 3 个子代理达到上限
      await manager.spawn({ task: 'Task 1' });
      await manager.spawn({ task: 'Task 2' });
      await manager.spawn({ task: 'Task 3' });

      const result = await spawnTool.execute('test-4', {
        task: 'Task 4'
      });

      expect(result.details.success).toBe(false);
      expect(result.content[0].text).toContain('最大并发');
    });

    it('should fail when permission denied', async () => {
      // etf 不允许创建 main
      const etfTool = createSessionsSpawnTool({
        manager,
        currentAgentId: 'etf'
      });

      const result = await etfTool.execute('test-1', {
        task: 'Test task',
        agentId: 'main'
      });

      expect(result.details.success).toBe(false);
      expect(result.details.error).toContain('not allowed');
    });
  });

  describe('subagents tool - list', () => {
    it('should list active subagents', async () => {
      await manager.spawn({ task: 'Task 1' });
      await manager.spawn({ task: 'Task 2' });

      const result = await subagentsTool.execute('test', { action: 'list' });
      
      expect(result.details.action).toBe('list');
      expect(result.content[0].text).toContain('sub-');
    });

    it('should return message when no subagents', async () => {
      const result = await subagentsTool.execute('test', { action: 'list' });
      
      expect(result.content[0].text).toContain('没有活跃的子代理');
    });
  });

  describe('subagents tool - get', () => {
    it('should get subagent info', async () => {
      const id = await manager.spawn({ task: 'Test task' });

      const result = await subagentsTool.execute('test', {
        action: 'get',
        target: id
      });

      expect(result.details.action).toBe('get');
      expect(result.content[0].text).toContain(id);
      expect(result.content[0].text).toContain('Test task');
    });

    it('should return error for missing target', async () => {
      const result = await subagentsTool.execute('test', { action: 'get' });
      
      expect(result.content[0].text).toContain('需要提供 target');
    });

    it('should return error for non-existent subagent', async () => {
      const result = await subagentsTool.execute('test', {
        action: 'get',
        target: 'nonexistent'
      });

      expect(result.content[0].text).toContain('不存在');
    });
  });

  describe('subagents tool - kill', () => {
    it('should kill subagent', async () => {
      const id = await manager.spawn({ task: 'Test' });

      const result = await subagentsTool.execute('test', {
        action: 'kill',
        target: id
      });

      expect(result.content[0].text).toContain('已终止');
      
      const info = manager.get(id);
      expect(info?.status).toBe('killed');
    });

    it('should return error for missing target', async () => {
      const result = await subagentsTool.execute('test', { action: 'kill' });
      
      expect(result.content[0].text).toContain('需要提供 target');
    });
  });

  describe('subagents tool - stats', () => {
    it('should return stats', async () => {
      await manager.spawn({ task: 'Task 1' });
      await manager.spawn({ task: 'Task 2' });

      const result = await subagentsTool.execute('test', { action: 'stats' });
      
      expect(result.details.action).toBe('stats');
      expect(result.content[0].text).toContain('总数: 2');
      expect(result.content[0].text).toContain('活跃: 2');
    });
  });

  describe('subagents tool - unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await subagentsTool.execute('test', {
        action: 'unknown' as any
      });

      expect(result.content[0].text).toContain('未知操作');
    });
  });

  describe('formatSubagentInfo', () => {
    it('should format subagent info', () => {
      const info = {
        id: 'sub-test-123',
        agentId: 'main',
        status: 'completed' as const,
        task: 'Test task',
        createdAt: new Date('2026-03-25T12:00:00Z'),
        timeout: 60000,
        result: 'Task completed successfully'
      };

      const formatted = formatSubagentInfo(info);
      
      expect(formatted).toContain('ID: sub-test-123');
      expect(formatted).toContain('Agent: main');
      expect(formatted).toContain('Status: completed');
      expect(formatted).toContain('Task: Test task');
    });

    it('should include error when present', () => {
      const info = {
        id: 'sub-test',
        agentId: 'main',
        status: 'failed' as const,
        task: 'Test',
        createdAt: new Date(),
        timeout: 60000,
        error: 'Something went wrong'
      };

      const formatted = formatSubagentInfo(info);
      expect(formatted).toContain('Error: Something went wrong');
    });

    it('should include parentAgentId when present', () => {
      const info = {
        id: 'sub-test',
        agentId: 'etf',
        parentAgentId: 'main',
        status: 'running' as const,
        task: 'Test',
        createdAt: new Date(),
        timeout: 60000
      };

      const formatted = formatSubagentInfo(info);
      expect(formatted).toContain('Parent: main');
    });
  });
});