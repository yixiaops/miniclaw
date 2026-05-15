/**
 * 定时任务集成测试
 *
 * 测试完整的任务创建、调度、执行流程
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { PendingMessageStore } from '../../../src/scheduler/pending-store.js';
import { SchedulerManager } from '../../../src/scheduler/manager.js';
import { TaskExecutor } from '../../../src/scheduler/executor.js';
import path from 'path';

const TEST_STORE_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'test-integration-tasks.json');
const TEST_PENDING_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'test-integration-pending.json');

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((expr, callback, options) => ({
      stop: vi.fn(),
      start: vi.fn(),
    })),
    validate: vi.fn((expr) => expr.split(' ').length === 5),
  },
}));

describe('Scheduler Flow Integration', () => {
  let taskStore: TaskStore;
  let pendingStore: PendingMessageStore;
  let manager: SchedulerManager;
  let executor: TaskExecutor;

  const mockSendMessage = vi.fn();
  const mockSpawnAgent = vi.fn();

  beforeEach(() => {
    taskStore = new TaskStore(TEST_STORE_PATH);
    pendingStore = new PendingMessageStore(TEST_PENDING_PATH);

    // 清空存储
    for (const task of taskStore.getAll()) {
      taskStore.delete(task.taskId);
    }
    for (const msg of pendingStore.getAll()) {
      pendingStore.remove(msg.messageId);
    }

    executor = new TaskExecutor(taskStore, pendingStore, {
      sendMessage: mockSendMessage,
      spawnAgent: mockSpawnAgent,
    });

    manager = new SchedulerManager(taskStore, executor);

    mockSendMessage.mockClear();
    mockSpawnAgent.mockClear();
    mockSendMessage.mockReturnValue(true); // 默认用户在线
  });

  afterEach(() => {
    manager.stopAll();
    for (const task of taskStore.getAll()) {
      taskStore.delete(task.taskId);
    }
    for (const msg of pendingStore.getAll()) {
      pendingStore.remove(msg.messageId);
    }
  });

  describe('一次性提醒任务流程', () => {
    it('should complete full flow: create -> schedule -> execute -> cleanup', async () => {
      // 1. 创建任务
      const task = {
        taskId: 'flow-1',
        userId: 'user-1',
        channel: 'cli',
        content: '明天9点提醒我开会',
        summary: '开会',
        executeTime: '2026-05-16T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      taskStore.create(task);
      expect(taskStore.getById('flow-1')).toBeDefined();

      // 2. 调度任务
      manager.scheduleTask(task);
      expect(manager.getScheduledCount()).toBe(1);

      // 3. 执行任务
      await executor.execute(task);

      // 4. 验证执行结果
      const executed = taskStore.getById('flow-1');
      expect(executed?.status).toBe('executed');
      expect(mockSendMessage).toHaveBeenCalled();

      // 5. 清理
      manager.cancelTask('flow-1');
      expect(manager.getScheduledCount()).toBe(0);
    });
  });

  describe('周期性任务流程', () => {
    it('should handle recurring task execution cycle', async () => {
      const task = {
        taskId: 'recurring-flow',
        userId: 'user-1',
        channel: 'cli',
        content: '每周一9点提醒我开会',
        summary: '开会',
        executeTime: '0 9 * * 1', // 每周一9点
        taskType: 'recurring',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      // 创建并调度
      taskStore.create(task);
      manager.scheduleTask(task);

      // 执行（周期性任务保持 pending）
      await executor.execute(task);

      const executed = taskStore.getById('recurring-flow');
      expect(executed?.status).toBe('pending'); // 周期性任务保持待执行
      expect(executed?.lastExecuteTime).toBeDefined();
    });
  });

  describe('离线用户流程', () => {
    it('should store pending message when user offline', async () => {
      mockSendMessage.mockReturnValue(false); // 用户离线

      const task = {
        taskId: 'offline-flow',
        userId: 'user-1',
        channel: 'feishu',
        content: '提醒消息',
        summary: '提醒',
        executeTime: '2026-05-16T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      taskStore.create(task);
      await executor.execute(task);

      // 验证状态为 waiting-push
      const result = taskStore.getById('offline-flow');
      expect(result?.status).toBe('waiting-push');

      // 验证消息存入待推送
      expect(pendingStore.getByUserId('user-1').length).toBe(1);
    });
  });

  describe('指令执行流程', () => {
    it('should spawn agent for instruction task', async () => {
      mockSpawnAgent.mockResolvedValue({ success: true, result: '周报已生成' });

      const task = {
        taskId: 'instruction-flow',
        userId: 'user-1',
        channel: 'cli',
        content: '生成周报',
        summary: '周报',
        executeTime: '2026-05-16T09:00:00Z',
        taskType: 'one-time',
        actionType: 'instruction',
        actionParams: { agentId: 'report-agent' },
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      taskStore.create(task);
      await executor.execute(task);

      expect(mockSpawnAgent).toHaveBeenCalledWith({
        task: '生成周报',
        agentId: 'report-agent',
      });

      const result = taskStore.getById('instruction-flow');
      expect(result?.status).toBe('executed');
    });
  });

  describe('任务管理流程', () => {
    it('should handle task cancellation', async () => {
      const task = {
        taskId: 'cancel-flow',
        userId: 'user-1',
        channel: 'cli',
        content: '待取消任务',
        summary: '取消',
        executeTime: '2026-05-20T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      taskStore.create(task);
      manager.scheduleTask(task);

      // 取消任务
      taskStore.update('cancel-flow', { status: 'cancelled' });
      manager.cancelTask('cancel-flow');

      const cancelled = taskStore.getById('cancel-flow');
      expect(cancelled?.status).toBe('cancelled');
      expect(manager.getScheduledCount()).toBe(0);
    });

    it('should handle task time update', async () => {
      const task = {
        taskId: 'update-flow',
        userId: 'user-1',
        channel: 'cli',
        content: '待更新任务',
        summary: '更新',
        executeTime: '2026-05-16T09:00:00Z',
        taskType: 'one-time',
        actionType: 'reminder',
        status: 'pending',
        createdAt: new Date().toISOString(),
        retryCount: 0,
      };

      taskStore.create(task);
      manager.scheduleTask(task);

      // 更新执行时间
      const newTime = '2026-05-16T10:00:00Z';
      taskStore.update('update-flow', { executeTime: newTime });
      manager.rescheduleTask('update-flow', newTime);

      const updated = taskStore.getById('update-flow');
      expect(updated?.executeTime).toBe(newTime);
      expect(manager.getScheduledCount()).toBe(1);
    });
  });
});