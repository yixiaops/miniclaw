/**
 * @fileoverview Embedding Service 测试
 *
 * 测试向量嵌入服务的核心功能。
 *
 * @module tests/unit/embedding/embedding.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingService } from '../../../src/memory/embedding/embedding-service.js';

describe('EmbeddingService', () => {
  let service: EmbeddingService;

  beforeEach(() => {
    service = new EmbeddingService();
  });

  describe('embed', () => {
    it('should generate embedding for single text', async () => {
      const embedding = await service.embed('User prefers dark mode');

      expect(embedding).toBeDefined();
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    it('should return consistent embedding for same text', async () => {
      const text = 'User likes Python';
      const embedding1 = await service.embed(text);
      const embedding2 = await service.embed(text);

      // 缓存后应该返回相同结果
      expect(embedding1).toEqual(embedding2);
    });

    it('should handle empty text', async () => {
      const embedding = await service.embed('');

      expect(embedding).toBeDefined();
      expect(embedding.length).toBeGreaterThan(0);
    });
  });

  describe('embedBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = [
        'User prefers Python',
        'User likes Rust',
        'Weather is nice'
      ];

      const embeddings = await service.embedBatch(texts);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(3);
      expect(embeddings[0].length).toBeGreaterThan(0);
    });

    it('should handle empty array', async () => {
      const embeddings = await service.embedBatch([]);
      expect(embeddings).toEqual([]);
    });
  });

  describe('similarity', () => {
    it('should calculate cosine similarity', async () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [1, 0, 0];

      const similarity = service.similarity(embedding1, embedding2);

      expect(similarity).toBeCloseTo(1.0, 2); // 完全相同 = 1.0
    });

    it('should return 0 for orthogonal vectors', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [0, 1, 0];

      const similarity = service.similarity(embedding1, embedding2);

      expect(similarity).toBeCloseTo(0, 2); // 正交 = 0
    });

    it('should return negative for opposite vectors', () => {
      const embedding1 = [1, 0, 0];
      const embedding2 = [-1, 0, 0];

      const similarity = service.similarity(embedding1, embedding2);

      expect(similarity).toBeCloseTo(-1, 2); // 相反 = -1
    });

    it('should handle partial similarity', () => {
      const embedding1 = [1, 1, 0];
      const embedding2 = [1, 0, 0];

      const similarity = service.similarity(embedding1, embedding2);

      // 归一化后：(0.707, 0.707, 0) dot (1, 0, 0) = 0.707
      expect(similarity).toBeCloseTo(0.707, 2);
    });
  });

  describe('cache', () => {
    it('should cache embedding results', async () => {
      const text = 'Test content';

      // 第一次调用
      await service.embed(text);
      const cacheStats = service.getCacheStats();

      expect(cacheStats.size).toBeGreaterThan(0);
    });

    it('should reuse cached embeddings', async () => {
      const text = 'Cached text';

      // 第一次调用（缓存）
      await service.embed(text);
      const firstStats = service.getCacheStats();

      // 第二次调用（从缓存读取）
      await service.embed(text);
      const secondStats = service.getCacheStats();

      expect(secondStats.hits).toBeGreaterThan(firstStats.hits);
    });

    it('should clear cache', async () => {
      await service.embed('Text 1');
      await service.embed('Text 2');

      service.clearCache();
      const stats = service.getCacheStats();

      expect(stats.size).toBe(0);
    });
  });
});