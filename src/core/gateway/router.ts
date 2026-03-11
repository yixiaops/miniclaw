/**
 * @fileoverview 路由器 - 消息路由到对应 Session
 * @module core/gateway/router
 * @author Miniclaw Team
 * @created 2026-03-11
 */

/**
 * 路由规则
 */
export interface RouteRule {
  /** 规则 ID */
  id: string;
  /** 匹配条件 */
  match: {
    channel?: string;
    userId?: string;
    groupId?: string;
    pattern?: RegExp;
  };
  /** 目标 Session ID */
  targetSessionId: string;
  /** 优先级（数字越大优先级越高） */
  priority: number;
}

/**
 * 路由上下文
 */
export interface RouteContext {
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
 * 默认路由策略
 */
export type DefaultStrategy = 'byUser' | 'byGroup';

/**
 * 路由器配置
 */
export interface RouterConfig {
  /** 路由规则列表 */
  rules: RouteRule[];
  /** 默认路由策略 */
  defaultStrategy: DefaultStrategy;
}

/**
 * Router 类
 * 
 * 根据消息来源（通道、用户、群组）路由到对应 Session。
 * 
 * @example
 * ```ts
 * const router = new Router({
 *   rules: [],
 *   defaultStrategy: 'byUser'
 * });
 * 
 * const sessionId = router.route({
 *   channel: 'feishu',
 *   userId: 'user-123',
 *   content: 'Hello'
 * });
 * // sessionId = 'session-user-123'
 * ```
 */
export class Router {
  /** 路由规则列表 */
  private rules: RouteRule[];
  /** 默认路由策略 */
  private defaultStrategy: DefaultStrategy;

  /**
   * 创建 Router 实例
   * 
   * @param config - 路由器配置
   */
  constructor(config: RouterConfig) {
    this.rules = [...config.rules].sort((a, b) => b.priority - a.priority);
    this.defaultStrategy = config.defaultStrategy;
  }

  /**
   * 路由消息到 Session
   * 
   * @param ctx - 路由上下文
   * @returns Session ID
   */
  route(ctx: RouteContext): string {
    // 1. 尝试匹配自定义规则（按优先级）
    for (const rule of this.rules) {
      if (this.matchRule(rule, ctx)) {
        return rule.targetSessionId;
      }
    }

    // 2. 使用默认策略
    return this.defaultRoute(ctx);
  }

  /**
   * 添加路由规则
   * 
   * @param rule - 路由规则
   */
  addRule(rule: RouteRule): void {
    this.rules.push(rule);
    // 重新排序
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 移除路由规则
   * 
   * @param ruleId - 规则 ID
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  /**
   * 获取所有路由规则
   * 
   * @returns 路由规则列表
   */
  getRules(): RouteRule[] {
    return [...this.rules];
  }

  /**
   * 匹配规则
   * 
   * @param rule - 路由规则
   * @param ctx - 路由上下文
   * @returns 是否匹配
   */
  private matchRule(rule: RouteRule, ctx: RouteContext): boolean {
    const { match } = rule;

    // 检查通道
    if (match.channel && match.channel !== ctx.channel) {
      return false;
    }

    // 检查用户 ID
    if (match.userId && match.userId !== ctx.userId) {
      return false;
    }

    // 检查群组 ID
    if (match.groupId && match.groupId !== ctx.groupId) {
      return false;
    }

    // 检查消息模式
    if (match.pattern && !match.pattern.test(ctx.content)) {
      return false;
    }

    return true;
  }

  /**
   * 默认路由逻辑
   * 
   * @param ctx - 路由上下文
   * @returns Session ID
   */
  private defaultRoute(ctx: RouteContext): string {
    // CLI 通道：固定 Session
    if (ctx.channel === 'cli') {
      return 'session-cli';
    }

    // API 通道：按 clientId 隔离
    if (ctx.channel === 'api') {
      return `session-api-${ctx.clientId || 'default'}`;
    }

    // Web 通道：按 clientId 隔离
    if (ctx.channel === 'web') {
      return `session-web-${ctx.clientId || 'default'}`;
    }

    // Feishu 等其他通道：根据策略路由
    if (this.defaultStrategy === 'byGroup') {
      // 优先群组 ID
      if (ctx.groupId) {
        return `session-group-${ctx.groupId}`;
      }
      if (ctx.userId) {
        return `session-user-${ctx.userId}`;
      }
    } else {
      // byUser：优先用户 ID
      if (ctx.userId) {
        return `session-user-${ctx.userId}`;
      }
      if (ctx.groupId) {
        return `session-group-${ctx.groupId}`;
      }
    }

    // 兜底：使用通道名
    return `session-${ctx.channel}`;
  }
}