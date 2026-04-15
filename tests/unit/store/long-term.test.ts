/**
 * @fileoverview 长期记忆持久化测试
 *
 * 测试长期记忆的核心功能。
 *
 * @module tests/unit/store/long-term.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LongTermMemory } from '../../../src/memory/store/long-term.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('LongTermMemory', () => {
  let longTerm: LongTermMemory;
  const testDir = '/tmp/miniclaw-memory-test';

  beforeEach(async () => {
    // 创建测试目录
    await fs.mkdir(testDir, { recursive: true });
    longTerm = new LongTermMemory(testDir);
  });

  afterEach(async () => {
    // 清理测试目录
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('write', () => {
    it('should write long-term memory', async () => {
      const id = await longTerm.write('User prefers dark mode');

      expect(id).toBeDefined();
      expect(id).toMatch(/^long-/);
    });

    it('should set importance metadata', async () => {
      const id = await longTerm.write('Important decision', { importance: 0.9 });

      const entry = await longTerm.read(id);
      expect(entry?.metadata.importance).toBe(0.9);
      expect(entry?.type).toBe('long-term');
    });

    it('should set persisted flag', async () => {
      const id = await longTerm.write('Test content');

      const entry = await longTerm.read(id);
      expect(entry?.metadata.persisted).toBe(true);
    });
  });

  describe('read', () => {
    it('should read existing memory', async () => {
      const id = await longTerm.write('Test content');

      const entry = await longTerm.read(id);
      expect(entry?.content).toBe('Test content');
    });

    it('should return null for non-existing id', async () => {
      const entry = await longTerm.read('non-existing');
      expect(entry).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all long-term memories', async () => {
      await longTerm.write('Memory 1');
      await longTerm.write('Memory 2');
      await longTerm.write('Memory 3');

      const memories = await longTerm.list();
      expect(memories.length).toBe(3);
    });

    it('should filter by importance threshold', async () => {
      await longTerm.write('Low importance', { importance: 0.3 });
      await longTerm.write('High importance', { importance: 0.8 });

      const importantMemories = await longTerm.list({ minImportance: 0.5 });
      expect(importantMemories.length).toBe(1);
      expect(importantMemories[0].metadata.importance).toBe(0.8);
    });
  });

  describe('delete', () => {
    it('should delete memory', async () => {
      const id = await longTerm.write('To delete');

      const success = await longTerm.delete(id);
      expect(success).toBe(true);

      const entry = await longTerm.read(id);
      expect(entry).toBeNull();
    });
  });

  describe('persist', () => {
    it('should persist to file', async () => {
      await longTerm.write('Test memory');
      await longTerm.persist();

      // 检查文件是否存在
      const memoryFile = path.join(testDir, 'MEMORY.md');
      const exists = await fs.access(memoryFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should write markdown format', async () => {
      await longTerm.write('User prefers Python', { importance: 0.8 });
      await longTerm.persist();

      const memoryFile = path.join(testDir, 'MEMORY.md');
      const content = await fs.readFile(memoryFile, 'utf-8');

      expect(content).toContain('User prefers Python');
    });
  });

  describe('load', () => {
    it('should load from file', async () => {
      // 先写入并持久化
      await longTerm.write('Memory to persist');
      await longTerm.persist();

      // 创建新实例加载
      const newLongTerm = new LongTermMemory(testDir);
      await newLongTerm.load();

      const memories = await newLongTerm.list();
      expect(memories.length).toBeGreaterThan(0);
      expect(memories.some(m => m.content === 'Memory to persist')).toBe(true);
    });

    it('should handle missing file gracefully', async () => {
      const newLongTerm = new LongTermMemory(testDir);
      await newLongTerm.load();

      const memories = await newLongTerm.list();
      expect(memories).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update memory content', async () => {
      const id = await longTerm.write('Original');

      await longTerm.update(id, 'Updated');

      const entry = await longTerm.read(id);
      expect(entry?.content).toBe('Updated');
    });

    it('should update updatedAt timestamp', async () => {
      const id = await longTerm.write('Original');
      const originalEntry = await longTerm.read(id);
      const originalTime = originalEntry?.updatedAt.getTime();

      await new Promise(resolve => setTimeout(resolve, 50));
      await longTerm.update(id, 'Updated');

      const updatedEntry = await longTerm.read(id);
      expect(updatedEntry?.updatedAt.getTime()).toBeGreaterThan(originalTime || 0);
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      await longTerm.write('Memory 1', { importance: 0.5 });
      await longTerm.write('Memory 2', { importance: 0.9 });

      const stats = longTerm.getStats();

      expect(stats.total).toBe(2);
      expect(stats.avgImportance).toBeCloseTo(0.7, 1);
    });
  });
});