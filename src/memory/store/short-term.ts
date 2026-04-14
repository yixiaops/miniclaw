/**
 * @fileoverview 短期记忆管理实现
 *
 * 实现短期记忆存储，支持 Session 隔离和 TTL 过期。
 *
 * @module memory/store/short-term
 */

import type { MemoryEntry, MemoryMetadata } from './interface.js';
import { SessionManager, SessionInfo } from './session-manager.js';

/**
 * 短期记忆配置
 */
interface ShortTermConfig {
  /** 默认 TTL（毫秒） */
  defaultTTL: number;
  /** 最大记忆数/Session */
  maxPerSession: number;
}

/**
 * 短期记忆存储
 *
 * 支持按 Session 隔离，自动 TTL 过期。
 *
 * @example
 * ```ts
 * const shortTerm = new ShortTermMemory(sessionManager);
 * const id = await shortTerm.write('Context', 'session-123');
 * ```
 */
export class ShortTermMemory {
  /** 存储映射 */
  private store: Map<string, MemoryEntry> = new Map();
  /** Session 管理器 */
  private sessionManager: SessionManager;
  /** 配置 */
  private config: ShortTermConfig = {
    defaultTTL: 24 * 60 * 60 * 1000, // 24h
    maxPerSession: 100
  };

  /**
   * 创建短期记忆存储
   */
  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  /**
   * 写入短期记忆
   *
   * @param content - 内容
   * @param sessionId - Session ID
   * @param metadata - 元数据（可选）
   * @returns 记忆 ID
   */
  async write(
    content: string,
    sessionId: string,
    metadata?: Partial<MemoryMetadata>
  ): Promise<string> {
    // 更新 Session 活动
    this.sessionManager.updateActivity(sessionId);

    // 生成 ID
    const id = `short-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const entry: MemoryEntry = {
      id,
      content,
      type: 'short-term',
      metadata: {
        sessionId,
        timestamp: now,
        ttl: metadata?.ttl || this.config.defaultTTL,
        ...metadata
      },
      createdAt: now,
      updatedAt: now
    };

    this.store.set(id, entry);
    return id;
  }

  /**
   * 读取短期记忆
   */
  async read(id: string): Promise<MemoryEntry | null> {
    return this.store.get(id) || null;
  }

  /**
   * 列出 Session 的所有记忆
   */
  async list(sessionId: string): Promise<MemoryEntry[]> {
    const entries = Array.from(this.store.values());
    return entries.filter(e => e.metadata.sessionId === sessionId);
  }

  /**
   * 删除短期记忆
   */
  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * 清除所有记忆
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * 检查记忆是否过期
   */
  isExpired(id: string): boolean {
    const entry = this.store.get(id);
    if (!entry) {
      return true;
    }

    const ttl = entry.metadata.ttl || this.config.defaultTTL;
    const expiresAt = entry.createdAt.getTime() + ttl;

    return Date.now() > expiresAt;
  }

  /**
   * 获取过期记忆列表
   */
  getExpiredEntries(): MemoryEntry[] {
    const entries = Array.from(this.store.values());
    return entries.filter(e => this.isExpired(e.id));
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; bySession: Record<string, number> } {
    const entries = Array.from(this.store.values());
    const bySession: Record<string, number> = {};

    for (const entry of entries) {
      const sessionId = entry.metadata.sessionId || 'unknown';
      bySession[sessionId] = (bySession[sessionId] || 0) + 1;
    }

    return {
      total: entries.length,
      bySession
    };
  }
}