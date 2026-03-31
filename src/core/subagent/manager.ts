/**
 * @fileoverview 子代理管理器
 *
 * 管理子代理的创建、执行、状态和清理。
 * 集成 AgentRegistry 实现动态创建和执行 Agent。
 *
 * @module core/subagent/manager
 */

import { randomUUID } from 'crypto';
import type {
  SubagentInfo,
  SpawnOptions,
  SubagentResult,
  SubagentManagerConfig,
  SubagentStats
} from './types.js';
import type { AgentRegistry } from '../agent/registry.js';

/**
 * 获取日志前缀
 * 
 * @param agentId - Agent 类型 ID
 * @returns 日志前缀字符串
 */
function getLogPrefix(agentId: string): string {
  return `[Subagent:${agentId}]`;
}

/**
 * 获取调用者日志前缀
 * 
 * @param callerId - 调用者 ID
 * @param isSubagent - 调用者是否是子代理
 * @returns 日志前缀字符串
 */
function getCallerPrefix(callerId: string, isSubagent: boolean): string {
  return isSubagent ? `[Subagent:${callerId}]` : `[${callerId}]`;
}

/**
 * 打印日志
 * 
 * @param agentId - Agent 类型 ID
 * @param message - 日志消息
 */
function log(agentId: string, message: string): void {
  console.log(`${getLogPrefix(agentId)} ${message}`);
}

/**
 * 打印调用者日志
 * 
 * @param callerId - 调用者 ID
 * @param isSubagent - 调用者是否是子代理
 * @param message - 日志消息
 */
function logCaller(callerId: string, isSubagent: boolean, message: string): void {
  console.log(`${getCallerPrefix(callerId, isSubagent)} ${message}`);
}

/**
 * 打印分隔线
 * 
 * @param agentId - Agent 类型 ID
 * @param title - 分隔线标题（可选）
 */
function logDivider(agentId: string, title?: string): void {
  if (title) {
    console.log(`${getLogPrefix(agentId)} ${'═'.repeat(10)} ${title} ${'═'.repeat(10)}`);
  } else {
    console.log(`${getLogPrefix(agentId)} ${'─'.repeat(40)}`);
  }
}

/**
 * 打印调用者分隔线
 * 
 * @param callerId - 调用者 ID
 * @param isSubagent - 调用者是否是子代理
 * @param title - 分隔线标题（可选）
 */
function logCallerDivider(callerId: string, isSubagent: boolean, title?: string): void {
  const prefix = getCallerPrefix(callerId, isSubagent);
  if (title) {
    console.log(`${prefix} ${'═'.repeat(10)} ${title} ${'═'.repeat(10)}`);
  } else {
    console.log(`${prefix} ${'─'.repeat(40)}`);
  }
}

/**
 * 子代理管理器
 *
 * 负责子代理的生命周期管理：
 * - 创建子代理（权限检查 + Agent 实例创建）
 * - 执行子代理任务
 * - 状态管理
 * - 结果收集
 * - 定期清理
 */
export class SubagentManager {
  /** 子代理存储 */
  private subagents: Map<string, SubagentInfo> = new Map();

  /** Agent 注册表 */
  private registry: AgentRegistry;

  /** 最大并发数 */
  private maxConcurrent: number;

  /** 默认超时时间 */
  private defaultTimeout: number;

  /** 清理间隔 */
  private cleanupInterval: number;

  /** 清理定时器 */
  private cleanupTimer?: ReturnType<typeof setInterval>;

  /**
   * 创建 SubagentManager 实例
   *
   * @param config - 配置
   * @param registry - Agent 注册表
   */
  constructor(config: SubagentManagerConfig, registry: AgentRegistry) {
    this.registry = registry;
    this.maxConcurrent = config.maxConcurrent ?? 5;
    this.defaultTimeout = config.defaultTimeout ?? 60000;
    this.cleanupInterval = config.cleanupInterval ?? 300000;

    // 启动定期清理
    this.startCleanup();
  }

