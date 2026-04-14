/**
 * @fileoverview 记忆晋升机制实现
 *
 * 实现短期记忆晋升为长期记忆的逻辑。
 *
 * @module memory/promotion/promoter
 */

import type { MemoryEntry } from '../store/interface.js';
import type { ShortTermMemory } from '../store/short-term.js';
import type { LongTermMemory } from '../store/long-term.js';

/**
 * 晋升规则配置
 */
interface PromotionConfig {
  /** 重要性阈值 */
  importanceThreshold: number;
}

/**
 * 晋升统计
 */
interface PromotionStats {
  /** 总检查次数 */
  totalChecked: number;
  /** 晋升次数 */
  promoted: number;
  /** 跳过次数 */
  skipped: number;
}

/**
 * 记忆晋升器
 *
 * 将符合条件的短期记忆晋升为长期记忆。
 *
 * @example
 * ```ts
 * const promoter = new MemoryPromoter(shortTerm, longTerm);
 * const shouldPromote = promoter.check(entry);
 * if (shouldPromote) {
 *   await promoter.promote(id);
 * }
 * ```
 */
export class MemoryPromoter {
  /** 短期记忆 */
  private shortTerm: ShortTermMemory;
  /** 长期记忆 */
  private longTerm: LongTermMemory;
  /** 配置 */
  private config: PromotionConfig = {
    importanceThreshold: 0.5
  };
  /** 统计 */
  private stats: PromotionStats = { totalChecked: 0, promoted: 0, skipped: 0 };

  /**
   * 创建晋升器
   */
  constructor(shortTerm: ShortTermMemory, longTerm: LongTermMemory) {
    this.shortTerm = shortTerm;
    this.longTerm = longTerm;
  }

  /**
   * 检查是否应该晋升
   *
   * @param entry - 记忆条目
   * @returns 是否应该晋升
   */
  check(entry: MemoryEntry): boolean {
    this.stats.totalChecked++;

    const importance = entry.metadata.importance || 0;
    const shouldPromote = importance >= this.config.importanceThreshold;

    if (!shouldPromote) {
      this.stats.skipped++;
    }

    return shouldPromote;
  }

  /**
   * 晋升短期记忆为长期记忆
   *
   * @param shortId - 短期记忆 ID
   * @returns 长期记忆 ID（失败返回 null）
   */
  async promote(shortId: string): Promise<string | null> {
    // 读取短期记忆
    const entry = await this.shortTerm.read(shortId);
    if (!entry) {
      return null;
    }

    // 检查是否应该晋升
    if (!this.check(entry)) {
      return null;
    }

    // 写入长期记忆
    const longId = await this.longTerm.write(entry.content, {
      ...entry.metadata,
      importance: entry.metadata.importance || 0.5,
      promotedAt: new Date(),
      sessionId: undefined // 清除 sessionId
    });

    // 删除短期记忆
    await this.shortTerm.delete(shortId);

    this.stats.promoted++;
    return longId;
  }

  /**
   * 晋升所有符合条件的短期记忆
   *
   * @returns 晋升的长期记忆 ID 列表
   */
  async promoteAll(): Promise<string[]> {
    const stats = this.shortTerm.getStats();
    const promotedIds: string[] = [];

    for (const sessionId of Object.keys(stats.bySession)) {
      const memories = await this.shortTerm.list(sessionId);

      for (const entry of memories) {
        if (this.check(entry)) {
          const longId = await this.promote(entry.id);
          if (longId) {
            promotedIds.push(longId);
          }
        }
      }
    }

    return promotedIds;
  }

  /**
   * 设置重要性阈值
   */
  setThreshold(threshold: number): void {
    this.config.importanceThreshold = threshold;
  }

  /**
   * 获取统计信息
   */
  getStats(): PromotionStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = { totalChecked: 0, promoted: 0, skipped: 0 };
  }
}