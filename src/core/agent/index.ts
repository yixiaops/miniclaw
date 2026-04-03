/**
 * Miniclaw Agent 模块
 * 
 * 基于 pi-agent-core 封装，适配阿里云百炼大模型。
 * 
 * ## 架构说明
 * 
 * 本模块是 Miniclaw 的核心 Agent 实现，负责：
 * 1. 管理与大模型的对话交互
 * 2. 处理工具调用（Tool Calling）
 * 3. 提供流式响应能力
 * 
 * ## 与 pi-agent-core 的交互
 * 
 * pi-agent-core 是底层 Agent 框架，提供：
 * - Agent 类：核心状态机，管理对话历史、工具注册、事件订阅
 * - AgentMessage 类型：消息格式定义（user/assistant/system）
 * - AgentTool 类型：工具定义（name, description, parameters, execute）
 * 
 * 本模块通过以下方式与 pi-agent-core 交互：
 * - 创建 Agent 实例并初始化状态
 * - 调用 agent.prompt() 发送用户消息
 * - 订阅 agent 事件接收响应和工具调用
 * - 使用 agent.setTools() 注册工具
 * 
 * ## 事件类型
 * 
 * Agent 会发出以下事件：
 * - `message_update`: 消息更新，包含文本增量（text_delta）
 * - `tool_execution_start`: 工具开始执行
 * - `tool_execution_end`: 工具执行结束
 * - `agent_end`: Agent 处理完成
 * 
 * @module MiniclawAgent
 * @author Miniclaw Team
 */

import { Agent, type AgentTool, type AgentMessage } from '@mariozechner/pi-agent-core';
import { streamSimple } from '@mariozechner/pi-ai';
import type { Config } from '../config.js';
import type { SkillManager } from '../skill/index.js';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * Agent 选项配置
 * 
 * 用于创建 MiniclawAgent 实例时的初始化参数。
 * 
 * @property systemPrompt - 系统提示词，定义 Agent 的角色和行为
 * @property tools - 初始工具列表，Agent 可以调用的工具
 * @property agentId - Agent 类型 ID（如 main、etf、policy）
 * @property isSubagent - 是否是子代理
 * @property thinkingLevel - 思维链级别：'off' | 'low' | 'medium' | 'high'
 */
export interface MiniclawAgentOptions {
  /** 系统提示词 */
  systemPrompt?: string;
  /** 初始工具列表 */
  tools?: AgentTool[];
  /** Agent 类型 ID */
  agentId?: string;
  /** 是否是子代理 */
  isSubagent?: boolean;
  /** 思维链级别，默认 'low' */
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  /** 技能管理器 */
  skillManager?: SkillManager;
}

/**
 * 流式响应事件
 * 
 * 由 streamChat 方法生成的事件类型，用于实时输出 Agent 处理过程。
 * 
 * @property content - 文本内容增量
 * @property toolName - 工具名称（工具事件时）
 * @property toolStatus - 工具状态：'start' 开始执行，'end' 执行完成
 * @property toolResult - 工具执行结果（toolStatus 为 'end' 时）
 * @property done - 是否为完成事件
 */
export interface StreamChatEvent {
  content?: string;
  toolName?: string;
  toolStatus?: 'start' | 'end';
  toolResult?: any;
  done: boolean;
}

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 默认系统提示词
 * 
 * 定义 Agent 的基本角色、能力和工作原则。
 */
