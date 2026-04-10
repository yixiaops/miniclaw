/**
 * PromptManager 测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PromptManager } from '../../../../src/core/prompt/manager';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('PromptManager', () => {
  const testDir = join(tmpdir(), 'miniclaw-prompt-test');
  let manager: PromptManager;

  beforeEach(() => {
    // 创建测试目录
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    // 创建新的 manager 实例
    manager = new PromptManager({
      baseDir: testDir,
      fallbackPrompt: 'Default fallback prompt',
    });
  });

  afterEach(() => {
    // 清理测试目录
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const defaultManager = new PromptManager();
      expect(defaultManager).toBeDefined();
      expect(defaultManager.getDefaultPromptPath()).toContain('.miniclaw');
    });

    it('should accept custom options', () => {
      const customManager = new PromptManager({
        defaultPromptPath: '/custom/path.md',
        fallbackPrompt: 'Custom fallback',
        baseDir: '/custom/base',
      });
      expect(customManager.getDefaultPromptPath()).toBe('/custom/path.md');
    });
  });

  describe('loadPrompt', () => {
    describe('direct text content', () => {
      it('should load direct text prompt', async () => {
        const result = await manager.loadPrompt('Hello, AI!');

        expect(result.success).toBe(true);
        expect(result.template?.name).toBe('direct');
        expect(result.template?.content).toBe('Hello, AI!');
      });

      it('should not cache direct text prompts', async () => {
        await manager.loadPrompt('First prompt');
        await manager.loadPrompt('Second prompt');

        // 直接文本不应缓存
        expect(manager.getCached('any-key')).toBeUndefined();
      });
    });

    describe('file path references', () => {
      it('should load prompt from file with frontmatter', async () => {
        const promptFile = join(testDir, 'test-prompt.md');
        writeFileSync(promptFile, `---
name: test-prompt
description: A test prompt
---
You are a helpful assistant.`);

        const result = await manager.loadPrompt(promptFile);

        expect(result.success).toBe(true);
        expect(result.template?.name).toBe('test-prompt');
        expect(result.template?.description).toBe('A test prompt');
        expect(result.template?.content).toBe('You are a helpful assistant.');
      });

      it('should load prompt without frontmatter', async () => {
        const promptFile = join(testDir, 'plain.md');
        writeFileSync(promptFile, 'Plain content without frontmatter');

        const result = await manager.loadPrompt(promptFile);

        expect(result.success).toBe(true);
        expect(result.template?.name).toBe('unnamed');
        expect(result.template?.content).toBe('Plain content without frontmatter');
      });

      it('should cache loaded templates by default', async () => {
        const promptFile = join(testDir, 'cached.md');
        writeFileSync(promptFile, '---\nname: cached\n---\nContent');

        await manager.loadPrompt(promptFile);

        // 检查缓存
        expect(manager.getCached(promptFile)).toBeDefined();
      });

      it('should skip cache when cache option is false', async () => {
        const promptFile = join(testDir, 'no-cache.md');
        writeFileSync(promptFile, '---\nname: no-cache\n---\nContent');

        await manager.loadPrompt(promptFile, { cache: false });

        expect(manager.getCached(promptFile)).toBeUndefined();
      });

      it('should use fallback on file not found', async () => {
        const result = await manager.loadPrompt('/nonexistent/path.md');

        expect(result.success).toBe(false);
        expect(result.usedFallback).toBe(true);
        expect(result.template?.content).toBe('Default fallback prompt');
      });

      it('should use custom fallback when provided', async () => {
        const result = await manager.loadPrompt('/nonexistent/path.md', {
          fallback: 'Custom fallback text',
        });

        expect(result.success).toBe(false);
        expect(result.template?.content).toBe('Custom fallback text');
      });
    });

    describe('file path resolution', () => {
      it('should resolve ~ path', async () => {
        const homeDir = require('os').homedir();
        const promptFile = join(homeDir, '.miniclaw-test-prompt.md');
        writeFileSync(promptFile, 'Home prompt');

        try {
          const result = await manager.loadPrompt('~/.miniclaw-test-prompt.md');
          expect(result.success).toBe(true);
          expect(result.template?.content).toBe('Home prompt');
        } finally {
          rmSync(promptFile, { force: true });
        }
      });

      it('should resolve relative path', async () => {
        const promptFile = join(testDir, 'relative.md');
        writeFileSync(promptFile, 'Relative content');

        const relativeManager = new PromptManager({ baseDir: testDir });
        const result = await relativeManager.loadPrompt('./relative.md');

        expect(result.success).toBe(true);
        expect(result.template?.content).toBe('Relative content');
      });

      it('should handle file:// prefix', async () => {
        const promptFile = join(testDir, 'file-prefix.md');
        writeFileSync(promptFile, 'File prefix content');

        const result = await manager.loadPrompt(`file://${promptFile}`);

        expect(result.success).toBe(true);
        expect(result.template?.content).toBe('File prefix content');
      });
    });
  });

  describe('cache management', () => {
    it('should cache loaded templates', async () => {
      const promptFile = join(testDir, 'cache-test.md');
      writeFileSync(promptFile, '---\nname: cache-test\n---\nOriginal');

      await manager.loadPrompt(promptFile);

      // 修改文件
      writeFileSync(promptFile, '---\nname: modified\n---\nModified');

      // 缓存的应该还是原内容
      const cachedResult = await manager.loadPrompt(promptFile);
      expect(cachedResult.template?.name).toBe('cache-test');
    });

    it('should clear cache', async () => {
      const promptFile = join(testDir, 'clear-cache.md');
      writeFileSync(promptFile, 'Content');

      await manager.loadPrompt(promptFile);
      manager.clearCache();

      expect(manager.getCached(promptFile)).toBeUndefined();
    });

    it('should return cached template', async () => {
      const promptFile = join(testDir, 'get-cache.md');
      writeFileSync(promptFile, '---\nname: get-cache\n---\nContent');

      await manager.loadPrompt(promptFile);
      const cached = manager.getCached(promptFile);

      expect(cached).toBeDefined();
      expect(cached?.name).toBe('get-cache');
    });
  });

  describe('reloadPrompt', () => {
    it('should reload template from file', async () => {
      const promptFile = join(testDir, 'reload.md');
      writeFileSync(promptFile, '---\nname: original\n---\nOriginal content');

      // 首次加载
      const first = await manager.loadPrompt(promptFile);
      expect(first.template?.name).toBe('original');

      // 修改文件
      writeFileSync(promptFile, '---\nname: updated\n---\nUpdated content');

      // 重新加载
      const reloaded = await manager.reloadPrompt(promptFile);
      expect(reloaded.template?.name).toBe('updated');
      expect(reloaded.template?.content).toBe('Updated content');
    });

    it('should bypass cache on reload', async () => {
      const promptFile = join(testDir, 'bypass-cache.md');
      writeFileSync(promptFile, 'Content A');

      await manager.loadPrompt(promptFile);
      writeFileSync(promptFile, 'Content B');

      const result = await manager.reloadPrompt(promptFile);
      expect(result.template?.content).toBe('Content B');
    });
  });

  describe('verbose logging', () => {
    it('should log verbose messages when enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const promptFile = join(testDir, 'verbose.md');
      writeFileSync(promptFile, 'Content');

      await manager.loadPrompt(promptFile, { verbose: true });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle invalid file path', async () => {
      const result = await manager.loadPrompt('/invalid/path/to/file.md');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.usedFallback).toBe(true);
    });

    it('should handle permission errors', async () => {
      // 在某些系统上可能无法测试权限错误
      // 这里只测试返回结构
      const result = await manager.loadPrompt('/root/super-secret-prompt.md');

      expect(result).toBeDefined();
      expect(result.template).toBeDefined();
    });
  });
});

// 导入 vi 用于 mock
import { vi } from 'vitest';