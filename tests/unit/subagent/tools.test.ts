/**
 * @fileoverview 子代理工具测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SubagentManager, createSubagentManager } from '../../../src/core/subagent/manager.js';
import { 
  createSessionsSpawnTool, 
  createSubagentsTool,
  formatSubagentInfo 
} from '../../../src/core/subagent/tools.js';

describe('SubagentTools', () => {
  let manager: SubagentManager;
  let spawnTool: ReturnType<typeof createSessionsSpawnTool>;
  let subagentsTool: ReturnType<typeof createSubagentsTool>;

  beforeEach(() => {
    manager = createSubagentManager({
      maxConcurrent: 3,
      defaultTimeout: 1000
    });
    spawnTool = createSessionsSpawnTool(manager);
    subagentsTool = createSubagentsTool(manager);
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('sessions_spawn tool', () => {
    it('should have correct name', () => {
      expect(spawnTool.name).toBe('sessions_spawn');
    });

    it('should create subagent', async () => {
      const result = await spawnTool.execute('test-1', {
        task: 'Test task'
      });

      expect(result.success).toBe(true);
      expect(result.subagentId).toMatch(/^sub-/);
      expect(result.sessionKey).toContain('subagent:');
    });

    it('should create subagent with options', async () => {
      const result = await spawnTool.execute('test-2', {
        task: 'ETF analysis',
        agentId: 'etf',
        timeout: 30,
        skills: ['etf-analysis']
      });

      expect(result.success).toBe(true);
      
      const info = manager.get(result.subagentId);
      expect(info?.agentId).toBe('etf');
      expect(info?.skills).toContain('etf-analysis');
    });

    it('should fail when max concurrent reached', async () => {
      await spawnTool.execute('t1', { task: 'Task 1' });
      await spawnTool.execute('t2', { task: 'Task 2' });
      await spawnTool.execute('t3', { task: 'Task 3' });

      const result = await spawnTool.execute('t4', { task: 'Task 4' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum concurrent');
    });
  });

  describe('subagents tool - list', () => {
    it('should list active subagents', async () => {
      await spawnTool.execute('t1', { task: 'Task 1' });
      await spawnTool.execute('t2', { task: 'Task 2' });

      const result = await subagentsTool.execute('test', { action: 'list' });
      
      expect(result.action).toBe('list');
      expect(Array.isArray(result.data)).toBe(true);
      const list = result.data as any[];
      expect(list.length).toBe(2);
    });

    it('should return empty list when no subagents', async () => {
      const result = await subagentsTool.execute('test', { action: 'list' });
      
      const list = result.data as any[];
      expect(list.length).toBe(0);
    });
  });

  describe('subagents tool - get', () => {
    it('should get subagent info', async () => {
      const spawnResult = await spawnTool.execute('t1', { task: 'Test task' });

      const result = await subagentsTool.execute('test', {
        action: 'get',
        target: spawnResult.subagentId
      });

      expect(result.action).toBe('get');
      const info = result.data as any;
      expect(info.id).toBe(spawnResult.subagentId);
      expect(info.task).toBe('Test task');
    });

    it('should return error for missing target', async () => {
      const result = await subagentsTool.execute('test', { action: 'get' });
      
      expect(result.data).toContain('target is required');
    });

    it('should return error for non-existent subagent', async () => {
      const result = await subagentsTool.execute('test', {
        action: 'get',
        target: 'nonexistent'
      });

      expect(result.data).toContain('not found');
    });
  });

  describe('subagents tool - kill', () => {
    it('should kill subagent', async () => {
      const spawnResult = await spawnTool.execute('t1', { task: 'Test' });

      const result = await subagentsTool.execute('test', {
        action: 'kill',
        target: spawnResult.subagentId
      });

      expect(result.data).toContain('killed');
      
      const info = manager.get(spawnResult.subagentId);
      expect(info?.status).toBe('killed');
    });

    it('should return error for missing target', async () => {
      const result = await subagentsTool.execute('test', { action: 'kill' });
      
      expect(result.data).toContain('target is required');
    });
  });

  describe('subagents tool - stats', () => {
    it('should return stats', async () => {
      await spawnTool.execute('t1', { task: 'Task 1' });
      await spawnTool.execute('t2', { task: 'Task 2' });

      const result = await subagentsTool.execute('test', { action: 'stats' });
      
      expect(result.action).toBe('stats');
      const stats = result.data as any;
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
      expect(stats.maxConcurrent).toBe(3);
    });
  });

  describe('formatSubagentInfo', () => {
    it('should format subagent info', () => {
      const info = {
        id: 'sub-test-123',
        agentId: 'main',
        sessionKey: 'subagent:main:sub-test-123',
        task: 'Test task',
        status: 'completed' as const,
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
        sessionKey: 'subagent:main:sub-test',
        task: 'Test',
        status: 'failed' as const,
        createdAt: new Date(),
        timeout: 60000,
        error: 'Something went wrong'
      };

      const formatted = formatSubagentInfo(info);
      expect(formatted).toContain('Error: Something went wrong');
    });
  });

  describe('subagents tool - unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await subagentsTool.execute('test', {
        action: 'unknown' as any
      });

      expect(result.action).toBe('unknown');
      expect(result.data).toContain('Unknown action');
    });
  });
});