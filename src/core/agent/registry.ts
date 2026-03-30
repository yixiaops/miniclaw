/**
 * @fileoverview Agent 运行时注册表
 *
 * 管理 Agent 实例的生命周期，包括创建、获取、销毁和清理空闲 Agent。
 * 支持多 Agent 类型配置和子代理权限检查。
 *
 * @module core/agent/registry
 */

import type { MiniclawAgent } from './index.js';
import type { Config, AgentConfig, AgentsDefaults } from '../config.js';

/**
 * Agent 注册表项
 */
interface AgentEntry {
  /** Agent 实例 */
  agent: MiniclawAgent;
  /** Agent 类型 ID */
  agentId: string;
  /** 最后访问时间 */
  lastAccessedAt: number;
}

/**
 * 创建 Agent 的工厂函数类型
 */
export type CreateAgentFn = (
  sessionKey: string,
  config: Config,
  agentId: string,
  agentConfig?: AgentConfig,
  isSubagent?: boolean
) => MiniclawAgent;

/**
 * Agent 运行时注册表
 *
 * 管理所有活跃的 Agent 实例，提供：
 * - Agent 配置加载和管理
 * - Agent 的创建和复用
 * - Agent 的销毁
 * - 空闲 Agent 的清理
 * - 子代理权限检查
 * - 数量限制
 */
export class AgentRegistry {
  /** Agent 实例存储 */
  private agents: Map<string, AgentEntry> = new Map();

  /** Agent 配置存储 */
  private configs: Map<string, AgentConfig> = new Map();

  /** 默认配置 */
  private defaults: AgentsDefaults | null = null;

  /** 配置对象 */
  private config: Config;

  /** 创建 Agent 的工厂函数 */
  private createAgentFn: CreateAgentFn;

  /** 最大 Agent 数量 */
  private maxAgents: number = 50;

  /**
   * 创建 AgentRegistry 实例
   *
   * @param config - 配置对象
   * @param createAgentFn - 创建 Agent 的工厂函数
   * @param maxAgents - 最大 Agent 数量（默认 50）
   */
  constructor(config: Config, createAgentFn: CreateAgentFn, maxAgents?: number) {
    this.config = config;
    this.createAgentFn = createAgentFn;
    if (maxAgents !== undefined) {
      this.maxAgents = maxAgents;
    }

    // 自动加载配置（如果有）
    if (config.agents) {
      this.loadConfigs(config.agents.list, config.agents.defaults);
    }
  }

  /**
   * 加载 Agent 配置列表
   *
   * @param configs - Agent 配置列表
   * @param defaults - 默认配置
   */
  loadConfigs(configs: AgentConfig[], defaults: AgentsDefaults): void {
    this.defaults = defaults;
    this.configs.clear();

    for (const agentConfig of configs) {
      this.configs.set(agentConfig.id, agentConfig);
    }

    // 更新最大 Agent 数量
    if (defaults.maxConcurrent) {
      this.maxAgents = defaults.maxConcurrent;
    }
  }

  /**
   * 获取 Agent 配置
   *
   * @param agentId - Agent 类型 ID
   * @returns Agent 配置，如果不存在则返回 undefined
   */
  getConfig(agentId: string): AgentConfig | undefined {
    return this.configs.get(agentId);
  }

  /**
   * 获取所有 Agent 类型 ID
   *
   * @returns Agent 类型 ID 数组
   */
  getAgentTypes(): string[] {
    return Array.from(this.configs.keys());
  }

  /**
   * 检查父 Agent 是否允许创建指定类型的子代理
   *
   * @param parentAgentId - 父 Agent 类型 ID
   * @param childAgentId - 子代理类型 ID
   * @returns 是否允许
   */
  canSpawnSubagent(parentAgentId: string, childAgentId: string): boolean {
    // 获取父 Agent 配置
    const parentConfig = this.configs.get(parentAgentId);
    if (!parentConfig) {
      // 如果父 Agent 没有配置，检查默认行为
      // 默认不允许创建子代理
      return false;
    }

    // 检查 allowAgents 列表
    const allowAgents = parentConfig.subagents?.allowAgents;
    if (!allowAgents) {
      // 未配置 allowAgents，不允许创建子代理
      return false;
    }

    // 检查子代理类型是否在允许列表中
    return allowAgents.includes(childAgentId);
  }

