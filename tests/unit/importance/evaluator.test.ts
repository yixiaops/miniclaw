/**
 * @fileoverview ImportanceEvaluator 单元测试
 *
 * 测试 importance 标记解析、剥离、边界处理。
 *
 * @module tests/unit/importance/evaluator
 */

import { describe, it, expect } from 'vitest';
import { ImportanceEvaluator } from '../../../src/memory/importance/evaluator.js';

describe('ImportanceEvaluator', () => {
  const evaluator = new ImportanceEvaluator();

  describe('parse - normal cases', () => {
    it('T011: should parse normal importance marker', () => {
      const result = evaluator.parse('你好！[IMPORTANCE:0.3]');
      expect(result.importance).toBe(0.3);
      expect(result.strippedContent).toBe('你好！');
      expect(result.parsed).toBe(true);
    });

    it('T012: should take last marker when multiple', () => {
      const result = evaluator.parse('消息1[IMPORTANCE:0.5]消息2[IMPORTANCE:0.8]');
      expect(result.importance).toBe(0.8);
      expect(result.strippedContent).toBe('消息1消息2');
      expect(result.parsed).toBe(true);
    });
  });

  describe('parse - clamp values', () => {
    it('T013: should clamp value above 1 to 1.0', () => {
      const result = evaluator.parse('重要信息[IMPORTANCE:1.5]');
      expect(result.importance).toBe(1.0);
      expect(result.strippedContent).toBe('重要信息');
      expect(result.parsed).toBe(true);
    });

    it('T014: should clamp value below 0 to 0.0', () => {
      const result = evaluator.parse('普通信息[IMPORTANCE:-0.2]');
      expect(result.importance).toBe(0.0);
      expect(result.strippedContent).toBe('普通信息');
      expect(result.parsed).toBe(true);
    });
  });

  describe('parse - fallback cases', () => {
    it('T015: should return null when no marker', () => {
      const result = evaluator.parse('普通回复');
      expect(result.importance).toBe(null);
      expect(result.strippedContent).toBe('普通回复');
      expect(result.parsed).toBe(false);
    });

    it('T016: should return null for invalid format', () => {
      const result = evaluator.parse('消息[IMPORTANCE:abc]');
      expect(result.importance).toBe(null);
      expect(result.strippedContent).toBe('消息[IMPORTANCE:abc]');
      expect(result.parsed).toBe(false);
    });
  });

  describe('parse - stripping markers', () => {
    it('T017: should strip all markers from content', () => {
      const result = evaluator.parse('[IMPORTANCE:0.1]开始[IMPORTANCE:0.5]中间[IMPORTANCE:0.9]结束');
      expect(result.importance).toBe(0.9);
      expect(result.strippedContent).toBe('开始中间结束');
      expect(result.parsed).toBe(true);
    });
  });

  describe('parse - edge cases', () => {
    it('should handle empty content', () => {
      const result = evaluator.parse('');
      expect(result.importance).toBe(null);
      expect(result.strippedContent).toBe('');
      expect(result.parsed).toBe(false);
    });

    it('should handle marker only content', () => {
      const result = evaluator.parse('[IMPORTANCE:0.7]');
      expect(result.importance).toBe(0.7);
      expect(result.strippedContent).toBe('');
      expect(result.parsed).toBe(true);
    });

    it('should handle decimal values correctly', () => {
      const result = evaluator.parse('消息[IMPORTANCE:0.65]');
      expect(result.importance).toBe(0.65);
      expect(result.parsed).toBe(true);
    });

    it('should handle 0.0 correctly', () => {
      const result = evaluator.parse('消息[IMPORTANCE:0.0]');
      expect(result.importance).toBe(0.0);
      expect(result.parsed).toBe(true);
    });

    it('should handle 1.0 correctly', () => {
      const result = evaluator.parse('消息[IMPORTANCE:1.0]');
      expect(result.importance).toBe(1.0);
      expect(result.parsed).toBe(true);
    });
  });

  describe('config', () => {
    it('should use default config when not provided', () => {
      const defaultEvaluator = new ImportanceEvaluator();
      const config = defaultEvaluator.getConfig();
      expect(config.defaultImportance).toBe(0.3);
      expect(config.logParsed).toBe(false);
    });

    it('should accept custom config', () => {
      const customEvaluator = new ImportanceEvaluator({
        defaultImportance: 0.5,
        logParsed: true
      });
      const config = customEvaluator.getConfig();
      expect(config.defaultImportance).toBe(0.5);
      expect(config.logParsed).toBe(true);
    });
  });
});