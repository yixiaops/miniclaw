/**
 * @fileoverview 长期记忆持久化实现
 *
 * 实现长期记忆存储，支持文件持久化和加载。
 *
 * @module memory/store/long-term
 */

import type { MemoryEntry, MemoryMetadata } from './interface.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 长期记忆配置
 */
interface LongTermConfig {
  /** 存储目录 */
  storageDir: string;
  /** 主记忆文件 */
  memoryFile: string;
  /** 元数据文件 */
  metadataFile: string;
}

/**
 * 长期记忆存储
 *
 * 支持跨 Session 持久化，服务重启后数据恢复。
 *
 * @example
 * ```ts
 * const longTerm = new LongTermMemory('./memory');
 * const id = await longTerm.write('User prefers dark mode');
 * await longTerm.persist();
 * ```
 */
export class LongTermMemory {
  /** 存储映射 */
  private store: Map<string, MemoryEntry> = new Map();
  /** 配置 */
  private config: LongTermConfig;

  /**
   * 创建长期记忆存储
   *
   * @param storageDir - 存储目录
   */
  constructor(storageDir: string) {
    this.config = {
      storageDir,
      memoryFile: path.join(storageDir, 'MEMORY.md'),
      metadataFile: path.join(storageDir, 'long-term.json')
    };
  }

  /**
   * 写入长期记忆
   */
  async write(
    content: string,
    metadata?: Partial<MemoryMetadata>
  ): Promise<string> {
    const id = `long-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const entry: MemoryEntry = {
      id,
      content,
      type: 'long-term',
      metadata: {
        persisted: true,
        importance: metadata?.importance || 0.5,
        timestamp: now,
        ...metadata
      },
      createdAt: now,
      updatedAt: now
    };

    this.store.set(id, entry);
    return id;
  }

  /**
   * 读取长期记忆
   */
  async read(id: string): Promise<MemoryEntry | null> {
    return this.store.get(id) || null;
  }

  /**
   * 列出长期记忆
   */
  async list(options?: { minImportance?: number }): Promise<MemoryEntry[]> {
    let entries = Array.from(this.store.values());

    if (options?.minImportance) {
      entries = entries.filter(
        e => (e.metadata.importance || 0) >= options.minImportance!
      );
    }

    return entries;
  }

  /**
   * 更新长期记忆
   */
  async update(id: string, content: string): Promise<boolean> {
    const entry = this.store.get(id);
    if (!entry) {
      return false;
    }

    entry.content = content;
    entry.updatedAt = new Date();
    return true;
  }

  /**
   * 删除长期记忆
   */
  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  /**
   * 持久化到文件
   */
  async persist(): Promise<void> {
    // 确保目录存在
    await fs.mkdir(this.config.storageDir, { recursive: true });

    // 写入 Markdown 文件
    const entries = Array.from(this.store.values());
    const mdContent = this.formatMarkdown(entries);
    await fs.writeFile(this.config.memoryFile, mdContent, 'utf-8');

    // 写入 JSON 元数据
    const jsonContent = JSON.stringify({ entries }, null, 2);
    await fs.writeFile(this.config.metadataFile, jsonContent, 'utf-8');
  }

  /**
   * 从文件加载
   */
  async load(): Promise<void> {
    try {
      const jsonContent = await fs.readFile(this.config.metadataFile, 'utf-8');
      const data = JSON.parse(jsonContent);

      for (const entry of data.entries || []) {
        // 转换日期
        entry.createdAt = new Date(entry.createdAt);
        entry.updatedAt = new Date(entry.updatedAt);
        if (entry.metadata.timestamp) {
          entry.metadata.timestamp = new Date(entry.metadata.timestamp);
        }
        if (entry.metadata.promotedAt) {
          entry.metadata.promotedAt = new Date(entry.metadata.promotedAt);
        }

        this.store.set(entry.id, entry);
      }
    } catch {
      // 文件不存在或解析失败，忽略
    }
  }

  /**
   * 格式化 Markdown 内容
   */
  private formatMarkdown(entries: MemoryEntry[]): string {
    const lines = [
      '# MEMORY.md - 长期记忆',
      '',
      '> 自动生成，请勿手动编辑',
      ''
    ];

    // 按重要性排序
    const sorted = entries.sort(
      (a, b) => (b.metadata.importance || 0) - (a.metadata.importance || 0)
    );

    // 分类
    const highImportance = sorted.filter(e => (e.metadata.importance || 0) >= 0.7);
    const mediumImportance = sorted.filter(
      e => (e.metadata.importance || 0) >= 0.5 && (e.metadata.importance || 0) < 0.7
    );
    const lowImportance = sorted.filter(e => (e.metadata.importance || 0) < 0.5);

    if (highImportance.length > 0) {
      lines.push('## 高重要性');
      for (const entry of highImportance) {
        lines.push(`- ${entry.content} | importance: ${entry.metadata.importance}`);
      }
      lines.push('');
    }

    if (mediumImportance.length > 0) {
      lines.push('## 中重要性');
      for (const entry of mediumImportance) {
        lines.push(`- ${entry.content} | importance: ${entry.metadata.importance}`);
      }
      lines.push('');
    }

    if (lowImportance.length > 0) {
      lines.push('## 低重要性');
      for (const entry of lowImportance) {
        lines.push(`- ${entry.content} | importance: ${entry.metadata.importance}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; avgImportance: number } {
    const entries = Array.from(this.store.values());
    const total = entries.length;

    if (total === 0) {
      return { total: 0, avgImportance: 0 };
    }

    const avgImportance =
      entries.reduce((sum, e) => sum + (e.metadata.importance || 0), 0) / total;

    return { total, avgImportance };
  }

  /**
   * 清除所有记忆（内存）
   */
  clear(): void {
    this.store.clear();
  }
}