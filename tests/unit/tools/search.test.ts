/**
 * @fileoverview 双层检索测试
 *
 * 测试双层记忆合并检索功能。
 *
 * @module tests/unit/tools/search.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySearchTool } from '../../../src/memory/tools/search.js';
import { ShortTermMemory } from '../../../src/memory/store/short-term.js';
import { LongTermMemory } from '../../../src/memory/store/long-term.js';
import { SessionManager } from '../../../src/memory/store/session-manager.js';
import { EmbeddingService } from '../../../src/memory/embedding/index.js';
import * as fs from 'fs/promises';

describe('MemorySearchTool', () => {
  let searchTool: MemorySearchTool;
  let shortTerm: ShortTermMemory;
  let longTerm: LongTermMemory;
  let sessionManager: SessionManager;
  let embeddingService: EmbeddingService;
  const testDir = '/tmp/miniclaw-search-test';

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    sessionManager = new SessionManager();
    shortTerm = new ShortTermMemory(sessionManager);
    longTerm = new LongTermMemory(testDir);
    embeddingService = new EmbeddingService();
    searchTool = new MemorySearchTool(shortTerm, longTerm, embeddingService);
  });

  afterEach(async () => {
    shortTerm.clear();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('search', () => {
    it('should search both layers by default', async () => {
      const sessionId = 'session-123';

      await shortTerm.write('Short-term context', sessionId);
      await longTerm.write('Long-term context');

      const results = await searchTool.search({ query: 'context' });

      expect(results.length).toBe(2); // 短期和长期各一条
      expect(results.every(r => r.entry.content.includes('context'))).toBe(true);
    });

    it('should filter by type', async () => {
      const sessionId = 'session-123';

      await shortTerm.write('Short-term context', sessionId);
      await longTerm.write('Long-term context');

      // 仅搜索短期记忆
      const shortResults = await searchTool.search({
        query: 'context',
        types: ['short-term']
      });

      expect(shortResults.length).toBe(1);
      expect(shortResults[0].entry.type).toBe('short-term');

      // 仅搜索长期记忆
      const longResults = await searchTool.search({
        query: 'context',
        types: ['long-term']
      });

      expect(longResults.length).toBe(1);
      expect(longResults[0].entry.type).toBe('long-term');
    });

    it('should limit results', async () => {
      const sessionId = 'session-123';

      await shortTerm.write('Memory 1', sessionId);
      await shortTerm.write('Memory 2', sessionId);
      await shortTerm.write('Memory 3', sessionId);

      const results = await searchTool.search({ query: 'Memory', limit: 2 });

      expect(results.length).toBe(2);
    });

    it('should search by sessionId', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      await shortTerm.write('Session 1 context', session1);
      await shortTerm.write('Session 2 context', session2);

      const results = await searchTool.search({
        query: 'context',
        sessionId: session1
      });

      expect(results.length).toBe(1);
      expect(results[0].entry.metadata.sessionId).toBe(session1);
    });

    it('should return empty array for no matches', async () => {
      const sessionId = 'session-123';
      await shortTerm.write('Some content', sessionId);

      const results = await searchTool.search({ query: 'nonexistent' });

      expect(results).toEqual([]);
    });
  });

  describe('ranking', () => {
    it('should rank by time and relevance', async () => {
      const sessionId = 'session-123';

      // 先写入旧的
      await longTerm.write('Old memory');
      await new Promise(resolve => setTimeout(resolve, 100));

      // 再写入新的
      await longTerm.write('New memory');

      const results = await searchTool.search({ query: 'memory' });

      // 新的应该在前面（时间权重）
      expect(results[0].entry.content).toBe('New memory');
    });

    it('should apply time weight config', async () => {
      searchTool.setRankingConfig({ timeWeight: 0.8, relevanceWeight: 0.2 });

      const config = searchTool.getRankingConfig();
      expect(config.timeWeight).toBe(0.8);
      expect(config.relevanceWeight).toBe(0.2);
    });
  });

  describe('getStats', () => {
    it('should return search statistics', async () => {
      const sessionId = 'session-123';

      await shortTerm.write('Test', sessionId);
      await longTerm.write('Test');

      await searchTool.search({ query: 'Test' });

      const stats = searchTool.getStats();

      expect(stats.totalSearches).toBe(1);
      expect(stats.totalResults).toBe(2);
    });
  });
});