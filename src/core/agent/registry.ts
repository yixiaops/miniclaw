/**
 * @fileoverview Agent 运行时注册表
 *
 * 管理 Agent 实例的生命周期，包括创建、获取、销毁和清理空闲 Agent。
 *
 * @module core/agent/registry
 */

import type { MiniclawAgent } from './index.js';
import type { Config } from '../config.js';

/**
 * Agent 注册表项
 */
interface AgentEntry {
  /** Agent 实例 */
  agent: MiniclawAgent;
  /** 最后访问时间 */
  lastAccessedAt: number;
}

/**
 * 创建 Agent 的工厂函数类型
 */
export type CreateAgentFn = (sessionKey: string, config: Config) => MiniclawAgent;

/**
 * Agent 运行时注册表
 *
 * 管理所有活跃的 Agent 实例，提供：
 * - Agent 的创建和复用
 * - Agent 的销毁
 * - 空闲 Agent 的清理
 * - 数量限制
 */
export class AgentRegistry {
  /** Agent 存储 */
  private agents: Map<string, AgentEntry> = new Map();

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
  }

  /**
   * 获取或创建 Agent
   *
   * 如果指定 sessionKey 的 Agent 已存在，则返回现有实例。
   * 如果不存在，则创建新的 Agent 实例。
   *
   * @param sessionKey - Session Key
   * @returns Agent 实例
   * @throws 当达到最大 Agent 数量时抛出错误
   */
  getOrCreate(sessionKey: string): MiniclawAgent {
    const existing = this.agents.get(sessionKey);

    if (existing) {
      // 更新最后访问时间
      existing.lastAccessedAt = Date.now();
      return existing.agent;
    }

    // 检查是否达到最大数量
    if (this.agents.size >= this.maxAgents) {
      throw new Error('Maximum number of agents reached');
    }

    // 创建新 Agent
    const agent = this.createAgentFn(sessionKey, this.config);
    this.agents.set(sessionKey, {
      agent,
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