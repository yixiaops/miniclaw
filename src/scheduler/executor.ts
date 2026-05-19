/**
 * 任务执行器模块
 *
 * 负责执行任务：发送提醒消息或执行预设指令
 *
 * @module scheduler/executor
 */

import type {
  ScheduledTask,
  Channel,
} from './types.js';
import { TaskStore } from './task-store.js';
import { PendingMessageStore } from './pending-store.js';
import { randomUUID } from 'crypto';

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;

/** 执行器回调接口 */
export interface ExecutorCallbacks {
  /** 发送消息回调，返回 message ID 用于回声过滤 */
  sendMessage: (
    userId: string,
    channel: Channel,
    content: string
  ) => Promise<{ success: boolean; messageId?: string }>;
  /** 调用子 Agent 回调 */
  spawnAgent: (params: { task: string; agentId: string }) => Promise<{ success: boolean; result?: string }>;
}

/**
 * 任务执行器类
 */
export class TaskExecutor {
  private taskStore: TaskStore;
  private pendingStore: PendingMessageStore;
  private callbacks: ExecutorCallbacks;

  /**
   * 创建 TaskExecutor 实例
   *
   * @param taskStore - 任务存储
   * @param pendingStore - 待推送消息存储
   * @param callbacks - 执行回调
   */
  constructor(
    taskStore: TaskStore,
    pendingStore: PendingMessageStore,
    callbacks: ExecutorCallbacks
  ) {
    this.taskStore = taskStore;
    this.pendingStore = pendingStore;
    this.callbacks = callbacks;
  }

  /**
   * 执行任务
   *
   * @param task - 任务对象
   * @returns 执行结果
   */
  async execute(task: ScheduledTask): Promise<{
    success: boolean;
    status: 'executed' | 'waiting-push' | 'failed' | 'pending';
  }> {
    try {
      if (task.actionType === 'reminder') {
        return await this.executeReminder(task);
      } else {
        return await this.executeInstruction(task);
      }
    } catch (error) {
      // 执行失败，更新重试计数
      return this.handleFailure(task, error);
    }
  }

  /** 消息发送成功回调，用于回声过滤 */
  private onMessageSent?: (messageId: string) => void;

  /**
   * 设置消息发送成功回调
   */
  setOnMessageSent(callback: (messageId: string) => void): void {
    this.onMessageSent = callback;
  }

  /**
   * 执行提醒类型任务
   */
  private async executeReminder(
    task: ScheduledTask
  ): Promise<{ success: boolean; status: 'executed' | 'waiting-push' }> {
    const result = await this.callbacks.sendMessage(
      task.userId,
      task.channel,
      task.content
    );

    if (result.success) {
      // 注册消息 ID，防止 WebSocket 回声
      if (result.messageId && this.onMessageSent) {
        this.onMessageSent(result.messageId);
      }
      this.markExecuted(task.taskId, task.taskType);
      return { success: true, status: 'executed' };
    } else {
      // 用户离线，存入待推送
      this.storePending(task);
      this.taskStore.update(task.taskId, { status: 'waiting-push' });
      return { success: false, status: 'waiting-push' };
    }
  }

  /**
   * 执行指令类型任务
   */
  private async executeInstruction(
    task: ScheduledTask
  ): Promise<{ success: boolean; status: 'executed' | 'failed' | 'pending' }> {
    if (!task.actionParams?.agentId) {
      // 无目标 Agent，标记失败
      this.markFailed(task.taskId, 'No agentId specified');
      return { success: false, status: 'failed' };
    }

    const result = await this.callbacks.spawnAgent({
      task: task.content,
      agentId: task.actionParams.agentId,
    });

    if (result.success) {
      this.markExecuted(task.taskId, task.taskType);
      return { success: true, status: 'executed' };
    } else {
      return this.handleFailure(task, new Error('Agent spawn failed'));
    }
  }

  /**
   * 标记任务已执行
   */
  private markExecuted(taskId: string, taskType: string): void {
    const updates: Partial<ScheduledTask> = {
      status: taskType === 'recurring' ? 'pending' : 'executed',
      lastExecuteTime: new Date().toISOString(),
    };

    this.taskStore.update(taskId, updates);
  }

  /**
   * 标记任务失败
   */
  private markFailed(taskId: string, _errorMessage: string): void {
    this.taskStore.update(taskId, {
      status: 'failed',
    });
  }

  /**
   * 处理执行失败
   */
  private handleFailure(
    task: ScheduledTask,
    error: unknown
  ): { success: boolean; status: 'failed' | 'pending' } {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`[TaskExecutor] Task ${task.taskId} failed: ${message}`);

    // 检查重试次数
    if (task.retryCount >= MAX_RETRY_COUNT) {
      this.markFailed(task.taskId, message);
      return { success: false, status: 'failed' };
    }

    // 增加重试计数，保持 pending
    this.taskStore.update(task.taskId, {
      retryCount: task.retryCount + 1,
    });

    return { success: false, status: 'pending' };
  }

  /**
   * 存储待推送消息
   */
  private storePending(task: ScheduledTask): void {
    const pendingMessage = {
      messageId: randomUUID(),
      taskId: task.taskId,
      userId: task.userId,
      channel: task.channel,
      content: task.content,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    this.pendingStore.add(pendingMessage);
  }
}