/**
 * @fileoverview 去重逻辑实现
 *
 * 实现记忆内容的去重检测，支持精确匹配和语义相似度检测。
 *
 * @module memory/write/deduplication
 */

import type { IEmbeddingService } from '../embedding/interface.js';

/**
 * 去重检查器
 *
 * 检测新内容是否与已存在内容重复。
 *
 * @example
 * ```ts
 * const checker = new DeduplicationChecker(embeddingService);
 * const isDuplicate = await checker.check(newContent, existingContents);
 * ```
 */
export class DeduplicationChecker {
  /** 嵌入服务 */
  private embeddingService: IEmbeddingService;
  /** 默认相似度阈值 */
  private readonly defaultThreshold = 0.95;

  /**
   * 创建去重检查器
   *
   * @param embeddingService - 嵌入服务
   */
  constructor(embeddingService: IEmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * 检查内容是否重复
   *
   * @param newContent - 新内容
   * @param existingContent - 已存在内容列表
   * @param threshold - 相似度阈值（默认 0.95）
   * @returns 是否重复
   */
  async check(
    newContent: string,
    existingContent: string[],
    threshold?: number
  ): Promise<boolean> {
    const similarityThreshold = threshold || this.defaultThreshold;

    // 1. 精确匹配检查
    if (existingContent.includes(newContent)) {
      return true;
    }

    // 2. 语义相似度检查
    if (existingContent.length === 0) {
      return false;
    }

    // 计算新内容的嵌入向量
    const newEmbedding = await this.embeddingService.embed(newContent);

    // 与所有已存在内容比较
    for (const existing of existingContent) {
      const existingEmbedding = await this.embeddingService.embed(existing);
      const similarity = this.embeddingService.similarity(newEmbedding, existingEmbedding);

      if (similarity >= similarityThreshold) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取相似度分数
   *
   * @param content1 - 内容1
   * @param content2 - 内容2
   * @returns 相似度分数（0-1）
   */
  async getSimilarityScore(content1: string, content2: string): Promise<number> {
    const embedding1 = await this.embeddingService.embed(content1);
    const embedding2 = await this.embeddingService.embed(content2);

    return this.embeddingService.similarity(embedding1, embedding2);
  }
}