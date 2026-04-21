/**
 * @fileoverview Miniclaw Gateway - 系统统一入口
 *
 * 整合 Router、SessionManager、AgentRegistry，提供消息处理的核心流程。
 *
 * @module core/gateway
 */

import { Router, type RouteContext } from './router.js';
import { SessionManager, type SessionConfig, type Session } from './session.js';
import { AgentRegistry, type CreateAgentFn } from '../agent/registry.js';
import { SimpleMemoryStorage, type Message as StorageMessage } from '../memory/simple.js';
import type { Config } from '../config.js';
import type { MiniclawAgent, StreamChatEvent } from '../agent/index.js';
import type { MemoryManager } from '../../memory/manager.js';
import { AutoMemoryWriter } from '../../memory/auto-writer.js';
import { ImportanceEvaluator } from '../../memory/importance/index.js';
import { SoulLoader } from '../../soul/index.js';

/**
 * 消息上下文
 */
export interface MessageContext {
  /** 通道类型 */
  channel: string;
  /** 用户 ID */
  userId?: string;
  /** 群组 ID */
  groupId?: string;
  /** API 客户端 ID */
  clientId?: string;
  /** 消息内容 */
  content: string;
}

/**
 * 响应结构
 */
export interface Response {
  /** 响应内容 */
  content: string;
  /** Session ID */
  sessionId: string;
}

/**
 * Gateway 状态
 */
export interface GatewayStatus {
  /** Agent 数量 */
  agentCount: number;
  /** Session 数量 */
  sessionCount: number;
}

/**
 * Gateway 配置
 */
export interface GatewayConfig {
  /** 创建 Agent 的工厂函数 */
  createAgentFn: CreateAgentFn;
  /** 最大 Agent 数量 */
  maxAgents?: number;
  /** Session 配置 */
  sessionConfig?: Partial<SessionConfig>;
  /** 存储目录路径（可选，默认 ~/.miniclaw/sessions/） */
  storageDir?: string;
  /** 记忆管理器（可选） */
  memoryManager?: MemoryManager;
}

/**
 * 默认 Session 配置
 */
const DEFAULT_SESSION_CONFIG: SessionConfig = {
  maxHistoryLength: 50,
  sessionTtl: 3600000, // 1小时
  maxConcurrentSessions: 100,
  persistence: 'memory'
};

/**
 * MiniclawGateway 类
 *
 * 系统的统一入口，协调各个组件完成消息处理流程。
 *
 * ## 消息处理流程
 *
 * 1. Router.route(ctx) → sessionId
 * 2. SessionManager.getOrCreate(sessionId) → session
 * 3. AgentRegistry.getOrCreate(sessionId) → agent
 * 4. agent.chat(ctx.content) → response
 * 5. session.addMessage(user + assistant)
 * 6. 返回 response
 *
 * @example
 * ```ts
 * const gateway = new MiniclawGateway(config, {
 *   createAgentFn: (sessionKey, config) => new MiniclawAgent(config)
 * });
 *
 * const response = await gateway.handleMessage({
 *   channel: 'cli',
 *   content: '你好'
 * });
 * ```
 */
export class MiniclawGateway {
  /** 路由器 */
  private router: Router;

  /** Session 管理器 */
  private sessionManager: SessionManager;

  /** Agent 注册表 */
  private agentRegistry: AgentRegistry;

  /** 持久化存储 */
  private storage: SimpleMemoryStorage;

  /** 记忆管理器（可选） */
  private memoryManager?: MemoryManager;

  /** 自动记忆写入器（可选） */
  private autoWriter?: AutoMemoryWriter;

  /** Importance 评估器 */
  private importanceEvaluator: ImportanceEvaluator;

  /** Soul 加载器 */
  private soulLoader: SoulLoader;

  /** 配置 */
  private config: Config;