  /**
   * 获取 Agent 允许创建的最大子代理并发数
   *
   * @param agentId - Agent 类型 ID
   * @returns 最大并发数
   */
  getMaxSubagentConcurrent(agentId: string): number {
    const agentConfig = this.configs.get(agentId);
    if (agentConfig?.subagents?.maxConcurrent) {
      return agentConfig.subagents.maxConcurrent;
    }
    // 使用默认值
    return this.defaults?.subagents?.maxConcurrent ?? 5;
  }

  /**
   * 获取或创建 Agent
   *
   * 如果指定 sessionKey 的 Agent 已存在，则返回现有实例。
   * 如果不存在，则创建新的 Agent 实例。
   *
   * @param sessionKey - Session Key
   * @param agentId - Agent 类型 ID（可选，默认 'main'）
   * @param isSubagent - 是否是子代理（可选，默认根据 sessionKey 判断）
   * @returns Agent 实例
   * @throws 当达到最大 Agent 数量时抛出错误
   */
  getOrCreate(sessionKey: string, agentId?: string, isSubagent?: boolean): MiniclawAgent {
    const targetAgentId = agentId || 'main';
    // 自动判断是否是子代理（sessionKey 以 'subagent:' 开头）
    const isSub = isSubagent ?? sessionKey.startsWith('subagent:');

    // 检查是否已存在
    const existing = this.agents.get(sessionKey);
    if (existing) {
      // 更新最后访问时间
      existing.lastAccessedAt = Date.now();
      return existing.agent;
    }

    // 检查是否达到最大数量
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Maximum number of agents reached (${this.maxAgents})`);
    }

    // 获取 Agent 配置
    const agentConfig = this.configs.get(targetAgentId);

    // 创建新 Agent
    const agent = this.createAgentFn(sessionKey, this.config, targetAgentId, agentConfig, isSub);
    this.agents.set(sessionKey, {
      agent,
      agentId: targetAgentId,
      lastAccessedAt: Date.now()
    });

    return agent;
  }

  /**
   * 获取 Agent
   *
   * @param sessionKey - Session Key
   * @returns Agent 实例，如果不存在则返回 undefined
   */
  get(sessionKey: string): MiniclawAgent | undefined {
    const entry = this.agents.get(sessionKey);
    if (entry) {
      entry.lastAccessedAt = Date.now();
      return entry.agent;
    }
    return undefined;
  }

  /**
   * 获取 Agent 的类型 ID
   *
   * @param sessionKey - Session Key
   * @returns Agent 类型 ID，如果不存在则返回 undefined
   */
  getAgentId(sessionKey: string): string | undefined {
    const entry = this.agents.get(sessionKey);
    return entry?.agentId;
  }

  /**
   * 销毁指定的 Agent
   *
   * @param sessionKey - Session Key
   */
  destroy(sessionKey: string): void {
    const entry = this.agents.get(sessionKey);
    if (entry) {
      // 调用 Agent 的清理方法（如果存在）
      if (typeof entry.agent.reset === 'function') {
        entry.agent.reset();
      }
      this.agents.delete(sessionKey);
    }
  }

  /**
   * 清理空闲时间超过阈值的 Agent
   *
   * @param idleTimeoutMs - 空闲超时时间（毫秒）
   */
  cleanupIdle(idleTimeoutMs: number): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [sessionKey, entry] of this.agents) {
      if (now - entry.lastAccessedAt > idleTimeoutMs) {
        keysToDelete.push(sessionKey);
      }
    }

    for (const sessionKey of keysToDelete) {
      this.destroy(sessionKey);
    }
  }

  /**
   * 获取当前活跃 Agent 数量
   *
   * @returns Agent 数量
   */
  count(): number {
    return this.agents.size;
  }

  /**
   * 获取所有 Session Key
   *
   * @returns Session Key 数组
   */
  getSessionKeys(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * 销毁所有 Agent
   */
  destroyAll(): void {
    for (const sessionKey of this.agents.keys()) {
      this.destroy(sessionKey);
    }
  }

  /**
   * 获取 Agent 的最后访问时间
   *
   * @param sessionKey - Session Key
   * @returns 最后访问时间戳，如果不存在则返回 0
   */
  getLastAccessTime(sessionKey: string): number {
    const entry = this.agents.get(sessionKey);
    return entry ? entry.lastAccessedAt : 0;
  }
}