const DEFAULT_SYSTEM_PROMPT = `你是 Miniclaw，一个专业、可靠的 AI 助手。

## 核心原则

1. **理解意图**：先理解用户真正想要什么，再行动
2. **分析任务**：复杂任务先拆解步骤，不急于执行
3. **确认模糊**：不确定时先询问，不猜测
4. **逐步执行**：按步骤依次完成，不跳跃

## 意图理解

收到指令时，先思考：
- 用户的真实目的是什么？
- 是否有隐含的上下文？
- 指令是否清晰明确？

**常见概念映射：**
- "桌面" → 用户的操作系统桌面目录
  - Linux: \`~/Desktop\` 或 \`~/桌面\`
  - macOS: \`~/Desktop\`
  - Windows: \`C:\\Users\\{用户名}\\Desktop\`
- "当前目录" → 工作目录，通常是项目根目录
- "用户目录" → \`~\` 或 \`/home/{用户名}\`

**不确定时，先询问确认！**

## 任务处理流程

### 简单任务（单步可完成）
直接执行，报告结果。

### 复杂任务（需要多步）
1. **分析**：拆解需要哪些步骤
2. **规划**：确定执行顺序
3. **执行**：逐步完成
4. **验证**：确认结果符合预期

### 示例

用户："在桌面创建 a.txt 并写入 hello ps"

正确流程：
1. 思考：用户说的"桌面"是哪里？→ Linux 环境，应为 \`~/Desktop\` 或 \`~/桌面\`
2. 检查：桌面目录是否存在
3. 创建：在正确位置创建文件
4. 确认：告知用户文件的实际路径

## 工具使用

- **write_file**：写入文件，存在则追加，不存在则创建
- **read_file**：读取文件内容
- **shell**：执行系统命令（如创建目录、查看文件等）

## 环境信息

当前运行环境：
- 工作目录：项目根目录
- 用户目录：\`~\`（通过 shell 访问）

请用简洁、专业的方式回复用户。行动前多思考，不确定时先确认。`;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 估算文本的 Token 数量
 * 
 * 使用简单的启发式方法估算 token 数量：
 * - 英文：约 4 字符 = 1 token
 * - 中文：约 1.5 字符 = 1 token
 * 
 * 这是一个粗略估算，实际值取决于具体的 tokenizer。
 * 误差范围约 ±20%，仅用于日志和调试。
 * 
 * @param text - 要估算的文本
 * @returns 估算的 token 数量
 */
function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  
  // 分离中文和非中文字符
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  const nonChineseChars = text.length - chineseChars.length;
  
  // 中文：约 1.5 字符 = 1 token
  // 英文/其他：约 4 字符 = 1 token
  const chineseTokens = Math.ceil(chineseChars.length / 1.5);
  const nonChineseTokens = Math.ceil(nonChineseChars / 4);
  
  return chineseTokens + nonChineseTokens;
}

/**
 * 估算消息列表的 Token 数量
 * 
 * 遍历消息列表，累加每条消息的 token 估算值。
 * 包含消息内容的估算，以及消息格式的额外开销。
 * 
 * @param messages - 消息列表
 * @returns 估算的 token 数量
 */
function estimateMessagesTokens(messages: AgentMessage[]): number {
  let totalTokens = 0;
  
  for (const message of messages) {
    // 每条消息有格式开销（role 字段等）
    totalTokens += 4; // 消息格式开销
    
    // 处理消息内容
    if (typeof message.content === 'string') {
      totalTokens += estimateTokens(message.content);
    } else if (Array.isArray(message.content)) {
      // 多部分内容
      for (const part of message.content) {
        if (part.type === 'text' && part.text) {
          totalTokens += estimateTokens(part.text);
        }
      }
    }
  }
  
  return totalTokens;
}

/**
 * 格式化消息列表为可读字符串
 * 
 * 将消息列表转换为易读的字符串格式，用于日志输出。
 * 每条消息显示角色和内容预览。
 * 
 * @param messages - 消息列表
 * @param maxLength - 内容预览的最大长度（默认 100）
 * @returns 格式化后的字符串
 */
function formatMessagesForLog(messages: AgentMessage[], maxLength: number = 100): string {
  return messages.map((msg, index) => {
    let contentPreview: string;
    
    if (typeof msg.content === 'string') {
      contentPreview = msg.content;
    } else if (Array.isArray(msg.content)) {
      // 多部分内容，提取文本部分
      const textParts = msg.content
        .filter(part => part.type === 'text')
        .map(part => (part as any).text || '')
        .join(' ');
      contentPreview = textParts;
    } else {
      contentPreview = '[非文本内容]';
    }
    
    // 截断过长的内容
    if (contentPreview.length > maxLength) {
      contentPreview = contentPreview.substring(0, maxLength) + '...';
    }
    
    return `  [${index + 1}] ${msg.role}: ${contentPreview}`;
  }).join('\n');
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 创建百炼模型配置
 * 
 * 根据配置创建适配阿里云百炼 API 的模型配置对象。
 * 这个配置会被 pi-agent-core 用于调用大模型 API。
 * 
 * @param config - Miniclaw 配置对象
 * @returns 百炼模型配置对象
 */
function createBailianModel(config: Config) {
  return {
    // 模型标识符，如 "qwen-turbo"、"qwen-plus" 等
    id: config.bailian.model,
    // 模型显示名称
    name: config.bailian.model,
    // API 类型，百炼使用 OpenAI 兼容接口
    api: 'openai-completions' as const,
    // 服务提供商标识
    provider: 'bailian',
    // API 基础 URL
    baseUrl: config.bailian.baseUrl,
    // 是否支持推理模式（思维链）- 百炼支持但需要特殊处理
    reasoning: false,  // 🔴 关键：百炼不支持 developer 角色，必须设为 false
    // 支持的输入类型
    input: ['text', 'image'] as ('text' | 'image')[],
    // 成本配置（百炼按实际计费，此处为占位）
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0
    },
    // 上下文窗口大小
    contextWindow: 128000,
    // 最大输出 token 数
    maxTokens: 8192,
    // 请求头，包含认证信息
    headers: {
      'Authorization': `Bearer ${config.bailian.apiKey}`
    },
    // 百炼 API 兼容性配置
    compat: {
      supportsDeveloperRole: false,  // 百炼不支持 developer 角色
      supportsReasoningEffort: false, // 百炼不支持 reasoning_effort 参数
    }
  };
}

