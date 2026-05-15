/**
 * 删除定时任务工具
 */

import { Type, type Static } from '@sinclair/typebox';
import type { TaskStore } from '../scheduler/task-store.js';

const SchedulerDeleteParamsSchema = Type.Object({
  taskId: Type.String({ description: '要删除的任务 ID' }),
});

type SchedulerDeleteParams = Static<typeof SchedulerDeleteParamsSchema>;

/**
 * 删除定时任务工具定义
 */
export function createSchedulerDeleteTool(
  taskStore: TaskStore,
  getUserId: () => string
) {
  return {
    name: 'scheduler_delete',
    label: '删除定时任务',
    description: '删除指定的定时任务。',
    parameters: SchedulerDeleteParamsSchema,

    async execute(
      _toolCallId: string,
      params: SchedulerDeleteParams,
      _signal?: AbortSignal
    ): Promise<{
      content: Array<{ type: 'text'; text: string }>;
      details: { taskId: string; success: boolean };
    }> {
      const userId = getUserId();
      const task = taskStore.getById(params.taskId);

      if (!task) {
        return {
          content: [{ type: 'text', text: '任务不存在。' }],
          details: { taskId: params.taskId, success: false },
        };
      }

      if (task.userId !== userId) {
        return {
          content: [
            { type: 'text', text: '无法删除其他用户的任务。' },
          ],
          details: { taskId: params.taskId, success: false },
        };
      }

      taskStore.update(params.taskId, { status: 'cancelled' });
      taskStore.delete(params.taskId);

      return {
        content: [
          { type: 'text', text: `任务 ${params.taskId} 已删除。` },
        ],
        details: { taskId: params.taskId, success: true },
      };
    },
  };
}

export type SchedulerDeleteTool = ReturnType<typeof createSchedulerDeleteTool>;