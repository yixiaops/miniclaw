/**
 * @fileoverview 记忆候选池管理测试
 *
 * 测试记忆候选池的核心功能。
 *
 * @module tests/unit/store/candidate-pool.test
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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