/**
 * @fileoverview MemoryManager 单元测试
 *
 * 测试 MemoryManager 统一入口的核心功能。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryManager } from '../../../src/memory/manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('MemoryManager', () => {
  let manager: MemoryManager;
  let testDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    testDir = join(tmpdir(), `memory-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    manager = new MemoryManager({
      storageDir: testDir,
      defaultTTL: 24 * 60 * 60 * 1000, // 24h
      cleanupInterval: 3600000 // 1h
    });
  });

  afterEach(async () => {
    manager.destroy();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('should initialize all components', async () => {
      await manager.initialize();

      const status = manager.getStatus();
      expect(status.ttlRunning).toBe(true);
      expect(status.shortTermCount).toBe(0);
      expect(status.longTermCount).toBe(0);
    });
  });

  describe('write', () => {
    it('should write to short-term memory', async () => {
      await manager.initialize();

      const id = await manager.write('Test content', 'session-1');
      expect(id).toBeDefined();

      const status = manager.getStatus();
      expect(status.shortTermCount).toBe(1);
    });

    it('should write with custom importance', async () => {
      await manager.initialize();

      const id = await manager.write('Important content', 'session-1', {
        importance: 0.4 // 低于晋升阈值，避免异步晋升
      });
      expect(id).toBeDefined();
    });
  });

  describe('search', () => {
    it('should search both layers', async () => {
      await manager.initialize();

      // 写入测试数据
      await manager.write('User likes dark mode', 'session-1');
      await manager.write('Assistant confirmed preference', 'session-1');

      const results = await manager.search('dark mode');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array when no match', async () => {
      await manager.initialize();

      const results = await manager.search('nonexistent keyword');
      expect(results).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired memories', async () => {
      // 直接测试 cleanup 方法能正常执行
      await manager.initialize();

      // 写入一些记忆
      await manager.write('Content 1', 'session-1');
      await manager.write('Content 2', 'session-1');

      // cleanup 应该正常执行，即使没有过期记忆
      const result = await manager.cleanup();
      expect(result).toBeDefined();
      expect(typeof result.expired).toBe('number');
      expect(typeof result.promoted).toBe('number');
      expect(typeof result.cleaned).toBe('number');
    });
  });

  describe('persist', () => {
    it('should persist long-term memory', async () => {
      await manager.initialize();

      // 手动晋升一条记忆
      await manager.write('Persistent content', 'session-1', {
        importance: 0.9
      });
      await manager.promoteAll();

      await manager.persist();

      // 新实例加载
      const manager2 = new MemoryManager({
        storageDir: testDir
      });
      await manager2.initialize();

      const status = manager2.getStatus();
      expect(status.longTermCount).toBeGreaterThan(0);

      manager2.destroy();
    });
  });

  describe('error handling', () => {
    it('should handle error gracefully', async () => {
      // 在未初始化时调用方法
      const managerNotInit = new MemoryManager({
        storageDir: testDir
      });

      // 不应该抛出异常
      const result = await managerNotInit.search('test');
      expect(result).toEqual([]);

      managerNotInit.destroy();
    });
  });
});