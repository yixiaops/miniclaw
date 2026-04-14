/**
 * @fileoverview Embedding Service 实现
 *
 * 实现向量嵌入服务，支持文本向量化、相似度计算和缓存。
 *
 * @module memory/embedding/embedding-service
 */

import type { IEmbeddingService, EmbeddingVector } from './interface.js';

/**
 * 缓存统计
 */
interface CacheStats {
  size: number;
  hits: number;
  misses: number;
}

/**
 * EmbeddingService 类
 *
 * 实现向量嵌入服务。
 *
 * V1 版本：使用简单的哈希模拟嵌入向量（无需外部 LLM 调用）
 * V2 版本：可升级为真实 LLM Embedding API
 *
 * @example
 * ```ts
 * const service = new EmbeddingService();
 * const embedding = await service.embed('User prefers dark mode');
 * const similarity = service.similarity(embedding1, embedding2);
 * ```
 */
export class EmbeddingService implements IEmbeddingService {
  /** 缓存映射 */
  private cache: Map<string, EmbeddingVector> = new Map();
  /** 缓存统计 */
  private stats: CacheStats = { size: 0, hits: 0, misses: 0 };
  /** 向量维度 */
  private readonly dimensions = 128;

  /**
   * 生成嵌入向量
   *
   * V1: 使用简单哈希模拟
   * V2: 可升级为真实 API
   */
  async embed(text: string): Promise<EmbeddingVector> {
    // 检查缓存
    const cached = this.cache.get(text);
    if (cached) {
      this.stats.hits++;
      return cached;
    }

    this.stats.misses++;

    // V1: 使用哈希生成模拟向量
    const embedding = this.generateHashEmbedding(text);

    // 缓存结果
    this.cache.set(text, embedding);
    this.stats.size = this.cache.size;

    return embedding;
  }

  /**
   * 批量生成嵌入向量
   */
  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    return Promise.all(texts.map(text => this.embed(text)));
  }

  /**
   * 计算余弦相似度
   */
  similarity(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): CacheStats {
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.stats = { size: 0, hits: 0, misses: 0 };
  }

  /**
   * 使用哈希生成模拟嵌入向量
   *
   * 注意：这是 V1 简化实现，用于测试和原型开发
   * V2 应替换为真实 LLM Embedding API
   */
  private generateHashEmbedding(text: string): EmbeddingVector {
    const embedding: EmbeddingVector = [];

    // 使用文本哈希生成伪随机向量
    const hash = this.simpleHash(text);

    for (let i = 0; i < this.dimensions; i++) {
      // 使用哈希值生成伪随机数，然后归一化到 [-1, 1]
      const value = ((hash * (i + 1)) % 1000) / 500 - 1;
      embedding.push(value);
    }

    // 归一化向量
    return this.normalize(embedding);
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 归一化向量
   */
  private normalize(vector: EmbeddingVector): EmbeddingVector {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));

    if (norm === 0) {
      return vector;
    }

    return vector.map(v => v / norm);
  }
}