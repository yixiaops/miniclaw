/**
 * SchedulerWatcher 热加载模块
 *
 * 监听 scheduled-tasks.json 文件变化，实现任务配置热加载
 *
 * @module scheduler/watcher
 */

import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { TaskStore } from './task-store.js';
import type { SchedulerManager } from './manager.js';
import type { ScheduledTask } from './types.js';

/**
 * SchedulerWatcher 配置选项
 */
export interface SchedulerWatcherOptions {
  /** 任务存储 */
  taskStore: TaskStore;
  /** 调度管理器 */
  schedulerManager: SchedulerManager;
  /** 文件路径（默认 ~/.miniclaw/scheduled-tasks.json） */
  filePath?: string;
  /** 防抖延迟（毫秒，默认 1000） */
  debounceDelay?: number;
}

/**
 * SchedulerWatcher 类
 *
 * 监听 scheduled-tasks.json 文件变化，自动更新任务调度
 */
export class SchedulerWatcher {
  private taskStore: TaskStore;
  private schedulerManager: SchedulerManager;
  private filePath: string;
  private debounceDelay: number;
  private watcher?: FSWatcher;
  private debounceTimer?: NodeJS.Timeout;
  private lastTasks: Map<string, ScheduledTask> = new Map();

  constructor(options: SchedulerWatcherOptions) {
    this.taskStore = options.taskStore;
    this.schedulerManager = options.schedulerManager;
    this.filePath = options.filePath || join(homedir(), '.miniclaw', 'scheduled-tasks.json');
    this.debounceDelay = options.debounceDelay ?? 1000;
  }

  /**
   * 启动监听
   */
  async start(): Promise<void> {
    if (!existsSync(this.filePath)) {
      console.warn(`[SchedulerWatcher] 文件不存在: ${this.filePath}`);
      return;
    }

    // 加载初始任务列表（从文件重新加载，确保数据最新）
    this.taskStore.load();
    const initialTasks = this.taskStore.getAll();
    for (const task of initialTasks) {
      this.lastTasks.set(task.taskId, task);
    }

    this.watcher = chokidar.watch(this.filePath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 50,
      },
    });

    this.watcher.on('change', () => {
      this.handleChange();
    });

    console.log(`[SchedulerWatcher] 已启动监听: ${this.filePath}`);
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    console.log('[SchedulerWatcher] 已停止监听');
  }

  /**
   * 检查是否正在监听
   */
  isWatching(): boolean {
    return this.watcher !== undefined;
  }

  /**
   * 处理文件变化（带防抖）
   */
  private handleChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processChange();
      this.debounceTimer = undefined;
    }, this.debounceDelay);
  }

  /**
   * 处理任务变化
   *
   * 可用于测试或手动触发重新加载
   */
  async processChange(): Promise<void> {
    try {
      // 重新加载 TaskStore（读取最新文件）
      this.taskStore.load();

      const newTasks = this.taskStore.getAll();
      const newTaskMap = new Map<string, ScheduledTask>();
      for (const task of newTasks) {
        newTaskMap.set(task.taskId, task);
      }

      // 检测变化
      const added: ScheduledTask[] = [];
      const removed: string[] = [];
      const modified: ScheduledTask[] = [];

      // 检测新增和修改
      for (const [taskId, newTask] of newTaskMap) {
        const oldTask = this.lastTasks.get(taskId);
        if (!oldTask) {
          added.push(newTask);
        } else if (oldTask.executeTime !== newTask.executeTime) {
          modified.push(newTask);
        }
      }

      // 检测删除
      for (const [taskId] of this.lastTasks) {
        if (!newTaskMap.has(taskId)) {
          removed.push(taskId);
        }
      }

      // 执行调度变更
      if (added.length > 0 || removed.length > 0 || modified.length > 0) {
        console.log(`[SchedulerWatcher] 检测到任务变化:`);
        if (added.length > 0) {
          console.log(
            `  - 新增: ${added.length} 个 (${added.map((t) => t.taskId.slice(0, 8)).join(', ')})`
          );
        }
        if (removed.length > 0) {
          console.log(`  - 删除: ${removed.length} 个 (${removed.map(id => id.slice(0, 8)).join(', ')})`);
        }
        if (modified.length > 0) {
          console.log(
            `  - 修改: ${modified.length} 个 (${modified.map((t) => t.taskId.slice(0, 8)).join(', ')})`
          );
        }

        // 处理删除
        for (const taskId of removed) {
          this.schedulerManager.cancelTask(taskId);
        }

        // 处理修改（先取消再重新调度）
        for (const task of modified) {
          this.schedulerManager.cancelTask(task.taskId);
          this.schedulerManager.scheduleTask(task);
        }

        // 处理新增
        for (const task of added) {
          this.schedulerManager.scheduleTask(task);
        }

        console.log('[SchedulerWatcher] ✓ 调度更新完成');
      }

      // 更新上次任务列表
      this.lastTasks = newTaskMap;
    } catch (error) {
      console.error(`[SchedulerWatcher] 处理变化失败: ${error}`);
    }
  }
}