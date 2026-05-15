/**
 * 创建定时任务工具
 *
 * 通过 scheduler_create 工具创建定时提醒或周期性任务
 */

import { Type, type Static } from '@sinclair/typebox';
import { randomUUID } from 'crypto';
import type {
  TaskType,
  ActionType,
  SchedulerCreateResult,
} from '../scheduler/types.js';
import type { TaskStore } from '../scheduler/task-store.js';
import { findDuplicateTask } from '../scheduler/dedup.js';

/**
 * 工具参数 schema
 */
const SchedulerCreateParamsSchema = Type.Object({
  content: Type.String({ description: '任务内容描述（用户原始语言）' }),
  executeTime: Type.String({
    description: '执行时间：ISO 时间戳 或 cron 表达式',
  }),
  taskType: Type.Union(
    [Type.Literal('one-time'), Type.Literal('recurring')],
    { description: '任务类型：一次性(one-time) 或 周期性(recurring)' }
  ),
  actionType: Type.Union(
    [Type.Literal('reminder'), Type.Literal('instruction')],
    { description: '动作类型：提醒(reminder) 或 指令(instruction)' }
  ),
  agentId: Type.Optional(
    Type.String({ description: '目标 Agent ID（instruction 类型时）' })
  ),
});

type SchedulerCreateParams = Static<typeof SchedulerCreateParamsSchema>;

/**
 * 工具详情类型
 */
export interface SchedulerCreateDetails {
  taskId: string;
  content: string;
  executeTime: string;
  taskType: TaskType;
  actionType: ActionType;
}

/**
 * 创建定时任务工具定义
 */
export function createSchedulerCreateTool(
  taskStore: TaskStore,
  getUserId: () => string,
  getChannel: () => 'cli' | 'api' | 'web' | 'feishu'
) {
  return {
    name: 'scheduler_create',
    label: '创建定时任务',
    description:
      '创建定时任务（提醒或预设指令）。支持一次性任务和周期性任务。',
    parameters: SchedulerCreateParamsSchema,

    async execute(
      _toolCallId: string,
      params: SchedulerCreateParams,
      _signal?: AbortSignal
    ): Promise<{
      content: Array<{ type: 'text'; text: string }>;
      details: SchedulerCreateDetails;
    }> {
      const userId = getUserId();
      const channel = getChannel();

      // 创建任务摘要（从内容提取关键词）
      const summary = params.content.slice(0, 20);

      // 检查重复任务
      const existingTasks = taskStore.getByUserId(userId);
      const duplicate = findDuplicateTask(
        {
          taskId: '',
          userId,
          channel,
          content: params.content,
          summary,
          executeTime: params.executeTime,
          taskType: params.taskType,
          actionType: params.actionType,
          status: 'pending',
          createdAt: new Date().toISOString(),
          retryCount: 0,
        },
        existingTasks
      );

      const result: SchedulerCreateResult = {
        success: false,
        taskId: '',
        message: '',
        duplicateCheck: {
          isDuplicate: duplicate !== undefined,
          existingTaskId: duplicate?.taskId || null,
        },
      };

      if (duplicate) {
        result.message = `发现相似任务（ID: ${duplicate.taskId}）。请确认是否要合并或创建新任务。`;
      } else {
        // 创建新任务
        const taskId = randomUUID();
        const task = {
          taskId,
          userId,
          channel,
          content: params.content,
          summary,
          executeTime: params.executeTime,
          taskType: params.taskType,
          actionType: params.actionType,
          actionParams: params.agentId ? { agentId: params.agentId } : undefined,
          status: 'pending' as const,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };

        taskStore.create(task);
        result.success = true;
        result.taskId = taskId;
        result.message = `定时任务已创建（ID: ${taskId}）。将在 ${params.executeTime} 执行。`;
      }

      return {
        content: [{ type: 'text', text: result.message }],
        details: {
          taskId: result.taskId,
          content: params.content,
          executeTime: params.executeTime,
          taskType: params.taskType,
          actionType: params.actionType,
        },
      };
    },
  };
}

export type SchedulerCreateTool = ReturnType<typeof createSchedulerCreateTool>;