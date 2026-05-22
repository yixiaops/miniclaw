/**
 * 查询定时任务执行日志工具
 */

import { Type, type Static } from '@sinclair/typebox';
import type { ExecutionLogStore } from '../scheduler/execution-log-store.js';
import type { TaskStore } from '../scheduler/task-store.js';

const SchedulerLogsParamsSchema = Type.Object({
  /** 限制返回条数，默认 20 */
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  /** 指定任务 ID 过滤（可选） */
  taskId: Type.Optional(Type.String()),
});

type SchedulerLogsParams = Static<typeof SchedulerLogsParamsSchema>;

/**
 * 工具详情类型
 */
export interface SchedulerLogsDetails {
  total: number;
  logIds: string[];
}

/**
 * 查询定时任务执行日志工具定义
 */
export function createSchedulerLogsTool(
  executionLogStore: ExecutionLogStore,
  taskStore: TaskStore,
  _getUserId: () => string
) {
  return {
    name: 'scheduler_logs',
    label: '查询任务执行日志',
    description:
      '查询定时任务的执行历史记录，包括成功、失败和等待推送的记录。' +
      '可以指定 taskId 查看单个任务的历史，或者不指定查看最近的所有记录。',
    parameters: SchedulerLogsParamsSchema,

    async execute(
      _toolCallId: string,
      params: SchedulerLogsParams,
      _signal?: AbortSignal
    ): Promise<{
      content: Array<{ type: 'text'; text: string }>;
      details: SchedulerLogsDetails;
    }> {
      const limit = params.limit || 20;
      let logs = executionLogStore.getRecent(limit);

      // 如果指定了 taskId，过滤
      if (params.taskId) {
        logs = executionLogStore.getByTaskId(params.taskId).slice(0, limit);
      }

      // 获取任务映射（用于显示任务摘要）
      const allTasks = taskStore.getAll();
      const taskMap = new Map(allTasks.map((t) => [t.taskId, t]));

      if (logs.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text:
                params.taskId
                  ? `任务 ${params.taskId.slice(0, 8)} 暂无执行记录。`
                  : '暂无执行日志。',
            },
          ],
          details: { total: 0, logIds: [] },
        };
      }

      // 统计信息
      const stats = executionLogStore.getStats();

      // 格式化日志
      const lines = logs.map((log, i) => {
        const task = taskMap.get(log.taskId);
        const summary = task
          ? task.summary || task.content.slice(0, 40)
          : log.taskId.slice(0, 8);
        const time = new Date(log.executeTime).toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        const statusIcon =
          log.result === 'success'
            ? '✅'
            : log.result === 'failed'
              ? '❌'
              : '⏳';
        const errorInfo = log.errorMessage ? ` - ${log.errorMessage}` : '';

        return `${i + 1}. ${statusIcon} [${time}] ${summary}${errorInfo}`;
      });

      const statsText =
        `执行统计：共 ${stats.total} 条记录，成功 ${stats.success} 次，` +
        `失败 ${stats.failed} 次，等待推送 ${stats.waiting} 次\n`;

      const text = statsText + lines.join('\n');

      return {
        content: [{ type: 'text', text }],
        details: {
          total: logs.length,
          logIds: logs.map((l) => l.logId),
        },
      };
    },
  };
}

export type SchedulerLogsTool = ReturnType<typeof createSchedulerLogsTool>;
