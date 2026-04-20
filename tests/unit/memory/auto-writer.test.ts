/**
 * @fileoverview AutoMemoryWriter 测试
 *
 * 测试自动写入对话到短期记忆的逻辑。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoMemoryWriter } from '../../../src/memory/auto-writer.js';
import type { MemoryManager } from '../../../src/memory/manager.js';

describe('AutoMemoryWriter', () => {
  let writer: AutoMemoryWriter;
  let mockManager: MemoryManager;

  beforeEach(() => {
    // Mock MemoryManager
    mockManager = {
      write: vi.fn().mockResolvedValue('test-id'),
      search: vi.fn().mockResolvedValue([]),
      cleanup: vi.fn().mockResolvedValue({ expired: 0, promoted: 0, cleaned: 0 }),
      persist: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      getStatus: vi.fn().mockReturnValue({ candidatePoolCount: 0, longTermCount: 0 })
    } as unknown as MemoryManager;

    writer = new AutoMemoryWriter(mockManager);
  });

  describe('writeConversation', () => {
    it('should write user message with importance 0.3', async () => {
      await writer.writeConversation('session-1', 'user message', 'assistant message');
      
      expect(mockManager.write).toHaveBeenCalledWith(
        'user message',
        'session-1',
        expect.objectContaining({ importance: 0.3 })
      );
    });

    it('should write assistant message with importance 0.3', async () => {
      await writer.writeConversation('session-1', 'user message', 'assistant message');
      
      expect(mockManager.write).toHaveBeenCalledWith(
        'assistant message',
        'session-1',
        expect.objectContaining({ importance: 0.3 })
      );
    });

    it('should not throw on write failure', async () => {
      // Mock write to fail
      vi.mocked(mockManager.write).mockRejectedValue(new Error('Write failed'));
      
      // Should not throw
      await writer.writeConversation('session-1', 'user message', 'assistant message');
      
      // Should complete without error
      expect(true).toBe(true);
    });

    it('should complete in < 50ms', async () => {
      const start = Date.now();
      await writer.writeConversation('session-1', 'user message', 'assistant message');
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeLessThan(50);
    });

    it('should use silentExecute for error handling', async () => {
      // 验证失败时不抛异常（说明使用了 silentExecute）
      vi.mocked(mockManager.write).mockRejectedValue(new Error('Write failed'));
      
      const result = await writer.writeConversation('session-1', 'user message', 'assistant message');
      
      // silentExecute 不会抛异常，只会静默降级
      expect(result).toBeDefined();
    });
  });

  describe('writeUserMessage', () => {
    it('should write user message only', async () => {
      await writer.writeUserMessage('session-1', 'user message');
      
      expect(mockManager.write).toHaveBeenCalledTimes(1);
      expect(mockManager.write).toHaveBeenCalledWith(
        'user message',
        'session-1',
        expect.objectContaining({ importance: 0.3, source: 'user' })
      );
    });
  });

  describe('writeAssistantMessage', () => {
    it('should write assistant message only', async () => {
      await writer.writeAssistantMessage('session-1', 'assistant message');
      
      expect(mockManager.write).toHaveBeenCalledTimes(1);
      expect(mockManager.write).toHaveBeenCalledWith(
        'assistant message',
        'session-1',
        expect.objectContaining({ importance: 0.3, source: 'assistant' })
      );
    });
  });

  describe('configuration', () => {
    it('should use custom importance when provided', async () => {
      const customWriter = new AutoMemoryWriter(mockManager, { defaultImportance: 0.5 });
      await customWriter.writeConversation('session-1', 'user message', 'assistant message');
      
      expect(mockManager.write).toHaveBeenCalledWith(
        expect.any(String),
        'session-1',
        expect.objectContaining({ importance: 0.5 })
      );
    });

    it('should skip writing when disabled', async () => {
      const disabledWriter = new AutoMemoryWriter(mockManager, { enabled: false });
      await disabledWriter.writeConversation('session-1', 'user message', 'assistant message');
      
      expect(mockManager.write).not.toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = writer.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.defaultImportance).toBe(0.3);
    });
  });

  describe('withConfig', () => {
    it('should create new writer with updated config', () => {
      const newWriter = writer.withConfig({ defaultImportance: 0.5 });
      expect(newWriter.getConfig().defaultImportance).toBe(0.5);
    });
  });
});