// ============================================================================
// MiniclawAgent 类
// ============================================================================

/**
 * Miniclaw Agent 类
 * 
 * 封装 pi-agent-core 的 Agent，提供简化的 API 用于 Miniclaw 应用。
 * 
 * ## 主要职责
 * 
 * 1. **对话管理**：维护对话历史，支持多轮对话
 * 2. **工具集成**：注册和管理工具，支持工具调用
 * 3. **流式响应**：提供流式输出能力，实时返回响应
 * 4. **状态管理**：管理 Agent 的内部状态（模型、提示词等）
 * 
 * ## 使用示例
 * 
 * ```typescript
 * const agent = new MiniclawAgent(config, {
 *   systemPrompt: '你是一个助手',
 *   tools: [myTool]
 * });
 * 
 * // 简单对话
 * const response = await agent.chat('你好');
 * 
 * // 流式对话
 * for await (const event of agent.streamChat('请帮我写代码')) {
 *   if (event.content) {
 *     process.stdout.write(event.content);
 *   }
 * }
 * ```
 * 
 * ## 事件订阅
 * 
 * Agent 内部会发出多种事件，可以通过 subscribe 方法订阅：
 * 
 * ```typescript
 * agent.subscribe((event) => {
 *   console.log('Event:', event.type);
 * });
 * ```
 */
export class MiniclawAgent {
  /** Miniclaw 配置对象 */
  private config: Config;
  
  /** 底层 pi-agent-core Agent 实例 */
  private agent: Agent;
  
  /** 已注册的工具列表 */
  private tools: AgentTool[] = [];
  
  /** 当前使用的模型标识符 */
  private currentModel: string;
  
  /** Agent 类型 ID */
  private agentId: string;
  
  /** 是否是子代理 */
  private isSubagent: boolean;
  
  /** 技能管理器 */
  private skillManager?: SkillManager;

  /**
   * 获取日志前缀
   * 
   * @returns 日志前缀字符串
   */
  private getLogPrefix(): string {
    return this.isSubagent 
      ? `[Subagent:${this.agentId}]` 
      : `[${this.agentId}]`;
  }
  
  /**
   * 打印日志
   * 
   * @param message - 日志消息
   */
  private log(message: string): void {
    console.log(`${this.getLogPrefix()} ${message}`);
  }
  
  /**
   * 打印分隔线
   * 
   * @param title - 分隔线标题（可选）
   */
  private logDivider(title?: string): void {
    if (title) {
      console.log(`${this.getLogPrefix()} ${'═'.repeat(10)} ${title} ${'═'.repeat(10)}`);
    } else {
      console.log(`${this.getLogPrefix()} ${'─'.repeat(40)}`);
    }
  }

