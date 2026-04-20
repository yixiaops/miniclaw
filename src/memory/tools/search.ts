/**
 * @fileoverview 双层检索实现
 *
 * 实现双层记忆的合并检索功能。
 *
 * @module memory/tools/search
 */

import type { MemoryEntry, SearchResult } from '../store/interface.js';
import type { MemoryCandidatePool } from '../store/candidate-pool.js';
import type { LongTermMemory } from '../store/long-term.js';
import type { IEmbeddingService } from '../embedding/interface.js';

/**
 * 搜索参数
 */
interface SearchParams {
  /** 搜索查询 */
  query: string;
  /** 记忆类型过滤 */
  types?: ('candidate' | 'long-term')[];
  /** Session ID 过滤（仅短期记忆） */
  sessionId?: string;
  /** 结果数量限制 */
  limit?: number;
}

/**
 * 排序配置
 */
interface RankingConfig {
  /** 时间权重 */
  timeWeight: number;
  /** 相关性权重 */
  relevanceWeight: number;
}

/**
 * 搜索统计
 */
interface SearchStats {
  /** 总搜索次数 */
  totalSearches: number;
  /** 总结果数 */
  totalResults: number;
  /** 平均结果数 */
  avgResults: number;
}

/**
 * 双层检索工具
 *
 * 合并检索短期和长期记忆。
 *
 * @example
 * ```ts
 * const searchTool = new MemorySearchTool(candidatePool, longTerm, embeddingService);
 * const results = await searchTool.search({ query: 'user preferences' });
 * ```
 */
export class MemorySearchTool {
  /** 矩期记忆 */
  private candidatePool: MemoryCandidatePool;
  /** 长期记忆 */
  private longTerm: LongTermMemory;
  /** 嵌入服务（预留，未来用于语义搜索） */
  // @ts-expect-error Reserved for future semantic search
  private embeddingService: IEmbeddingService;
  /** 排序配置 */
  private rankingConfig: RankingConfig = {
    timeWeight: 0.6,
    relevanceWeight: 0.4
  };
  /** 统计 */
  private stats: SearchStats = { totalSearches: 0, totalResults: 0, avgResults: 0 };

  /**
   * 创建检索工具
   */
  constructor(
    candidatePool: MemoryCandidatePool,
    longTerm: LongTermMemory,
    embeddingService: IEmbeddingService
  ) {
    this.candidatePool = candidatePool;
    this.longTerm = longTerm;
    this.embeddingService = embeddingService;
  }

  /**
   * 执行检索
   *
   * @param params - 搜索参数
   * @returns 搜索结果列表
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    this.stats.totalSearches++;

    const { query, types, sessionId, limit = 10 } = params;
    const allResults: SearchResult[] = [];

    // 1. 检索短期记忆
    if (!types || types.includes('candidate')) {
      let shortEntries = sessionId
        ? await this.candidatePool.list(sessionId)
        : await this.getAllShortTerm();

      for (const entry of shortEntries) {
        const score = this.calculateScore(query, entry);
        allResults.push({ entry, score });
      }
    }

    // 2. 检索长期记忆
    if (!types || types.includes('long-term')) {
      const longEntries = await this.longTerm.list();

      for (const entry of longEntries) {
        const score = this.calculateScore(query, entry);
        allResults.push({ entry, score });
      }
    }

    // 3. 过滤无匹配结果（score = 0）
    const filtered = allResults.filter(r => r.score > 0);

    // 4. 排序
    const sorted = filtered.sort((a, b) => b.score - a.score);

    // 5. 限制数量
    const limited = sorted.slice(0, limit);

    // 更新统计
    this.stats.totalResults += limited.length;
    this.stats.avgResults = this.stats.totalResults / this.stats.totalSearches;

    return limited;
  }

  /**
   * 获取所有短期记忆
   */
  private async getAllShortTerm(): Promise<MemoryEntry[]> {
    const stats = this.candidatePool.getStats();
    const allEntries: MemoryEntry[] = [];

    for (const sessionId of Object.keys(stats.bySession)) {
      const entries = await this.candidatePool.list(sessionId);
      allEntries.push(...entries);
    }

    return allEntries;
  }

  /**
   * 计算综合评分
   *
   * 时间权重 + 相关性权重
   */
  private calculateScore(query: string, entry: MemoryEntry): number {
    // 相关性评分（关键词匹配）
    let relevanceScore = 0;
    if (query && entry.content.toLowerCase().includes(query.toLowerCase())) {
      relevanceScore = 1.0;
    }

    // 无匹配时直接返回 0
    if (relevanceScore === 0) {
      return 0;
    }

    // 时间评分（越新越高）
    const now = Date.now();
    const age = now - entry.createdAt.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24h
    const timeScore = Math.max(0, 1 - age / maxAge);

    // 综合评分
    const { timeWeight, relevanceWeight } = this.rankingConfig;
    return timeScore * timeWeight + relevanceScore * relevanceWeight;
  }

  /**
   * 设置排序配置
   */
  setRankingConfig(config: Partial<RankingConfig>): void {
    this.rankingConfig = { ...this.rankingConfig, ...config };
  }

  /**
   * 获取排序配置
   */
  getRankingConfig(): RankingConfig {
    return { ...this.rankingConfig };
  }

  /**
   * 获取统计信息
   */
  getStats(): SearchStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = { totalSearches: 0, totalResults: 0, avgResults: 0 };
  }
}