  /**
   * 创建 MiniclawGateway 实例
   *
   * @param config - Miniclaw 配置
   * @param gatewayConfig - Gateway 配置
   */
  constructor(config: Config, gatewayConfig: GatewayConfig) {
    this.config = config;

    // 初始化路由器
    this.router = new Router({
      rules: [],
      defaultStrategy: 'byUser'
    });

    // 初始化 Session 管理器
    const sessionConfig: SessionConfig = {
      ...DEFAULT_SESSION_CONFIG,
      ...gatewayConfig.sessionConfig
    };
    this.sessionManager = new SessionManager(sessionConfig);

    // 初始化 Agent 注册表
    this.agentRegistry = new AgentRegistry(
      config,
      gatewayConfig.createAgentFn,
      gatewayConfig.maxAgents
    );

    // 初始化持久化存储
    this.storage = new SimpleMemoryStorage(gatewayConfig.storageDir);

    // 初始化记忆管理器（可选）
    this.memoryManager = gatewayConfig.memoryManager;
    if (this.memoryManager) {
      this.autoWriter = new AutoMemoryWriter(this.memoryManager, {
        defaultImportance: config.memory?.defaultImportance ?? 0.3,
        enabled: config.memory?.enabled ?? false
      });
    }

    // 初始化 ImportanceEvaluator
    this.importanceEvaluator = new ImportanceEvaluator({
      defaultImportance: config.memory?.defaultImportance ?? 0.3
    });

    // 初始化 SoulLoader
    this.soulLoader = new SoulLoader();
  }

  /**
   * 初始化 Gateway
   *
   * 从持久化存储加载已有的 Session 历史。
   * 必须在使用 Gateway 之前调用此方法。
   */
  async initialize(): Promise<void> {
    const sessionKeys = await this.storage.listSessions();

    for (const sessionKey of sessionKeys) {
      const messages = await this.storage.load(sessionKey);
      if (messages.length > 0) {
        // 创建 Session 并恢复历史消息
        const session = this.sessionManager.getOrCreate(sessionKey, {
          channel: 'restored'
        });
        // 恢复历史消息
        for (const msg of messages) {
          session.addMessage({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined
          });
        }
      }
    }

    console.log(`[Gateway] 从记忆加载了 ${sessionKeys.length} 个 Session`);
  }

  /**
   * 处理消息
   *
   * @param ctx - 消息上下文
   * @returns 响应
   */
  async handleMessage(ctx: MessageContext): Promise<Response> {
    // 1. 路由消息到 Session
    const sessionId = this.router.route(this.toRouteContext(ctx));

    // 2. 获取或创建 Session
    const session = this.sessionManager.getOrCreate(sessionId, {
      channel: ctx.channel,
      userId: ctx.userId,
      groupId: ctx.groupId
    });

    // 3. 获取或创建 Agent
    const agent = this.agentRegistry.getOrCreate(sessionId);

    // 4. 调用 Agent 处理消息
    const response = await agent.chat(ctx.content);

    // 5. 解析 importance 标记
    const parseResult = this.importanceEvaluator.parse(response.content);

    // 6. 使用剥离后的内容
    const cleanContent = parseResult.strippedContent;

    // 7. 记录消息到 Session 历史
    session.addMessage({
      role: 'user',
      content: ctx.content
    });
    session.addMessage({
      role: 'assistant',
      content: cleanContent
    });

    // 8. 保存对话历史到持久化存储
    await this.saveSessionHistory(session);

    // 9. 自动写入记忆（传入 importance）
    if (this.autoWriter) {
      const importance = parseResult.importance ?? this.config.memory?.defaultImportance ?? 0.3;
      await this.autoWriter.writeConversation(sessionId, ctx.content, cleanContent, importance);
    }

    // 10. 返回响应
    return {
      content: cleanContent,
      sessionId
    };
  }

