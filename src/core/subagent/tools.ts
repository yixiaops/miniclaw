/**
 * @fileoverview 子代理工具实现
 * 
 * 实现 sessions_spawn 和 subagents 工具
 * 
 * @module core/subagent/tools
 */

import { Type } from '@sinclair/typebox';
import type {
  SessionsSpawnParams,
  SessionsSpawnResult,
  SubagentsParams,
  SubagentsResult,
  SubagentInfo
} from './types.js';
import type { SubagentManager } from './manager.js';

/**
 * 创建 sessions_spawn 工具
 */
export function createSessionsSpawnTool(manager: SubagentManager) {
  return {
    name: 'sessions_spawn',
    description: '创建子代理执行任务。适用于：并行处理、专业任务委托。返回子代理 ID 和执行结果。',
    parameters: Type.Object({
      task: Type.String({ 
        description: '任务描述，清晰说明子代理需要完成什么' 
      }),
      agentId: Type.Optional(Type.String({ 
        description: '指定 Agent 类型，如 etf、policy。不填则使用默认 Agent' 
      })),
      timeout: Type.Optional(Type.Number({ 
        description: '超时时间（秒），默认 60' 
      })),
      skills: Type.Optional(Type.Array(Type.String())),
      model: Type.Optional(Type.String({ 
        description: '指定模型' 
      }))
    }),

    async execute(
      _toolCallId: string,
      params: SessionsSpawnParams
    ): Promise<SessionsSpawnResult> {
      try {
        // 检查是否可以创建
        if (!manager.canSpawn()) {
          return {
            subagentId: '',
            sessionKey: '',
            success: false,
            error: 'Maximum concurrent subagents reached'
          };
        }

        // 创建子代理
        const subagentId = await manager.spawn({
          task: params.task,
          agentId: params.agentId,
          timeout: params.timeout ? params.timeout * 1000 : undefined,
          skills: params.skills,
          model: params.model
        });

        const info = manager.get(subagentId);
        
        // 标记开始执行
        manager.startExecution(subagentId);
        
        // 注意：这里不自动完成，让调用者决定何时完成
        // 实际实现应该调用 Agent 执行任务

        return {
          subagentId,
          sessionKey: info?.sessionKey ?? '',
          success: true,
          result: `Subagent ${subagentId} created and started`
        };

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          subagentId: '',
          sessionKey: '',
          success: false,
          error: message
        };
      }
    }
  };
}

/**
 * 创建 subagents 工具
 */
export function createSubagentsTool(manager: SubagentManager) {
  return {
    name: 'subagents',
    description: '管理子代理：列出、获取详情、终止、查看统计。',
    parameters: Type.Object({
      action: Type.Union([
        Type.Literal('list'),
        Type.Literal('get'),
        Type.Literal('kill'),
        Type.Literal('stats')
      ], { description: '操作类型' }),
      target: Type.Optional(Type.String({ 
        description: '子代理 ID（get/kill 时必填）' 
      }))
    }),

    async execute(
      _toolCallId: string,
      params: SubagentsParams
    ): Promise<SubagentsResult> {
      switch (params.action) {
        case 'list': {
          const list = manager.getActive();
          return {
            action: 'list',
            data: list
          };
        }

        case 'get': {
          if (!params.target) {
            return {
              action: 'get',
              data: 'Error: target is required for get action'
            };
          }
          const info = manager.get(params.target);
          if (!info) {
            return {
              action: 'get',
              data: `Subagent ${params.target} not found`
            };
          }
          return {
            action: 'get',
            data: info
          };
        }

        case 'kill': {
          if (!params.target) {
            return {
              action: 'kill',
              data: 'Error: target is required for kill action'
            };
          }
          const success = manager.kill(params.target);
          return {
            action: 'kill',
            data: success 
              ? `Subagent ${params.target} killed` 
              : `Failed to kill subagent ${params.target}`
          };
        }

        case 'stats': {
          const stats = manager.getStats();
          return {
            action: 'stats',
            data: stats
          };
        }

        default:
          return {
            action: params.action,
            data: `Unknown action: ${params.action}`
          };
      }
    }
  };
}

/**
 * 格式化子代理信息为字符串
 */
export function formatSubagentInfo(info: SubagentInfo): string {
  const lines = [
    `ID: ${info.id}`,
    `Agent: ${info.agentId}`,
    `Status: ${info.status}`,
    `Task: ${info.task}`,
    `Created: ${info.createdAt.toISOString()}`
  ];

  if (info.result) {
    lines.push(`Result: ${info.result.slice(0, 100)}...`);
  }

  if (info.error) {
    lines.push(`Error: ${info.error}`);
  }

  return lines.join('\n');
}