/**
 * 任务执行日志存储模块
 *
 * 记录每次任务执行的结果，提供可追溯的执行历史
 *
 * @module scheduler/execution-log-store
 */

import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { TaskExecutionLog, Channel } from './types.js';

/** 默认存储路径 */
const DEFAULT_STORE_PATH = path.join(
  homedir(),
  '.miniclaw',
  'execution-logs.json'
);

/** 执行日志存储结构 */
interface ExecutionLogStoreData {
  logs: TaskExecutionLog[];
}

/** 最大保留日志条数 */
const MAX_LOG_ENTRIES = 200;

/**
 * 执行日志存储类
 *
 * 负责记录每次任务执行的结果，支持查询和清理
 */
export class ExecutionLogStore {
  private filePath: string;
  private logs: TaskExecutionLog[] = [];

  /**
   * 创建 ExecutionLogStore 实例
   *
   * @param filePath - 存储文件路径（可选）
   */
  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_STORE_PATH;
    this.load();
  }

  /**
   * 从文件加载日志数据
   */
  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.save();
        return;
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data: ExecutionLogStoreData = JSON.parse(content);
      this.logs = data.logs || [];
    } catch (error) {
      console.warn(
        `[ExecutionLogStore] Failed to load ${this.filePath}, creating new store`
      );
      this.logs = [];
      this.save();
    }
  }

  /**
   * 保存日志数据到文件
   */
  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: ExecutionLogStoreData = {
      logs: this.logs,
    };

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 添加执行日志
   *
   * @param log - 日志对象
   */
  add(log: TaskExecutionLog): void {
    this.logs.push(log);

    // 清理旧日志，保留最新 MAX_LOG_ENTRIES 条
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES);
    }

    this.save();
  }

  /**
   * 记录任务执行结果
   *
   * @param taskId - 任务 ID
   * @param result - 执行结果
   * @param channelUsed - 使用的渠道
   * @param messageSent - 消息是否已发送
   * @param errorMessage - 错误信息（失败时）
   */
  record(
    taskId: string,
    result: 'success' | 'failed' | 'waiting',
    channelUsed: Channel,
    messageSent: boolean,
    errorMessage?: string
  ): void {
    const log: TaskExecutionLog = {
      logId: randomUUID(),
      taskId,
      executeTime: new Date().toISOString(),
      result,
      errorMessage,
      channelUsed,
      messageSent,
    };

    this.add(log);
    console.log(
      `[ExecutionLog] Task ${taskId}: ${result} (channel=${channelUsed}, sent=${messageSent})`
    );
  }

  /**
   * 获取所有日志
   *
   * @returns 日志列表（按时间倒序）
   */
  getAll(): TaskExecutionLog[] {
    return [...this.logs].sort((a, b) => {
      return new Date(b.executeTime).getTime() - new Date(a.executeTime).getTime();
    });
  }

  /**
   * 根据任务 ID 获取日志
   *
   * @param taskId - 任务 ID
   * @returns 该任务的日志列表
   */
  getByTaskId(taskId: string): TaskExecutionLog[] {
    return this.getAll().filter((log) => log.taskId === taskId);
  }

  /**
   * 获取最近 N 条日志
   *
   * @param limit - 数量限制
   * @returns 最新日志列表
   */
  getRecent(limit: number = 20): TaskExecutionLog[] {
    return this.getAll().slice(0, limit);
  }

  /**
   * 获取任务执行统计
   *
   * @returns 统计信息
   */
  getStats(): {
    total: number;
    success: number;
    failed: number;
    waiting: number;
    lastSuccess: string | null;
    lastFailure: string | null;
  } {
    const total = this.logs.length;
    const success = this.logs.filter((l) => l.result === 'success').length;
    const failed = this.logs.filter((l) => l.result === 'failed').length;
    const waiting = this.logs.filter((l) => l.result === 'waiting').length;

    const successLogs = this.logs
      .filter((l) => l.result === 'success')
      .sort((a, b) => new Date(b.executeTime).getTime() - new Date(a.executeTime).getTime());
    const failureLogs = this.logs
      .filter((l) => l.result === 'failed')
      .sort((a, b) => new Date(b.executeTime).getTime() - new Date(a.executeTime).getTime());

    return {
      total,
      success,
      failed,
      waiting,
      lastSuccess: successLogs.length > 0 ? successLogs[0].executeTime : null,
      lastFailure: failureLogs.length > 0 ? failureLogs[0].executeTime : null,
    };
  }

  /**
   * 清理旧日志
   *
   * @param maxAgeMs - 最大保留时间（毫秒）
   * @returns 清理的日志数量
   */
  cleanExpired(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    const before = this.logs.length;

    this.logs = this.logs.filter((log) => {
      const age = now - new Date(log.executeTime).getTime();
      return age <= maxAgeMs;
    });

    const cleaned = before - this.logs.length;
    if (cleaned > 0) {
      this.save();
    }

    return cleaned;
  }

  /**
   * 获取日志数量
   */
  count(): number {
    return this.logs.length;
  }
}
