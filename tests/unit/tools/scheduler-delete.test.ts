/**
 * scheduler_delete 工具测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSchedulerDeleteTool } from '../../../src/tools/scheduler-delete.js';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('scheduler_delete 工具', () => {
  let taskStore: TaskStore;
  let tempDir: string;
  let tool: ReturnType<typeof createSchedulerDeleteTool>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'scheduler-delete-test-'));
    taskStore = new TaskStore(join(tempDir, 'tasks.json'));
    tool = createSchedulerDeleteTool(
      taskStore,
      () => 'test-user'
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('execute', () => {
    it('应该删除存在的任务', async () => {
      // 创建任务
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

      expect(result.content[0].text).toContain('已删除');
      expect(result.details.success).toBe(true);

      const task = taskStore.getById('task-1');
      expect(task).toBeUndefined();
    });

    it('应该拒绝删除其他用户的任务', async () => {
      // 创建其他用户的任务
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

      const result = await tool.execute('call-1', { taskId: 'task-1' });

      expect(result.content[0].text).toContain('无法删除');
      expect(result.details.success).toBe(false);

      const task = taskStore.getById('task-1');
      expect(task).toBeDefined();
    });

    it('应该处理不存在任务', async () => {
      const result = await tool.execute('call-1', { taskId: 'non-existent' });

      expect(result.content[0].text).toContain('不存在');
      expect(result.details.success).toBe(false);
    });
  });
});