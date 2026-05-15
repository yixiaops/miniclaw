/**
 * scheduler_create 工具测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createSchedulerCreateTool } from '../../../src/tools/scheduler-create.js';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('scheduler_create 工具', () => {
  let taskStore: TaskStore;
  let tempDir: string;
  let tool: ReturnType<typeof createSchedulerCreateTool>;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'scheduler-create-test-'));
    taskStore = new TaskStore(join(tempDir, 'tasks.json'));
    tool = createSchedulerCreateTool(
      taskStore,
      () => 'test-user',
      () => 'cli'
    );
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('参数验证', () => {
    it('应该接受有效的参数', () => {
      expect(tool.name).toBe('scheduler_create');
      expect(tool.parameters).toBeDefined();
    });
  });

  describe('execute', () => {
    it('应该创建一次性提醒任务', async () => {
      const result = await tool.execute('call-1', {
        content: '提醒我明天上午9点开会',
        executeTime: '2025-01-01T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
      });

      expect(result.content[0].type).toBe('text');
      expect(result.details.taskId).not.toBe('');
      expect(result.details.taskType).toBe('one-time');
      expect(result.details.actionType).toBe('reminder');

      const tasks = taskStore.getByUserId('test-user');
      expect(tasks.length).toBe(1);
      expect(tasks[0].content).toBe('提醒我明天上午9点开会');
    });

    it('应该创建周期性提醒任务', async () => {
      const result = await tool.execute('call-2', {
        content: '每天早上9点提醒我打卡',
        executeTime: '0 9 * * *',
        taskType: 'recurring',
        actionType: 'reminder',
      });

      expect(result.details.taskId).not.toBe('');
      expect(result.details.taskType).toBe('recurring');

      const tasks = taskStore.getByUserId('test-user');
      expect(tasks.length).toBe(1);
      expect(tasks[0].taskType).toBe('recurring');
    });

    it('应该创建指令类型任务', async () => {
      const result = await tool.execute('call-3', {
        content: '每天生成日报',
        executeTime: '0 18 * * *',
        taskType: 'recurring',
        actionType: 'instruction',
        agentId: 'report-agent',
      });

      expect(result.details.taskId).not.toBe('');
      expect(result.details.actionType).toBe('instruction');

      const tasks = taskStore.getByUserId('test-user');
      expect(tasks[0].actionParams?.agentId).toBe('report-agent');
    });

    it('应该检测重复任务', async () => {
      // 先创建一个任务
      await tool.execute('call-1', {
        content: '提醒我每天早上9点打卡',
        executeTime: '0 9 * * *',
        taskType: 'recurring',
        actionType: 'reminder',
      });

      // 创建相似任务
      const result = await tool.execute('call-2', {
        content: '提醒我每天早上9点打卡', // 相同内容
        executeTime: '0 9 * * *',
        taskType: 'recurring',
        actionType: 'reminder',
      });

      // 重复任务时 taskId 为空
      expect(result.details.taskId).toBe('');
      expect(result.content[0].text).toContain('相似任务');
    });
  });
});