/**
 * @fileoverview 子代理管理器
 * 
 * 管理子代理的创建、执行、状态和清理
 * 
 * @module core/subagent/manager
 */

import { randomUUID } from 'crypto';
import type {
  SubagentInfo,
  SpawnOptions,
  SubagentResult,
  SubagentManagerConfig,
  SubagentStats
} from './types.js';

/**
 * 子代理管理器
 * 
 * 负责子代理的生命周期管理
 */
export class SubagentManager {
  /** 子代理存储 */
  private subagents: Map<string, SubagentInfo> = new Map();
  
  /** 最大并发数 */
  private maxConcurrent: number;
  
  /** 默认超时时间 */
  private defaultTimeout: number;
  
  /** 清理间隔 */
  private cleanupInterval: number;
  
  /** 清理定时器 */
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(config: SubagentManagerConfig = {}) {
    this.maxConcurrent = config.maxConcurrent ?? 5;
    this.defaultTimeout = config.defaultTimeout ?? 60000;
    this.cleanupInterval = config.cleanupInterval ?? 300000;
    
    // 启动定期清理
    this.startCleanup();
  }

  /**
   * 创建子代理
   * 
   * @param options 创建选项
   * @returns 子代理 ID
   */
  async spawn(options: SpawnOptions): Promise<string> {
    // 检查并发限制
    if (this.getActiveCount() >= this.maxConcurrent) {
      throw new Error(`Maximum concurrent subagents reached (${this.maxConcurrent})`);
    }

    // 生成 UUID
    const id = `sub-${randomUUID()}`;
    const agentId = options.agentId ?? 'main';
    const sessionKey = `subagent:${agentId}:${id}`;

    // 创建子代理信息
    const info: SubagentInfo = {
      id,
      agentId,
      sessionKey,
      task: options.task,
      status: 'pending',
      createdAt: new Date(),
      timeout: options.timeout ?? this.defaultTimeout,
      skills: options.skills,
      model: options.model
    };

    this.subagents.set(id, info);
    
    return id;
  }

  /**
   * 开始执行子代理
   * 
   * @param subagentId 子代理 ID
   */
  startExecution(subagentId: string): void {
    const info = this.subagents.get(subagentId);
    if (info && info.status === 'pending') {
      info.status = 'running';
      info.startedAt = new Date();
    }
  }

  /**
   * 标记子代理完成
   * 
   * @param subagentId 子代理 ID
   * @param result 执行结果
   */
  complete(subagentId: string, result: string): void {
    const info = this.subagents.get(subagentId);
    if (info) {
      info.status = 'completed';
      info.result = result;
      info.endedAt = new Date();
    }
  }

  /**
   * 标记子代理失败
   * 
   * @param subagentId 子代理 ID
   * @param error 错误信息
   */
  fail(subagentId: string, error: string): void {
    const info = this.subagents.get(subagentId);
    if (info) {
      info.status = 'failed';
      info.error = error;
      info.endedAt = new Date();
    }
  }

  /**
   * 标记子代理超时
   * 
   * @param subagentId 子代理 ID
   */
  timeout(subagentId: string): void {
    const info = this.subagents.get(subagentId);
    if (info) {
      info.status = 'timeout';
      info.error = 'Execution timeout';
      info.endedAt = new Date();
    }
  }

  /**
   * 终止子代理
   * 
   * @param subagentId 子代理 ID
   */
  kill(subagentId: string): boolean {
    const info = this.subagents.get(subagentId);
    if (info && (info.status === 'pending' || info.status === 'running')) {
      info.status = 'killed';
      info.endedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * 获取子代理信息
   * 
   * @param subagentId 子代理 ID
   * @returns 子代理信息
   */
  get(subagentId: string): SubagentInfo | undefined {
    return this.subagents.get(subagentId);
  }

  /**
   * 获取所有子代理
   */
  getAll(): SubagentInfo[] {
    return Array.from(this.subagents.values());
  }

  /**
   * 获取活跃子代理（pending 或 running）
   */
  getActive(): SubagentInfo[] {
    return this.getAll().filter(
      info => info.status === 'pending' || info.status === 'running'
    );
  }

  /**
   * 获取活跃子代理数量
   */
  getActiveCount(): number {
    return this.getActive().length;
  }

  /**
   * 检查是否可以创建新子代理
   */
  canSpawn(): boolean {
    return this.getActiveCount() < this.maxConcurrent;
  }

  /**
   * 等待子代理完成
   * 
   * @param subagentId 子代理 ID
   * @param timeout 超时时间（毫秒）
   * @returns 执行结果
   */
  async await(subagentId: string, timeout?: number): Promise<SubagentResult> {
    const info = this.subagents.get(subagentId);
    if (!info) {
      return {
        success: false,
        subagentId,
        error: 'Subagent not found',
        duration: 0,
        status: 'failed'
      };
    }

    const startTime = Date.now();
    const checkInterval = 100;
    const maxWait = timeout ?? info.timeout;

    return new Promise((resolve) => {
      const check = () => {
        const current = this.subagents.get(subagentId);
        if (!current) {
          resolve({
            success: false,
            subagentId,
            error: 'Subagent not found',
            duration: Date.now() - startTime,
            status: 'failed'
          });
          return;
        }

        // 检查是否完成
        if (current.status !== 'pending' && current.status !== 'running') {
          const duration = Date.now() - startTime;
          
          if (current.status === 'completed') {
            resolve({
              success: true,
              subagentId,
              data: current.result,
              duration,
              status: current.status
            });
          } else {
            resolve({
              success: false,
              subagentId,
              error: current.error ?? `Subagent ${current.status}`,
              duration,
              status: current.status
            });
          }
          return;
        }

        // 检查超时
        if (Date.now() - startTime > maxWait) {
          this.timeout(subagentId);
          resolve({
            success: false,
            subagentId,
            error: 'Wait timeout',
            duration: Date.now() - startTime,
            status: 'timeout'
          });
          return;
        }

        // 继续等待
        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * 获取统计信息
   */
  getStats(): SubagentStats {
    const all = this.getAll();
    return {
      total: all.length,
      active: this.getActiveCount(),
      completed: all.filter(s => s.status === 'completed').length,
      failed: all.filter(s => s.status === 'failed' || s.status === 'timeout').length,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * 清理已完成的子代理
   */
  cleanup(): number {
    const toDelete: string[] = [];
    
    for (const [id, info] of this.subagents) {
      // 清理已完成、失败、超时、被终止的子代理
      if (['completed', 'failed', 'timeout', 'killed'].includes(info.status)) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.subagents.delete(id);
    }

    return toDelete.length;
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * 停止定期清理
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopCleanup();
    this.subagents.clear();
  }
}

/**
 * 创建子代理管理器
 */
export function createSubagentManager(config?: SubagentManagerConfig): SubagentManager {
  return new SubagentManager(config);
}