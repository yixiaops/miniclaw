/**
 * @fileoverview Importance Flow 集成测试
 *
 * 测试 US2: TTL 过期时晋升决策
 * 测试 US3: 用户查看长期记忆
 *
 * @module tests/integration/importance-flow
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryManager } from '../../src/memory/manager.js';
import { MemoryCandidatePool } from '../../src/memory/store/candidate-pool.js';
import { LongTermMemory } from '../../src/memory/store/long-term.js';
import { SessionManager } from '../../src/memory/store/session-manager.js';
import { TTLManager } from '../../src/memory/store/ttl-manager.js';
import { MemoryPromoter } from '../../src/memory/promotion/promoter.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

/**
 * 创建测试用的记忆条目（模拟已过期）
 * TTL 设置为 1ms，写入后等待确保过期
 */
async function createExpiredEntry(
  pool: MemoryCandidatePool,
  sessionId: string,
  importance: number,
  content: string
): Promise<string> {
  // 设置 TTL 为 1ms 使其快速过期
  const id = await pool.write(content, sessionId, {
    importance,
    ttl: 1 // 1ms TTL
  });
  // 等待 2ms 确保 TTL 过期
  await new Promise(resolve => setTimeout(resolve, 2));
  return id;
}

describe('Importance Flow Integration Tests', () => {
  let testDir: string;
  let sessionManager: SessionManager;
  let candidatePool: MemoryCandidatePool;
  let longTerm: LongTermMemory;
  let promoter: MemoryPromoter;
  let ttlManager: TTLManager;

  beforeEach(async () => {
    testDir = join(tmpdir(), `importance-flow-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    sessionManager = new SessionManager();
    candidatePool = new MemoryCandidatePool(sessionManager, {
      defaultTTL: 0 // 立即过期便于测试
    });
    longTerm = new LongTermMemory(testDir);
    promoter = new MemoryPromoter(candidatePool, longTerm);
    ttlManager = new TTLManager(candidatePool, promoter);

    // 设置晋升阈值
    promoter.setThreshold(0.5);
  });

  afterEach(async () => {
    ttlManager.stop();
    candidatePool.clear();
    longTerm.clear();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('T031-T033: US2 TTL Promotion Tests', () => {
    it('T031: should promote memory when importance >= threshold', async () => {
      const sessionId = 'test-session-1';

      // 写入高 importance 记忆（立即过期）
      const id = await createExpiredEntry(
        candidatePool,
        sessionId,
        0.8, // 高于阈值 0.5
        '重要信息：用户偏好深色模式'
      );

      // 验证候选池中有该条目
      const entryBefore = await candidatePool.read(id);
      expect(entryBefore).toBeDefined();
      expect(entryBefore?.metadata.importance).toBe(0.8);

      // 执行 TTL 清理
      const result = await ttlManager.cleanup();

      // 验证晋升结果
      expect(result.expired).toBe(1);
      expect(result.promoted).toBe(1);
      expect(result.cleaned).toBe(0);

      // 验证候选池中已删除
      const entryAfter = await candidatePool.read(id);
      expect(entryAfter).toBeNull();

      // 验证长期记忆中有该条目
      const longTermEntries = await longTerm.list();
      expect(longTermEntries.length).toBe(1);
      expect(longTermEntries[0].content).toContain('重要信息');
      expect(longTermEntries[0].metadata.importance).toBe(0.8);
    });

    it('T032: should delete memory when importance < threshold', async () => {
      const sessionId = 'test-session-2';

      // 写入低 importance 记忆（立即过期）
      const id = await createExpiredEntry(
        candidatePool,
        sessionId,
        0.3, // 低于阈值 0.5
        '普通聊天：你好'
      );

      // 验证候选池中有该条目
      const entryBefore = await candidatePool.read(id);
      expect(entryBefore).toBeDefined();
      expect(entryBefore?.metadata.importance).toBe(0.3);

      // 执行 TTL 清理
      const result = await ttlManager.cleanup();

      // 验证清理结果
      expect(result.expired).toBe(1);
      expect(result.promoted).toBe(0);
      expect(result.cleaned).toBe(1);

      // 验证候选池中已删除
      const entryAfter = await candidatePool.read(id);
      expect(entryAfter).toBeNull();

      // 验证长期记忆中没有该条目
      const longTermEntries = await longTerm.list();
      expect(longTermEntries.length).toBe(0);
    });

    it('T033: should handle multiple entries with different importance', async () => {
      const sessionId = 'test-session-3';

      // 写入多个不同 importance 的记忆
      const id1 = await createExpiredEntry(
        candidatePool,
        sessionId,
        0.8,
        '高重要性：用户邮箱 user@example.com'
      );
      const id2 = await createExpiredEntry(
        candidatePool,
        sessionId,
        0.4,
        '低重要性：普通问候'
      );
      const id3 = await createExpiredEntry(
        candidatePool,
        sessionId,
        0.5, // 恰好在阈值
        '中等重要性：用户喜欢咖啡'
      );
      const id4 = await createExpiredEntry(
        candidatePool,
        sessionId,
        0.9,
        '最高重要性：紧急联系方式'
      );

      // 验证候选池中有 4 个条目
      const entriesBefore = await candidatePool.list(sessionId);
      expect(entriesBefore.length).toBe(4);

      // 执行 TTL 清理
      const result = await ttlManager.cleanup();

      // 验证结果：应该晋升 3 个（importance >= 0.5），清理 1 个（importance < 0.5）
      expect(result.expired).toBe(4);
      expect(result.promoted).toBe(3); // 0.8, 0.5, 0.9
      expect(result.cleaned).toBe(1); // 0.4

      // 验证候选池清空
      const entriesAfter = await candidatePool.list(sessionId);
      expect(entriesAfter.length).toBe(0);

      // 验证长期记忆有 3 个条目
      const longTermEntries = await longTerm.list();
      expect(longTermEntries.length).toBe(3);

      // 验证长期记忆包含正确的条目
      const contents = longTermEntries.map(e => e.content);
      expect(contents).toContain('高重要性：用户邮箱 user@example.com');
      expect(contents).toContain('中等重要性：用户喜欢咖啡');
      expect(contents).toContain('最高重要性：紧急联系方式');
      expect(contents).not.toContain('低重要性：普通问候');
    });
  });

  describe('T034-T035: Verification Tests', () => {
    it('T034: TTLManager should use entry.metadata.importance for promotion decision', async () => {
      const sessionId = 'verify-session-1';

      // 验证 TTLManager.cleanup() 调用 promoter.check(entry)
      // promoter.check() 使用 entry.metadata.importance

      const id = await createExpiredEntry(
        candidatePool,
        sessionId,
        0.6,
        '测试内容'
      );

      const entry = await candidatePool.read(id);
      expect(entry?.metadata.importance).toBe(0.6);

      // 清理后应该晋升
      const result = await ttlManager.cleanup();
      expect(result.promoted).toBe(1);
    });

    it('T035: MemoryPromoter.check() should use importance threshold correctly', async () => {
      // 测试 MemoryPromoter.check() 方法

      // 创建测试条目（不需要实际写入）
      const highImportanceEntry = {
        id: 'test-1',
        content: 'high',
        type: 'candidate',
        metadata: { importance: 0.8 },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const lowImportanceEntry = {
        id: 'test-2',
        content: 'low',
        type: 'candidate',
        metadata: { importance: 0.3 },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const thresholdEntry = {
        id: 'test-3',
        content: 'threshold',
        type: 'candidate',
        metadata: { importance: 0.5 },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 测试 check 方法
      expect(promoter.check(highImportanceEntry)).toBe(true);
      expect(promoter.check(lowImportanceEntry)).toBe(false);
      expect(promoter.check(thresholdEntry)).toBe(true); // 阈值边界应该晋升

      // 验证统计
      const stats = promoter.getStats();
      expect(stats.totalChecked).toBe(3);
    });
  });

  describe('T037-T038: US3 Long-Term Memory Tests', () => {
    it('T037: should view promoted long-term memory', async () => {
      const sessionId = 'view-session-1';

      // 直接写入长期记忆（模拟晋升后的状态）
      const id1 = await longTerm.write('用户偏好：深色模式', {
        importance: 0.8,
        promotedAt: new Date()
      });
      const id2 = await longTerm.write('用户邮箱：test@example.com', {
        importance: 0.7,
        promotedAt: new Date()
      });

      // 验证可以列出长期记忆
      const entries = await longTerm.list();
      expect(entries.length).toBe(2);

      // 验证可以读取单个长期记忆
      const entry1 = await longTerm.read(id1);
      expect(entry1).toBeDefined();
      expect(entry1?.content).toContain('深色模式');
      expect(entry1?.metadata.importance).toBe(0.8);

      // 验证可以按重要性筛选
      const highImportance = await longTerm.list({ minImportance: 0.75 });
      expect(highImportance.length).toBe(1);
      expect(highImportance[0].content).toContain('深色模式');
    });

    it('T038: should handle empty long-term memory', async () => {
      // 清空的长期记忆
      longTerm.clear();

      // 验证返回空列表
      const entries = await longTerm.list();
      expect(entries.length).toBe(0);

      // 验证读取不存在条目返回 null
      const entry = await longTerm.read('nonexistent-id');
      expect(entry).toBeNull();

      // 验证统计信息
      const stats = longTerm.getStats();
      expect(stats.total).toBe(0);
      expect(stats.avgImportance).toBe(0);
    });
  });

  describe('T039: memory_get tool verification', () => {
    it('should return long-term memory entries', async () => {
      // 验证 LongTermMemory.list() 返回正确的格式
      await longTerm.write('测试记忆 1', { importance: 0.6 });
      await longTerm.write('测试记忆 2', { importance: 0.7 });

      const entries = await longTerm.list();

      // 验证返回的条目格式正确
      for (const entry of entries) {
        expect(entry.id).toBeDefined();
        expect(entry.content).toBeDefined();
        expect(entry.type).toBe('long-term');
        expect(entry.metadata.importance).toBeDefined();
        expect(entry.createdAt).toBeDefined();
        expect(entry.updatedAt).toBeDefined();
      }
    });
  });
});