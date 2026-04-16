/**
 * @fileoverview 记忆管理器
 *
 * 统一管理双层记忆系统的入口，提供简化 API。
 *
 * @module memory/manager
 */

import { ShortTermMemory } from './store/short-term.js';
import { LongTermMemory } from './store/long-term.js';
import { SessionManager } from './store/session-manager.js';
import { TTLManager } from './store/ttl-manager.js';
import { MemoryPromoter } from './promotion/promoter.js';
import { MemorySearchTool } from './tools/search.js';
import { EmbeddingService } from './embedding/index.js';
import type { MemoryMetadata, SearchResult, SearchOptions } from './store/interface.js';

/**
 * 记忆管理器配置
 */
export interface MemoryManagerConfig {
  /** 存储目录 */
  storageDir: string;
  /** 默认 TTL（毫秒），默认 24h */
  defaultTTL?: number;
  /** TTL 清理间隔（毫秒），默认 1h */
  cleanupInterval?: number;
  /** 晋升重要性阈值，默认 0.5 */
  promotionThreshold?: number;
}

/**
 * 记忆状态
 */
export interface MemoryStatus {
  /** 短期记忆总数 */
  shortTermCount: number;
  /** 长期记忆总数 */
  longTermCount: number;
  /** 各 Session 记忆数 */
  bySession: Record<string, number>;
  /** 平均重要性 */
  avgImportance: number;
  /** TTL 管理器是否运行 */
  ttlRunning: boolean;
}

/**
 * 清理结果
 */
export interface CleanupResult {
  /** 过期数量 */
  expired: number;
  /** 晋升数量 */
  promoted: number;
  /** 清理数量 */
  cleaned: number;
}

/**
 * MemoryManager 类
 *
 * 统一管理双层记忆系统的入口。
 *
 * @example
 * ```ts
 * const manager = new MemoryManager({
 *   storageDir: '~/.miniclaw',
 *   defaultTTL: 24 * 60 * 60 * 1000
 * });
 * await manager.initialize();
 * await manager.write('User prefers dark mode', 'session-1');
 * const results = await manager.search('dark mode');
 * await manager.cleanup();
 * await manager.persist();
 * manager.destroy();
 * ```
 */
export class MemoryManager {
  private sessionManager: SessionManager;
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private promoter: MemoryPromoter;
  private ttlManager: TTLManager;
  private searchTool: MemorySearchTool;
  private embeddingService: EmbeddingService;
  private config: MemoryManagerConfig;
  private initialized: boolean = false;

  constructor(config: MemoryManagerConfig) {
    this.config = config;

    // 初始化所有组件
    this.sessionManager = new SessionManager();
    this.shortTerm = new ShortTermMemory(this.sessionManager, {
      defaultTTL: config.defaultTTL
    });
    this.longTerm = new LongTermMemory(config.storageDir);
    this.embeddingService = new EmbeddingService();

    this.promoter = new MemoryPromoter(this.shortTerm, this.longTerm);
    if (config.promotionThreshold) {
      this.promoter.setThreshold(config.promotionThreshold);
    }

    this.ttlManager = new TTLManager(this.shortTerm, this.promoter);
    if (config.defaultTTL) {
      this.ttlManager.setDefaultTTL(config.defaultTTL);
    }

    this.searchTool = new MemorySearchTool(
      this.shortTerm,
      this.longTerm,
      this.embeddingService
    );
  }

  /**
   * 初始化记忆系统
   *
   * 加载长期记忆，启动 TTL 清理。
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // 加载长期记忆
      await this.longTerm.load();

      // 启动 TTL 清理
      const interval = this.config.cleanupInterval || 3600000; // 1h
      this.ttlManager.schedule(interval);

      this.initialized = true;
    } catch (error) {
      // 静默降级
      console.error('[MemoryManager] Initialize failed:', error);
    }
  }

  /**
   * 写入记忆
   *
   * @param content - 记忆内容
   * @param sessionId - Session ID
   * @param metadata - 元数据（可选）
   * @returns 记忆 ID
   */
  async write(
    content: string,
    sessionId: string,
    metadata?: MemoryMetadata
  ): Promise<string> {
    try {
      const defaultImportance = 0.3;
      return await this.shortTerm.write(content, sessionId, {
        ...metadata,
        importance: metadata?.importance ?? defaultImportance
      });
    } catch (error) {
      // 静默降级
      console.error('[MemoryManager] Write failed:', error);
      return '';
    }
  }

  /**
   * 搜索记忆
   *
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns 搜索结果
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    if (!this.initialized) {
      return [];
    }

    try {
      return await this.searchTool.search({
        query,
        limit: options?.limit || 10,
        types: options?.types
      });
    } catch (error) {
      // 静默降级
      console.error('[MemoryManager] Search failed:', error);
      return [];
    }
  }

  /**
   * 晋升指定记忆
   *
   * @param shortId - 短期记忆 ID
   * @returns 长期记忆 ID（失败返回 null）
   */
  async promote(shortId: string): Promise<string | null> {
    try {
      return await this.promoter.promote(shortId);
    } catch (error) {
      console.error('[MemoryManager] Promote failed:', error);
      return null;
    }
  }

  /**
   * 晋升所有符合条件的记忆
   *
   * @returns 晋升的长期记忆 ID 列表
   */
  async promoteAll(): Promise<string[]> {
    try {
      return await this.promoter.promoteAll();
    } catch (error) {
      console.error('[MemoryManager] PromoteAll failed:', error);
      return [];
    }
  }

  /**
   * 执行 TTL 清理
   *
   * @returns 清理结果
   */
  async cleanup(): Promise<CleanupResult> {
    try {
      return await this.ttlManager.cleanup();
    } catch (error) {
      console.error('[MemoryManager] Cleanup failed:', error);
      return { expired: 0, promoted: 0, cleaned: 0 };
    }
  }

  /**
   * 持久化长期记忆
   */
  async persist(): Promise<void> {
    try {
      await this.longTerm.persist();
    } catch (error) {
      console.error('[MemoryManager] Persist failed:', error);
    }
  }

  /**
   * 获取状态
   *
   * @returns 状态信息
   */
  getStatus(): MemoryStatus {
    const shortStats = this.shortTerm.getStats();
    const longStats = this.longTerm.getStats();

    return {
      shortTermCount: shortStats.total,
      longTermCount: longStats.total,
      bySession: shortStats.bySession,
      avgImportance: longStats.avgImportance,
      ttlRunning: this.ttlManager.isRunning()
    };
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    this.ttlManager.stop();
    this.shortTerm.clear();
    this.longTerm.clear();
    this.initialized = false;
  }
}