  /**
   * 创建 MiniclawAgent 实例
   * 
   * @param config - Miniclaw 配置
   * @param options - Agent 选项
   */
  constructor(config: Config, options?: MiniclawAgentOptions) {
    this.config = config;
    this.agentId = options?.agentId || 'main';
    this.isSubagent = options?.isSubagent || false;
    this.currentModel = config.bailian.model;
    this.skillManager = options?.skillManager;

    this.log(`初始化 Agent`);
    this.log(`模型: ${this.currentModel}`);
    this.log(`API 地址: ${config.bailian.baseUrl}`);

    // 创建底层 Agent - 不传递空 tools 数组
    // pi-agent-core 对空数组有特殊处理，undefined 表示无工具
    const initialTools = options?.tools && options.tools.length > 0 ? options.tools : undefined;
    
    if (initialTools && initialTools.length > 0) {
      this.log(`初始工具数量: ${initialTools.length}`);
      initialTools.forEach(tool => {
        this.log(`  - ${tool.name}: ${tool.description.substring(0, 50)}...`);
      });
    }

    // 创建 Agent 实例
    // Agent 构造函数接收初始状态和流式处理函数
    this.agent = new Agent({
      initialState: {
        // 系统提示词，定义 Agent 的角色和行为
        systemPrompt: options?.systemPrompt || DEFAULT_SYSTEM_PROMPT,
        // 模型配置
        model: createBailianModel(config),
        // 工具列表
        tools: initialTools,
        // 思维链级别（显示推理过程）
        thinkingLevel: options?.thinkingLevel || 'low',
        // 对话历史
        messages: [],
        // 是否正在流式输出
        isStreaming: false,
        // 当前流式消息
        streamMessage: null,
        // 待执行的工具调用
        pendingToolCalls: new Set()
      },
      // 流式处理函数
      // 当 Agent 需要调用大模型时，会调用此函数
      streamFn: async (model, context, opts) => {
        return streamSimple(model, context, {
          ...opts,
          apiKey: config.bailian.apiKey
        });
      }
    });

    // 保存工具引用
    if (options?.tools) {
      this.tools = options.tools;
    }
    
    this.log(`Agent 初始化完成`);
  }

  // ==========================================================================
  // 配置访问方法
  // ==========================================================================

  /**
   * 获取 Miniclaw 配置
   * 
   * @returns 当前配置对象
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * 获取系统提示词
   * 
   * 系统提示词定义了 Agent 的角色、行为和能力边界。
   * 
   * @returns 当前系统提示词
   */
  getSystemPrompt(): string {
    return this.agent.state.systemPrompt;
  }

  /**
   * 设置系统提示词
   * 
   * 更改 Agent 的系统提示词。更改后会影响后续的所有对话。
   * 
   * @param prompt - 新的系统提示词
   */
  setSystemPrompt(prompt: string): void {
    this.log(`更新系统提示词 (${prompt.length} 字符)`);
    this.agent.setSystemPrompt(prompt);
  }

  /**
   * 获取模型配置信息
   * 
   * 返回当前使用的模型相关配置。
   * 
   * @returns 模型配置对象
   */
  getModelConfig() {
    return {
      provider: 'bailian',
      model: this.currentModel,
      baseUrl: this.config.bailian.baseUrl
    };
  }

  /**
   * 设置使用的模型
   * 
   * 切换 Agent 使用的大模型。切换后立即生效。
   * 
   * @param model - 模型标识符（如 "qwen-turbo"、"qwen-plus"）
   */
  setModel(model: string): void {
    this.log(`切换模型: ${this.currentModel} -> ${model}`);
    this.currentModel = model;
    this.config.bailian.model = model;
    this.agent.setModel(createBailianModel(this.config));
  }

  // ==========================================================================
  // 核心对话方法
  // ==========================================================================

