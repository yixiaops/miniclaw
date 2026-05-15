/**
 * SchedulerManager 单元测试
 *
 * 测试 node-cron 集成的调度管理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SchedulerManager } from '../../../src/scheduler/manager.js';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { ScheduledTask } from '../../../src/scheduler/types.js';
import path from 'path';

// Mock node-cron
vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((expr, callback, options) => ({
      stop: vi.fn(),
      start: vi.fn(),
    })),
    validate: vi.fn((expr) => {
      // 简化的验证：5字段 cron 表达式
      const parts = expr.split(' ');
      return parts.length === 5;
    }),
  },
}));

const TEST_STORE_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'test-scheduler-tasks.json');

const createMockTask = (id: string): ScheduledTask => ({
  taskId: id,
  userId: 'test-user',
  channel: 'cli',
  content: '测试任务',
  summary: '测试',
  executeTime: '2026-05-16T09:00:00Z',
  taskType: 'one-time',
  actionType: 'reminder',
  status: 'pending',
  createdAt: '2026-05-15T10:00:00Z',
  retryCount: 0,
});

describe('SchedulerManager', () => {
  let manager: SchedulerManager;
  let store: TaskStore;

  beforeEach(() => {
    store = new TaskStore(TEST_STORE_PATH);
    // 清空存储
    for (const task of store.getAll()) {
      store.delete(task.taskId);
    }
    manager = new SchedulerManager(store);
  });

  afterEach(() => {
    manager.stopAll();
    for (const task of store.getAll()) {
      store.delete(task.taskId);
    }
  });

  describe('初始化', () => {
    it('should load pending tasks on initialization', () => {
      store.create(createMockTask('init-task'));

      const newManager = new SchedulerManager(store);
      const scheduledCount = newManager.getScheduledCount();
      expect(scheduledCount).toBe(1);
    });
  });

  describe('任务调度', () => {
    it('should schedule a one-time task', () => {
      const task = createMockTask('schedule-1');
      manager.scheduleTask(task);

      expect(manager.getScheduledCount()).toBe(1);
    });

    it('should schedule a recurring task with cron expression', () => {
      const task = {
        ...createMockTask('recurring-1'),
        taskType: 'recurring',
        executeTime: '0 9 * * 1', // 每周一9点
      };

      manager.scheduleTask(task);
      expect(manager.getScheduledCount()).toBe(1);
    });

    it('should validate cron expression before scheduling', () => {
      const validTask = {
        ...createMockTask('valid-cron'),
        taskType: 'recurring',
        executeTime: '0 9 * * 1',
      };

      const invalidTask = {
        ...createMockTask('invalid-cron'),
        taskType: 'recurring',
        executeTime: 'invalid cron',
      };

      const validResult = manager.validateCron(validTask.executeTime);
      expect(validResult).toBe(true);

      const invalidResult = manager.validateCron(invalidTask.executeTime);
      expect(invalidResult).toBe(false);
    });
  });

  describe('任务取消', () => {
    it('should cancel a scheduled task', () => {
      const task = createMockTask('cancel-test');
      manager.scheduleTask(task);

      manager.cancelTask('cancel-test');
      expect(manager.getScheduledCount()).toBe(0);
    });

    it('should return false when cancelling non-existent task', () => {
      const result = manager.cancelTask('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('任务重调度', () => {
    it('should reschedule task when time updated', () => {
      const task = createMockTask('reschedule-test');
      store.create(task); // 需要先存入 store
      manager.scheduleTask(task);

      const newTime = '2026-05-16T10:00:00Z';
      manager.rescheduleTask('reschedule-test', newTime);

      expect(manager.getScheduledCount()).toBe(1);
    });
  });

  describe('批量操作', () => {
    it('should schedule all pending tasks', () => {
      store.create(createMockTask('batch-1'));
      store.create(createMockTask('batch-2'));
      store.create(createMockTask('batch-3'));

      manager.scheduleAllPending();
      expect(manager.getScheduledCount()).toBe(3);
    });

    it('should stop all scheduled tasks', () => {
      manager.scheduleTask(createMockTask('stop-1'));
      manager.scheduleTask(createMockTask('stop-2'));

      manager.stopAll();
      expect(manager.getScheduledCount()).toBe(0);
    });
  });
});