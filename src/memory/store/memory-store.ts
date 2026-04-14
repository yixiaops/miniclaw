/**
 * @fileoverview Memory Store 实现
 *
 * 实现记忆存储的核心功能，使用内存 Map 存储。
 *
 * @module memory/store/memory-store
 */

import type {
  IMemoryStore,
  MemoryEntry,
  MemoryType,
  MemoryMetadata,
  SearchOptions,
  SearchResult
} from './interface.js';

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `memory-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * MemoryStore 类
 *
 * 实现记忆存储的核心操作，使用内存 Map 存储。
 *
 * @example
 * ```ts
 * const store = new MemoryStore();
 * const id = await store.write('User prefers dark mode', 'long-term');
 * const entry = await store.read(id);
 * ```
 */
export class MemoryStore implements IMemoryStore {
  /** 存储映射 */
  private store: Map<string, MemoryEntry> = new Map();

  /**
   * 写入记忆
   */
  async write(content: string, type: MemoryType, metadata?: MemoryMetadata): Promise<string> {
    const id = generateId();
    const now = new Date();

    const entry: MemoryEntry = {
      id,
      content,
      type,
      metadata: metadata || {},
      createdAt: now,
      updatedAt: now
    };

    this.store.set(id, entry);
    return id;
  }

  /**
   * 读取记忆
   */
  async read(id: string): Promise<MemoryEntry | null> {
    return this.store.get(id) || null;
  }

  /**
   * 更新记忆
   */
  async update(id: string, content: string): Promise<boolean> {
    const entry = this.store.get(id);
    if (!entry) {
      return false;
    }

    entry.content = content;
    entry.updatedAt = new Date();
    this.store.set(id, entry);
    return true;
  }

  /**
   * 删除记忆
   */
  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * 列出记忆
   */
  async list(type?: MemoryType): Promise<MemoryEntry[]> {
    const entries = Array.from(this.store.values());

    if (type) {
      return entries.filter(e => e.type === type);
    }

    return entries;
  }

  /**
   * 搜索记忆
   *
   * 使用简单的关键词匹配（子字符串搜索）
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, limit = 10, minScore = 0, types } = options;
    const queryLower = query.toLowerCase();

    const entries = await this.list();
    let filteredEntries = entries;

    // 类型过滤
    if (types && types.length > 0) {
      filteredEntries = entries.filter(e => types.includes(e.type));
    }

    // 关键词匹配
    const results: SearchResult[] = [];
    for (const entry of filteredEntries) {
      const contentLower = entry.content.toLowerCase();

      if (contentLower.includes(queryLower)) {
        // 简单评分：匹配则返回 1.0
        const score = 1.0;

        if (score >= minScore) {
          results.push({ entry, score });
        }
      }
    }

    // 限制结果数量
    return results.slice(0, limit);
  }
}