/**
 * @fileoverview 知识库搜索器
 *
 * 搜索 knowledge base 目录下的 .md 文件内容。
 *
 * @module core/memory/knowledge-searcher
 */

import { mkdir, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { MemorySearchResult, SearchOptions } from './session-searcher.js';

/**
 * KnowledgeSearcher 类
 *
 * 搜索知识库目录下的 .md 文件内容。
 *
 * @example
 * ```ts
 * const searcher = new KnowledgeSearcher('~/.miniclaw/memory');
 * const results = await searcher.search('ETF');
 * ```
 */
export class KnowledgeSearcher {
  /** 知识库目录 */
  private memoryDir: string;

  /**
   * 创建 KnowledgeSearcher 实例
   *
   * @param memoryDir - 知识库目录路径（默认为 ~/.miniclaw/memory）
   */
  constructor(memoryDir?: string) {
    this.memoryDir = memoryDir || join(process.env.HOME || '', '.miniclaw', 'memory');
  }

  /**
   * 确保目录存在
   */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.memoryDir)) {
      await mkdir(this.memoryDir, { recursive: true });
    }
  }

  /**
   * 加载所有 .md 文件
   */
  private async loadFiles(): Promise<Array<{ path: string; lines: string[] }>> {
    await this.ensureDir();

    const files: Array<{ path: string; lines: string[] }> = [];

    try {
      const entries = await readdir(this.memoryDir, { withFileTypes: true });

      for (const entry of entries) {
        // 只读取 .md 文件
        if (entry.isFile() && entry.name.endsWith('.md')) {
          const filePath = join(this.memoryDir, entry.name);
          const content = await readFile(filePath, 'utf-8');
          files.push({
            path: `memory/${entry.name}`,
            lines: content.split('\n')
          });
        }
      }
    } catch {
      // 目录不存在或读取失败，返回空数组
    }

    return files;
  }

  /**
   * 搜索知识库内容
   *
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns 匹配的搜索结果
   */
  async search(query: string, options?: SearchOptions): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = [];
    const maxResults = options?.maxResults ?? 10;
    const queryLower = query.toLowerCase();

    // 加载所有文件
    const files = await this.loadFiles();

    for (const file of files) {
      // 搜索每一行
      for (let i = 0; i < file.lines.length; i++) {
        const line = file.lines[i];
        const lineLower = line.toLowerCase();

        // 大小写不敏感匹配
        if (lineLower.includes(queryLower)) {
          results.push({
            path: file.path,
            startLine: i + 1,  // 1-indexed
            endLine: i + 1,
            score: 1.0,
            snippet: line,
            source: 'memory'
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