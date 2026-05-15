/**
 * scheduler_list 工具测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSchedulerListTool } from '../../../src/tools/scheduler-list.js';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';

describe('scheduler_list 工具', () => {
  let taskStore: TaskStore;
  let tempDir: string;
  let tool: ReturnType<typeof createSchedulerListTool>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'scheduler-list-test-'));
    taskStore = new TaskStore(join(tempDir, 'tasks.json'));
    tool = createSchedulerListTool(
      taskStore,
      () => 'test-user'
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('execute', () => {
    it('应该返回空列表当没有任务', async () => {
      const result = await tool.execute('call-1', {});

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('没有定时任务');
      expect(result.details.total).toBe(0);
      expect(result.details.taskIds).toHaveLength(0);
    });

    it('应该列出用户的待执行任务', async () => {
      // 创建测试任务
      taskStore.create({
        taskId: 'task-1',
        userId: 'test-user',
        channel: 'cli',
        content: '任务1',
        summary: '任务1',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      taskStore.create({
        taskId: 'task-2',
        userId: 'test-user',
        channel: 'cli',
        content: '任务2',
        summary: '任务2',
        executeTime: '0 9 * * *',
        taskType: 'recurring',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const result = await tool.execute('call-1', {});

      expect(result.details.taskIds).toHaveLength(2);
      expect(result.details.total).toBe(2);
    });

    it('应该只列出当前用户的任务', async () => {
      // 创建不同用户的任务
      taskStore.create({
        taskId: 'task-1',
        userId: 'test-user',
        channel: 'cli',
        content: '我的任务',
        summary: '我的任务',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      taskStore.create({
        taskId: 'task-2',
        userId: 'other-user',
        channel: 'cli',
        content: '其他用户任务',
        summary: '其他用户任务',
        executeTime: '2025-01-01T10:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const result = await tool.execute('call-1', {});

      expect(result.details.taskIds).toHaveLength(1);
      expect(result.details.taskIds[0]).toBe('task-1');
    });

    it('应该只列出 pending 状态的任务', async () => {
      taskStore.create({
        taskId: 'task-1',
        userId: 'test-user',
        channel: 'cli',
        content: '待执行任务',
        summary: '待执行任务',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      taskStore.create({
        taskId: 'task-2',
        userId: 'test-user',
        channel: 'cli',
        content: '已完成任务',
        summary: '已完成任务',
        executeTime: '2025-01-01T10:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'executed',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const result = await tool.execute('call-1', {});

      expect(result.details.taskIds).toHaveLength(1);
      expect(result.details.taskIds[0]).toBe('task-1');
    });
  });
});