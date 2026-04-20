/**
 * @fileoverview TTL 管理器实现
 *
 * 实现候选池记忆的 TTL 过期清理。
 *
 * @module memory/store/ttl-manager
 */

import type { MemoryCandidatePool } from './candidate-pool.js';
import type { MemoryPromoter } from '../promotion/promoter.js';

/**
 * 清理统计
 */
interface CleanupResult {
  /** 过期数量 */
  expired: number;
  /** 晋升数量 */
  promoted: number;
  /** 清理数量 */
  cleaned: number;
}

/**
 * TTL 统计
 */
interface TTLStats {
  /** 清理次数 */
  cleanups: number;
  /** 总过期数 */
  totalExpired: number;
  /** 总清理数 */
  totalCleaned: number;
  /** 总晋升数 */
  totalPromoted: number;
}

/**
 * TTL 管理器
 *
 * 定期清理过期的候选池记忆。
 *
 * @example
 * ```ts
 * const ttlManager = new TTLManager(candidatePool, promoter);
 * ttlManager.schedule(3600000); // 每小时清理
 * ```
 */
export class TTLManager {
  /** 候选池 */
  private candidatePool: MemoryCandidatePool;
  /** 晋升器 */
  private promoter: MemoryPromoter;
  /** 定时器 */
  private timer?: ReturnType<typeof setInterval>;
  /** 默认 TTL */
  private defaultTTL: number = 24 * 60 * 60 * 1000; // 24h
  /** 统计 */
  private stats: TTLStats = {
    cleanups: 0,
    totalExpired: 0,
    totalCleaned: 0,
    totalPromoted: 0
  };

  /**
   * 创建 TTL 管理器
   */
  constructor(candidatePool: MemoryCandidatePool, promoter: MemoryPromoter) {
    this.candidatePool = candidatePool;
    this.promoter = promoter;
  }

  /**
   * 执行清理
   *
   * @returns 清理结果
   */
  async cleanup(): Promise<CleanupResult> {
    this.stats.cleanups++;

    const expiredEntries = this.candidatePool.getExpiredEntries();
    const result: CleanupResult = { expired: 0, promoted: 0, cleaned: 0 };

    for (const entry of expiredEntries) {
      this.stats.totalExpired++;
      result.expired++;

      // 检查是否需要晋升
      if (this.promoter.check(entry)) {
        const promoted = await this.promoter.promote(entry.id);
        if (promoted) {
          this.stats.totalPromoted++;
          result.promoted++;
          continue; // 晋升成功，跳过删除
        }
      }

      // 删除过期记忆
      await this.candidatePool.delete(entry.id);
      this.stats.totalCleaned++;
      result.cleaned++;
    }

    return result;
  }

  /**
   * 启动定时清理
   *
   * @param interval - 清理间隔（毫秒）
   */
  schedule(interval: number): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.timer = setInterval(async () => {
      await this.cleanup();
    }, interval);
  }

  /**
   * 停止定时清理
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * 是否正在运行
   */
  isRunning(): boolean {
    return this.timer !== undefined;
  }

  /**
   * 获取统计信息
   */
  getStats(): TTLStats {
    return { ...this.stats };
  }

  /**
   * 设置默认 TTL
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * 获取默认 TTL
   */
  getDefaultTTL(): number {
    return this.defaultTTL;
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      cleanups: 0,
      totalExpired: 0,
      totalCleaned: 0,
      totalPromoted: 0
    };
  }
}