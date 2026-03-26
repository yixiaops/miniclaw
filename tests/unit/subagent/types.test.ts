/**
 * @fileoverview 子代理类型测试
 */

import { describe, it, expect } from 'vitest';
import type { SubagentStatus, SubagentInfo, SpawnOptions } from '../../../src/core/subagent/types.js';

describe('SubagentTypes', () => {
  it('should define correct status types', () => {
    const statuses: SubagentStatus[] = [
      'pending', 'running', 'completed', 'failed', 'timeout', 'killed'
    ];
    
    expect(statuses).toHaveLength(6);
    expect(statuses).toContain('pending');
    expect(statuses).toContain('running');
    expect(statuses).toContain('completed');
  });

  it('should create valid SubagentInfo', () => {
    const info: SubagentInfo = {
      id: 'sub-test-123',
      agentId: 'main',
      sessionKey: 'subagent:main:sub-test-123',
      task: 'Test task',
      status: 'pending',
      createdAt: new Date(),
      timeout: 60000
    };

    expect(info.id).toBe('sub-test-123');
    expect(info.status).toBe('pending');
    expect(info.timeout).toBe(60000);
  });

  it('should create valid SpawnOptions', () => {
    const options: SpawnOptions = {
      task: 'Test task',
      agentId: 'etf',
      timeout: 30000,
      skills: ['etf-analysis'],
      model: 'qwen-plus'
    };

    expect(options.task).toBe('Test task');
    expect(options.agentId).toBe('etf');
    expect(options.skills).toContain('etf-analysis');
  });

  it('should allow optional fields in SubagentInfo', () => {
    const info: SubagentInfo = {
      id: 'sub-1',
      agentId: 'main',
      sessionKey: 'subagent:main:sub-1',
      task: 'Task',
      status: 'completed',
      createdAt: new Date(),
      timeout: 60000,
      result: 'Task completed successfully',
      startedAt: new Date(),
      endedAt: new Date()
    };

    expect(info.result).toBeDefined();
    expect(info.startedAt).toBeDefined();
    expect(info.endedAt).toBeDefined();
  });
});