/**
 * 更新定时任务工具
 */

import { Type, type Static } from '@sinclair/typebox';
import type { TaskStore } from '../scheduler/task-store.js';

const SchedulerUpdateParamsSchema = Type.Object({
  taskId: Type.String({ description: '要更新的任务 ID' }),
  content: Type.Optional(Type.String({ description: '新任务内容' })),
  executeTime: Type.Optional(
    Type.String({ description: '新执行时间（ISO 或 cron）' })
  ),
});

type SchedulerUpdateParams = Static<typeof SchedulerUpdateParamsSchema>;

/**
 * 更新定时任务工具定义
 */
export function createSchedulerUpdateTool(
  taskStore: TaskStore,
  getUserId: () => string
) {
  return {
    name: 'scheduler_update',
    label: '更新定时任务',
    description: '更新定时任务的内容或执行时间。',
    parameters: SchedulerUpdateParamsSchema,

    async execute(
      _toolCallId: string,
      params: SchedulerUpdateParams,
      _signal?: AbortSignal
    ): Promise<{
      content: Array<{ type: 'text'; text: string }>;
      details: { taskId: string; updatedFields: string[]; success: boolean };
    }> {
      const userId = getUserId();
      const task = taskStore.getById(params.taskId);

      if (!task) {
        return {
          content: [{ type: 'text', text: '任务不存在。' }],
          details: {
            taskId: params.taskId,
            updatedFields: [],
            success: false,
          },
        };
      }

      if (task.userId !== userId) {
        return {
          content: [
            { type: 'text', text: '无法更新其他用户的任务。' },
          ],
          details: {
            taskId: params.taskId,
            updatedFields: [],
            success: false,
          },
        };
      }

      const updates: Record<string, string> = {};
      const updatedFields: string[] = [];

      if (params.content) {
        updates.content = params.content;
        updates.summary = params.content.slice(0, 20);
        updatedFields.push('content');
      }

      if (params.executeTime) {
        updates.executeTime = params.executeTime;
        updatedFields.push('executeTime');
      }

      if (updatedFields.length > 0) {
        taskStore.update(params.taskId, updates);
      }

      return {
        content: [
          {
            type: 'text',
            text:
              updatedFields.length === 0
                ? '没有提供更新字段。'
                : `任务已更新：${updatedFields.join(', ')}`,
          },
        ],
        details: { taskId: params.taskId, updatedFields, success: true },
      };
    },
  };
}

export type SchedulerUpdateTool = ReturnType<typeof createSchedulerUpdateTool>;