  /**
   * 创建子代理
   *
   * @param options 创建选项
   * @returns 子代理 ID
   * @throws 当并发数达到上限或权限检查失败时抛出错误
   */
  async spawn(options: SpawnOptions): Promise<string> {
    const agentId = options.agentId ?? 'main';
    const parentAgentId = options.parentAgentId;
    const parentIsSubagent = options.parentIsSubagent || false;
    
    // 日志前缀：使用调用者身份（不是目标子代理身份）
    const callerId = parentAgentId || 'system';

    // ===== 日志：开始创建子代理 =====
    logCallerDivider(callerId, parentIsSubagent, `创建子代理 ${agentId}`);
    logCaller(callerId, parentIsSubagent, `📋 目标 Agent: ${agentId}`);
    logCaller(callerId, parentIsSubagent, `📋 任务: ${options.task.substring(0, 100)}${options.task.length > 100 ? '...' : ''}`);
    logCaller(callerId, parentIsSubagent, `📋 当前活跃子代理数: ${this.getActiveCount()}/${this.maxConcurrent}`);

    // 检查并发限制
    if (this.getActiveCount() >= this.maxConcurrent) {
      logCaller(callerId, parentIsSubagent, `❌ 并发限制: 已达上限 ${this.maxConcurrent}`);
      throw new Error(`Maximum concurrent subagents reached (${this.maxConcurrent})`);
    }

    // 权限检查（如果有父 Agent）
    if (parentAgentId) {
      const canSpawn = this.registry.canSpawnSubagent(parentAgentId, agentId);
      logCaller(callerId, parentIsSubagent, `🔐 权限检查: ${parentAgentId} → ${agentId} = ${canSpawn ? '✅ 允许' : '❌ 拒绝'}`);
      if (!canSpawn) {
        logCaller(callerId, parentIsSubagent, `❌ 权限拒绝: ${parentAgentId} 不允许创建 ${agentId}`);
        throw new Error(
          `Agent '${parentAgentId}' is not allowed to spawn subagent of type '${agentId}'`
        );
      }
    }

    // 生成唯一 ID
    const id = `sub-${randomUUID()}`;
    const sessionKey = `subagent:${agentId}:${id}`;

    // 获取 Agent 配置的超时时间
    const timeout = options.timeout ?? this.defaultTimeout;

    // 创建子代理信息
    const info: SubagentInfo = {
      id,
      agentId,
      sessionKey,
      parentAgentId,
      task: options.task,
      status: 'pending',
      createdAt: new Date(),
      timeout,
      skills: options.skills,
      model: options.model
    };

    this.subagents.set(id, info);
    logCaller(callerId, parentIsSubagent, `🆔 子代理 ID: ${id}`);
    logCaller(callerId, parentIsSubagent, `🆔 Session Key: ${sessionKey}`);

    // 通过 AgentRegistry 创建 Agent 实例
    try {
      const agentConfig = this.registry.getConfig(agentId);
      logCaller(callerId, parentIsSubagent, `📦 Agent 配置: ${agentConfig?.name || agentId}, model=${agentConfig?.model || '默认'}`);
      
      this.registry.getOrCreate(sessionKey, agentId);
      logCaller(callerId, parentIsSubagent, `✅ Agent 实例创建成功`);
      logCallerDivider(callerId, parentIsSubagent);
    } catch (err) {
      // 创建失败，清理子代理信息
      this.subagents.delete(id);
      throw err;
    }

    return id;
  }

