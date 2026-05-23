/**
 * @fileoverview 记忆候选池实现
 *
 * 实现候选记忆存储，支持 Session 隔离和 TTL 过期。
 *
 * @module memory/store/candidate-pool
 */

import type { MemoryEntry, MemoryMetadata } from './interface.js';
import { SessionManager } from './session-manager.js';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

/** 候选池存储结构 */
interface CandidatePoolStoreData {
  entries: MemoryEntry[];
  savedAt: string;
}

/**
 * 记忆晋升器接口
 */
export interface MemoryPromoter {
  /** 晋升记忆到长期存储 */
  promote(entry: MemoryEntry): Promise<void>;
}

/**
 * 候选池配置
 */
interface CandidatePoolConfig {
  /** 默认 TTL（毫秒） */
  defaultTTL: number;
  /** 最大记忆数/Session */
  maxPerSession: number;
  /** 最大条目数（容量上限） */
  maxEntries: number;
  /** 每次清理的条目数 */
  evictCount: number;
  /** 即时晋升阈值（importance >= 此值时立即晋升） */
  instantPromoteThreshold: number;
}

/**
 * 记忆候选池存储
 *
 * 支持按 Session 隔离，自动 TTL 过期。
 *
 * @example
 * ```ts
 * const candidatePool = new MemoryCandidatePool(sessionManager);
 * const id = await candidatePool.write('Context', 'session-123');
 * ```
 */
export class MemoryCandidatePool {
  /** 存储映射 */
  private store: Map<string, MemoryEntry> = new Map();
  /** Session 管理器 */
  private sessionManager: SessionManager;
  /** 记忆晋升器 */
  private promoter?: MemoryPromoter;
  /** 持久化文件路径 */
  private filePath: string;
  /** 配置 */
  private config: CandidatePoolConfig = {
    defaultTTL: 24 * 60 * 60 * 1000, // 24h
    maxPerSession: 100,
    maxEntries: 500,
    evictCount: 50,
    instantPromoteThreshold: 0.5
  };

  /** 最大条目数 */
  get maxEntries(): number {
    return this.config.maxEntries;
  }

  /** 每次清理条目数 */
  get evictCount(): number {
    return this.config.evictCount;
  }

  /** 即时晋升阈值 */
  get instantPromoteThreshold(): number {
    return this.config.instantPromoteThreshold;
  }

  /**
   * 创建候选池存储
   *
   * @param sessionManager - Session 管理器
   * @param config - 配置选项（可选）
   * @param filePath - 持久化文件路径（可选，默认 ~/.miniclaw/candidate-pool.json）
   */
  constructor(
    sessionManager: SessionManager,
    config?: Partial<CandidatePoolConfig>,
    filePath?: string
  ) {
    this.sessionManager = sessionManager;
    this.filePath = filePath || path.join(homedir(), '.miniclaw', 'candidate-pool.json');
    if (config) {
      this.config = { ...this.config, ...config };
    }
    // 启动时加载持久化数据
    this.loadFromFile();
  }

  /**
   * 从文件加载候选池数据
   */
  private loadFromFile(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        return; // 文件不存在，使用空存储
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data: CandidatePoolStoreData = JSON.parse(content);

      // 恢复记忆条目
      for (const entry of data.entries || []) {
        // 恢复 Date 对象
        entry.createdAt = new Date(entry.createdAt);
        entry.updatedAt = new Date(entry.updatedAt);
        if (entry.metadata.timestamp) {
          entry.metadata.timestamp = new Date(entry.metadata.timestamp);
        }
        this.store.set(entry.id, entry);
      }

      console.log(`[CandidatePool] 从文件加载了 ${this.store.size} 条候选记忆`);
    } catch (error) {
      console.warn(`[CandidatePool] 加载失败，使用空存储: ${error}`);
    }
  }

  /**
   * 持久化候选池数据到文件
   */
  persist(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const entries = Array.from(this.store.values());
      const data: CandidatePoolStoreData = {
        entries,
        savedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[CandidatePool] 持久化了 ${entries.length} 条候选记忆`);
    } catch (error) {
      console.warn(`[CandidatePool] 持久化失败: ${error}`);
    }
  }

  /**
   * 设置记忆晋升器
   *
   * @param promoter - 晋升器实例
   */
  setPromoter(promoter: MemoryPromoter): void {
    this.promoter = promoter;
  }

  /**
   * 清理低重要性条目
   *
   * @param count - 清理数量
   */
  evictLowImportance(count: number): void {
    if (count >= this.store.size) {
      return; // 不清理超过总数的情况
    }

    // 获取所有条目并按 importance 排序（升序，低 importance 在前）
    const entries = Array.from(this.store.values());
    entries.sort((a, b) => {
      const importanceA = a.metadata.importance ?? 0;
      const importanceB = b.metadata.importance ?? 0;
      return importanceA - importanceB;
    });

    // 删除前 count 个最低 importance 的条目
    for (let i = 0; i < count && i < entries.length; i++) {
      this.store.delete(entries[i].id);
    }
  }

  /**
   * 写入候选记忆
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
    // 检查容量并触发清理
    if (this.store.size >= this.config.maxEntries) {
      this.evictLowImportance(this.config.evictCount);
    }

    // 更新 Session 活动
    this.sessionManager.updateActivity(sessionId);

    // 生成 ID
    const id = `candidate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const entry: MemoryEntry = {
      id,
      content,
      type: 'candidate',
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

    // 检查是否需要即时晋升
    const importance = metadata?.importance ?? 0;
    if (this.promoter && importance >= this.config.instantPromoteThreshold) {
      await this.promoter.promote(entry);
    }

    return id;
  }

  /**
   * 读取候选记忆
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