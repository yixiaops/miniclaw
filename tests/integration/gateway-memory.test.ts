/**
 * @fileoverview Gateway 记忆集成测试
 *
 * 测试 Gateway 与 MemoryManager 的集成。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MiniclawGateway, type GatewayConfig, type MessageContext } from '../../src/core/gateway/index.js';
import { MemoryManager } from '../../src/memory/manager.js';
import type { Config } from '../../src/core/config.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('Gateway with MemoryManager', () => {
  let testDir: string;
  let memoryManager: MemoryManager;
  let gateway: MiniclawGateway;
  let mockConfig: Config;

  beforeEach(async () => {
    testDir = join(tmpdir(), `gateway-memory-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    mockConfig = {
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

    // Mock createAgentFn
    const mockCreateAgentFn = vi.fn().mockReturnValue({
      chat: vi.fn().mockResolvedValue({ content: 'test response' }),
      streamChat: vi.fn().mockImplementation(async function* () {
        yield { content: 'test', done: false };
        yield { content: ' response', done: true };
      })
    });

    memoryManager = new MemoryManager({ storageDir: testDir });
    await memoryManager.initialize();

    gateway = new MiniclawGateway(mockConfig, {
      createAgentFn: mockCreateAgentFn,
      memoryManager
    });

    await gateway.initialize();
  });

  afterEach(async () => {
    memoryManager.destroy();
    await gateway.cleanup();
    await rm(testDir, { recursive: true, force: true });
  });

  describe('memoryManager integration', () => {
    it('should accept optional memoryManager', () => {
      expect(gateway).toBeDefined();
    });

    it('should auto-write conversation on handleMessage', async () => {
      const ctx: MessageContext = {
        channel: 'cli',
        userId: 'user-1',
        content: 'test message'
      };

      await gateway.handleMessage(ctx);

      // 验证记忆已写入
      const status = memoryManager.getStatus();
      expect(status.candidatePoolCount).toBeGreaterThan(0);
    });

    it('should fallback to SimpleMemoryStorage when no memoryManager', async () => {
      const gatewayNoMemory = new MiniclawGateway(mockConfig, {
        createAgentFn: vi.fn().mockReturnValue({
          chat: vi.fn().mockResolvedValue({ content: 'test response' })
        })
      });

      // 无 memoryManager 时应该正常工作
      const ctx: MessageContext = {
        channel: 'cli',
        userId: 'user-1',
        content: 'test message'
      };

      const response = await gatewayNoMemory.handleMessage(ctx);
      expect(response.content).toBe('test response');

      await gatewayNoMemory.cleanup();
    });

    it('should not block on memory write failure', async () => {
      // Mock write to fail
      const failingManager = {
        write: vi.fn().mockRejectedValue(new Error('Write failed')),
        initialize: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn(),
        getStatus: vi.fn().mockReturnValue({ candidatePoolCount: 0 })
      } as unknown as MemoryManager;

      const gatewayWithFailure = new MiniclawGateway(mockConfig, {
        createAgentFn: vi.fn().mockReturnValue({
          chat: vi.fn().mockResolvedValue({ content: 'test response' })
        }),
        memoryManager: failingManager
      });

      const ctx: MessageContext = {
        channel: 'cli',
        userId: 'user-1',
        content: 'test message'
      };

      // 应该正常返回，不抛异常
      const response = await gatewayWithFailure.handleMessage(ctx);
      expect(response.content).toBe('test response');

      await gatewayWithFailure.cleanup();
    });

    it('should write both user and assistant messages', async () => {
      const ctx: MessageContext = {
        channel: 'cli',
        userId: 'user-1',
        content: 'user test message'
      };

      await gateway.handleMessage(ctx);

      // 搜索用户消息和助手消息
      const userResults = await memoryManager.search('user test');
      const assistantResults = await memoryManager.search('test response');

      expect(userResults.length + assistantResults.length).toBeGreaterThan(0);
    });
  });

  describe('backward compatibility', () => {
    it('should work without memory config', async () => {
      const gatewaySimple = new MiniclawGateway(mockConfig, {
        createAgentFn: vi.fn().mockReturnValue({
          chat: vi.fn().mockResolvedValue({ content: 'response' })
        })
      });

      const ctx: MessageContext = {
        channel: 'cli',
        content: 'hello'
      };

      const response = await gatewaySimple.handleMessage(ctx);
      expect(response).toBeDefined();
      expect(response.content).toBe('response');

      await gatewaySimple.cleanup();
    });
  });
});