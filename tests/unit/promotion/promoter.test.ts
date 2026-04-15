/**
 * @fileoverview 记忆晋升机制测试
 *
 * 测试短期记忆晋升为长期记忆的功能。
 *
 * @module tests/unit/promotion/promoter.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryPromoter } from '../../../src/memory/promotion/promoter.js';
import { ShortTermMemory } from '../../../src/memory/store/short-term.js';
import { LongTermMemory } from '../../../src/memory/store/long-term.js';
import { SessionManager } from '../../../src/memory/store/session-manager.js';
import * as fs from 'fs/promises';

describe('MemoryPromoter', () => {
  let promoter: MemoryPromoter;
  let shortTerm: ShortTermMemory;
  let longTerm: LongTermMemory;
  let sessionManager: SessionManager;
  const testDir = '/tmp/miniclaw-promotion-test';

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    sessionManager = new SessionManager();
    shortTerm = new ShortTermMemory(sessionManager);
    longTerm = new LongTermMemory(testDir);
    promoter = new MemoryPromoter(shortTerm, longTerm);
  });

  describe('check', () => {
    it('should return true for high importance', async () => {
      const sessionId = 'session-123';
      const id = await shortTerm.write('Important decision', sessionId, {
        importance: 0.9
      });

      const entry = await shortTerm.read(id);
      const shouldPromote = promoter.check(entry!);

      expect(shouldPromote).toBe(true);
    });

    it('should return false for low importance', async () => {
      const sessionId = 'session-123';
      const id = await shortTerm.write('Normal context', sessionId, {
        importance: 0.3
      });

      const entry = await shortTerm.read(id);
      const shouldPromote = promoter.check(entry!);

      expect(shouldPromote).toBe(false);
    });

    it('should respect threshold config', async () => {
      promoter.setThreshold(0.7);

      const sessionId = 'session-123';
      const id = await shortTerm.write('Medium importance', sessionId, {
        importance: 0.6
      });

      const entry = await shortTerm.read(id);
      const shouldPromote = promoter.check(entry!);

      expect(shouldPromote).toBe(false);
    });

    it('should promote with importance 0.5 by default', async () => {
      const sessionId = 'session-123';
      const id = await shortTerm.write('Decision', sessionId, {
        importance: 0.5
      });

      const entry = await shortTerm.read(id);
      const shouldPromote = promoter.check(entry!);

      expect(shouldPromote).toBe(true);
    });
  });

  describe('promote', () => {
    it('should promote short-term to long-term', async () => {
      const sessionId = 'session-123';
      const shortId = await shortTerm.write('Important info', sessionId, {
        importance: 0.8
      });

      const longId = await promoter.promote(shortId);

      expect(longId).toBeDefined();
      expect(longId).toMatch(/^long-/);

      const longEntry = await longTerm.read(longId);
      expect(longEntry?.content).toBe('Important info');
      expect(longEntry?.metadata.promotedAt).toBeDefined();
    });

    it('should delete short-term after promotion', async () => {
      const sessionId = 'session-123';
      const shortId = await shortTerm.write('To promote', sessionId, {
        importance: 0.9
      });

      await promoter.promote(shortId);

      const shortEntry = await shortTerm.read(shortId);
      expect(shortEntry).toBeNull();
    });

    it('should preserve metadata', async () => {
      const sessionId = 'session-123';
      const shortId = await shortTerm.write('With metadata', sessionId, {
        importance: 0.8,
        tags: ['important', 'work']
      });

      const longId = await promoter.promote(shortId);

      const longEntry = await longTerm.read(longId);
      expect(longEntry?.metadata.tags).toEqual(['important', 'work']);
    });

    it('should return null for non-existing id', async () => {
      const longId = await promoter.promote('non-existing');

      expect(longId).toBeNull();
    });

    it('should return null if check fails', async () => {
      const sessionId = 'session-123';
      const shortId = await shortTerm.write('Low importance', sessionId, {
        importance: 0.1
      });

      const longId = await promoter.promote(shortId);

      expect(longId).toBeNull();
    });
  });

  describe('promoteAll', () => {
    it('should promote all eligible memories', async () => {
      const sessionId = 'session-123';

      await shortTerm.write('High 1', sessionId, { importance: 0.8 });
      await shortTerm.write('High 2', sessionId, { importance: 0.9 });
      await shortTerm.write('Low', sessionId, { importance: 0.2 });

      const promotedIds = await promoter.promoteAll();

      expect(promotedIds.length).toBe(2);

      const longMemories = await longTerm.list();
      expect(longMemories.length).toBe(2);
    });
  });

  describe('getStats', () => {
    it('should return promotion statistics', async () => {
      const sessionId = 'session-123';

      await shortTerm.write('Promoted 1', sessionId, { importance: 0.8 });
      await shortTerm.write('Promoted 2', sessionId, { importance: 0.9 });
      await shortTerm.write('Low', sessionId, { importance: 0.2 });

      promoter.resetStats(); // 重置统计
      await promoter.promoteAll();

      const stats = promoter.getStats();

      expect(stats.promoted).toBe(2);
      expect(stats.totalChecked).toBeGreaterThanOrEqual(2);
    });
  });
});