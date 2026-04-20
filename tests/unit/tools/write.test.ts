/**
 * @fileoverview memory_write 工具测试
 *
 * 测试记忆写入工具的核心功能。
 *
 * @module tests/unit/tools/write.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWriteTool } from '../../../src/memory/tools/write.js';
import { MemoryStore } from '../../../src/memory/store/index.js';
import { EmbeddingService } from '../../../src/memory/embedding/index.js';
import { DeduplicationChecker } from '../../../src/memory/write/index.js';
import { SensitiveDetector } from '../../../src/memory/write/index.js';

describe('MemoryWriteTool', () => {
  let tool: MemoryWriteTool;
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    const embeddingService = new EmbeddingService();
    const deduplicationChecker = new DeduplicationChecker(embeddingService);
    const sensitiveDetector = new SensitiveDetector();
    tool = new MemoryWriteTool(store, deduplicationChecker, sensitiveDetector);
  });

  describe('execute', () => {
    it('should write memory and return created status', async () => {
      const result = await tool.execute({
        content: 'User prefers dark mode',
        type: 'long-term'
      });

      expect(result.status).toBe('created');
      expect(result.id).toBeDefined();
    });

    it('should skip sensitive content', async () => {
      const result = await tool.execute({
        content: 'My password is secret123',
        type: 'long-term'
      });

      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('敏感');
    });

    it('should skip duplicate content', async () => {
      // 先写入一条
      await tool.execute({
        content: 'User prefers Python',
        type: 'long-term'
      });

      // 再写入相同内容
      const result = await tool.execute({
        content: 'User prefers Python',
        type: 'long-term'
      });

      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('重复');
    });

    it('should write with metadata', async () => {
      const result = await tool.execute({
        content: 'Test content',
        type: 'candidate',
        metadata: {
          sessionId: 'session-123',
          importance: 0.8,
          tags: ['test']
        }
      });

      expect(result.status).toBe('created');

      const entry = await store.read(result.id!);
      expect(entry?.metadata.sessionId).toBe('session-123');
      expect(entry?.metadata.importance).toBe(0.8);
    });

    it('should update existing memory when force flag set', async () => {
      // 先写入一条
      const firstResult = await tool.execute({
        content: 'Original content',
        type: 'long-term'
      });

      // 强制更新相同内容
      const result = await tool.execute({
        content: 'Original content',
        type: 'long-term',
        force: true
      });

      expect(result.status).toBe('updated');
    });
  });

  describe('validate', () => {
    it('should validate required fields', async () => {
      const result = await tool.execute({
        content: '',
        type: 'long-term'
      });

      expect(result.status).toBe('error');
      expect(result.reason).toContain('content');
    });

    it('should validate type field', async () => {
      const result = await tool.execute({
        content: 'Test',
        type: 'invalid-type' as any
      });

      expect(result.status).toBe('error');
    });
  });

  describe('getStats', () => {
    it('should return write statistics', async () => {
      await tool.execute({ content: 'Test 1', type: 'long-term' });
      await tool.execute({ content: 'Test 2', type: 'long-term' });
      await tool.execute({ content: 'password is secret', type: 'long-term' }); // skipped

      const stats = tool.getStats();

      expect(stats.total).toBe(3);
      expect(stats.created).toBe(2);
      expect(stats.skipped).toBe(1);
    });
  });
});