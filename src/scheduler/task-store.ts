/**
 * 任务存储模块
 *
 * 实现定时任务的 JSON 文件持久化存储
 *
 * @module scheduler/task-store
 */

import fs from 'fs';
import path from 'path';
import type {
  ScheduledTask,
  TaskStoreData,
  TaskStatus,
} from './types.js';

/** 默认存储路径 */
const DEFAULT_STORE_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.miniclaw',
  'scheduled-tasks.json'
);

/**
 * 任务存储类
 *
 * 负责定时任务的 CRUD 操作和持久化
 */
export class TaskStore {
  private filePath: string;
  private tasks: Map<string, ScheduledTask> = new Map();

  /**
   * 创建 TaskStore 实例
   *
   * @param filePath - 存储文件路径（可选，默认 ~/.miniclaw/scheduled-tasks.json）
   */
  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_STORE_PATH;
    this.load();
  }

  /**
   * 从文件加载任务数据
   */
  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        // 创建空存储文件
        this.save();
        return;
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data: TaskStoreData = JSON.parse(content);

      // 加载到内存 Map
      for (const task of data.tasks || []) {
        this.tasks.set(task.taskId, task);
      }
    } catch (error) {
      // JSON 解析失败时，创建空存储
      console.warn(
        `[TaskStore] Failed to load ${this.filePath}, creating new store`
      );
      this.tasks.clear();
      this.save();
    }
  }

  /**
   * 保存任务数据到文件
   */
  private save(): void {
    // 确保目录存在
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: TaskStoreData = {
      tasks: Array.from(this.tasks.values()),
    };

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 获取所有任务
   *
   * @returns 任务列表
   */
  getAll(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 根据 taskId 获取任务
   *
   * @param taskId - 任务 ID
   * @returns 任务对象或 undefined
   */
  getById(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 根据 userId 获取任务列表
   *
   * @param userId - 用户 ID
   * @returns 该用户的任务列表
   */
  getByUserId(userId: string): ScheduledTask[] {
    return this.getAll().filter((task) => task.userId === userId);
  }

  /**
   * 根据状态获取任务列表
   *
   * @param status - 任务状态
   * @returns 指定状态的任务列表
   */
  getByStatus(status: TaskStatus): ScheduledTask[] {
    return this.getAll().filter((task) => task.status === status);
  }

  /**
   * 获取用户的待执行任务
   *
   * @param userId - 用户 ID
   * @returns 该用户的 pending 状态任务列表
   */
  getPendingByUserId(userId: string): ScheduledTask[] {
    return this.getByUserId(userId).filter(
      (task) => task.status === 'pending'
    );
  }

  /**
   * 创建新任务
   *
   * @param task - 任务对象
   * @returns 创建的任务
   */
  create(task: ScheduledTask): ScheduledTask {
    this.tasks.set(task.taskId, task);
    this.save();
    return task;
  }

  /**
   * 更新任务
   *
   * @param taskId - 任务 ID
   * @param updates - 更新字段
   * @returns 更新后的任务或 undefined
   */
  update(
    taskId: string,
    updates: Partial<ScheduledTask>
  ): ScheduledTask | undefined {
    const task = this.tasks.get(taskId);
    if (!task) {
      return undefined;
    }

    const updated = {
      ...task,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(taskId, updated);
    this.save();
    return updated;
  }

  /**
   * 删除任务
   *
   * @param taskId - 任务 ID
   * @returns 是否删除成功
   */
  delete(taskId: string): boolean {
    if (!this.tasks.has(taskId)) {
      return false;
    }

    this.tasks.delete(taskId);
    this.save();
    return true;
  }

  /**
   * 查找相似任务（用于去重）
   *
   * 在指定时间窗口（±30分钟）内查找内容相似的 pending 任务
   *
   * @param userId - 用户 ID
   * @param summary - 任务摘要
   * @param executeTime - 执行时间（ISO 格式）
   * @param timeWindowMs - 时间窗口（默认 30 分钟）
   * @returns 相似任务或 undefined
   */
  findSimilarTask(
    userId: string,
    summary: string,
    executeTime: string,
    timeWindowMs: number = 30 * 60 * 1000
  ): ScheduledTask | undefined {
    const userTasks = this.getPendingByUserId(userId);
    const targetTime = new Date(executeTime).getTime();

    for (const task of userTasks) {
      const taskTime = new Date(task.executeTime).getTime();
      const timeDiff = Math.abs(targetTime - taskTime);

      // 时间差在窗口内
      if (timeDiff <= timeWindowMs) {
        // 检查内容相似度（简化版：关键词匹配）
        const similarity = this.calculateSimilarity(summary, task.summary);
        if (similarity >= 0.7) {
          return task;
        }
      }
    }

    return undefined;
  }

  /**
   * 计算字符串相似度（简化版）
   *
   * 使用关键词交集比例计算相似度
   *
   * @param str1 - 字符串 1
   * @param str2 - 字符串 2
   * @returns 相似度 (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const set1 = new Set(words1);
    const set2 = new Set(words2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) {
      return 0;
    }

    return intersection.size / union.size;
  }

  /**
   * 获取需要执行的任务（按执行时间排序）
   *
   * @param now - 当前时间
   * @returns 需要执行的任务列表
   */
  getTasksToExecute(now: Date): ScheduledTask[] {
    const nowTime = now.getTime();

    return this.getByStatus('pending')
      .filter((task) => {
        const executeTime = new Date(task.executeTime).getTime();
        return executeTime <= nowTime;
      })
      .sort((a, b) => {
        const timeA = new Date(a.executeTime).getTime();
        const timeB = new Date(b.executeTime).getTime();
        return timeA - timeB;
      });
  }

  /**
   * 清理已执行或已取消的过期任务
   *
   * @param maxAgeMs - 最大保留时间（默认 7 天）
   * @returns 清理的任务数量
   */
  cleanExpired(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const task of this.getAll()) {
      // 只清理已执行、已取消、已失败的任务
      if (task.status === 'executed' || task.status === 'cancelled' || task.status === 'failed') {
        const updatedAt = task.updatedAt || task.createdAt;
        const age = now - new Date(updatedAt).getTime();

        if (age > maxAgeMs) {
          toDelete.push(task.taskId);
        }
      }
    }

    for (const taskId of toDelete) {
      this.tasks.delete(taskId);
    }

    if (toDelete.length > 0) {
      this.save();
    }

    return toDelete.length;
  }
}