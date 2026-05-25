/**
 * SchedulerWatcher 热加载模块
 *
 * 监听 scheduled-tasks.json 文件变化，实现任务配置热加载
 *
 * @module scheduler/watcher
 */

import type { TaskStore } from './task-store.js';
import type { SchedulerManager } from './manager.js';

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
  // @ts-expect-error TODO: will be used in task 2 (chokidar implementation)
  private _taskStore: TaskStore;
  // @ts-expect-error TODO: will be used in task 2 (chokidar implementation)
  private _schedulerManager: SchedulerManager;
  // @ts-expect-error TODO: will be used in task 2 (chokidar implementation)
  private _filePath: string;
  // @ts-expect-error TODO: will be used in task 2 (chokidar implementation)
  private _debounceDelay: number;

  constructor(options: SchedulerWatcherOptions) {
    this._taskStore = options.taskStore;
    this._schedulerManager = options.schedulerManager;
    this._filePath = options.filePath || '';
    this._debounceDelay = options.debounceDelay ?? 1000;
  }

  /**
   * 启动监听
   */
  async start(): Promise<void> {
    // TODO: 实现 chokidar 监听
  }

  /**
   * 停止监听
   */
  stop(): void {
    // TODO: 实现停止监听
  }
}