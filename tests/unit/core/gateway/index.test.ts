/**
 * @fileoverview MiniclawGateway 单元测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Config } from '../../../../src/core/config.js';
import type { MiniclawAgent } from '../../../../src/core/agent/index.js';

// Mock MiniclawAgent
const createMockAgent = (): MiniclawAgent => {
  return {
    getHistory: vi.fn(() => []),
    reset: vi.fn(),
    chat: vi.fn(async () => ({ content: '测试响应' })),
    streamChat: vi.fn(async function* () {
      yield { content: '测试', done: false };
      yield { content: '响应', done: false };
      yield { done: true };
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

describe('MiniclawGateway', () => {
  let MiniclawGateway: typeof import('../../../../src/core/gateway/index.js').MiniclawGateway;
  let MessageContext: typeof import('../../../../src/core/gateway/index.js').MessageContext;
  let gateway: InstanceType<typeof MiniclawGateway>;
  let createAgentFn: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // 动态导入模块
    const gatewayModule = await import('../../../../src/core/gateway/index.js');
    MiniclawGateway = gatewayModule.MiniclawGateway;
    MessageContext = gatewayModule.MessageContext;

    createAgentFn = vi.fn(() => createMockAgent());
    gateway = new MiniclawGateway(mockConfig, { createAgentFn });
  });

  afterEach(async () => {
    await gateway.cleanup();
  });

  describe('handleMessage', () => {
    it('应该正确路由消息到 Session', async () => {
      const ctx = {
        channel: 'cli',
        content: '你好'
      };

      const response = await gateway.handleMessage(ctx);

      expect(response).toBeDefined();
      expect(response.content).toBe('测试响应');
    });

    it('应该复用已存在的 Session', async () => {
      const ctx1 = {
        channel: 'cli',
        content: '第一条消息'
      };

      const ctx2 = {
        channel: 'cli',
        content: '第二条消息'
      };

      await gateway.handleMessage(ctx1);
      await gateway.handleMessage(ctx2);

      // CLI 通道应该使用相同的 session，所以只创建一个 agent
      expect(createAgentFn).toHaveBeenCalledTimes(1);
    });

    it('应该为新用户创建新 Session', async () => {
      const ctx1 = {
        channel: 'feishu',
        userId: 'user-1',
        content: '你好'
      };

      const ctx2 = {
        channel: 'feishu',
        userId: 'user-2',
        content: '你好'
      };

      await gateway.handleMessage(ctx1);
      await gateway.handleMessage(ctx2);

      // 不同用户应该创建不同的 agent
      expect(createAgentFn).toHaveBeenCalledTimes(2);
    });

    it('应该为群组创建隔离的 Session（byGroup 策略）', async () => {
      // 创建新的 mock 函数和 gateway
      const groupCreateAgentFn = vi.fn(() => createMockAgent());
      const gatewayWithGroupStrategy = new MiniclawGateway(mockConfig, {
        createAgentFn: groupCreateAgentFn
      });

      const ctx1 = {
        channel: 'feishu',
        userId: 'user-1',
        groupId: 'group-1',
        content: '你好'
      };

      const ctx2 = {
        channel: 'feishu',
        userId: 'user-2',
        groupId: 'group-1',
        content: '你好'
      };

      await gatewayWithGroupStrategy.handleMessage(ctx1);
      await gatewayWithGroupStrategy.handleMessage(ctx2);

      // 默认 byUser 策略下，不同用户会创建不同的 agent
      expect(groupCreateAgentFn).toHaveBeenCalledTimes(2);

      await gatewayWithGroupStrategy.cleanup();
    });

    it('应该传递正确的上下文给 Agent', async () => {
      const ctx = {
        channel: 'cli',
        content: '测试消息'
      };

      await gateway.handleMessage(ctx);

      // 验证 createAgentFn 被调用时传递了正确的参数
      // 新签名: (sessionKey, config, agentId, agentConfig, isSubagent)
      expect(createAgentFn).toHaveBeenCalledWith(
        expect.any(String),
        mockConfig,
        'main',
        undefined,
        false  // isSubagent = false for main agent
      );
    });
  });

  describe('getStatus', () => {
    it('应该返回正确的状态', () => {
      const status = gateway.getStatus();

      expect(status).toHaveProperty('agentCount');
      expect(status).toHaveProperty('sessionCount');
      expect(status.agentCount).toBe(0);
      expect(status.sessionCount).toBe(0);
    });

    it('应该在处理消息后更新状态', async () => {
      const ctx = {
        channel: 'cli',
        content: '你好'
      };

      await gateway.handleMessage(ctx);

      const status = gateway.getStatus();
      expect(status.agentCount).toBe(1);
      expect(status.sessionCount).toBe(1);
    });
  });

  describe('cleanup', () => {
    it('应该清理所有资源', async () => {
      const ctx = {
        channel: 'cli',
        content: '你好'
      };

      await gateway.handleMessage(ctx);
      await gateway.cleanup();

      const status = gateway.getStatus();
      expect(status.agentCount).toBe(0);
      expect(status.sessionCount).toBe(0);
    });
  });

  describe('destroySession', () => {
    it('应该销毁指定的 Session', async () => {
      const ctx = {
        channel: 'cli',
        content: '你好'
      };

      await gateway.handleMessage(ctx);
      gateway.destroySession('session-cli');

      const status = gateway.getStatus();
      expect(status.agentCount).toBe(0);
      expect(status.sessionCount).toBe(0);
    });
  });

  describe('initialize', () => {
    it('应该从存储加载 Session 历史', async () => {
      // 创建带有自定义存储目录的 gateway
      const initCreateAgentFn = vi.fn(() => createMockAgent());
      const initGateway = new MiniclawGateway(mockConfig, {
        createAgentFn: initCreateAgentFn,
        storageDir: '/tmp/miniclaw-test-init'
      });

      // 先创建一个 session 并保存消息
      await initGateway.handleMessage({ channel: 'cli', content: 'test message' });

      // 清理资源但保留存储
      await initGateway.cleanup();

      // 创建新的 gateway 实例来模拟重启
      const newCreateAgentFn = vi.fn(() => createMockAgent());
      const newGateway = new MiniclawGateway(mockConfig, {
        createAgentFn: newCreateAgentFn,
        storageDir: '/tmp/miniclaw-test-init'
      });

      // 初始化应该加载之前的 session
      await newGateway.initialize();

      const status = newGateway.getStatus();
      expect(status.sessionCount).toBe(1);

      await newGateway.cleanup();
    });

    it('应该处理空存储', async () => {
      const emptyCreateAgentFn = vi.fn(() => createMockAgent());
      const emptyGateway = new MiniclawGateway(mockConfig, {
        createAgentFn: emptyCreateAgentFn,
        storageDir: '/tmp/miniclaw-test-empty-' + Date.now()
      });

      // 初始化空存储
      await emptyGateway.initialize();

      const status = emptyGateway.getStatus();
      expect(status.sessionCount).toBe(0);

      await emptyGateway.cleanup();
    });
  });

  describe('streamHandleMessage', () => {
    it('应该流式处理消息', async () => {
      const ctx = {
        channel: 'cli',
        content: '你好'
      };

      const events = [];
      for await (const event of gateway.streamHandleMessage(ctx)) {
        events.push(event);
      }

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('sessionId');
      expect(events[events.length - 1].done).toBe(true);
    });

    it('应该在流式处理中记录消息历史', async () => {
      const ctx = {
        channel: 'cli',
        content: '测试流式消息'
      };

      // 消费流
      for await (const _ of gateway.streamHandleMessage(ctx)) {
        // 消费所有事件
      }

      // 验证 session 状态
      const status = gateway.getStatus();
      expect(status.sessionCount).toBe(1);
      expect(status.agentCount).toBe(1);
    });

    it('应该为不同用户创建独立的流式 session', async () => {
      const ctx1 = {
        channel: 'feishu',
        userId: 'stream-user-1',
        content: '消息1'
      };

      const ctx2 = {
        channel: 'feishu',
        userId: 'stream-user-2',
        content: '消息2'
      };

      // 消费两个流
      for await (const _ of gateway.streamHandleMessage(ctx1)) {}
      for await (const _ of gateway.streamHandleMessage(ctx2)) {}

      // 验证创建了两个 session
      expect(createAgentFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOrCreateAgent', () => {
    it('应该返回 Agent 和 sessionId', () => {
      const ctx = {
        channel: 'cli',
        content: 'test'
      };

      const result = gateway.getOrCreateAgent(ctx);

      expect(result).toHaveProperty('agent');
      expect(result).toHaveProperty('sessionId');
      expect(result.agent).toBeDefined();
      expect(result.sessionId).toBe('session-cli');
    });

    it('应该创建对应的 Session', () => {
      const ctx = {
        channel: 'api',
        clientId: 'client-123',
        content: 'test'
      };

      gateway.getOrCreateAgent(ctx);

      const status = gateway.getStatus();
      expect(status.sessionCount).toBe(1);
    });

    it('应该复用已存在的 Agent', () => {
      const ctx = {
        channel: 'cli',
        content: 'test'
      };

      const result1 = gateway.getOrCreateAgent(ctx);
      const result2 = gateway.getOrCreateAgent(ctx);

      expect(result1.sessionId).toBe(result2.sessionId);
      expect(createAgentFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getter methods', () => {
    it('应该返回 Router 实例', () => {
      const router = gateway.getRouter();
      expect(router).toBeDefined();
      expect(typeof router.route).toBe('function');
    });

    it('应该返回 SessionManager 实例', () => {
      const sessionManager = gateway.getSessionManager();
      expect(sessionManager).toBeDefined();
      expect(typeof sessionManager.getOrCreate).toBe('function');
    });

    it('应该返回 AgentRegistry 实例', () => {
      const agentRegistry = gateway.getAgentRegistry();
      expect(agentRegistry).toBeDefined();
      expect(typeof agentRegistry.getOrCreate).toBe('function');
    });

    it('应该返回 Config 实例', () => {
      const config = gateway.getConfig();
      expect(config).toBeDefined();
      expect(config).toEqual(mockConfig);
    });
  });
});