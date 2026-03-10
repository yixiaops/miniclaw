/**
 * 配置模块测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Config, loadConfig, validateConfig, getConfigPath } from '../../src/core/config.js';

describe('Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    it('should load config from environment variables', () => {
      process.env.MINICLAW_BAILIAN_API_KEY = 'test-api-key';
      process.env.MINICLAW_BAILIAN_MODEL = 'qwen-turbo';

      const config = loadConfig();

      expect(config.bailian.apiKey).toBe('test-api-key');
      expect(config.bailian.model).toBe('qwen-turbo');
    });

    it('should use default model if not specified', () => {
      process.env.MINICLAW_BAILIAN_API_KEY = 'test-api-key';
      delete process.env.MINICLAW_BAILIAN_MODEL;

      const config = loadConfig();

      expect(config.bailian.model).toBe('qwen-turbo');
    });

    it('should throw error if API key is missing', () => {
      delete process.env.MINICLAW_BAILIAN_API_KEY;

      expect(() => loadConfig()).toThrow('BAILIAN_API_KEY');
    });

    it('should load server config with defaults', () => {
      process.env.MINICLAW_BAILIAN_API_KEY = 'test-key';

      const config = loadConfig();

      expect(config.server.port).toBe(3000);
      expect(config.server.host).toBe('0.0.0.0');
    });

    it('should load server config from env', () => {
      process.env.MINICLAW_BAILIAN_API_KEY = 'test-key';
      process.env.MINICLAW_SERVER_PORT = '8080';
      process.env.MINICLAW_SERVER_HOST = 'localhost';

      const config = loadConfig();

      expect(config.server.port).toBe(8080);
      expect(config.server.host).toBe('localhost');
    });

    it('should load feishu config if provided', () => {
      process.env.MINICLAW_BAILIAN_API_KEY = 'test-key';
      process.env.MINICLAW_FEISHU_APP_ID = 'cli_test';
      process.env.MINICLAW_FEISHU_APP_SECRET = 'secret';

      const config = loadConfig();

      expect(config.feishu?.appId).toBe('cli_test');
      expect(config.feishu?.appSecret).toBe('secret');
    });

    it('should set feishu to undefined if not configured', () => {
      process.env.MINICLAW_BAILIAN_API_KEY = 'test-key';
      delete process.env.MINICLAW_FEISHU_APP_ID;

      const config = loadConfig();

      expect(config.feishu).toBeUndefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate a valid config', () => {
      const config: Config = {
        bailian: {
          apiKey: 'test-key',
          model: 'qwen-turbo',
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        },
        server: {
          port: 3000,
          host: '0.0.0.0'
        }
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for missing required fields', () => {
      const config = {
        bailian: {
          apiKey: '',
          model: 'qwen-turbo',
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        },
        server: {
          port: 3000,
          host: '0.0.0.0'
        }
      } as Config;

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('bailian.apiKey is required');
    });

    it('should validate port range', () => {
      const config: Config = {
        bailian: {
          apiKey: 'test-key',
          model: 'qwen-turbo',
          baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
        },
        server: {
          port: 70000,
          host: '0.0.0.0'
        }
      };

      const result = validateConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('server.port must be between 1 and 65535');
    });
  });

  describe('getConfigPath', () => {
    it('should return default config path', () => {
      const path = getConfigPath();

      expect(path).toContain('.miniclaw');
    });

    it('should respect MINICLAW_CONFIG_PATH env', () => {
      process.env.MINICLAW_CONFIG_PATH = '/custom/path/config.json';

      const path = getConfigPath();

      expect(path).toBe('/custom/path/config.json');
    });
  });
});