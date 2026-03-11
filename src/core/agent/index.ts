/**
 * Miniclaw Agent 模块
 * 基于 pi-agent-core 封装，适配阿里云百炼
 */
import { Agent, type AgentTool, type AgentMessage } from '@mariozechner/pi-agent-core';
import { streamSimple } from '@mariozechner/pi-ai';
import type { Config } from '../config.js';

/**
 * Agent 选项
 */
export interface MiniclawAgentOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 初始工具列表 */
  tools?: AgentTool[];
}

/**
 * 默认系统提示词
 */
const DEFAULT_SYSTEM_PROMPT = `你是 Miniclaw，一个轻量级的个人 AI 助手。
你可以帮助用户完成各种任务，包括：
- 回答问题和提供建议
- 读写文件
- 执行 Shell 命令
- 搜索网络信息

请用简洁、友好的方式回复用户。`;

/**
 * 创建百炼模型配置
 */
function createBailianModel(config: Config) {
  return {
    id: config.bailian.model,
    name: config.bailian.model,
    api: 'openai-completions' as const,
    provider: 'bailian',
    baseUrl: config.bailian.baseUrl,
    reasoning: false,
    input: ['text', 'image'] as ('text' | 'image')[],
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0
    },
    contextWindow: 128000,
    maxTokens: 8192,
    headers: {
      'Authorization': `Bearer ${config.bailian.apiKey}`
    }
  };
}

/**
 * Miniclaw Agent 类
 * 封装 pi-agent-core，提供简化的 API
 */
export class MiniclawAgent {
  private config: Config;
  private agent: Agent;
  private tools: AgentTool[] = [];
  private currentModel: string;

  constructor(config: Config, options?: MiniclawAgentOptions) {
    this.config = config;
    this.currentModel = config.bailian.model;

    // 创建底层 Agent - 不传递空 tools 数组
    const initialTools = options?.tools && options.tools.length > 0 ? options.tools : undefined;
    
    this.agent = new Agent({
      initialState: {
        systemPrompt: options?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        model: createBailianModel(config),
        tools: initialTools,
        thinkingLevel: 'off',
        messages: [],
        isStreaming: false,
        streamMessage: null,
        pendingToolCalls: new Set()
      },
      streamFn: async (model, context, opts) => {
        return streamSimple(model, context, {
          ...opts,
          apiKey: config.bailian.apiKey
        });
      }
    });

    if (options?.tools) {
      this.tools = options.tools;
    }
  }

  /**
   * 获取配置
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * 获取系统提示词
   */
  getSystemPrompt(): string {
    return this.agent.state.systemPrompt;
  }

  /**
   * 设置系统提示词
   */
  setSystemPrompt(prompt: string): void {
    this.agent.setSystemPrompt(prompt);
  }

  /**
   * 获取模型配置
   */
  getModelConfig() {
    return {
      provider: 'bailian',
      model: this.currentModel,
      baseUrl: this.config.bailian.baseUrl
    };
  }

  /**
   * 设置模型
   */
  setModel(model: string): void {
    this.currentModel = model;
    this.config.bailian.model = model;
    this.agent.setModel(createBailianModel(this.config));
  }

  /**
   * 发送消息并获取响应
   */
  async chat(input: string): Promise<{ content: string }> {
    // 收集流式响应内容
    let fullContent = '';
    
    const unsubscribe = this.agent.subscribe((event: any) => {
      if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
        fullContent += event.assistantMessageEvent.delta;
      }
    });

    await this.agent.prompt(input);
    
    unsubscribe();

    // 优先返回收集到的流式内容
    if (fullContent) {
      return { content: fullContent };
    }

    // 回退到从消息历史读取
    const messages = this.agent.state.messages;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage && lastMessage.role === 'assistant') {
      const content = lastMessage.content;
      if (Array.isArray(content)) {
        const textContent = content.find(c => c.type === 'text');
        return { content: textContent?.text || '' };
      }
      return { content: '' };
    }

    return { content: '' };
  }

  /**
   * 流式发送消息
   */
  async *streamChat(input: string): AsyncGenerator<{ content?: string; done: boolean }> {
    // 收集流式响应
    let fullContent = '';

    const unsubscribe = this.agent.subscribe((event: any) => {
      if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
        fullContent += event.assistantMessageEvent.delta;
      }
    });

    await this.agent.prompt(input);

    // 返回收集的内容
    yield { content: fullContent, done: false };
    yield { done: true };

    unsubscribe();
  }

  /**
   * 获取对话历史
   */
  getHistory(): AgentMessage[] {
    return this.agent.state.messages;
  }

  /**
   * 重置对话
   */
  reset(): void {
    this.agent.reset();
  }

  /**
   * 注册工具
   */
  registerTool(tool: AgentTool): void {
    this.tools.push(tool);
    this.agent.setTools(this.tools);
  }

  /**
   * 获取已注册的工具
   */
  getTools(): AgentTool[] {
    return this.tools;
  }

  /**
   * 清除所有工具
   */
  clearTools(): void {
    this.tools = [];
    this.agent.setTools([]);
  }

  /**
   * 订阅 Agent 事件
   */
  subscribe(fn: (event: unknown) => void): () => void {
    return this.agent.subscribe(fn);
  }

  /**
   * 中断当前操作
   */
  abort(): void {
    this.agent.abort();
  }
}