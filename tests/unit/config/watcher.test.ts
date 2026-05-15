/**
 * ConfigWatcher 单元测试
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigWatcher, type ConfigChangeEvent } from '../../../src/config/watcher.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'fs';

// Mock chokidar to avoid actual file watching in tests
vi.mock('chokidar', () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn(() => {}),
      close: vi.fn(),
    })),
  },
}));

describe('ConfigWatcher', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'config-watcher-test-'));
    configPath = join(tempDir, 'config.json');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('应该使用默认配置路径', () => {
      const watcher = new ConfigWatcher();
      expect(watcher).toBeDefined();
    });

    it('应该接受自定义配置路径', () => {
      const watcher = new ConfigWatcher({ configPath });
      expect(watcher).toBeDefined();
    });

    it('应该接受禁用选项', () => {
      const watcher = new ConfigWatcher({ enabled: false });
      expect(watcher).toBeDefined();
    });
  });

  describe('start/stop', () => {
    it('禁用时应该不启动监听', async () => {
      const watcher = new ConfigWatcher({ enabled: false });
      await watcher.start();
      // 应该不抛错
      watcher.stop();
    });

    it('配置文件不存在时应该跳过监听', async () => {
      const watcher = new ConfigWatcher({ configPath: join(tempDir, 'not-exist.json') });
      await watcher.start();
      // 应该不抛错
      watcher.stop();
    });
  });

  describe('loadConfig', () => {
    it('应该加载有效配置', async () => {
      const config = {
        bailian: {
          apiKey: 'test-key',
          baseUrl: 'https://test.com',
          model: 'test-model',
        },
      };
      writeFileSync(configPath, JSON.stringify(config));

      const watcher = new ConfigWatcher({ configPath });
      const loaded = await watcher.reload();

      expect(loaded).toBeDefined();
      expect(loaded?.bailian.apiKey).toBe('test-key');
    });

    it('应该处理无效 JSON', async () => {
      writeFileSync(configPath, 'invalid json');

      const watcher = new ConfigWatcher({ configPath });
      const loaded = await watcher.reload();

      expect(loaded).toBeUndefined();
    });

    it('应该处理文件不存在', async () => {
      const watcher = new ConfigWatcher({ configPath: join(tempDir, 'not-exist.json') });
      const loaded = await watcher.reload();

      expect(loaded).toBeUndefined();
    });
  });

  describe('getLastConfig', () => {
    it('应该返回最后加载的配置', async () => {
      const config = {
        bailian: {
          apiKey: 'test-key',
          baseUrl: 'https://test.com',
          model: 'test-model',
        },
      };
      writeFileSync(configPath, JSON.stringify(config));

      const watcher = new ConfigWatcher({ configPath, enabled: true });
      const loaded = await watcher.reload();

      expect(loaded).toBeDefined();
      expect(loaded?.bailian?.apiKey).toBe('test-key');

      const last = watcher.getLastConfig();
      expect(last?.bailian?.apiKey).toBe('test-key');
    });

    it('未加载时应该返回 undefined', () => {
      const watcher = new ConfigWatcher({ configPath });
      const last = watcher.getLastConfig();
      expect(last).toBeUndefined();
    });
  });

  describe('detectChanges', () => {
    it('应该检测新增 Agent', async () => {
      const oldConfig = {
        bailian: { apiKey: 'key', baseUrl: 'url', model: 'model' },
        agents: { list: [{ id: 'main' }] as any[], defaults: {} },
      };
      const newConfig = {
        bailian: { apiKey: 'key', baseUrl: 'url', model: 'model' },
        agents: { list: [{ id: 'main' }, { id: 'etf' }] as any[], defaults: {} },
      };

      writeFileSync(configPath, JSON.stringify(newConfig));

      const watcher = new ConfigWatcher({ configPath });
      watcher['lastConfig'] = oldConfig;

      await watcher.reload();

      // 使用私有方法检测变化（仅用于验证逻辑）
      const changes = watcher['detectChanges'](oldConfig, newConfig);
      expect(changes.added.length).toBe(1);
      expect(changes.added[0].id).toBe('etf');
    });

    it('应该检测移除 Agent', () => {
      const watcher = new ConfigWatcher({ configPath });
      const oldConfig = {
        bailian: { apiKey: 'key', baseUrl: 'url', model: 'model' },
        agents: { list: [{ id: 'main' }, { id: 'etf' }] as any[], defaults: {} },
      };
      const newConfig = {
        bailian: { apiKey: 'key', baseUrl: 'url', model: 'model' },
        agents: { list: [{ id: 'main' }] as any[], defaults: {} },
      };

      const changes = watcher['detectChanges'](oldConfig, newConfig);
      expect(changes.removed).toContain('etf');
    });

    it('应该检测修改 Agent', () => {
      const watcher = new ConfigWatcher({ configPath });
      const oldConfig = {
        bailian: { apiKey: 'key', baseUrl: 'url', model: 'model' },
        agents: { list: [{ id: 'main', model: 'model-a' }] as any[], defaults: {} },
      };
      const newConfig = {
        bailian: { apiKey: 'key', baseUrl: 'url', model: 'model' },
        agents: { list: [{ id: 'main', model: 'model-b' }] as any[], defaults: {} },
      };

      const changes = watcher['detectChanges'](oldConfig, newConfig);
      expect(changes.modified).toContain('main');
    });

    it('无变化时应该返回空数组', () => {
      const watcher = new ConfigWatcher({ configPath });
      const config = {
        bailian: { apiKey: 'key', baseUrl: 'url', model: 'model' },
        agents: { list: [{ id: 'main' }] as any[], defaults: {} },
      };

      const changes = watcher['detectChanges'](config, config);
      expect(changes.added).toHaveLength(0);
      expect(changes.removed).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
    });
  });

  describe('onChange callback', () => {
    it('应该在配置变化时触发回调', async () => {
      const config = {
        bailian: { apiKey: 'key', baseUrl: 'url', model: 'model' },
      };

      writeFileSync(configPath, JSON.stringify(config));

      const events: ConfigChangeEvent[] = [];
      const watcher = new ConfigWatcher({
        configPath,
        onChange: (event) => events.push(event),
      });

      await watcher.reload();

      // 手动触发 change 处理（因为 chokidar mocked）
      await watcher['processChange'](configPath, 'change');

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('change');
      expect(events[0].config).toBeDefined();
    });
  });
});