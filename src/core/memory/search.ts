/**
 * @fileoverview 记忆搜索管理器
 *
 * 整合 SessionSearcher 和 KnowledgeSearcher，提供统一的搜索接口。
 *
 * @module core/memory/search
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { SimpleMemoryStorage } from './simple.js';
import { SessionSearcher, type MemorySearchResult, type SearchOptions } from './session-searcher.js';
import { KnowledgeSearcher } from './knowledge-searcher.js';

/**
 * 文件读取参数
 */
export interface FileReadParams {
  /** 文件路径（相对于 ~/.miniclaw/） */
  path: string;
  /** 起始行号（1-indexed） */
  from?: number;
  /** 读取行数 */
  lines?: number;
}

/**
 * MemorySearchManager 类
 *
 * 记忆搜索的统一入口，整合对话历史搜索和知识库搜索。
 *
 * @example
 * ```ts
 * const manager = new MemorySearchManager();
 *
 * // 搜索所有来源
 * const results = await manager.search('ETF');
 *
 * // 读取文件内容
 * const content = await manager.readFile({ path: 'memory/notes.md' });
 * ```
 */
export class MemorySearchManager {
  /** Session 搜索器 */
  private sessionSearcher: SessionSearcher;
  /** 知识库搜索器 */
  private knowledgeSearcher: KnowledgeSearcher;
  /** 基础目录 */
  private baseDir: string;

  /**
   * 创建 MemorySearchManager 实例
   *
   * @param storageDir - 存储目录路径（默认为 ~/.miniclaw/）
   */
  constructor(storageDir?: string) {
    this.baseDir = storageDir || join(process.env.HOME || '', '.miniclaw');

    // 初始化搜索器
    const sessionsDir = join(this.baseDir, 'sessions');
    const storage = new SimpleMemoryStorage(sessionsDir);
    this.sessionSearcher = new SessionSearcher(storage);

    const memoryDir = join(this.baseDir, 'memory');
    this.knowledgeSearcher = new KnowledgeSearcher(memoryDir);
  }

  /**
   * 搜索记忆
   *
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns 匹配的搜索结果
   */
  async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]> {
    const sources = options?.sources || ['sessions', 'memory'];
    const maxResults = options?.maxResults ?? 10;
    const results: MemorySearchResult[] = [];

    // 搜索 sessions
    if (sources.includes('sessions')) {
      const sessionResults = await this.sessionSearcher.search(query, options);
      results.push(...sessionResults);
    }

    // 搜索 memory
    if (sources.includes('memory')) {
      const memoryResults = await this.knowledgeSearcher.search(query, options);
      results.push(...memoryResults);
    }

    // 按分数排序（目前都是 1.0，顺序不重要）
    // 限制结果数量
    return results.slice(0, maxResults);
  }

  /**
   * 读取文件内容
   *
   * @param params - 文件读取参数
   * @returns 文件内容
   */
  async readFile(params: FileReadParams): Promise<{ text: string; path: string }> {
    // 安全检查：防止路径遍历
    const normalizedPath = join(this.baseDir, params.path);
    if (!normalizedPath.startsWith(this.baseDir)) {
      throw new Error('Invalid path: must be within ~/.miniclaw');
    }

    // 读取文件
    const content = await readFile(normalizedPath, 'utf-8');
    const lines = content.split('\n');

    // 分页处理
    const from = params.from ?? 1;
    const count = params.lines ?? lines.length;

    // 边界检查
    const start = Math.max(0, from - 1);
    const end = Math.min(lines.length, start + count);

    const selectedLines = lines.slice(start, end);

    return {
      text: selectedLines.join('\n'),
      path: params.path
    };
  }
}