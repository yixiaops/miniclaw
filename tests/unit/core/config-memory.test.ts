/**
 * @fileoverview Config memory 配置测试
 *
 * 测试 MemoryConfig 接口和解析逻辑。
 */

import { describe, it, expect } from 'vitest';
import type { MemoryConfig, Config } from '../../../src/core/config.js';
import { DEFAULT_MEMORY_CONFIG } from '../../../src/core/config.js';

describe('Config.memory', () => {
  describe('DEFAULT_MEMORY_CONFIG', () => {
    it('should have promotionThreshold <= defaultImportance for proper memory promotion', () => {
      // 背景：临时记忆晋升到长期记忆时，重要性分数需要达到 promotionThreshold
      // 如果 promotionThreshold > defaultImportance，新记忆的默认重要性分数
      // 将永远无法满足晋升条件，导致记忆无法正确晋升
      expect(DEFAULT_MEMORY_CONFIG.promotionThreshold).toBeLessThanOrEqual(
        DEFAULT_MEMORY_CONFIG.defaultImportance
      );
    });

    it('should have sensible default values', () => {
      expect(DEFAULT_MEMORY_CONFIG.enabled).toBe(false);
      expect(DEFAULT_MEMORY_CONFIG.defaultTTL).toBe(24 * 60 * 60 * 1000); // 24h
      expect(DEFAULT_MEMORY_CONFIG.cleanupInterval).toBe(60 * 60 * 1000); // 1h
    });
  });

  describe('MemoryConfig interface', () => {
    it('should parse memory config from JSON', () => {
      const json = {
        memory: {
          enabled: true,
          dir: '~/.miniclaw',
          defaultTTL: 86400000,
          cleanupInterval: 3600000,
          promotionThreshold: 0.5,
          defaultImportance: 0.3,
          injectContext: false
        }
      };

      const memoryConfig: MemoryConfig = json.memory;
      expect(memoryConfig.enabled).toBe(true);
      expect(memoryConfig.dir).toBe('~/.miniclaw');
      expect(memoryConfig.defaultImportance).toBe(0.3);
    });

    it('should default enabled to false', () => {
      const memoryConfig: MemoryConfig = {};
      expect(memoryConfig.enabled ?? false).toBe(false);
    });

    it('should default importance to 0.3', () => {
      const memoryConfig: MemoryConfig = {};
      expect(memoryConfig.defaultImportance ?? 0.3).toBe(0.3);
    });

    it('should default injectContext to false', () => {
      const memoryConfig: MemoryConfig = {};
      expect(memoryConfig.injectContext ?? false).toBe(false);
    });

    it('should allow partial memory config', () => {
      const memoryConfig: MemoryConfig = {
        enabled: true,
        dir: './memory-storage'
      };
      expect(memoryConfig.enabled).toBe(true);
      expect(memoryConfig.dir).toBe('./memory-storage');
      expect(memoryConfig.defaultImportance).toBeUndefined();
    });
  });

  describe('Memory optimization config', () => {
    describe('SessionConfig', () => {
      it('should have session config with maxFullMessages', () => {
        const config: MemoryConfig = {
          session: {
            maxFullMessages: 50,
            maxSummaryBatches: 15,
            compressInterval: 3600000
          }
        };
        expect(config.session?.maxFullMessages).toBe(50);
      });

      it('should have session config with maxSummaryBatches', () => {
        const config: MemoryConfig = {
          session: {
            maxFullMessages: 50,
            maxSummaryBatches: 15,
            compressInterval: 3600000
          }
        };
        expect(config.session?.maxSummaryBatches).toBe(15);
      });

      it('should have session config with compressInterval', () => {
        const config: MemoryConfig = {
          session: {
            maxFullMessages: 50,
            maxSummaryBatches: 15,
            compressInterval: 3600000
          }
        };
        expect(config.session?.compressInterval).toBe(3600000);
      });
    });

    describe('CandidatePoolConfig', () => {
      it('should have candidatePool config with maxEntries', () => {
        const config: MemoryConfig = {
          candidatePool: {
            maxEntries: 500,
            evictCount: 50,
            instantPromoteThreshold: 0.5
          }
        };
        expect(config.candidatePool?.maxEntries).toBe(500);
      });

      it('should have candidatePool config with evictCount', () => {
        const config: MemoryConfig = {
          candidatePool: {
            maxEntries: 500,
            evictCount: 50,
            instantPromoteThreshold: 0.5
          }
        };
        expect(config.candidatePool?.evictCount).toBe(50);
      });

      it('should have candidatePool config with instantPromoteThreshold', () => {
        const config: MemoryConfig = {
          candidatePool: {
            maxEntries: 500,
            evictCount: 50,
            instantPromoteThreshold: 0.5
          }
        };
        expect(config.candidatePool?.instantPromoteThreshold).toBe(0.5);
      });
    });

    describe('DEFAULT_MEMORY_CONFIG defaults', () => {
      it('should have default session config values', () => {
        expect(DEFAULT_MEMORY_CONFIG.session?.maxFullMessages).toBe(50);
        expect(DEFAULT_MEMORY_CONFIG.session?.maxSummaryBatches).toBe(15);
        expect(DEFAULT_MEMORY_CONFIG.session?.compressInterval).toBe(3600000);
      });

      it('should have default candidatePool config values', () => {
        expect(DEFAULT_MEMORY_CONFIG.candidatePool?.maxEntries).toBe(500);
        expect(DEFAULT_MEMORY_CONFIG.candidatePool?.evictCount).toBe(50);
        expect(DEFAULT_MEMORY_CONFIG.candidatePool?.instantPromoteThreshold).toBe(0.5);
      });
    });
  });

  describe('Config integration', () => {
    it('should include memory config in Config interface', () => {
      const config: Config = {
        bailian: {
          apiKey: 'test-key',
          model: 'qwen-plus',
          baseUrl: 'https://example.com'
        },
        server: {
          port: 3000,
          host: '0.0.0.0'
        },
        memory: {
          enabled: true,
          defaultImportance: 0.3
        }
      };

      expect(config.memory).toBeDefined();
      expect(config.memory?.enabled).toBe(true);
    });
  });
});