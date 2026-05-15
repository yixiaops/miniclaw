/**
 * 定时任务模块类型定义
 *
 * @module scheduler/types
 */

// ============================================================================
// 任务状态枚举
// ============================================================================

/** 任务状态 */
export type TaskStatus =
  | 'pending' // 待执行
  | 'executed' // 已执行
  | 'cancelled' // 已取消
  | 'failed' // 执行失败
  | 'waiting-push'; // 等待推送（用户离线）

/** 任务类型 */
export type TaskType = 'one-time' | 'recurring';

/** 动作类型 */
export type ActionType = 'reminder' | 'instruction';

/** 创建渠道 */
export type Channel = 'cli' | 'api' | 'web' | 'feishu';

// ============================================================================
// 核心实体
// ============================================================================

/** 定时任务实体 */
export interface ScheduledTask {
  /** 任务唯一标识（UUID v4） */
  taskId: string;
  /** 用户标识（用于权限隔离） */
  userId: string;
  /** 创建渠道 */
  channel: Channel;
  /** 任务内容（用户原始描述） */
  content: string;
  /** 内容摘要（用于去重匹配，关键词提取） */
  summary: string;
  /** 执行时间（ISO 时间戳 或 cron 表达式） */
  executeTime: string;
  /** 任务类型 */
  taskType: TaskType;
  /** 动作类型 */
  actionType: ActionType;
  /** 动作参数 */
  actionParams?: TaskActionParams;
  /** 任务状态 */
  status: TaskStatus;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt?: string;
  /** 重试次数（默认 0，最大 3） */
  retryCount: number;
  /** 最后执行时间（周期性任务） */
  lastExecuteTime?: string;
  /** 下次执行时间（周期性任务） */
  nextExecuteTime?: string;
}

/** 任务动作参数 */
export interface TaskActionParams {
  /** 目标 Agent ID（instruction 类型时） */
  agentId?: string;
  /** 预设指令内容 */
  instruction?: string;
}

/** 任务执行日志 */
export interface TaskExecutionLog {
  /** 日志唯一标识 */
  logId: string;
  /** 关联任务 ID */
  taskId: string;
  /** 实际执行时间 */
  executeTime: string;
  /** 执行结果 */
  result: 'success' | 'failed' | 'waiting';
  /** 错误信息（失败时） */
  errorMessage?: string;
  /** 实际使用的渠道 */
  channelUsed: Channel;
  /** 消息是否已发送 */
  messageSent: boolean;
}

/** 待推送消息 */
export interface PendingMessage {
  /** 消息唯一标识 */
  messageId: string;
  /** 关联任务 ID */
  taskId: string;
  /** 目标用户 */
  userId: string;
  /** 目标渠道 */
  channel: Channel;
  /** 消息内容 */
  content: string;
  /** 创建时间 */
  createdAt: string;
  /** 重试次数 */
  retryCount: number;
}

// ============================================================================
// 存储结构
// ============================================================================

/** 任务存储结构 */
export interface TaskStoreData {
  tasks: ScheduledTask[];
}

/** 执行日志存储结构 */
export interface TaskLogStoreData {
  logs: TaskExecutionLog[];
}

/** 待推送消息存储结构 */
export interface PendingMessageStoreData {
  messages: PendingMessage[];
}

// ============================================================================
// 工具参数
// ============================================================================

/** scheduler_create 工具参数 */
export interface SchedulerCreateParams {
  /** 任务内容 */
  content: string;
  /** 执行时间（ISO 或 cron） */
  executeTime: string;
  /** 任务类型 */
  taskType: TaskType;
  /** 动作类型 */
  actionType: ActionType;
  /** 目标 Agent ID（可选） */
  agentId?: string;
}

/** scheduler_delete 工具参数 */
export interface SchedulerDeleteParams {
  /** 任务 ID */
  taskId: string;
}

/** scheduler_update 工具参数 */
export interface SchedulerUpdateParams {
  /** 任务 ID */
  taskId: string;
  /** 新任务内容（可选） */
  content?: string;
  /** 新执行时间（可选） */
  executeTime?: string;
}

/** scheduler_list 工具返回 */
export interface SchedulerListResult {
  tasks: Array<{
    taskId: string;
    content: string;
    executeTime: string;
    taskType: TaskType;
    actionType: ActionType;
    status: TaskStatus;
    nextExecuteTime: string | null;
  }>;
  total: number;
}

/** scheduler_create 工具返回 */
export interface SchedulerCreateResult {
  success: boolean;
  taskId: string;
  message: string;
  duplicateCheck: {
    isDuplicate: boolean;
    existingTaskId: string | null;
  };
}