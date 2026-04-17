/**
 * 消息去重测试
 * T1.5 消息去重测试
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageDeduplicator } from '../../../src/channels/feishu-dedup.js';

describe('MessageDeduplicator', () => {
  let dedup: MessageDeduplicator;

  beforeEach(() => {
    dedup = new MessageDeduplicator();
  });

  describe('基本去重功能', () => {
    // 首次消息不去重
    it('should not deduplicate first message', () => {
      expect(dedup.isDuplicate('msg-1')).toBe(false);
    });

    // 重复消息被过滤
    it('should deduplicate repeated message', () => {
      dedup.isDuplicate('msg-1'); // 首次
      expect(dedup.isDuplicate('msg-1')).toBe(true); // 重复
    });

    // 不同 messageId 不去重
    it('should not deduplicate different messageIds', () => {
      dedup.isDuplicate('msg-1');
      dedup.isDuplicate('msg-2');
      expect(dedup.isDuplicate('msg-3')).toBe(false);
    });
  });

  describe('缓存上限', () => {
    // 达到上限自动清理
    it('should clear cache when reaching maxSize', () => {
      const dedupWithLimit = new MessageDeduplicator({ maxSize: 99 });

      // 添加 99 条消息（达到 maxSize）
      for (let i = 1; i <= 99; i++) {
        dedupWithLimit.isDuplicate(`msg-${i}`);
      }

      // 第 100 条消息触发清理（缓存已满 99 条，添加前清理）
      expect(dedupWithLimit.isDuplicate('msg-100')).toBe(false);

      // 验证自动清理：msg-1 被清理，再次检查当作新消息
      expect(dedupWithLimit.isDuplicate('msg-1')).toBe(false);
    });

    // 达到上限后可以继续添加新消息
    it('should allow adding new messages after cleanup', () => {
      const dedupWithLimit = new MessageDeduplicator({ maxSize: 50 });

      // 添加 50 条消息触发清理
      for (let i = 1; i <= 50; i++) {
        dedupWithLimit.isDuplicate(`msg-${i}`);
      }

      // 新消息应该正常处理
      expect(dedupWithLimit.isDuplicate('msg-new')).toBe(false);
      expect(dedupWithLimit.isDuplicate('msg-new')).toBe(true); // 第二次重复
    });
  });

  describe('手动清理', () => {
    // clear() 方法清空缓存
    it('should clear all cached messages', () => {
      dedup.isDuplicate('msg-1');
      dedup.isDuplicate('msg-2');
      dedup.isDuplicate('msg-3');

      dedup.clear();

      // 清空后所有消息都应该当作新消息
      expect(dedup.isDuplicate('msg-1')).toBe(false);
      expect(dedup.isDuplicate('msg-2')).toBe(false);
    });
  });

  describe('统计信息', () => {
    // 获取缓存大小
    it('should return correct size', () => {
      expect(dedup.size()).toBe(0);

      dedup.isDuplicate('msg-1');
      expect(dedup.size()).toBe(1);

      dedup.isDuplicate('msg-2');
      expect(dedup.size()).toBe(2);

      // 重复消息不增加计数
      dedup.isDuplicate('msg-1');
      expect(dedup.size()).toBe(2);
    });
  });

  describe('边界情况', () => {
    // 空 messageId
    it('should handle empty messageId', () => {
      expect(dedup.isDuplicate('')).toBe(false);
      expect(dedup.isDuplicate('')).toBe(true);
    });

    // null/undefined messageId (类型检查后)
    it('should handle null messageId by treating as string', () => {
      // TypeScript 类型检查会阻止 null，但运行时可能传入
      expect(dedup.isDuplicate(null as unknown as string)).toBe(false);
    });

    // 特殊字符 messageId
    it('should handle special characters in messageId', () => {
      expect(dedup.isDuplicate('msg-with-dash')).toBe(false);
      expect(dedup.isDuplicate('msg_with_underscore')).toBe(false);
      expect(dedup.isDuplicate('msg.with.dot')).toBe(false);
    });
  });
});