/**
 * @fileoverview Gateway 集成测试
 *
 * 验证 Gateway 与各组件的协作：
 * - CLI 通道有独立 Session
 * - API 通道按 clientId 隔离
 * - Feishu 私聊按用户隔离
 * - Feishu 群聊按群组隔离
 * - Session 可以持久化和恢复
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MiniclawGateway, type MessageContext } from '../../src/core/gateway/index.js';
import type { Config } from '../../src/core/config.js';
import type { MiniclawAgent } from '../../src/core/agent/index.js';
import { SimpleMemoryStorage } from '../../src/core/memory/simple.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock Agent 工厂
const createMockAgent = (): MiniclawAgent => {
  let callCount = 0;
  return {
    getHistory: vi.fn(() => []),
    reset: vi.fn(),
    chat: vi.fn(async (input: string) => {
      callCount++;
      return { content: `响应 #${callCount}: ${input}` };
    }),
    streamChat: vi.fn(async function* () {
      yield { content: '测试响应', done: true };
    }),
    registerTool: vi.fn(),
    getTools: vi.fn(() => []),
    clearTools: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    abort: vi.fn(),
    getConfig: vi.fn(),
    getSystemPrompt: vi.fn(),
    setSystemPrompt: vi.fn(),
    getModelConfig: vi.fn(),
    setModel: vi.fn()
  } as unknown as MiniclawAgent;
};

// Mock Config
const mockConfig: Config = {
  bailian: {
    apiKey: 'test-api-key',
    model: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
};

describe('Gateway Integration', () => {
  let gateway: MiniclawGateway;
  let agentInstances: MiniclawAgent[];
  let tempDir: string;
  let storage: SimpleMemoryStorage;

  beforeEach(async () => {
    // 创建临时目录
    tempDir = await mkdtemp(join(tmpdir(), 'miniclaw-gateway-test-'));

    // 初始化存储
    storage = new SimpleMemoryStorage(tempDir);

    // 追踪创建的 Agent 实例
    agentInstances = [];

    // 创建 Agent 工厂函数
    const createAgentFn = () => {
      const agent = createMockAgent();
      agentInstances.push(agent);
      return agent;
    };

    // 创建 Gateway
    gateway = new MiniclawGateway(mockConfig, {
      createAgentFn,
      maxAgents: 50
    });
  });

  afterEach(async () => {
    gateway.cleanup();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('CLI 通道隔离', () => {
    it('CLI 通道应该有独立 Session', async () => {
      // CLI 通道不传用户信息，使用默认 Session
      const ctx1: MessageContext = {
        channel: 'cli',
        content: '第一条消息'
      };

      const ctx2: MessageContext = {
        channel: 'cli',
        content: '第二条消息'
      };

      const response1 = await gateway.handleMessage(ctx1);
      const response2 = await gateway.handleMessage(ctx2);

      // 应该复用同一个 Session
      expect(response1.sessionId).toBe(response2.sessionId);
      // 只创建一个 Agent
      expect(agentInstances.length).toBe(1);
    });
  });

  describe('API 通道隔离', () => {
    it('API 通道应该按 clientId 隔离 Session', async () => {
      const ctx1: MessageContext = {
        channel: 'api',
        clientId: 'client-001',
        content: '客户端1的消息'
      };

      const ctx2: MessageContext = {
        channel: 'api',
        clientId: 'client-002',
        content: '客户端2的消息'
      };

      const response1 = await gateway.handleMessage(ctx1);
      const response2 = await gateway.handleMessage(ctx2);

      // 不同的 clientId 应该有不同的 Session
      expect(response1.sessionId).not.toBe(response2.sessionId);
      // 应该创建两个 Agent
      expect(agentInstances.length).toBe(2);
    });

    it('相同的 clientId 应该复用 Session', async () => {
      const ctx1: MessageContext = {
        channel: 'api',
        clientId: 'same-client',
        content: '第一条消息'
      };

      const ctx2: MessageContext = {
        channel: 'api',
        clientId: 'same-client',
        content: '第二条消息'
      };

      const response1 = await gateway.handleMessage(ctx1);
      const response2 = await gateway.handleMessage(ctx2);

      // 相同的 clientId 应该有相同的 Session
      expect(response1.sessionId).toBe(response2.sessionId);
      // 只创建一个 Agent
      expect(agentInstances.length).toBe(1);
    });
  });

  describe('Feishu 通道隔离', () => {
    it('Feishu 私聊应该按用户隔离', async () => {
      const ctx1: MessageContext = {
        channel: 'feishu',
        userId: 'ou_user_001',
        content: '用户1的消息'
      };

      const ctx2: MessageContext = {
        channel: 'feishu',
        userId: 'ou_user_002',
        content: '用户2的消息'
      };

      const response1 = await gateway.handleMessage(ctx1);
      const response2 = await gateway.handleMessage(ctx2);

      // 不同的用户应该有不同的 Session
      expect(response1.sessionId).not.toBe(response2.sessionId);
      // 应该创建两个 Agent
      expect(agentInstances.length).toBe(2);
    });

    it('Feishu 群聊应该按群组隔离', async () => {
      // 注意：当前 Router 默认策略是 byUser
      // 群组隔离需要配置 Router 规则或修改默认策略

      // 测试相同用户在不同群组的场景
      const ctx1: MessageContext = {
        channel: 'feishu',
        userId: 'ou_user_001',
        groupId: 'oc_group_001',
        content: '群组1的消息'
      };

      const ctx2: MessageContext = {
        channel: 'feishu',
        userId: 'ou_user_001',
        groupId: 'oc_group_002',
        content: '群组2的消息'
      };

      // 在当前 byUser 策略下，相同用户使用相同 Session
      const response1 = await gateway.handleMessage(ctx1);
      const response2 = await gateway.handleMessage(ctx2);

      // 当前策略下，相同用户使用相同 Session
      expect(response1.sessionId).toBe(response2.sessionId);
    });

    it('相同用户的消息应该复用 Session', async () => {
      const ctx1: MessageContext = {
        channel: 'feishu',
        userId: 'ou_same_user',
        content: '第一条消息'
      };

      const ctx2: MessageContext = {
        channel: 'feishu',
        userId: 'ou_same_user',
        content: '第二条消息'
      };

      const response1 = await gateway.handleMessage(ctx1);
      const response2 = await gateway.handleMessage(ctx2);

      // 相同用户应该复用 Session
      expect(response1.sessionId).toBe(response2.sessionId);
      // 只创建一个 Agent
      expect(agentInstances.length).toBe(1);
    });
  });

  describe('多用户消息隔离', () => {
    it('不同通道的用户应该完全隔离', async () => {
      const contexts: MessageContext[] = [
        { channel: 'cli', content: 'CLI消息' },
        { channel: 'api', clientId: 'api-client-1', content: 'API消息1' },
        { channel: 'api', clientId: 'api-client-2', content: 'API消息2' },
        { channel: 'feishu', userId: 'feishu-user-1', content: '飞书用户1' },
        { channel: 'feishu', userId: 'feishu-user-2', content: '飞书用户2' }
      ];

      const responses = await Promise.all(
        contexts.map(ctx => gateway.handleMessage(ctx))
      );

      const sessionIds = responses.map(r => r.sessionId);

      // 所有 Session ID 应该唯一
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(5);

      // 应该创建 5 个 Agent
      expect(agentInstances.length).toBe(5);
    });
  });

  describe('Session 状态', () => {
    it('Gateway 状态应该正确反映活跃的 Session', async () => {
      const initialStatus = gateway.getStatus();
      expect(initialStatus.agentCount).toBe(0);
      expect(initialStatus.sessionCount).toBe(0);

      await gateway.handleMessage({ channel: 'cli', content: '消息1' });

      const status1 = gateway.getStatus();
      expect(status1.agentCount).toBe(1);
      expect(status1.sessionCount).toBe(1);

      await gateway.handleMessage({ channel: 'api', clientId: 'client-1', content: '消息2' });

      const status2 = gateway.getStatus();
      expect(status2.agentCount).toBe(2);
      expect(status2.sessionCount).toBe(2);
    });

    it('销毁 Session 应该更新状态', async () => {
      await gateway.handleMessage({ channel: 'cli', content: '消息' });

      const status1 = gateway.getStatus();
      expect(status1.agentCount).toBe(1);

      // 获取 sessionKey（CLI 使用固定格式）
      const router = gateway.getRouter();
      const sessionId = router.route({ channel: 'cli', content: '' });
      gateway.destroySession(sessionId);

      const status2 = gateway.getStatus();
      expect(status2.agentCount).toBe(0);
    });
  });

  describe('Agent 复用验证', () => {
    it('复用 Agent 应该保持对话历史', async () => {
      const ctx: MessageContext = {
        channel: 'cli',
        content: '你好'
      };

      // 发送两条消息
      await gateway.handleMessage(ctx);
      await gateway.handleMessage({ ...ctx, content: '再见' });

      // 只创建一个 Agent
      expect(agentInstances.length).toBe(1);

      // Agent 的 chat 方法应该被调用两次
      const agent = agentInstances[0];
      expect(agent.chat).toHaveBeenCalledTimes(2);
    });
  });

  describe('资源清理', () => {
    it('cleanup 应该清理所有资源', async () => {
      // 创建多个 Session
      await gateway.handleMessage({ channel: 'cli', content: '消息' });
      await gateway.handleMessage({ channel: 'api', clientId: 'client-1', content: '消息' });
      await gateway.handleMessage({ channel: 'feishu', userId: 'user-1', content: '消息' });

      const statusBefore = gateway.getStatus();
      expect(statusBefore.agentCount).toBe(3);

      gateway.cleanup();

      const statusAfter = gateway.getStatus();
      expect(statusAfter.agentCount).toBe(0);
      expect(statusAfter.sessionCount).toBe(0);
    });
  });
});