  /**
   * 发送消息并获取响应（非流式）
   * 
   * 这是最简单的对话接口，发送用户输入并等待完整响应返回。
   * 适用于不需要实时输出的场景。
   * 
   * ## 内部流程
   * 
   * 1. 打印发送上下文（日志）
   * 2. 订阅 Agent 事件
   * 3. 调用 agent.prompt() 发送消息
   * 4. 收集流式响应内容
   * 5. 打印接收详情（日志）
   * 6. 返回完整响应
   * 
   * @param input - 用户输入
   * @returns 包含响应内容的 Promise
   */
  async chat(input: string): Promise<{ content: string }> {
    this.log(`═════════════ 开始对话 ═════════════`);
    
    // ===== 技能匹配 =====
    let skillPrompt = '';
    let originalSystemPrompt: string | null = null;
    if (this.skillManager) {
      const matchedSkill = this.skillManager.match(input);
      if (matchedSkill) {
        skillPrompt = this.skillManager.getPrompt(matchedSkill.name);
        this.log(`🎯 匹配到技能: ${matchedSkill.name}`);
      }
    }
    
    // 如果匹配到技能，临时更新 system prompt
    if (skillPrompt) {
      originalSystemPrompt = this.agent.state.systemPrompt;
      const fullPrompt = `${originalSystemPrompt}\n\n${skillPrompt}`;
      this.agent.setSystemPrompt(fullPrompt);
      this.log(`📋 已注入技能 prompt (${skillPrompt.length} 字符)`);
    }
    
    // ===== 发送前：打印上下文 =====
    this.logSendContext(input);
    
    // 收集流式响应内容
    let fullContent = '';
    let toolCallCount = 0;
    let startTime = Date.now();
    
    // 订阅 Agent 事件
    // Agent 在处理过程中会发出多种事件
    const unsubscribe = this.agent.subscribe((event: any) => {
      // 记录所有事件类型（调试用，已禁用）
      // this.log(`📨 收到事件: ${event.type}`);
      
      // 文本增量事件：大模型返回的文本片段
      if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
        fullContent += event.assistantMessageEvent.delta;
      }
      
      // 推理增量事件：Agent 思考过程（已禁用日志）
      // if (event.type === 'thinking_update' || 
      //     (event.type === 'message_update' && event.assistantMessageEvent?.type === 'thinking_delta')) {
      //   const thinkingDelta = event.thinking || event.assistantMessageEvent?.delta || '';
      //   if (thinkingDelta) {
      //     this.log(`💭 推理: ${thinkingDelta.substring(0, 100)}${thinkingDelta.length > 100 ? '...' : ''}`);
      //   }
      // }
      
      // 工具调用事件：工具开始执行
      if (event.type === 'tool_execution_start') {
        toolCallCount++;
        this.log(`🔧 工具调用 #${toolCallCount}: ${event.toolName}`);
      }
      
      // 工具调用事件：工具执行完成
      if (event.type === 'tool_execution_end') {
        toolCallCount++;
        let resultPreview: string;
        if (event.result && event.result.content) {
          // 工具返回格式: { content: [{ type: 'text', text: 'xxx' }] }
          const textContent = event.result.content.find((c: any) => c.type === 'text');
          resultPreview = textContent?.text?.substring(0, 150) || '[无文本内容]';
        } else if (typeof event.result === 'string') {
          resultPreview = event.result.substring(0, 150);
        } else {
          resultPreview = JSON.stringify(event.result).substring(0, 150);
        }
        this.log(`✅ 工具结果 #${toolCallCount}: ${resultPreview}${resultPreview.length >= 150 ? '...' : ''}`);
        this.log(`📥 工具结果已加入消息历史，等待 LLM 生成回复...`);
      }
    });

    // 调用底层 Agent 发送消息
    // agent.prompt 是异步的，会处理完整的对话流程
    await this.agent.prompt(input);
    
    // 取消订阅
    unsubscribe();

    // ===== 接收后：打印详情 =====
    this.logReceiveDetails(fullContent, toolCallCount, startTime);
    
    // ===== 恢复原始 system prompt =====
    if (originalSystemPrompt) {
      this.agent.setSystemPrompt(originalSystemPrompt);
      this.log(`📋 已恢复原始 system prompt`);
    }
    
    this.log(`═════════════ 对话结束 ═════════════\n`);

    // 返回收集到的内容
    if (fullContent) {
      return { content: fullContent };
    }

    // 回退：从消息历史读取最后一条助手消息
    const messages = this.agent.state.messages;
    const lastMessage = messages[messages.length - 1];

    this.log(`📚 消息历史总数: ${messages.length}`);
    messages.forEach((msg, i) => {
      this.log(`📚   [${i}] role: ${msg.role}, content type: ${Array.isArray(msg.content) ? 'array' : typeof msg.content}`);
      if (Array.isArray(msg.content)) {
        this.log(`📚       内容部分数量: ${msg.content.length}`);
      } else if (typeof msg.content === 'string') {
        this.log(`📚       字符串长度: ${msg.content.length}`);
      }
    });

