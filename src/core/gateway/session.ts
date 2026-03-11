/**
 * @fileoverview Session 管理器 - 管理用户会话和对话历史
 * @module core/gateway/session
 * @author Miniclaw Team
 * @created 2026-03-11
 */

/**
 * 消息结构
 */
export interface Message {
  /** 角色：user 或 assistant */
  role: 'user' | 'assistant' | 'system';
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp?: Date;
}

/**
 * Session 元数据
 */
export interface SessionMetadata {
  /** 通道类型 */
  channel: string;
  /** 用户 ID */
  userId?: string;
  /** 群组 ID */
  groupId?: string;
  /** 其他自定义字段 */
  [key: string]: string | undefined;
}

/**
 * Session 配置
 */
export interface SessionConfig {
  /** 最大历史消息数 */
  maxHistoryLength: number;
  /** Session 过期时间（毫秒） */
  sessionTtl: number;
  /** 最大并发 Session 数 */
  maxConcurrentSessions: number;
  /** 持久化存储类型 */
  persistence: 'memory' | 'sqlite' | 'file';
}

/**
 * Session 类
 * 
 * 表示一个用户会话，包含对话历史和元数据。
 * 
 * @example
 * ```ts
 * const session = new Session('session-1', { maxHistoryLength: 50 });
 * session.addMessage({ role: 'user', content: 'Hello' });
 * console.log(session.messages);
 * ```
 */
export class Session {
  /** Session ID */
  readonly id: string;
  /** 创建时间 */
  readonly createdAt: Date;
  /** 最后活跃时间 */
  lastActiveAt: Date;
  /** 对话历史 */
  messages: Message[];
  /** 元数据 */
  metadata: SessionMetadata;

  /** 最大历史消息数 */
  private maxHistoryLength: number;

  /**
   * 创建 Session 实例
   * 
   * @param id - Session ID
   * @param options - 配置选项
   */
  constructor(
    id: string,
    options: {
      maxHistoryLength: number;
      metadata?: SessionMetadata;
    }
  ) {
    this.id = id;
    this.createdAt = new Date();
    this.lastActiveAt = new Date();
    this.messages = [];
    this.metadata = options.metadata || { channel: 'unknown' };
    this.maxHistoryLength = options.maxHistoryLength;
  }

  /**
   * 添加消息到历史
   * 
   * @param message - 消息内容
   */
  addMessage(message: Message): void {
    this.messages.push({
      ...message,
      timestamp: message.timestamp || new Date()
    });

    // 超过最大长度时，移除最早的消息
    if (this.messages.length > this.maxHistoryLength) {
      this.messages = this.messages.slice(-this.maxHistoryLength);
    }

    this.lastActiveAt = new Date();
  }

  /**
   * 清空历史
   */
  clear(): void {
    this.messages = [];
    this.lastActiveAt = new Date();
  }

  /**
   * 检查是否过期
   * 
   * @param ttl - 过期时间（毫秒）
   * @returns 是否过期
   */
  isExpired(ttl: number): boolean {
    const now = Date.now();
    const lastActive = this.lastActiveAt.getTime();
    return now - lastActive > ttl;
  }
}

/**
 * SessionManager 类
 * 
 * 管理所有 Session 的创建、销毁、过期清理。
 * 
 * @example
 * ```ts
 * const manager = new SessionManager({
 *   maxHistoryLength: 50,
 *   sessionTtl: 3600000,
 *   maxConcurrentSessions: 100,
 *   persistence: 'memory'
 * });
 * 
 * const session = manager.getOrCreate('session-1', { channel: 'cli' });
 * ```
 */
export class SessionManager {
  /** Session 存储 */
  private sessions: Map<string, Session> = new Map();
  /** 配置 */
  private config: SessionConfig;

  /**
   * 创建 SessionManager 实例
   * 
   * @param config - Session 配置
   */
  constructor(config: SessionConfig) {
    this.config = config;
  }

  /**
   * 获取或创建 Session
   * 
   * @param sessionId - Session ID
   * @param metadata - Session 元数据（创建时使用）
   * @returns Session 实例
   * @throws {Error} 超过最大 Session 数时抛出错误
   */
  getOrCreate(sessionId: string, metadata?: SessionMetadata): Session {
    // 检查是否已存在
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastActiveAt = new Date();
      return existing;
    }

    // 检查是否超过最大数量
    if (this.sessions.size >= this.config.maxConcurrentSessions) {
      throw new Error(`Maximum concurrent sessions reached: ${this.config.maxConcurrentSessions}`);
    }

    // 创建新 Session
    const session = new Session(sessionId, {
      maxHistoryLength: this.config.maxHistoryLength,
      metadata: metadata || { channel: 'unknown' }
    });

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * 获取 Session
   * 
   * @param sessionId - Session ID
   * @returns Session 实例或 undefined
   */
  get(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 销毁 Session
   * 
   * @param sessionId - Session ID
   */
  destroy(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * 清理过期 Session
   */
  cleanup(): void {
    for (const [id, session] of this.sessions) {
      if (session.isExpired(this.config.sessionTtl)) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * 获取所有 Session
   * 
   * @returns Session 数组
   */
  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取 Session 数量
   * 
   * @returns Session 数量
   */
  count(): number {
    return this.sessions.size;
  }
}