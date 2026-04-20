/**
 * @fileoverview 双层记忆集成测试
 *
 * 测试双层记忆系统的端到端流程。
 *
 * @module tests/integration/dual-layer.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCandidatePool } from '../../src/memory/store/candidate-pool.js';
import { LongTermMemory } from '../../src/memory/store/long-term.js';
import { SessionManager } from '../../src/memory/store/session-manager.js';
import { TTLManager } from '../../src/memory/store/ttl-manager.js';
import { MemoryPromoter } from '../../src/memory/promotion/promoter.js';
import { MemorySearchTool } from '../../src/memory/tools/search.js';
import { EmbeddingService } from '../../src/memory/embedding/index.js';
import { MemoryWriteTool } from '../../src/memory/tools/write.js';
import { DeduplicationChecker } from '../../src/memory/write/deduplication.js';
import { SensitiveDetector } from '../../src/memory/write/sensitive-detector.js';
import * as fs from 'fs/promises';

describe('Dual-Layer Memory Integration', () => {
  let candidatePool: MemoryCandidatePool;
  let longTerm: LongTermMemory;
  let sessionManager: SessionManager;
  let ttlManager: TTLManager;
  let promoter: MemoryPromoter;
  let searchTool: MemorySearchTool;
  let writeTool: MemoryWriteTool;
  let embeddingService: EmbeddingService;
  const testDir = '/tmp/miniclaw-integration-test';

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    
    // 初始化所有组件
    sessionManager = new SessionManager();
    candidatePool = new MemoryCandidatePool(sessionManager);
    longTerm = new LongTermMemory(testDir);
    embeddingService = new EmbeddingService();
    
    const dedupChecker = new DeduplicationChecker(embeddingService);
    const sensitiveDetector = new SensitiveDetector();
    
    writeTool = new MemoryWriteTool(candidatePool, dedupChecker, sensitiveDetector);
    promoter = new MemoryPromoter(candidatePool, longTerm);
    ttlManager = new TTLManager(candidatePool, promoter);
    searchTool = new MemorySearchTool(candidatePool, longTerm, embeddingService);
  });

  afterEach(async () => {
    ttlManager.stop();
    candidatePool.clear();
    longTerm.clear();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Full Workflow', () => {
    it('should write, promote, and search memory', async () => {
      const sessionId = sessionManager.create();

      // 1. 写入短期记忆（高重要性）
      const shortId = await candidatePool.write('User prefers dark mode', sessionId, {
        importance: 0.8
      });

      // 2. 手动晋升
      const longId = await promoter.promote(shortId);

      expect(longId).toBeDefined();

      // 3. 搜索（应该找到长期记忆）
      const results = await searchTool.search({ query: 'dark mode' });

      expect(results.length).toBe(1);
      expect(results[0].entry.content).toBe('User prefers dark mode');
      expect(results[0].entry.type).toBe('long-term');
    });

    it('should persist and restore long-term memory', async () => {
      const sessionId = sessionManager.create();

      // 1. 写入并晋升
      const shortId = await candidatePool.write('Important preference', sessionId, {
        importance: 0.9
      });
      await promoter.promote(shortId);

      // 2. 持久化
      await longTerm.persist();

      // 3. 清除内存（模拟重启）
      longTerm.clear();

      // 4. 从文件加载
      await longTerm.load();

      // 5. 验证数据恢复
      const memories = await longTerm.list();
      expect(memories.length).toBe(1);
      expect(memories[0].content).toBe('Important preference');
    });

    it('should cleanup expired memories', async () => {
      const sessionId = sessionManager.create();

      // 1. 写入短期记忆（低重要性，短 TTL）
      await candidatePool.write('Temporary context', sessionId, {
        importance: 0.2,
        ttl: 100 // 100ms
      });

      // 2. 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 3. 执行清理
      const result = await ttlManager.cleanup();

      expect(result.expired).toBe(1);
      expect(result.cleaned).toBe(1); // 低重要性，直接清理

      // 4. 验证已删除
      const remaining = await candidatePool.list(sessionId);
      expect(remaining.length).toBe(0);
    });

    it('should promote before cleanup for important memories', async () => {
      const sessionId = sessionManager.create();

      // 1. 写入短期记忆（高重要性，短 TTL）
      await candidatePool.write('Important decision', sessionId, {
        importance: 0.9,
        ttl: 100
      });

      // 2. 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 3. 执行清理
      const result = await ttlManager.cleanup();

      expect(result.expired).toBe(1);
      expect(result.promoted).toBe(1); // 晋升而非清理

      // 4. 验证长期记忆存在
      const longMemories = await longTerm.list();
      expect(longMemories.length).toBe(1);
    });

    it('should filter sensitive content', async () => {
      const sessionId = sessionManager.create();

      // 1. 尝试写入敏感内容
      const result = await writeTool.execute({
        content: 'My password is secret123',
        type: 'long-term'
      });

      // 2. 应该被跳过
      expect(result.status).toBe('skipped');
      expect(result.reason).toContain('敏感');
    });

    it('should handle multiple sessions', async () => {
      const session1 = sessionManager.create();
      const session2 = sessionManager.create();

      // 1. 不同 Session 写入
      await candidatePool.write('Session 1 context', session1);
      await candidatePool.write('Session 2 context', session2);

      // 2. 按 Session 搜索
      const session1Results = await searchTool.search({
        query: 'context',
        sessionId: session1
      });

      expect(session1Results.length).toBe(1);
      expect(session1Results[0].entry.metadata.sessionId).toBe(session1);

      const session2Results = await searchTool.search({
        query: 'context',
        sessionId: session2
      });

      expect(session2Results.length).toBe(1);
      expect(session2Results[0].entry.metadata.sessionId).toBe(session2);
    });

    it('should rank results by time and relevance', async () => {
      const sessionId = sessionManager.create();

      // 1. 写入多条记忆
      await candidatePool.write('Old memory', sessionId);
      await new Promise(resolve => setTimeout(resolve, 100));
      await candidatePool.write('New memory', sessionId);

      // 2. 搜索
      const results = await searchTool.search({ query: 'memory' });

      // 3. 新的应该在前面
      expect(results[0].entry.content).toBe('New memory');
      expect(results[1].entry.content).toBe('Old memory');
    });
  });

  describe('Statistics', () => {
    it('should track overall statistics', async () => {
      const sessionId = sessionManager.create();

      // 1. 写入多条记忆
      await candidatePool.write('Memory 1', sessionId, { importance: 0.8 });
      await candidatePool.write('Memory 2', sessionId, { importance: 0.9 });
      await candidatePool.write('Memory 3', sessionId, { importance: 0.2 });

      // 2. 执行晋升
      await promoter.promoteAll();

      // 3. 检查统计
      const promotionStats = promoter.getStats();
      expect(promotionStats.promoted).toBe(2);

      const shortStats = candidatePool.getStats();
      expect(shortStats.total).toBe(1); // 只剩低重要性的

      const longStats = longTerm.getStats();
      expect(longStats.total).toBe(2);
    });
  });
});