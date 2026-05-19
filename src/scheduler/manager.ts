/**
 * 调度管理器模块
 *
 * 负责使用 node-cron 调度定时任务
 *
 * @module scheduler/manager
 */

import cron from 'node-cron';
import type { ScheduledTask } from './types.js';
import { TaskStore } from './task-store.js';
import type { TaskExecutor } from './executor.js';

/**
 * 调度管理器类
 *
 * 管理定时任务的创建、调度、取消
 */
export class SchedulerManager {
  private taskStore: TaskStore;
  private executor?: TaskExecutor;
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  /**
   * 创建 SchedulerManager 实例
   *
   * @param taskStore - 任务存储
   * @param executor - 任务执行器（可选，用于触发执行）
   */
  constructor(taskStore: TaskStore, executor?: TaskExecutor) {
    this.taskStore = taskStore;
    this.executor = executor;

    // 初始化时加载所有 pending 任务
    this.loadPendingTasks();
  }

  /**
   * 加载所有待执行任务并调度
   */
  private loadPendingTasks(): void {
    const pendingTasks = this.taskStore.getByStatus('pending');
    for (const task of pendingTasks) {
      this.scheduleTask(task);
    }
  }

  /**
   * 验证 cron 表达式是否有效
   *
   * @param expression - cron 表达式
   * @returns 是否有效
   */
  validateCron(expression: string): boolean {
    return cron.validate(expression);
  }

  /**
   * 调度单个任务
   *
   * @param task - 任务对象
   * @returns 是否调度成功
   */
  scheduleTask(task: ScheduledTask): boolean {
    // 检查是否已调度
    if (this.scheduledJobs.has(task.taskId)) {
      return false;
    }

    // 确定调度表达式
    let cronExpression: string;
    if (task.taskType === 'recurring') {
      // 周期性任务直接使用 cron 表达式
      if (!this.validateCron(task.executeTime)) {
        console.warn(
          `[SchedulerManager] Invalid cron expression: ${task.executeTime}`
        );
        return false;
      }
      cronExpression = task.executeTime;
    } else {
      // 一次性任务：转换为 cron 表达式格式
      const executeDate = new Date(task.executeTime);
      cronExpression = this.dateToCron(executeDate);
    }

    // 创建调度任务
    const job = cron.schedule(
      cronExpression,
      () => {
        this.triggerExecution(task);
      }
    );

    this.scheduledJobs.set(task.taskId, job);
    return true;
  }

  /**
   * 将日期转换为 cron 表达式
   *
   * 格式：minute hour day month weekday
   */
  private dateToCron(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;

    return `${minute} ${hour} ${day} ${month} *`;
  }

  /**
   * 触发任务执行
   */
  private async triggerExecution(task: ScheduledTask): Promise<void> {
    if (this.executor) {
      await this.executor.execute(task);
    } else {
      console.log(
        `[SchedulerManager] Task ${task.taskId} triggered (no executor configured)`
      );
    }

    // 一次性任务执行后自动取消调度
    if (task.taskType === 'one-time') {
      this.cancelTask(task.taskId);
    }
  }

  /**
   * 取消任务调度
   *
   * @param taskId - 任务 ID
   * @returns 是否取消成功
   */
  cancelTask(taskId: string): boolean {
    const job = this.scheduledJobs.get(taskId);
    if (!job) {
      return false;
    }

    job.stop();
    this.scheduledJobs.delete(taskId);
    return true;
  }

  /**
   * 重调度任务（更新执行时间）
   *
   * @param taskId - 任务 ID
   * @param newExecuteTime - 新执行时间
   * @returns 是否成功
   */
  rescheduleTask(taskId: string, newExecuteTime: string): boolean {
    // 先取消现有调度
    this.cancelTask(taskId);

    // 获取任务并更新
    const task = this.taskStore.getById(taskId);
    if (!task) {
      return false;
    }

    // 创建新调度
    const updatedTask = { ...task, executeTime: newExecuteTime };
    return this.scheduleTask(updatedTask);
  }

  /**
   * 调度所有待执行任务
   */
  scheduleAllPending(): void {
    const pendingTasks = this.taskStore.getByStatus('pending');
    for (const task of pendingTasks) {
      this.scheduleTask(task);
    }
  }

  /**
   * 停止所有调度任务
   */
  stopAll(): void {
    for (const job of this.scheduledJobs.values()) {
      job.stop();
    }
    this.scheduledJobs.clear();
  }

  /**
   * 获取已调度任务数量
   */
  getScheduledCount(): number {
    return this.scheduledJobs.size;
  }

  /**
   * 获取已调度任务 ID 列表
   */
  getScheduledTaskIds(): string[] {
    return Array.from(this.scheduledJobs.keys());
  }

  /**
   * 设置任务执行器（延迟初始化）
   */
  setExecutor(executor: TaskExecutor): void {
    this.executor = executor;
  }
}