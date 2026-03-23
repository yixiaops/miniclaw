/**
 * @fileoverview Session 搜索器
 *
 * 搜索对话历史中的消息内容。
 * 复用 SimpleMemoryStorage 进行数据读取。
 *
 * @module core/memory/session-searcher
 */

import type { SimpleMemoryStorage } from './simple.js';

/**
 * 搜索结果
 */
export interface MemorySearchResult {
  /** 文件路径 */
  path: string;
  /** 起始行号 */
  startLine: number;
  /** 结束行号 */
  endLine: number;
  /** 匹配分数 */
  score: number;
  /** 匹配的内容片段 */
  snippet: string;
  /** 数据来源 */
  source: 'sessions' | 'memory';
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 最大结果数 */
  maxResults?: number;
  /** 最小分数 */
  minScore?: number;
  /** 限制在特定 Session */
  sessionKey?: string;
  /** 搜索来源 */
  sources?: ('sessions' | 'memory')[];
}

/**
 * SessionSearcher 类
 *
 * 搜索对话历史中的消息内容。
 * 使用 SimpleMemoryStorage 加载数据，不重复实现读取逻辑。
 *
 * @example
 * ```ts
 * const storage = new SimpleMemoryStorage();
 * const searcher = new SessionSearcher(storage);
 * const results = await searcher.search('ETF');
 * ```
 */
export class SessionSearcher {
  /** 存储实例 */
  private storage: SimpleMemoryStorage;

  /**
   * 创建 SessionSearcher 实例
   *
   * @param storage - SimpleMemoryStorage 实例
   */
  constructor(storage: SimpleMemoryStorage) {
    this.storage = storage;
  }

  /**
   * 搜索消息内容
   *
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns 匹配的搜索结果
   */
  async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];
    const maxResults = options?.maxResults ?? 10;
    const queryLower = query.toLowerCase();

    // 获取所有 session
    const sessionKeys = await this.storage.listSessions();

    for (const sessionKey of sessionKeys) {
      // 如果指定了 sessionKey，只搜索该 session
      if (options?.sessionKey && sessionKey !== options.sessionKey) {
        continue;
      }

      // 加载消息
      const messages = await this.storage.load(sessionKey);

      // 搜索每条消息
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const contentLower = msg.content.toLowerCase();

        // 大小写不敏感匹配
        if (contentLower.includes(queryLower)) {
          results.push({
            path: `sessions/${sessionKey}`,
            startLine: i,
            endLine: i,
            score: 1.0,
            snippet: msg.content,
            source: 'sessions'
          });

          // 达到最大结果数，提前返回
          if (results.length >= maxResults) {
            return results;
          }
        }
      }
    }

    return results;
  }
}