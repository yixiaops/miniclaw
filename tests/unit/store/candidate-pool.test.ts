/**
 * @fileoverview 记忆候选池管理测试
 *
 * 测试记忆候选池的核心功能。
 *
 * @module tests/unit/store/candidate-pool.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryCandidatePool } from '../../../src/memory/store/candidate-pool.js';
import { SessionManager } from '../../../src/memory/store/session-manager.js';

describe('MemoryCandidatePool', () => {
  let candidatePool: MemoryCandidatePool;
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager();
    candidatePool = new MemoryCandidatePool(sessionManager);
  });

  afterEach(() => {
    candidatePool.clear();
  });

  describe('write', () => {
    it('should write candidate memory with session id', async () => {
      const sessionId = 'session-123';
      const id = await candidatePool.write('User context', sessionId);

      expect(id).toBeDefined();
      expect(id).toMatch(/^candidate-/);
    });

    it('should store content with sessionId', async () => {
      const sessionId = 'session-123';
      const id = await candidatePool.write('Test content', sessionId);

      const entry = await candidatePool.read(id);
      expect(entry?.metadata.sessionId).toBe(sessionId);
      expect(entry?.type).toBe('candidate');
    });

    it('should set TTL metadata', async () => {
      const sessionId = 'session-123';
      const id = await candidatePool.write('Test', sessionId);

      const entry = await candidatePool.read(id);
      expect(entry?.metadata.ttl).toBeDefined();
      expect(entry?.metadata.ttl).toBeGreaterThan(0);
    });
  });

  describe('read', () => {
    it('should read existing memory', async () => {
      const sessionId = 'session-123';
      const id = await candidatePool.write('Test content', sessionId);

      const entry = await candidatePool.read(id);
      expect(entry?.content).toBe('Test content');
    });

    it('should return null for non-existing id', async () => {
      const entry = await candidatePool.read('non-existing');
      expect(entry).toBeNull();
    });
  });

  describe('list', () => {
    it('should list memories by session', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      await candidatePool.write('Memory 1', session1);
      await candidatePool.write('Memory 2', session1);
      await candidatePool.write('Memory 3', session2);

      const session1Memories = await candidatePool.list(session1);
      expect(session1Memories.length).toBe(2);

      const session2Memories = await candidatePool.list(session2);
      expect(session2Memories.length).toBe(1);
    });

    it('should return empty array for unknown session', async () => {
      const memories = await candidatePool.list('unknown-session');
      expect(memories).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete memory', async () => {
      const sessionId = 'session-123';
      const id = await candidatePool.write('To delete', sessionId);

      const success = await candidatePool.delete(id);
      expect(success).toBe(true);

      const entry = await candidatePool.read(id);
      expect(entry).toBeNull();
    });

    it('should return false for non-existing id', async () => {
      const success = await candidatePool.delete('non-existing');
      expect(success).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all memories', async () => {
      await candidatePool.write('Memory 1', 'session-1');
      await candidatePool.write('Memory 2', 'session-2');

      candidatePool.clear();

      const session1Memories = await candidatePool.list('session-1');
      expect(session1Memories).toEqual([]);

      const session2Memories = await candidatePool.list('session-2');
      expect(session2Memories).toEqual([]);
    });
  });

  describe('TTL', () => {
    it('should check expired memories', async () => {
      const sessionId = 'session-123';
      const id = await candidatePool.write('Test', sessionId, { ttl: 100 }); // 100ms TTL

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 150));

      const isExpired = candidatePool.isExpired(id);
      expect(isExpired).toBe(true);
    });

    it('should not expire fresh memories', async () => {
      const sessionId = 'session-123';
      const id = await candidatePool.write('Test', sessionId);

      const isExpired = candidatePool.isExpired(id);
      expect(isExpired).toBe(false);
    });
  });

  // T002-T004: 容量上限测试
  describe('capacity limits', () => {
    it('should have maxEntries property (default 500)', () => {
      expect(candidatePool.maxEntries).toBe(500);
    });

    it('should have evictCount property (default 50)', () => {
      expect(candidatePool.evictCount).toBe(50);
    });

    it('should have instantPromoteThreshold property (default 0.5)', () => {
      expect(candidatePool.instantPromoteThreshold).toBe(0.5);
    });

    it('should not evict when below maxEntries', async () => {
      const sessionId = 'session-123';
      // 写入少量条目
      for (let i = 0; i < 10; i++) {
        await candidatePool.write(`Content ${i}`, sessionId);
      }

      const stats = candidatePool.getStats();
      expect(stats.total).toBe(10);
    });

    it('should respect config.maxEntries override', () => {
      const customPool = new MemoryCandidatePool(sessionManager, {
        maxEntries: 100,
        evictCount: 10
      });
      expect(customPool.maxEntries).toBe(100);
      expect(customPool.evictCount).toBe(10);
    });
  });

  describe('evictLowImportance', () => {
    it('should sort entries by importance before evicting', async () => {
      const sessionId = 'session-123';
      // 写入不同 importance 的条目
      await candidatePool.write('Low importance', sessionId, { importance: 0.1 });
      await candidatePool.write('High importance', sessionId, { importance: 0.9 });
      await candidatePool.write('Medium importance', sessionId, { importance: 0.5 });

      candidatePool.evictLowImportance(1);

      const entries = await candidatePool.list(sessionId);
      expect(entries.length).toBe(2);
      // 低 importance 应被删除
      expect(entries.find(e => e.content === 'Low importance')).toBeUndefined();
    });

    it('should delete exact count of entries', async () => {
      const sessionId = 'session-123';
      for (let i = 0; i < 5; i++) {
        await candidatePool.write(`Content ${i}`, sessionId, { importance: i * 0.2 });
      }

      candidatePool.evictLowImportance(2);

      const entries = await candidatePool.list(sessionId);
      expect(entries.length).toBe(3);
    });

    it('should handle entries without importance (treat as 0)', async () => {
      const sessionId = 'session-123';
      // 无 importance 的条目（默认 0）
      await candidatePool.write('No importance', sessionId);
      await candidatePool.write('Has importance', sessionId, { importance: 0.8 });

      candidatePool.evictLowImportance(1);

      const entries = await candidatePool.list(sessionId);
      expect(entries.length).toBe(1);
      expect(entries[0].content).toBe('Has importance');
    });

    it('should not delete if count > store.size', async () => {
      const sessionId = 'session-123';
      await candidatePool.write('Only one', sessionId);

      candidatePool.evictLowImportance(10);

      const entries = await candidatePool.list(sessionId);
      expect(entries.length).toBe(1);
    });
  });

  describe('write with capacity check', () => {
    it('should trigger eviction when at capacity', async () => {
      // 创建容量为 10 的池
      const smallPool = new MemoryCandidatePool(sessionManager, {
        maxEntries: 10,
        evictCount: 2
      });

      const sessionId = 'session-123';
      // 写入 10 条低 importance
      for (let i = 0; i < 10; i++) {
        await smallPool.write(`Low ${i}`, sessionId, { importance: 0.1 });
      }

      // 再写入一条，应触发清理
      await smallPool.write('New entry', sessionId, { importance: 0.5 });

      const stats = smallPool.getStats();
      // 10 - 2 + 1 = 9
      expect(stats.total).toBe(9);
    });

    it('should keep high importance entries when evicting', async () => {
      const smallPool = new MemoryCandidatePool(sessionManager, {
        maxEntries: 10,
        evictCount: 2
      });

      const sessionId = 'session-123';
      // 写入低 importance
      for (let i = 0; i < 8; i++) {
        await smallPool.write(`Low ${i}`, sessionId, { importance: 0.1 });
      }
      // 写入高 importance
      await smallPool.write('High 1', sessionId, { importance: 0.9 });
      await smallPool.write('High 2', sessionId, { importance: 0.8 });

      // 触发清理（写入新条目）
      await smallPool.write('New', sessionId, { importance: 0.5 });

      const entries = await smallPool.list(sessionId);
      const highEntries = entries.filter(e => e.content.startsWith('High'));
      expect(highEntries.length).toBe(2);
    });

    it('should instantly promote when importance >= 0.5', async () => {
      const sessionId = 'session-123';
      const mockPromoter = {
        promote: vi.fn().mockResolvedValue(undefined)
      };

      candidatePool.setPromoter(mockPromoter);
      await candidatePool.write('High importance', sessionId, { importance: 0.6 });

      expect(mockPromoter.promote).toHaveBeenCalled();
    });

    it('should not instantly promote when importance < 0.5', async () => {
      const sessionId = 'session-123';
      const mockPromoter = {
        promote: vi.fn().mockResolvedValue(undefined)
      };

      candidatePool.setPromoter(mockPromoter);
      await candidatePool.write('Low importance', sessionId, { importance: 0.3 });

      expect(mockPromoter.promote).not.toHaveBeenCalled();
    });
  });
});

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  describe('create', () => {
    it('should create new session', () => {
      const sessionId = manager.create();
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session-/);
    });

    it('should track session creation time', () => {
      const sessionId = manager.create();
      const session = manager.get(sessionId);

      expect(session?.createdAt).toBeDefined();
      expect(session?.lastActivity).toBeDefined();
    });
  });

  describe('get', () => {
    it('should get existing session', () => {
      const sessionId = manager.create();
      const session = manager.get(sessionId);

      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);
    });

    it('should return null for unknown session', () => {
      const session = manager.get('unknown');
      expect(session).toBeNull();
    });
  });

  describe('updateActivity', () => {
    it('should update lastActivity timestamp', async () => {
      const sessionId = manager.create();
      const originalActivity = manager.get(sessionId)?.lastActivity;

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      manager.updateActivity(sessionId);

      const updatedActivity = manager.get(sessionId)?.lastActivity;
      expect(updatedActivity?.getTime()).toBeGreaterThan(originalActivity?.getTime() || 0);
    });
  });

  describe('listActive', () => {
    it('should list active sessions', () => {
      manager.create();
      manager.create();

      const sessions = manager.listActive();
      expect(sessions.length).toBe(2);
    });

    it('should filter by activity threshold', async () => {
      const sessionId = manager.create();

      // 等待一下
      await new Promise(resolve => setTimeout(resolve, 100));

      // 活跃阈值设为 200ms（session 还活跃）
      const activeSessions = manager.listActive(200);
      expect(activeSessions.length).toBe(1);

      // 活跃阈值设为 50ms（session 已不活跃）
      const inactiveSessions = manager.listActive(50);
      expect(inactiveSessions.length).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should destroy session', () => {
      const sessionId = manager.create();
      manager.destroy(sessionId);

      const session = manager.get(sessionId);
      expect(session).toBeNull();
    });
  });
});