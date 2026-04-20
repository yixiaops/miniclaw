/**
 * @fileoverview Memory Store 测试
 *
 * 测试记忆存储的核心功能。
 *
 * @module tests/unit/memory/store.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryStore } from '../../../src/memory/store/memory-store.js';
import type { MemoryEntry, MemoryType } from '../../../src/memory/store/interface.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
  });

  describe('write', () => {
    it('should write memory entry and return id', async () => {
      const id = await store.write('User prefers dark mode', 'long-term');
      expect(id).toBeDefined();
      expect(id).toMatch(/^memory-/);
    });

    it('should write with metadata', async () => {
      const id = await store.write('Test content', 'candidate', {
        sessionId: 'session-123',
        importance: 0.8,
        tags: ['test']
      });

      const entry = await store.read(id);
      expect(entry?.metadata.sessionId).toBe('session-123');
      expect(entry?.metadata.importance).toBe(0.8);
      expect(entry?.metadata.tags).toContain('test');
    });

    it('should set createdAt and updatedAt', async () => {
      const id = await store.write('Test', 'long-term');
      const entry = await store.read(id);

      expect(entry?.createdAt).toBeDefined();
      expect(entry?.updatedAt).toBeDefined();
      expect(entry?.createdAt.getTime()).toBe(entry?.updatedAt.getTime());
    });
  });

  describe('read', () => {
    it('should read existing memory entry', async () => {
      const id = await store.write('User likes Python', 'long-term');
      const entry = await store.read(id);

      expect(entry).toBeDefined();
      expect(entry?.content).toBe('User likes Python');
      expect(entry?.type).toBe('long-term');
    });

    it('should return null for non-existing id', async () => {
      const entry = await store.read('non-existing-id');
      expect(entry).toBeNull();
    });
  });

  describe('update', () => {
    it('should update memory content', async () => {
      const id = await store.write('Original content', 'long-term');
      const success = await store.update(id, 'Updated content');

      expect(success).toBe(true);
      const entry = await store.read(id);
      expect(entry?.content).toBe('Updated content');
    });

    it('should update updatedAt timestamp', async () => {
      const id = await store.write('Test', 'long-term');
      const originalEntry = await store.read(id);
      const originalUpdatedAt = originalEntry?.updatedAt;

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      await store.update(id, 'Updated');
      const updatedEntry = await store.read(id);

      expect(updatedEntry?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt?.getTime() || 0);
    });

    it('should return false for non-existing id', async () => {
      const success = await store.update('non-existing-id', 'New content');
      expect(success).toBe(false);
    });
  });

  describe('delete', () => {
    it('should delete existing memory entry', async () => {
      const id = await store.write('To be deleted', 'candidate');
      const success = await store.delete(id);

      expect(success).toBe(true);
      const entry = await store.read(id);
      expect(entry).toBeNull();
    });

    it('should return false for non-existing id', async () => {
      const success = await store.delete('non-existing-id');
      expect(success).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all memory entries', async () => {
      await store.write('Memory 1', 'long-term');
      await store.write('Memory 2', 'candidate');
      await store.write('Memory 3', 'long-term');

      const entries = await store.list();
      expect(entries.length).toBe(3);
    });

    it('should filter by type', async () => {
      await store.write('Long-term 1', 'long-term');
      await store.write('Short-term 1', 'candidate');
      await store.write('Long-term 2', 'long-term');

      const longTermEntries = await store.list('long-term');
      expect(longTermEntries.length).toBe(2);
      expect(longTermEntries.every(e => e.type === 'long-term')).toBe(true);

      const candidateEntries = await store.list('candidate');
      expect(candidateEntries.length).toBe(1);
      expect(candidateEntries.every(e => e.type === 'candidate')).toBe(true);
    });

    it('should return empty array when no entries', async () => {
      const entries = await store.list();
      expect(entries).toEqual([]);
    });
  });

  describe('search', () => {
    it('should search by keyword', async () => {
      await store.write('User prefers Python programming', 'long-term');
      await store.write('User likes Rust', 'long-term');
      await store.write('Weather is nice today', 'candidate');

      const results = await store.search({ query: 'Python' });
      expect(results.length).toBe(1);
      expect(results[0].entry.content).toContain('Python');
    });

    it('should return results with score', async () => {
      await store.write('User prefers Python', 'long-term');

      const results = await store.search({ query: 'Python' });
      expect(results[0].score).toBeDefined();
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should limit results', async () => {
      await store.write('Python 1', 'long-term');
      await store.write('Python 2', 'long-term');
      await store.write('Python 3', 'long-term');

      const results = await store.search({ query: 'Python', limit: 2 });
      expect(results.length).toBe(2);
    });

    it('should filter by type', async () => {
      await store.write('Python long-term', 'long-term');
      await store.write('Python short-term', 'candidate');

      const longTermResults = await store.search({
        query: 'Python',
        types: ['long-term']
      });
      expect(longTermResults.length).toBe(1);
      expect(longTermResults[0].entry.type).toBe('long-term');
    });

    it('should return empty array for no matches', async () => {
      await store.write('User likes Python', 'long-term');

      const results = await store.search({ query: 'JavaScript' });
      expect(results).toEqual([]);
    });
  });
});