    if (lastMessage && lastMessage.role === 'assistant') {
      const content = lastMessage.content;
      this.log(`📚 最后一条消息是 assistant，内容类型: ${Array.isArray(content) ? 'array' : typeof content}`);
      
      if (Array.isArray(content)) {
        // 打印所有内容部分
        this.log(`📚 内容部分数量: ${content.length}`);
        content.forEach((part, i) => {
          this.log(`📚   [${i}] type: ${part.type}`);
          if (part.type === 'text') {
            this.log(`📚       text 长度: ${(part as any).text?.length || 0}`);
          }
          // if (part.type === 'thinking') {
          //   this.log(`📚       thinking 长度: ${(part as any).thinking?.length || 0}`);
          // }
        });
        
        const textContent = content.find(c => c.type === 'text');
        const thinkingContent = content.find(c => c.type === 'thinking');
        
        // 如果有 thinking 内容但没有 text，尝试用 thinking
        if (!textContent?.text && thinkingContent?.thinking) {
          // this.log(`📚 ⚠️ 没有 text 内容，但有 thinking 内容，使用 thinking`);
          return { content: thinkingContent.thinking };
        }
        
        if (content.length === 0) {
          this.log(`📚 ⚠️ 内容数组为空！LLM 可能没有生成任何内容`);
        }
        
        return { content: textContent?.text || '' };
      }
      return { content: '' };
    }

