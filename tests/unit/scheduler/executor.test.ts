/**
 * TaskExecutor 单元测试
 *
 * 测试任务执行器（提醒/指令分发）
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TaskExecutor } from '../../../src/scheduler/executor.js';
import { TaskStore } from '../../../src/scheduler/task-store.js';
import { PendingMessageStore } from '../../../src/scheduler/pending-store.js';
import { ScheduledTask } from '../../../src/scheduler/types.js';
import path from 'path';

const TEST_STORE_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'test-executor-tasks.json');
const TEST_PENDING_PATH = path.join(process.cwd(), 'tests', 'fixtures', 'test-executor-pending.json');

const createMockTask = (id: string, actionType: 'reminder' | 'instruction' = 'reminder'): ScheduledTask => ({
  taskId: id,
  userId: 'test-user',
  channel: 'cli',
  content: '测试任务内容',
  summary: '测试',
  executeTime: '2026-05-16T09:00:00Z',
  taskType: 'one-time',
  actionType,
  status: 'pending',
  createdAt: '2026-05-15T10:00:00Z',
  retryCount: 0,
});

// Mock 发送消息函数
const mockSendMessage = vi.fn();

// Mock sessions_spawn
const mockSpawnAgent = vi.fn();

describe('TaskExecutor', () => {
  let executor: TaskExecutor;
  let taskStore: TaskStore;
  let pendingStore: PendingMessageStore;

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

    mockSendMessage.mockClear();
    mockSpawnAgent.mockClear();
    mockSendMessage.mockResolvedValue({ success: true }); // 默认用户在线
  });

  describe('提醒类型任务', () => {
    it('should execute reminder task and mark as executed', async () => {
      const task = createMockTask('reminder-1');
      taskStore.create(task);

      await executor.execute(task);

      // 验证任务状态已更新
      const updated = taskStore.getById('reminder-1');
      expect(updated?.status).toBe('executed');
    });

    it('should send message via sendMessage callback', async () => {
      const task = createMockTask('reminder-2');
      taskStore.create(task);

      await executor.execute(task);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-user',
        'cli',
        '测试任务内容'
      );
    });

    it('should store pending message when user offline', async () => {
      // Mock sendMessage 返回 false（用户离线）
      mockSendMessage.mockResolvedValue({ success: false });

      const task = createMockTask('offline-task');
      taskStore.create(task);

      await executor.execute(task);

      // 验证任务状态为 waiting-push
      const updated = taskStore.getById('offline-task');
      expect(updated?.status).toBe('waiting-push');

      // 验证消息存入 pending store
      expect(pendingStore.count()).toBe(1);
    });
  });

  describe('指令类型任务', () => {
    it('should execute instruction task by spawning agent', async () => {
      const task = {
        ...createMockTask('instruction-1', 'instruction'),
        actionParams: { agentId: 'report-agent' },
      };
      taskStore.create(task);

      await executor.execute(task);

      expect(mockSpawnAgent).toHaveBeenCalledWith({
        task: '测试任务内容',
        agentId: 'report-agent',
      });
    });

    it('should mark instruction task as executed after spawn', async () => {
      mockSpawnAgent.mockResolvedValue({ success: true });

      const task = {
        ...createMockTask('instruction-2', 'instruction'),
        actionParams: { agentId: 'report-agent' },
      };
      taskStore.create(task);

      await executor.execute(task);

      const updated = taskStore.getById('instruction-2');
      expect(updated?.status).toBe('executed');
    });
  });

  describe('重试机制', () => {
    it('should increment retry count on failure', async () => {
      mockSendMessage.mockImplementation(() => {
        throw new Error('Send failed');
      });

      const task = createMockTask('retry-task');
      taskStore.create(task);

      await executor.execute(task);

      const updated = taskStore.getById('retry-task');
      expect(updated?.retryCount).toBe(1);
      expect(updated?.status).toBe('pending'); // 待重试
    });

    it('should mark as failed after max retries', async () => {
      mockSendMessage.mockImplementation(() => {
        throw new Error('Send failed');
      });

      const task = { ...createMockTask('max-retry'), retryCount: 3 };
      taskStore.create(task);

      await executor.execute(task);

      const updated = taskStore.getById('max-retry');
      expect(updated?.status).toBe('failed');
    });
  });

  describe('周期性任务', () => {
    it('should update nextExecuteTime for recurring task', async () => {
      const task = {
        ...createMockTask('recurring-1'),
        taskType: 'recurring',
        executeTime: '0 9 * * 1', // 每周一
      };
      taskStore.create(task);

      await executor.execute(task);

      const updated = taskStore.getById('recurring-1');
      expect(updated?.status).toBe('pending'); // 保持 pending
      expect(updated?.lastExecuteTime).toBeDefined();
    });
  });
});