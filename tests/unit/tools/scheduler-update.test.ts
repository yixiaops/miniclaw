/**
 * scheduler_update 工具测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSchedulerUpdateTool } from '../../../src/tools/scheduler-update.js';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('scheduler_update 工具', () => {
  let taskStore: TaskStore;
  let tempDir: string;
  let tool: ReturnType<typeof createSchedulerUpdateTool>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'scheduler-update-test-'));
    taskStore = new TaskStore(join(tempDir, 'tasks.json'));
    tool = createSchedulerUpdateTool(
      taskStore,
      () => 'test-user'
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('execute', () => {
    it('应该更新任务内容', async () => {
      // 创建任务
      taskStore.create({
        taskId: 'task-1',
        userId: 'test-user',
        channel: 'cli',
        content: '原始内容',
        summary: '原始内容',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const result = await tool.execute('call-1', {
        taskId: 'task-1',
        content: '新内容',
      });

      expect(result.content[0].text).toContain('已更新');
      expect(result.details.updatedFields).toContain('content');
      expect(result.details.success).toBe(true);

      const task = taskStore.getById('task-1');
      expect(task?.content).toBe('新内容');
      expect(task?.summary).toBe('新内容');
    });

    it('应该更新执行时间', async () => {
      taskStore.create({
        taskId: 'task-1',
        userId: 'test-user',
        channel: 'cli',
        content: '测试任务',
        summary: '测试任务',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const result = await tool.execute('call-1', {
        taskId: 'task-1',
        executeTime: '2025-02-01T10:00:00Z',
      });

      expect(result.details.updatedFields).toContain('executeTime');

      const task = taskStore.getById('task-1');
      expect(task?.executeTime).toBe('2025-02-01T10:00:00Z');
    });

    it('应该同时更新多个字段', async () => {
      taskStore.create({
        taskId: 'task-1',
        userId: 'test-user',
        channel: 'cli',
        content: '原始内容',
        summary: '原始内容',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const result = await tool.execute('call-1', {
        taskId: 'task-1',
        content: '新内容',
        executeTime: '0 10 * * *',
      });

      expect(result.details.updatedFields).toContain('content');
      expect(result.details.updatedFields).toContain('executeTime');

      const task = taskStore.getById('task-1');
      expect(task?.content).toBe('新内容');
      expect(task?.executeTime).toBe('0 10 * * *');
    });

    it('应该拒绝更新其他用户的任务', async () => {
      taskStore.create({
        taskId: 'task-1',
        userId: 'other-user',
        channel: 'cli',
        content: '其他用户任务',
        summary: '其他用户任务',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const result = await tool.execute('call-1', {
        taskId: 'task-1',
        content: '尝试更新',
      });

      expect(result.content[0].text).toContain('无法更新');
      expect(result.details.success).toBe(false);
    });

    it('应该处理没有更新字段的情况', async () => {
      taskStore.create({
        taskId: 'task-1',
        userId: 'test-user',
        channel: 'cli',
        content: '测试任务',
        summary: '测试任务',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });

      const result = await tool.execute('call-1', { taskId: 'task-1' });

      expect(result.content[0].text).toContain('没有提供更新字段');
      expect(result.details.updatedFields).toHaveLength(0);
    });
  });
});