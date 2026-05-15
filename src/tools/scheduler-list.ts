/**
 * 查询定时任务列表工具
 */

import { Type, type Static } from '@sinclair/typebox';
import type { SchedulerListResult } from '../scheduler/types.js';
import type { TaskStore } from '../scheduler/task-store.js';

const SchedulerListParamsSchema = Type.Object({});

type SchedulerListParams = Static<typeof SchedulerListParamsSchema>;

/**
 * 工具详情类型
 */
export interface SchedulerListDetails {
  total: number;
  taskIds: string[];
}

/**
 * 查询定时任务列表工具定义
 */
export function createSchedulerListTool(
  taskStore: TaskStore,
  getUserId: () => string
) {
  return {
    name: 'scheduler_list',
    label: '查询定时任务',
    description: '查询当前用户的定时任务列表。',
    parameters: SchedulerListParamsSchema,

    async execute(
      _toolCallId: string,
      _params: SchedulerListParams,
      _signal?: AbortSignal
    ): Promise<{
      content: Array<{ type: 'text'; text: string }>;
      details: SchedulerListDetails;
    }> {
      const userId = getUserId();
      const pendingTasks = taskStore.getPendingByUserId(userId);

      const result: SchedulerListResult = {
        tasks: pendingTasks.map((task) => ({
          taskId: task.taskId,
          content: task.content,
          executeTime: task.executeTime,
          taskType: task.taskType,
          actionType: task.actionType,
          status: task.status,
          nextExecuteTime: null,
        })),
        total: pendingTasks.length,
      };

      const text =
        result.total === 0
          ? '您目前没有定时任务。'
          : `您有 ${result.total} 个定时任务：\n${result.tasks
              .map(
                (t, i) =>
                  `${i + 1}. [${t.taskId.slice(0, 8)}] ${t.executeTime} - ${t.content.slice(0, 30)}`
              )
              .join('\n')}`;

      return {
        content: [{ type: 'text', text }],
        details: {
          total: result.total,
          taskIds: pendingTasks.map((t) => t.taskId),
        },
      };
    },
  };
}

export type SchedulerListTool = ReturnType<typeof createSchedulerListTool>;