    this.log(`📚 ⚠️ 没有找到助手消息`);
    return { content: '' };
  }

  /**
   * 流式发送消息
   * 
   * 提供实时流式输出的对话接口。通过 AsyncGenerator 逐步返回响应，
   * 适用于需要实时显示响应的场景（如 CLI、Web 界面）。
   * 
   * ## 内部流程
   * 
   * 1. 创建事件队列
   * 2. 订阅 Agent 事件
   * 3. 启动 agent.prompt()
   * 4. 通过 Generator 实时 yield 事件
   * 5. 处理完成后结束
   * 
   * ## 事件类型
   * 
   * - `content`: 文本增量，逐步拼接得到完整响应
   * - `toolStatus: 'start'`: 工具开始执行
   * - `toolStatus: 'end'`: 工具执行完成，包含结果
   * - `done: true`: 处理完成
   * 
   * @param input - 用户输入
   * @yields 流式响应事件
   */
  async *streamChat(input: string): AsyncGenerator<StreamChatEvent> {
    this.log(`═════════════ 开始流式对话 ═════════════`);
    
    // ===== 发送前：打印上下文 =====
    this.logSendContext(input);
    
    // 事件队列，用于实现真正的流式输出
    // Agent 事件是异步的，通过队列传递给 Generator
    const eventQueue: StreamChatEvent[] = [];
    
    // 用于通知新事件可用的 Promise resolve 函数
    let resolveEvent: (() => void) | null = null;
    
    // 标记是否完成
    let isComplete = false;
    
    // 工具调用计数器
    let toolCallCount = 0;
    
    // 开始时间
    let startTime = Date.now();

    // 订阅所有 Agent 事件
    // Agent 在处理过程中会发出多种事件，我们将其转换为统一的事件格式
    const unsubscribe = this.agent.subscribe((event: any) => {
      switch (event.type) {
        // 文本增量更新事件
        // 大模型返回文本时，会多次触发此事件
        case 'message_update':
          if (event.assistantMessageEvent?.type === 'text_delta') {
            eventQueue.push({
              content: event.assistantMessageEvent.delta,
              done: false
            });
          }
          // 推理增量事件（已禁用日志）
          // if (event.assistantMessageEvent?.type === 'thinking_delta') {
          //   const thinkingDelta = event.assistantMessageEvent?.delta || '';
          //   if (thinkingDelta) {
          //     this.log(`💭 推理: ${thinkingDelta.substring(0, 100)}${thinkingDelta.length > 100 ? '...' : ''}`);
          //   }
          // }
          break;
          
        // 推理更新事件（已禁用日志）
        // case 'thinking_update':
        //   const thinking = event.thinking || '';
        //   if (thinking) {
        //     this.log(`💭 推理: ${thinking.substring(0, 100)}${thinking.length > 100 ? '...' : ''}`);
        //   }
        //   break;

        // 工具执行开始事件
        // 当 Agent 决定调用工具时触发
        case 'tool_execution_start':
          toolCallCount++;
          this.log(`🔧 工具调用开始: ${event.toolName}`);
          // 打印工具参数（如果有）
          if (event.args) {
            this.log(`   参数: ${JSON.stringify(event.args).substring(0, 200)}`);
          }
          eventQueue.push({
            toolName: event.toolName,
            toolStatus: 'start',
            done: false
          });
          break;

        // 工具执行结束事件
        // 工具执行完成后触发，包含执行结果
        case 'tool_execution_end':
          this.log(`✅ 工具执行完成: ${event.toolName}`);
          // 打印结果预览
          const resultPreview = typeof event.result === 'string'
            ? event.result.substring(0, 100)
            : JSON.stringify(event.result).substring(0, 100);
          this.log(`   结果: ${resultPreview}${resultPreview.length >= 100 ? '...' : ''}`);
          eventQueue.push({
            toolName: event.toolName,
            toolStatus: 'end',
            toolResult: event.result,
            done: false
          });
          break;

        // Agent 结束事件
        // 所有处理完成，包括工具调用和响应生成
        case 'agent_end':
          this.log(`Agent 处理完成`);
          isComplete = true;
          eventQueue.push({ done: true });
          break;
      }

      // 通知有新事件可用
      // 唤醒等待中的 Generator
      if (resolveEvent) {
        resolveEvent();
        resolveEvent = null;
      }
    });

    // 启动 prompt 处理
    // agent.prompt 是异步的，在后台执行
    this.agent.prompt(input).then(() => {
      // prompt 完成后，如果没有收到 agent_end 事件，手动标记完成
      // 这是为了兼容可能不发送 agent_end 事件的实现
      if (!isComplete) {
        this.log(`⚠️ prompt 完成，但未收到 agent_end 事件`);
        isComplete = true;
        eventQueue.push({ done: true });
        if (resolveEvent) {
          resolveEvent();
          resolveEvent = null;
        }
      }
    }).catch((error) => {
      this.log(`❌ prompt 执行错误: ${error.message}`);
      eventQueue.push({ content: `Error: ${error.message}`, done: false });
      isComplete = true;
      eventQueue.push({ done: true });
      if (resolveEvent) {
        resolveEvent();
        resolveEvent = null;
      }
    });

    // 流式输出事件
    // 通过 AsyncGenerator 逐步返回事件
    while (true) {
      // 如果队列中有事件，立即 yield
      if (eventQueue.length > 0) {
        const event = eventQueue.shift()!;
        yield event;

        // 如果是完成事件，结束循环
        if (event.done) {
          break;
        }
        continue;
      }

      // 如果已完成且队列空，结束
      if (isComplete) {
        break;
      }

      // 等待新事件
      // 使用 Promise 实现异步等待
      await new Promise<void>((resolve) => {
        resolveEvent = resolve;
      });
    }

    // 取消订阅
    unsubscribe();
    
    // 打印总结信息
    this.logReceiveDetails('[流式输出]', toolCallCount, startTime);
    this.log(`═════════════ 流式对话结束 ═════════════\n`);
  }

  // ==========================================================================
  // 历史和状态管理
  // ==========================================================================

  /**
   * 获取对话历史
   * 
   * 返回当前保存的所有对话消息，包括用户消息和助手消息。
   * 
   * @returns 消息列表
   */
  getHistory(): AgentMessage[] {
    return this.agent.state.messages;
  }

  /**
   * 重置对话
   * 
   * 清空对话历史，开始新的对话。系统提示词和工具配置保持不变。
   */
  reset(): void {
    this.log(`重置对话历史`);
    this.agent.reset();
  }

  // ==========================================================================
  // 工具管理
  // ==========================================================================

  /**
   * 注册工具
   * 
   * 向 Agent 添加一个新的工具。工具可以在对话中被 Agent 调用。
   * 
   * ## 工具定义格式
   * 
   * ```typescript
   * const myTool: AgentTool = {
   *   name: 'get_weather',
   *   description: '获取指定城市的天气信息',
   *   parameters: {
   *     type: 'object',
   *     properties: {
   *       city: { type: 'string', description: '城市名称' }
   *     },
   *     required: ['city']
   *   },
   *   execute: async (args) => {
   *     return { temperature: 25, weather: '晴' };
   *   }
   * };
   * ```
   * 
   * @param tool - 要注册的工具
   */
  registerTool(tool: AgentTool): void {
    this.log(`注册工具: ${tool.name}`);
    this.tools.push(tool);
    this.agent.setTools(this.tools);
  }

  /**
   * 获取已注册的工具列表
   * 
   * @returns 工具列表的副本
   */
  getTools(): AgentTool[] {
    return [...this.tools];
  }

  /**
   * 清除所有工具
   * 
   * 移除所有已注册的工具。Agent 将不再能调用任何工具。
   */
  clearTools(): void {
    this.log(`清除所有工具 (共 ${this.tools.length} 个)`);
    this.tools = [];
    this.agent.setTools([]);
  }

  // ==========================================================================
  // 事件订阅
  // ==========================================================================

  /**
   * 订阅 Agent 事件
   * 
   * 允许外部代码监听 Agent 的内部事件。
   * 
   * ## 事件类型
   * 
   * - `message_update`: 消息更新，包含文本增量
   * - `tool_execution_start`: 工具开始执行
   * - `tool_execution_end`: 工具执行完成
   * - `agent_end`: Agent 处理完成
   * 
   * @param fn - 事件处理函数
   * @returns 取消订阅的函数
   */
  subscribe(fn: (event: unknown) => void): () => void {
    return this.agent.subscribe(fn);
  }

  /**
   * 中断当前操作
   * 
   * 中止当前正在进行的请求或工具调用。
   */
  abort(): void {
    this.log(`⚠️ 中断当前操作`);
    this.agent.abort();
  }

  // ==========================================================================
  // 私有方法：日志输出
  // ==========================================================================

  /**
   * 打印发送上下文日志
   * 
   * 在发送消息给大模型前，打印完整的上下文信息，包括：
   * - 用户输入
   * - 系统提示词
   * - 对话历史
   * - Token 估算
   * 
   * @param input - 用户输入
   * @private
   */
  private logSendContext(input: string): void {
    this.logDivider('发送上下文');
    
    // 打印用户输入
    this.log(`📝 用户输入:`);
    this.log(`  "${input}"`);
    this.log(`   - 输入 Token 估算: ${estimateTokens(input)}`);
    
    // 打印系统提示词
    const systemPrompt = this.agent.state.systemPrompt;
    this.log(`📋 系统提示词 (${systemPrompt.length} 字符, ~${estimateTokens(systemPrompt)} tokens):`);
    const promptPreview = systemPrompt.length > 150 
      ? systemPrompt.substring(0, 150) + '...' 
      : systemPrompt;
    this.log(`  ${promptPreview.replace(/\n/g, '\n   ')}`);
    
    // 打印对话历史
    const messages = this.agent.state.messages;
    if (messages.length > 0) {
      this.log(`📚 对话历史 (${messages.length} 条消息):`);
      console.log(formatMessagesForLog(messages));
      this.log(`   - 历史 Token 估算: ${estimateMessagesTokens(messages)}`);
    } else {
      this.log(`📚 对话历史: (空)`);
    }
    
    // 打印工具信息
    if (this.tools.length > 0) {
      this.log(`🔧 可用工具 (${this.tools.length} 个):`);
      this.tools.forEach(tool => {
        this.log(`  - ${tool.name}: ${tool.description.substring(0, 40)}...`);
      });
    }
    
    // 打印总 Token 估算
    const totalTokens = estimateTokens(input) + estimateTokens(systemPrompt) + estimateMessagesTokens(messages);
    this.log(`📊 总 Token 估算: ~${totalTokens}`);
    
    this.logDivider();
  }

  /**
   * 打印接收详情日志
   * 
   * 在收到大模型响应后，打印响应详情，包括：
   * - 响应内容
   * - 工具调用次数
   * - 处理时长
   * 
   * @param content - 响应内容
   * @param toolCallCount - 工具调用次数
   * @param startTime - 开始时间戳
   * @private
   */
  private logReceiveDetails(content: string, toolCallCount: number, startTime: number): void {
    this.logDivider('接收详情');
    
    const duration = Date.now() - startTime;
    
    // 打印响应内容预览
    this.log(`💬 响应内容 (${content.length} 字符, ~${estimateTokens(content)} tokens):`);
    const contentPreview = content.length > 200 
      ? content.substring(0, 200) + '...' 
      : content;
    this.log(`  ${contentPreview.replace(/\n/g, '\n   ')}`);
    
    // 打印工具调用统计
    this.log(`🔧 工具调用次数: ${toolCallCount}`);
    
    // 打印处理时长
    this.log(`⏱️ 处理时长: ${duration}ms`);
    
    // 打印更新后的历史消息数
    const messages = this.agent.state.messages;
    this.log(`📚 当前历史消息数: ${messages.length}`);
    
    this.logDivider();
  }
}