  /**
   * 流式处理消息
   *
   * @param ctx - 消息上下文
   * @yields 流式响应事件
   */
  async *streamHandleMessage(ctx: MessageContext): AsyncGenerator<StreamChatEvent & { sessionId: string }> {
    // 1. 路由消息到 Session
    const sessionId = this.router.route(this.toRouteContext(ctx));

    // 2. 获取或创建 Session
    const session = this.sessionManager.getOrCreate(sessionId, {
      channel: ctx.channel,
      userId: ctx.userId,
      groupId: ctx.groupId
    });

    // 3. 获取或创建 Agent
    const agent = this.agentRegistry.getOrCreate(sessionId);

    // 4. 记录用户消息到 Session 历史
    session.addMessage({
      role: 'user',
      content: ctx.content
    });

    // 5. 流式调用 Agent 处理消息
    let fullContent = '';
    for await (const event of agent.streamChat(ctx.content)) {
      if (event.content) {
        fullContent += event.content;
      }
      yield { ...event, sessionId };

      if (event.done) {
        break;
      }
    }

    // 6. 解析 importance 标记
    const parseResult = this.importanceEvaluator.parse(fullContent);

    // 7. 使用剥离后的内容
    const cleanContent = parseResult.strippedContent;

    // 8. 记录助手消息到 Session 历史
    session.addMessage({
      role: 'assistant',
      content: cleanContent
    });

    // 9. 保存对话历史到持久化存储
    await this.saveSessionHistory(session);

    // 10. 自动写入记忆（传入 importance）
    if (this.autoWriter) {
      const importance = parseResult.importance ?? this.config.memory?.defaultImportance ?? 0.3;
      await this.autoWriter.writeConversation(sessionId, ctx.content, cleanContent, importance);
    }
  }

  /**
   * 获取或创建指定上下文的 Agent
   *
   * @param ctx - 消息上下文
   * @returns Agent 实例和 Session ID
   */
  getOrCreateAgent(ctx: MessageContext): { agent: MiniclawAgent; sessionId: string } {
    const sessionId = this.router.route(this.toRouteContext(ctx));

    // 确保 Session 存在
    this.sessionManager.getOrCreate(sessionId, {
      channel: ctx.channel,
      userId: ctx.userId,
      groupId: ctx.groupId
    });

    const agent = this.agentRegistry.getOrCreate(sessionId);
    return { agent, sessionId };
  }

  /**
   * 获取 Gateway 状态
   *
   * @returns 状态信息
   */
  getStatus(): GatewayStatus {
    return {
      agentCount: this.agentRegistry.count(),
      sessionCount: this.sessionManager.count()
    };
  }

  /**
   * 销毁指定的 Session
   *
   * @param sessionId - Session ID
   */
  destroySession(sessionId: string): void {
    this.agentRegistry.destroy(sessionId);
    this.sessionManager.destroy(sessionId);
  }

  /**
   * 清理所有资源
   */
  async cleanup(): Promise<void> {
    // 先持久化记忆数据（静默降级）
    try {
      await this.memoryManager?.persist();
    } catch {
      // 静默降级，不抛异常
    }
    // 然后销毁资源
    this.agentRegistry.destroyAll();
    // SessionManager 没有destroyAll，需要逐个清理
    const sessions = this.sessionManager.getAll();
    for (const session of sessions) {
      this.sessionManager.destroy(session.id);
    }
  }

  /**
   * 获取路由器实例
   *
   * @returns Router 实例
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * 获取 Session 管理器实例
   *
   * @returns SessionManager 实例
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * 获取 Agent 注册表实例
   *
   * @returns AgentRegistry 实例
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  /**
   * 获取配置
   *
   * @returns 配置对象
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * 获取 Soul 加载器实例
   *
   * @returns SoulLoader 实例
   */
  getSoulLoader(): SoulLoader {
    return this.soulLoader;
  }

  /**
   * 获取 Importance 评估器实例
   *
   * @returns ImportanceEvaluator 实例
   */
  getImportanceEvaluator(): ImportanceEvaluator {
    return this.importanceEvaluator;
  }

  /**
   * 将 MessageContext 转换为 RouteContext
   *
   * @param ctx - 消息上下文
   * @returns 路由上下文
   */
  private toRouteContext(ctx: MessageContext): RouteContext {
    return {
      channel: ctx.channel,
      userId: ctx.userId,
      groupId: ctx.groupId,
      clientId: ctx.clientId,
      content: ctx.content
    };
  }

  /**
   * 保存 Session 的对话历史到持久化存储
   *
   * @param session - Session 实例
   */
  private async saveSessionHistory(session: Session): Promise<void> {
    const messages: StorageMessage[] = session.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp?.toISOString()
    }));

    await this.storage.save(session.id, messages);
    console.log(`[Gateway] 保存对话历史到: ${session.id}`);
  }
}