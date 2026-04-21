/**
 * @fileoverview SoulLoader 单元测试
 *
 * 测试 soul.md 文件加载、默认内容、路径处理。
 *
 * @module tests/unit/soul/loader
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { SoulLoader, DEFAULT_SOUL } from '../../../src/soul/loader.js';

describe('SoulLoader', () => {
  const testDir = path.join(os.homedir(), '.miniclaw-test');
  const testSoulFile = path.join(testDir, 'soul.md');

  beforeAll(() => {
    // 创建测试目录
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // 清理测试文件
    if (fs.existsSync(testSoulFile)) {
      fs.unlinkSync(testSoulFile);
    }
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir);
    }
  });

  describe('T018: file exists scenario', () => {
    it('should load custom soul file when exists', async () => {
      // 写入自定义 soul 文件
      const customContent = '# Custom Soul\n## AI 人格\n自定义人格\n';
      fs.writeFileSync(testSoulFile, customContent);

      const loader = new SoulLoader({ filePath: testSoulFile });
      const content = await loader.load();

      expect(content).toBe(customContent);
    });

    it('should handle ~ path expansion', async () => {
      // 使用 ~ 路径
      const tildePath = path.join('~', '.miniclaw-test', 'soul.md').replace(os.homedir(), '~');
      const customContent = '# Custom Soul\n';
      fs.writeFileSync(testSoulFile, customContent);

      const loader = new SoulLoader({ filePath: tildePath });
      const content = await loader.load();

      expect(content).toBe(customContent);
    });
  });

  describe('T019: file not exists scenario', () => {
    it('should return DEFAULT_SOUL when file not exists', async () => {
      const loader = new SoulLoader({ filePath: '/nonexistent/path/soul.md' });
      const content = await loader.load();

      expect(content).toBe(DEFAULT_SOUL);
      expect(content).toContain('[IMPORTANCE:X]');
    });

    it('should return DEFAULT_SOUL when filePath is empty directory', async () => {
      const emptyDir = path.join(testDir, 'empty');
      if (!fs.existsSync(emptyDir)) {
        fs.mkdirSync(emptyDir, { recursive: true });
      }

      const loader = new SoulLoader({ filePath: path.join(emptyDir, 'soul.md') });
      const content = await loader.load();

      expect(content).toBe(DEFAULT_SOUL);

      // 清理
      fs.rmdirSync(emptyDir);
    });
  });

  describe('T020: getDefault()', () => {
    it('should return DEFAULT_SOUL content', () => {
      const loader = new SoulLoader();
      const defaultContent = loader.getDefault();

      expect(defaultContent).toBe(DEFAULT_SOUL);
      expect(defaultContent).toContain('Miniclaw Soul');
      expect(defaultContent).toContain('[IMPORTANCE:X]');
    });

    it('DEFAULT_SOUL should contain required sections', () => {
      expect(DEFAULT_SOUL).toContain('## AI 人格');
      expect(DEFAULT_SOUL).toContain('## 爱好');
      expect(DEFAULT_SOUL).toContain('## 核心规则');
      expect(DEFAULT_SOUL).toContain('[IMPORTANCE:X]');
    });
  });

  describe('enabled config', () => {
    it('should return empty string when disabled', async () => {
      const loader = new SoulLoader({ enabled: false });
      const content = await loader.load();

      expect(content).toBe('');
    });

    it('should load content when enabled', async () => {
      const loader = new SoulLoader({ enabled: true, filePath: testSoulFile });
      const customContent = '# Test\n';
      fs.writeFileSync(testSoulFile, customContent);

      const content = await loader.load();

      expect(content).toBe(customContent);
    });
  });

  describe('config', () => {
    it('should use default config when not provided', () => {
      const loader = new SoulLoader();
      const config = loader.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.filePath).toContain('.miniclaw');
    });

    it('should accept custom config', () => {
      const loader = new SoulLoader({
        filePath: '/custom/path/soul.md',
        enabled: false
      });
      const config = loader.getConfig();

      expect(config.filePath).toBe('/custom/path/soul.md');
      expect(config.enabled).toBe(false);
    });
  });
});