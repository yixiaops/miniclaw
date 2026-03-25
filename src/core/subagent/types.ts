/**
 * @fileoverview 子代理系统类型定义
 * 
 * @module core/subagent/types
 */

/**
 * 子代理状态
 */
export type SubagentStatus = 
  | 'pending'    // 等待执行
  | 'running'    // 执行中
  | 'completed'  // 已完成
  | 'failed'     // 执行失败
  | 'timeout'    // 超时
  | 'killed';    // 被终止

/**
 * 子代理信息
 */
export interface SubagentInfo {
  /** 子代理 ID（UUID 格式） */
  id: string;
  /** Agent 类型 ID */
  agentId: string;
  /** 会话 Key */
  sessionKey: string;
  /** 任务描述 */
  task: string;
  /** 当前状态 */
  status: SubagentStatus;
  /** 执行结果（完成时） */
  result?: string;
  /** 错误信息（失败时） */
  error?: string;
  /** 创建时间 */
  createdAt: Date;
  /** 开始执行时间 */
  startedAt?: Date;
  /** 结束时间 */
  endedAt?: Date;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 配置的技能列表 */
  skills?: string[];
  /** 使用的模型 */
  model?: string;
}

/**
 * 创建子代理选项
 */
export interface SpawnOptions {
  /** 任务描述 */
  task: string;
  /** Agent 类型 ID，默认 'main' */
  agentId?: string;
  /** 超时时间（毫秒），默认 60000 */
  timeout?: number;
  /** 技能列表 */
  skills?: string[];
  /** 指定模型 */
  model?: string;
  /** 额外上下文 */
  context?: string;
}

/**
 * 子代理执行结果
 */
export interface SubagentResult {
  /** 是否成功 */
  success: boolean;
  /** 子代理 ID */
  subagentId: string;
  /** 执行结果（成功时） */
  data?: string;
  /** 错误信息（失败时） */
  error?: string;
  /** 执行时间（毫秒） */
  duration: number;
  /** 状态 */
  status: SubagentStatus;
}

/**
 * 子代理管理器配置
 */
export interface SubagentManagerConfig {
  /** 最大并发数，默认 5 */
  maxConcurrent?: number;
  /** 默认超时时间（毫秒），默认 60000 */
  defaultTimeout?: number;
  /** 清理间隔（毫秒），默认 300000 */
  cleanupInterval?: number;
}

/**
 * 子代理统计信息
 */
export interface SubagentStats {
  /** 总数 */
  total: number;
  /** 活跃数 */
  active: number;
  /** 已完成数 */
  completed: number;
  /** 失败数 */
  failed: number;
  /** 最大并发数 */
  maxConcurrent: number;
}

/**
 * sessions_spawn 工具参数
 */
export interface SessionsSpawnParams {
  /** 任务描述 */
  task: string;
  /** Agent 类型 */
  agentId?: string;
  /** 超时时间（秒） */
  timeout?: number;
  /** 技能列表 */
  skills?: string[];
  /** 指定模型 */
  model?: string;
}

/**
 * sessions_spawn 工具返回值
 */
export interface SessionsSpawnResult {
  /** 子代理 ID */
  subagentId: string;
  /** 会话 Key */
  sessionKey: string;
  /** 是否成功 */
  success: boolean;
  /** 结果（成功时） */
  result?: string;
  /** 错误（失败时） */
  error?: string;
}

/**
 * subagents 工具参数
 */
export interface SubagentsParams {
  /** 操作类型 */
  action: 'list' | 'get' | 'kill' | 'stats';
  /** 目标子代理 ID（get/kill 时必填） */
  target?: string;
}

/**
 * subagents 工具返回值
 */
export interface SubagentsResult {
  /** 操作类型 */
  action: string;
  /** 结果数据 */
  data: SubagentInfo[] | SubagentInfo | SubagentStats | string;
}