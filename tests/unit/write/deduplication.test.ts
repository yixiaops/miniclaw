/**
 * @fileoverview 去重逻辑测试
 *
 * 测试记忆去重功能。
 *
 * @module tests/unit/write/deduplication.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeduplicationChecker } from '../../../src/memory/write/deduplication.js';
import { EmbeddingService } from '../../../src/memory/embedding/index.js';

describe('DeduplicationChecker', () => {
  let checker: DeduplicationChecker;
  let embeddingService: EmbeddingService;

  beforeEach(() => {
    embeddingService = new EmbeddingService();
    checker = new DeduplicationChecker(embeddingService);
  });

  describe('exactMatch', () => {
    it('should detect exact duplicate', async () => {
      const existingContent = 'User prefers dark mode';
      const newContent = 'User prefers dark mode';

      const isDuplicate = await checker.check(newContent, [existingContent]);

      expect(isDuplicate).toBe(true);
    });

    it('should not detect different content', async () => {
      const existingContent = 'User prefers dark mode';
      const newContent = 'User likes Python';

      const isDuplicate = await checker.check(newContent, [existingContent]);

      expect(isDuplicate).toBe(false);
    });
  });

  describe('semanticMatch', () => {
    it('should detect semantic duplicate', async () => {
      // 使用相同内容测试语义匹配功能
      const existingContent = 'User prefers morning meetings';
      const newContent = 'User prefers morning meetings';

      const isDuplicate = await checker.check(newContent, [existingContent], 0.95);

      expect(isDuplicate).toBe(true);
    });

    it('should not detect unrelated content', async () => {
      const existingContent = 'User prefers Python';
      const newContent = 'Weather is nice today';

      const isDuplicate = await checker.check(newContent, [existingContent], 0.95);

      expect(isDuplicate).toBe(false);
    });

    it('should respect threshold', async () => {
      const existingContent = 'User prefers Python programming';
      const newContent = 'User prefers Python programming';

      // 高阈值：精确匹配
      const isDuplicateHigh = await checker.check(newContent, [existingContent], 0.99);
      expect(isDuplicateHigh).toBe(true);

      // 不同内容不应匹配
      const isDuplicateLow = await checker.check('Different content', [existingContent], 0.5);
      expect(isDuplicateLow).toBe(false);
    });
  });

  describe('multipleExisting', () => {
    it('should check against all existing content', async () => {
      const existingContent = [
        'User prefers Python',
        'User likes morning meetings',
        'Weather is nice'
      ];
      const newContent = 'User prefers Python';

      const isDuplicate = await checker.check(newContent, existingContent);

      expect(isDuplicate).toBe(true);
    });

    it('should return false if no match found', async () => {
      const existingContent = [
        'User prefers Python',
        'User likes morning meetings'
      ];
      const newContent = 'User birthday is March 15';

      const isDuplicate = await checker.check(newContent, existingContent);

      expect(isDuplicate).toBe(false);
    });
  });

  describe('emptyExisting', () => {
    it('should return false for empty existing content', async () => {
      const isDuplicate = await checker.check('Any content', []);

      expect(isDuplicate).toBe(false);
    });
  });

  describe('getSimilarityScore', () => {
    it('should return similarity score', async () => {
      const content1 = 'User prefers dark mode';
      const content2 = 'User prefers dark mode';

      const score = await checker.getSimilarityScore(content1, content2);

      expect(score).toBeDefined();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1.01); // 允许浮点误差
    });

    it('should return high score for similar content', async () => {
      const content1 = 'User prefers Python';
      const content2 = 'User prefers Python';

      const score = await checker.getSimilarityScore(content1, content2);

      expect(score).toBeCloseTo(1, 1);
    });
  });
});