/**
 * SessionManager 单元测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('SessionManager', () => {
  let SessionManager: typeof import('../../src/core/gateway/session.js').SessionManager;
  let manager: InstanceType<typeof SessionManager>;

  beforeEach(async () => {
    vi.resetModules();
    SessionManager = (await import('../../../src/core/gateway/session.js')).SessionManager;
    manager = new SessionManager({
      maxHistoryLength: 50,
      sessionTtl: 3600000,
      maxConcurrentSessions: 100,
      persistence: 'memory'
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrCreate', () => {
    it('应该创建新 Session', () => {
      const session = manager.getOrCreate('session-1', {
        channel: 'cli',
        userId: 'user-1'
      });

      expect(session).toBeDefined();
      expect(session.id).toBe('session-1');
      expect(session.metadata.channel).toBe('cli');
      expect(session.metadata.userId).toBe('user-1');
    });

    it('应该返回已存在的 Session', () => {
      const session1 = manager.getOrCreate('session-1');
      const session2 = manager.getOrCreate('session-1');

      expect(session1).toBe(session2);
    });

    it('应该更新最后活跃时间', async () => {
      const session1 = manager.getOrCreate('session-1');
      const time1 = session1.lastActiveAt;

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      manager.getOrCreate('session-1');
      const session2 = manager.get('session-1');

      expect(session2!.lastActiveAt.getTime()).toBeGreaterThanOrEqual(time1.getTime());
    });
  });

  describe('get', () => {
    it('应该返回已存在的 Session', () => {
      manager.getOrCreate('session-1');
      const session = manager.get('session-1');

      expect(session).toBeDefined();
      expect(session!.id).toBe('session-1');
    });

    it('应该对不存在的 Session 返回 undefined', () => {
      const session = manager.get('not-exist');

      expect(session).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('应该销毁 Session', () => {
      manager.getOrCreate('session-1');
      manager.destroy('session-1');

      const session = manager.get('session-1');
      expect(session).toBeUndefined();
    });

    it('销毁不存在的 Session 不应该报错', () => {
      expect(() => manager.destroy('not-exist')).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('应该清理过期的 Session', async () => {
      // 创建一个短生命周期的管理器
      const shortTtlManager = new SessionManager({
        maxHistoryLength: 50,
        sessionTtl: 10, // 10ms
        maxConcurrentSessions: 100,
        persistence: 'memory'
      });

      shortTtlManager.getOrCreate('session-1');

      // 等待过期
      await new Promise(resolve => setTimeout(resolve, 20));

      shortTtlManager.cleanup();

      const session = shortTtlManager.get('session-1');
      expect(session).toBeUndefined();
    });

    it('不应该清理未过期的 Session', () => {
      manager.getOrCreate('session-1');
      manager.cleanup();

      const session = manager.get('session-1');
      expect(session).toBeDefined();
    });
  });

  describe('getAll', () => {
    it('应该返回所有 Session', () => {
      manager.getOrCreate('session-1');
      manager.getOrCreate('session-2');
      manager.getOrCreate('session-3');

      const sessions = manager.getAll();

      expect(sessions).toHaveLength(3);
      expect(sessions.map(s => s.id)).toContain('session-1');
      expect(sessions.map(s => s.id)).toContain('session-2');
      expect(sessions.map(s => s.id)).toContain('session-3');
    });

    it('没有 Session 时应该返回空数组', () => {
      const sessions = manager.getAll();
      expect(sessions).toEqual([]);
    });
  });

  describe('count', () => {
    it('应该返回 Session 数量', () => {
      expect(manager.count()).toBe(0);

      manager.getOrCreate('session-1');
      expect(manager.count()).toBe(1);

      manager.getOrCreate('session-2');
      expect(manager.count()).toBe(2);
    });
  });

  describe('maxConcurrentSessions', () => {
    it('应该限制最大 Session 数', () => {
      const limitedManager = new SessionManager({
        maxHistoryLength: 50,
        sessionTtl: 3600000,
        maxConcurrentSessions: 2,
        persistence: 'memory'
      });

      limitedManager.getOrCreate('session-1');
      limitedManager.getOrCreate('session-2');

      // 超过限制时应该抛出错误
      expect(() => limitedManager.getOrCreate('session-3')).toThrow();
    });
  });

  describe('messages', () => {
    it('应该能够添加消息到 Session', () => {
      const session = manager.getOrCreate('session-1');

      session.addMessage({ role: 'user', content: 'Hello' });
      session.addMessage({ role: 'assistant', content: 'Hi!' });

      expect(session.messages).toHaveLength(2);
      expect(session.messages[0].content).toBe('Hello');
      expect(session.messages[1].content).toBe('Hi!');
    });

    it('应该限制最大历史消息数', () => {
      const limitedManager = new SessionManager({
        maxHistoryLength: 5,
        sessionTtl: 3600000,
        maxConcurrentSessions: 100,
        persistence: 'memory'
      });

      const session = limitedManager.getOrCreate('session-1');

      // 添加 10 条消息
      for (let i = 0; i < 10; i++) {
        session.addMessage({ role: 'user', content: `Message ${i}` });
      }

      // 应该只保留最后 5 条
      expect(session.messages).toHaveLength(5);
      expect(session.messages[0].content).toBe('Message 5');
      expect(session.messages[4].content).toBe('Message 9');
    });
  });
});