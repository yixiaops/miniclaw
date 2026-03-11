/**
 * Agent 模块测试
 * 基于 pi-agent-core 封装
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MiniclawAgent } from '../../src/core/agent/index.js';
import type { Config } from '../../src/core/config.js';

// Mock pi-agent-core
vi.mock('@mariozechner/pi-agent-core', () => ({
  Agent: class MockAgent {
    private _state = {
      systemPrompt: '',
      model: null,
      thinkingLevel: 'off',
      tools: [] as any[],
      messages: [] as any[],
      isStreaming: false,
      streamMessage: null,
      pendingToolCalls: new Set()
    };
    private _subscribers: Function[] = [];

    constructor(opts?: any) {
      if (opts?.initialState?.systemPrompt) {
        this._state.systemPrompt = opts.initialState.systemPrompt;
      }
      if (opts?.initialState?.tools) {
        this._state.tools = opts.initialState.tools;
      }
    }

    get state() {
      return this._state;
    }

    setSystemPrompt(prompt: string) {
      this._state.systemPrompt = prompt;
    }

    setModel(model: any) {
      this._state.model = model;
    }

    setTools(tools: any[]) {
      this._state.tools = tools;
    }

    subscribe(fn: Function) {
      this._subscribers.push(fn);
      return () => {
        this._subscribers = this._subscribers.filter(s => s !== fn);
      };
    }

    async prompt(input: string) {
      // Mock response
      this._state.messages.push({
        role: 'user',
        content: input,
        timestamp: Date.now()
      });
      
      // Simulate streaming by emitting text_delta events
      const mockResponse = 'Hello! How can I help you today?';
      for (const char of mockResponse) {
        for (const fn of this._subscribers) {
          fn({
            type: 'message_update',
            assistantMessageEvent: {
              type: 'text_delta',
              delta: char
            }
          });
        }
      }
      
      this._state.messages.push({
        role: 'assistant',
        content: [{ type: 'text', text: mockResponse }],
        api: 'openai-completions',
        provider: 'bailian',
        model: 'qwen-turbo',
        usage: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0, totalTokens: 15, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: 'stop',
        timestamp: Date.now()
      });
    }

    abort() {}

    reset() {
      this._state.messages = [];
    }
  }
}));

// Mock pi-ai streamSimple
vi.mock('@mariozechner/pi-ai', () => ({
  streamSimple: vi.fn(),
  Type: {
    Object: () => ({})
  }
}));

describe('MiniclawAgent', () => {
  let mockConfig: Config;

  beforeEach(() => {
    mockConfig = {
      bailian: {
        apiKey: 'test-api-key',
        model: 'qwen-turbo',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      },
      server: {
        port: 3000,
        host: '0.0.0.0'
      }
    };
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create agent with config', () => {
      const agent = new MiniclawAgent(mockConfig);

      expect(agent).toBeDefined();
      expect(agent.getConfig()).toEqual(mockConfig);
    });

    it('should set default system prompt', () => {
      const agent = new MiniclawAgent(mockConfig);

      expect(agent.getSystemPrompt()).toContain('Miniclaw');
    });

    it('should accept custom system prompt', () => {
      const agent = new MiniclawAgent(mockConfig, {
        systemPrompt: 'You are a helpful coding assistant.'
      });

      expect(agent.getSystemPrompt()).toBe('You are a helpful coding assistant.');
    });
  });

  describe('chat', () => {
    it('should send message and get response', async () => {
      const agent = new MiniclawAgent(mockConfig);

      const response = await agent.chat('Hello');

      expect(response).toBeDefined();
      expect(response.content).toBe('Hello! How can I help you today?');
    });

    it('should maintain conversation history', async () => {
      const agent = new MiniclawAgent(mockConfig);

      await agent.chat('First message');
      await agent.chat('Second message');

      const history = agent.getHistory();
      expect(history).toHaveLength(4); // 2 user + 2 assistant
    });

    it('should clear history on reset', async () => {
      const agent = new MiniclawAgent(mockConfig);

      await agent.chat('Hello');
      expect(agent.getHistory()).toHaveLength(2);

      agent.reset();
      expect(agent.getHistory()).toHaveLength(0);
    });
  });

  describe('streamChat', () => {
    it('should stream response chunks', async () => {
      const agent = new MiniclawAgent(mockConfig);

      const chunks: string[] = [];
      for await (const chunk of agent.streamChat('Hello')) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('tools', () => {
    it('should register tools', () => {
      const agent = new MiniclawAgent(mockConfig);

      const tool = {
        name: 'read_file',
        description: 'Read file content',
        parameters: {},
        label: 'Read File',
        execute: async () => ({ content: [], details: null })
      };

      agent.registerTool(tool);

      expect(agent.getTools()).toHaveLength(1);
      expect(agent.getTools()[0].name).toBe('read_file');
    });

    it('should clear tools', () => {
      const agent = new MiniclawAgent(mockConfig);

      agent.registerTool({
        name: 'test',
        description: 'Test tool',
        parameters: {},
        label: 'Test',
        execute: async () => ({ content: [], details: null })
      });

      agent.clearTools();

      expect(agent.getTools()).toHaveLength(0);
    });
  });

  describe('model configuration', () => {
    it('should create model config for bailian', () => {
      const agent = new MiniclawAgent(mockConfig);

      const modelConfig = agent.getModelConfig();

      expect(modelConfig.provider).toBe('bailian');
      expect(modelConfig.model).toBe('qwen-turbo');
      expect(modelConfig.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    });

    it('should switch model', () => {
      const agent = new MiniclawAgent(mockConfig);

      agent.setModel('qwen-max');

      expect(agent.getModelConfig().model).toBe('qwen-max');
    });
  });
});