  /**
   * 执行子代理任务
   *
   * @param subagentId 子代理 ID
   * @returns 执行结果
   */
  async execute(subagentId: string): Promise<SubagentResult> {
    const info = this.subagents.get(subagentId);
    if (!info) {
      return {
        success: false,
        subagentId,
        error: 'Subagent not found',
        duration: 0,
        status: 'failed'
      };
    }

    // 检查状态
    if (info.status !== 'pending') {
      return {
        success: false,
        subagentId,
        error: `Subagent is not in pending state (current: ${info.status})`,
        duration: 0,
        status: info.status
      };
    }

    // 标记开始执行
    info.status = 'running';
    info.startedAt = new Date();
    const startTime = Date.now();

    // ===== 日志：开始执行 =====
    logDivider(info.agentId, `执行子代理 ${info.agentId}`);
    log(info.agentId, `🆔 子代理 ID: ${subagentId}`);
    log(info.agentId, `🆔 Session Key: ${info.sessionKey}`);
    log(info.agentId, `📋 任务: ${info.task.substring(0, 100)}${info.task.length > 100 ? '...' : ''}`);
    log(info.agentId, `⏱️ 超时: ${info.timeout}ms`);

    try {
      // 获取 Agent 实例
      const agent = this.registry.get(info.sessionKey);
      if (!agent) {
        throw new Error('Agent instance not found');
      }
      log(info.agentId, `✅ 获取 Agent 实例成功`);

      // 构建任务消息
      let taskMessage = info.task;
      if (info.skills && info.skills.length > 0) {
        taskMessage = `[Skills: ${info.skills.join(', ')}]\n\n${info.task}`;
        log(info.agentId, `📦 注入技能: ${info.skills.join(', ')}`);
      }

      // 调用 Agent 执行任务
      log(info.agentId, `🚀 开始调用 Agent.chat()...`);
      const response = await agent.chat(taskMessage);

      // 标记完成
      info.status = 'completed';
      info.result = response.content;
      info.endedAt = new Date();
      const duration = Date.now() - startTime;

      // ===== 日志：执行完成 =====
      log(info.agentId, `✅ 执行成功`);
      log(info.agentId, `⏱️ 耗时: ${duration}ms`);
      log(info.agentId, `📝 结果长度: ${response.content.length} 字符`);
      log(info.agentId, `📝 结果预览: ${response.content.substring(0, 200)}${response.content.length > 200 ? '...' : ''}`);
      log(info.agentId, `📤 返回数据给主代理...`);
      logDivider(info.agentId, );

      return {
        success: true,
        subagentId,
        data: response.content,
        duration,
        status: 'completed'
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const duration = Date.now() - startTime;

      // 标记失败
      info.status = 'failed';
      info.error = errorMsg;
      info.endedAt = new Date();

      // ===== 日志：执行失败 =====
      log(info.agentId, `❌ 执行失败: ${errorMsg}`);
      log(info.agentId, `⏱️ 耗时: ${duration}ms`);
      logDivider(info.agentId, );

      return {
        success: false,
        subagentId,
        error: errorMsg,
        duration,
        status: 'failed'
      };
    }
  }

  /**
   * 创建并执行子代理（便捷方法）
   *
   * @param options 创建选项
   * @returns 执行结果
   */
  async spawnAndExecute(options: SpawnOptions): Promise<SubagentResult> {
    const subagentId = await this.spawn(options);
    return this.execute(subagentId);
  }

  /**
   * 开始执行子代理（仅更新状态）
   *
   * @param subagentId 子代理 ID
   */
  startExecution(subagentId: string): void {
    const info = this.subagents.get(subagentId);
    if (info && info.status === 'pending') {
      info.status = 'running';
      info.startedAt = new Date();
    }
  }

  /**
   * 标记子代理完成
   *
   * @param subagentId 子代理 ID
   * @param result 执行结果
   */
  complete(subagentId: string, result: string): void {
    const info = this.subagents.get(subagentId);
    if (info) {
      info.status = 'completed';
      info.result = result;
      info.endedAt = new Date();
    }
  }

  /**
   * 标记子代理失败
   *
   * @param subagentId 子代理 ID
   * @param error 错误信息
   */
  fail(subagentId: string, error: string): void {
    const info = this.subagents.get(subagentId);
    if (info) {
      info.status = 'failed';
      info.error = error;
      info.endedAt = new Date();
    }
  }

  /**
   * 标记子代理超时
   *
   * @param subagentId 子代理 ID
   */
  timeout(subagentId: string): void {
    const info = this.subagents.get(subagentId);
    if (info) {
      info.status = 'timeout';
      info.error = 'Execution timeout';
      info.endedAt = new Date();
    }
  }

  /**
   * 终止子代理
   *
   * @param subagentId 子代理 ID
   */
  kill(subagentId: string): boolean {
    const info = this.subagents.get(subagentId);
    if (info && (info.status === 'pending' || info.status === 'running')) {
      info.status = 'killed';
      info.endedAt = new Date();

      // 销毁 Agent 实例
      this.registry.destroy(info.sessionKey);

      return true;
    }
    return false;
  }

  /**
   * 获取子代理信息
   *
   * @param subagentId 子代理 ID
   * @returns 子代理信息
   */
  get(subagentId: string): SubagentInfo | undefined {
    return this.subagents.get(subagentId);
  }

  /**
   * 获取所有子代理
   */
  getAll(): SubagentInfo[] {
    return Array.from(this.subagents.values());
  }

  /**
   * 获取活跃子代理（pending 或 running）
   */
  getActive(): SubagentInfo[] {
    return this.getAll().filter(
      info => info.status === 'pending' || info.status === 'running'
    );
  }

  /**
   * 获取活跃子代理数量
   */
  getActiveCount(): number {
    return this.getActive().length;
  }

  /**
   * 检查是否可以创建新子代理
   */
  canSpawn(): boolean {
    return this.getActiveCount() < this.maxConcurrent;
  }

  /**
   * 等待子代理完成
   *
   * @param subagentId 子代理 ID
   * @param timeout 超时时间（毫秒）
   * @returns 执行结果
   */
  async await(subagentId: string, timeout?: number): Promise<SubagentResult> {
    const info = this.subagents.get(subagentId);
    if (!info) {
      return {
        success: false,
        subagentId,
        error: 'Subagent not found',
        duration: 0,
        status: 'failed'
      };
    }

    const startTime = Date.now();
    const checkInterval = 100;
    const maxWait = timeout ?? info.timeout;

    return new Promise((resolve) => {
      const check = () => {
        const current = this.subagents.get(subagentId);
        if (!current) {
          resolve({
            success: false,
            subagentId,
            error: 'Subagent not found',
            duration: Date.now() - startTime,
            status: 'failed'
          });
          return;
        }

        // 检查是否完成
        if (current.status !== 'pending' && current.status !== 'running') {
          const duration = Date.now() - startTime;

          if (current.status === 'completed') {
            resolve({
              success: true,
              subagentId,
              data: current.result,
              duration,
              status: current.status
            });
          } else {
            resolve({
              success: false,
              subagentId,
              error: current.error ?? `Subagent ${current.status}`,
              duration,
              status: current.status
            });
          }
          return;
        }

        // 检查超时
        if (Date.now() - startTime > maxWait) {
          this.timeout(subagentId);
          resolve({
            success: false,
            subagentId,
            error: 'Wait timeout',
            duration: Date.now() - startTime,
            status: 'timeout'
          });
          return;
        }

        // 继续等待
        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  /**
   * 获取统计信息
   */
  getStats(): SubagentStats {
    const all = this.getAll();
    return {
      total: all.length,
      active: this.getActiveCount(),
      completed: all.filter(s => s.status === 'completed').length,
      failed: all.filter(s => s.status === 'failed' || s.status === 'timeout').length,
      maxConcurrent: this.maxConcurrent
    };
  }

  /**
   * 清理已完成的子代理
   */
  cleanup(): number {
    const toDelete: string[] = [];

    for (const [id, info] of this.subagents) {
      // 清理已完成、失败、超时、被终止的子代理
      if (['completed', 'failed', 'timeout', 'killed'].includes(info.status)) {
        // 同时销毁 Agent 实例
        this.registry.destroy(info.sessionKey);
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.subagents.delete(id);
    }

    return toDelete.length;
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  /**
   * 停止定期清理
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stopCleanup();

    // 销毁所有 Agent 实例
    for (const info of this.subagents.values()) {
      this.registry.destroy(info.sessionKey);
    }

    this.subagents.clear();
  }
}

/**
 * 创建子代理管理器
 *
 * @param config - 配置
 * @param registry - Agent 注册表
 */
export function createSubagentManager(
  config: SubagentManagerConfig,
  registry: AgentRegistry
): SubagentManager {
  return new SubagentManager(config, registry);
}