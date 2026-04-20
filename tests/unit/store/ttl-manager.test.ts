/**
 * @fileoverview TTL 管理器测试
 *
 * 测试 TTL 过期清理功能。
 *
 * @module tests/unit/store/ttl-manager.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TTLManager } from '../../../src/memory/store/ttl-manager.js';
import { MemoryCandidatePool } from '../../../src/memory/store/candidate-pool.js';
import { SessionManager } from '../../../src/memory/store/session-manager.js';
import { MemoryPromoter } from '../../../src/memory/promotion/promoter.js';
import { LongTermMemory } from '../../../src/memory/store/long-term.js';
import { SessionCompressor } from '../../../src/memory/session/compressor.js';

describe('TTLManager', () => {
  let ttlManager: TTLManager;
  let candidatePool: MemoryCandidatePool;
  let sessionManager: SessionManager;
  let promoter: MemoryPromoter;
  let longTerm: LongTermMemory;
  let compressor: SessionCompressor;
  const testDir = '/tmp/miniclaw-ttl-test';

  beforeEach(() => {
    sessionManager = new SessionManager();
    candidatePool = new MemoryCandidatePool(sessionManager);
    longTerm = new LongTermMemory(testDir);
    promoter = new MemoryPromoter(candidatePool, longTerm);
    compressor = new SessionCompressor();
    ttlManager = new TTLManager(candidatePool, promoter, {
      sessionManager,
      compressor
    });
  });

  afterEach(() => {
    ttlManager.stop();
    ttlManager.stopCompression(); // 停止压缩定时器
    candidatePool.clear();
  });

  describe('cleanup', () => {
    it('should cleanup expired memories', async () => {
      const sessionId = 'session-123';

      // 写入一个短期记忆，TTL 100ms
      await candidatePool.write('Expired', sessionId, { ttl: 100 });

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));

      // 执行清理
      const cleaned = await ttlManager.cleanup();

      expect(cleaned.expired).toBe(1);
    });

    it('should not cleanup fresh memories', async () => {
      const sessionId = 'session-123';

      await candidatePool.write('Fresh', sessionId);

      const cleaned = await ttlManager.cleanup();

      expect(cleaned.expired).toBe(0);
    });

    it('should promote eligible memories before cleanup', async () => {
      const sessionId = 'session-123';

      // 写入一个重要但即将过期的记忆
      await candidatePool.write('Important', sessionId, {
        ttl: 100,
        importance: 0.8
      });

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleaned = await ttlManager.cleanup();

      expect(cleaned.promoted).toBe(1);
      expect(cleaned.expired).toBe(1); // expired 计数在晋升前已统计
      expect(cleaned.cleaned).toBe(0); // 晋升后不删除

      const longMemories = await longTerm.list();
      expect(longMemories.length).toBe(1);
    });
  });

  describe('schedule', () => {
    it('should schedule cleanup job', () => {
      ttlManager.schedule(1000); // 每 1s 清理

      expect(ttlManager.isRunning()).toBe(true);
    });

    it('should stop cleanup job', () => {
      ttlManager.schedule(1000);
      ttlManager.stop();

      expect(ttlManager.isRunning()).toBe(false);
    });

    it('should run cleanup on schedule', async () => {
      const sessionId = 'session-123';
      await candidatePool.write('Expired', sessionId, { ttl: 100 });

      // 启动定时清理（每 200ms）
      ttlManager.schedule(200);

      // 等待过期 + 清理执行
      await new Promise(resolve => setTimeout(resolve, 400));

      expect(ttlManager.getStats().cleanups).toBeGreaterThanOrEqual(1);

      ttlManager.stop();
    });
  });

  describe('getStats', () => {
    it('should return cleanup statistics', async () => {
      const sessionId = 'session-123';

      await candidatePool.write('Expired 1', sessionId, { ttl: 100 });
      await candidatePool.write('Expired 2', sessionId, { ttl: 100 });

      await new Promise(resolve => setTimeout(resolve, 150));

      await ttlManager.cleanup();

      const stats = ttlManager.getStats();

      expect(stats.totalExpired).toBe(2);
      expect(stats.totalCleaned).toBe(2);
    });
  });

  describe('setDefaultTTL', () => {
    it('should set default TTL', () => {
      ttlManager.setDefaultTTL(3600000); // 1 hour

      expect(ttlManager.getDefaultTTL()).toBe(3600000);
    });
  });

  describe('session compression', () => {
    it('should trigger session compression periodically', async () => {
      // 创建活跃 Session
      const sessionId = sessionManager.create();

      // 模拟 Session 有大量消息（通过直接操作）
      // TTLManager 需要能够压缩这些消息

      // 启动压缩定时器（每 200ms）
      ttlManager.scheduleCompression(200);

      expect(ttlManager.isCompressionRunning()).toBe(true);

      // 等待至少一次压缩执行
      await new Promise(resolve => setTimeout(resolve, 400));

      const stats = ttlManager.getCompressionStats();
      expect(stats.compressions).toBeGreaterThanOrEqual(1);

      ttlManager.stopCompression();
    });

    it('should respect compressInterval config', () => {
      // 使用自定义压缩间隔
      ttlManager.scheduleCompression(5000);

      expect(ttlManager.getCompressInterval()).toBe(5000);

      ttlManager.stopCompression();
    });

    it('should compress all active sessions', async () => {
      // 创建多个活跃 Session
      const session1 = sessionManager.create();
      const session2 = sessionManager.create();

      // 确保都是活跃的
      sessionManager.updateActivity(session1);
      sessionManager.updateActivity(session2);

      // 执行一次性压缩
      const result = await ttlManager.compressActiveSessions();

      expect(result.sessionsCompressed).toBe(2);
    });

    it('should use default compressInterval of 1 hour', () => {
      expect(ttlManager.getDefaultCompressInterval()).toBe(3600000);
    });
  });
});