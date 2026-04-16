/**
 * @fileoverview MemoryErrorHandler 测试
 *
 * 测试静默降级错误处理逻辑。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryErrorHandler } from '../../../src/memory/error-handler.js';

describe('MemoryErrorHandler', () => {
  let handler: MemoryErrorHandler;

  beforeEach(() => {
    handler = new MemoryErrorHandler({ logErrors: true });
  });

  describe('silentExecute', () => {
    it('should return result on success', async () => {
      const result = await handler.silentExecute(
        async () => 'success',
        'fallback'
      );
      expect(result).toBe('success');
    });

    it('should return fallback on failure', async () => {
      const result = await handler.silentExecute(
        async () => {
          throw new Error('Operation failed');
        },
        'fallback'
      );
      expect(result).toBe('fallback');
    });

    it('should return undefined on failure without fallback', async () => {
      const result = await handler.silentExecute(
        async () => {
          throw new Error('Operation failed');
        }
      );
      expect(result).toBeUndefined();
    });

    it('should not throw exception on failure', async () => {
      // 不应该抛出异常
      const result = await handler.silentExecute(
        async () => {
          throw new Error('Operation failed');
        },
        'fallback'
      );
      expect(result).toBeDefined();
    });
  });

  describe('silentExecuteSync', () => {
    it('should return result on success', () => {
      const result = handler.silentExecuteSync(
        () => 'success',
        'fallback'
      );
      expect(result).toBe('success');
    });

    it('should return fallback on failure', () => {
      const result = handler.silentExecuteSync(
        () => {
          throw new Error('Operation failed');
        },
        'fallback'
      );
      expect(result).toBe('fallback');
    });

    it('should return undefined on failure without fallback', () => {
      const result = handler.silentExecuteSync(
        () => {
          throw new Error('Operation failed');
        }
      );
      expect(result).toBeUndefined();
    });
  });

  describe('logError', () => {
    it('should log error when logErrors is true', () => {
      const consoleSpy = vi.spyOn(console, 'error');
      
      handler.logError('test-operation', new Error('test error'));
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not log error when logErrors is false', () => {
      const silentHandler = new MemoryErrorHandler({ logErrors: false });
      const consoleSpy = vi.spyOn(console, 'error');
      
      silentHandler.logError('test-operation', new Error('test error'));
      
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getConfig', () => {
    it('should return current config', () => {
      const config = handler.getConfig();
      expect(config.logErrors).toBe(true);
    });
  });

  describe('withConfig', () => {
    it('should create new handler with updated config', () => {
      const newHandler = handler.withConfig({ logErrors: false });
      expect(newHandler.getConfig().logErrors).toBe(false);
    });
  });
});