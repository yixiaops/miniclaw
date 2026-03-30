/**
 * @fileoverview 子代理工具实现
 *
 * 实现 sessions_spawn 和 subagents 工具。
 * 集成 AgentRegistry 实现动态创建和执行子代理。
 *
 * @module core/subagent/tools
 */

import { Type, type Static } from '@sinclair/typebox';
import type { SubagentManager } from './manager.js';

// ============================================================================
// 日志配置
// ============================================================================

const LOG_PREFIX = '[SubagentTool]';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * sessions_spawn 工具参数 schema
 */
const SessionsSpawnParamsSchema = Type.Object({
  task: Type.String({
    description: '任务描述，清晰说明子代理需要完成什么'
  }),
  agentId: Type.Optional(Type.String({
    description: '指定 Agent 类型，如 etf、policy。不填则使用默认 Agent'
  })),
  parentAgentId: Type.Optional(Type.String({
    description: '父 Agent ID（用于权限检查，通常自动填充）'
  })),
  timeout: Type.Optional(Type.Number({
    description: '超时时间（秒），默认 60'
  })),
  skills: Type.Optional(Type.Array(Type.String())),
  model: Type.Optional(Type.String({
    description: '指定模型'
  }))
});

type SessionsSpawnParams = Static<typeof SessionsSpawnParamsSchema>;

/**
 * sessions_spawn 工具详情
 */
export interface SessionsSpawnDetails {
  subagentId: string;
  sessionKey: string;
  success: boolean;
  result?: string;
  error?: string;
}

/**
 * subagents 工具参数 schema
 */
const SubagentsParamsSchema = Type.Object({
  action: Type.Union([
    Type.Literal('list'),
    Type.Literal('get'),
    Type.Literal('kill'),
    Type.Literal('stats')
  ], { description: '操作类型' }),
  target: Type.Optional(Type.String({
    description: '子代理 ID（get/kill 时必填）'
  }))
});

type SubagentsParams = Static<typeof SubagentsParamsSchema>;

/**
 * subagents 工具详情
 */
export interface SubagentsDetails {
  action: string;
  data: unknown;
}

// ============================================================================
// 工具实现
// ============================================================================

/**
 * sessions_spawn 工具选项
 */
export interface SessionsSpawnToolOptions {
  /** 子代理管理器 */
  manager: SubagentManager;
  /** 当前 Agent ID（用于权限检查） */
  currentAgentId?: string;
  /** Agent 注册表（用于动态生成工具描述） */
  registry?: {
    getAgentTypes(): string[];
    getConfig(agentId: string): { name?: string; systemPrompt?: string } | undefined;
    canSpawnSubagent(parentId: string, childId: string): boolean;
  };
}

/**
 * 创建 sessions_spawn 工具
 *
 * @param options - 工具选项
 */
export function createSessionsSpawnTool(options: SessionsSpawnToolOptions) {
  const { manager, currentAgentId = 'main', registry } = options;

  // 动态生成可用的子代理列表
  let availableAgents = '';
  if (registry) {
    const allTypes = registry.getAgentTypes().filter(id => id !== currentAgentId);
    const allowedTypes = allTypes.filter(id => registry.canSpawnSubagent(currentAgentId, id));

    if (allowedTypes.length > 0) {
      const agentDetails = allowedTypes.map(id => {
        const config = registry.getConfig(id);
        const name = config?.name || id;
        // 从 systemPrompt 提取专长描述（前50字）
        const specialty = config?.systemPrompt
          ? config.systemPrompt.substring(0, 50).replace(/\n/g, ' ') + '...'
          : '';
        return `  - ${id}: ${name}${specialty ? ` — ${specialty}` : ''}`;
      }).join('\n');
      availableAgents = `\n\n可用的子代理类型：\n${agentDetails}`;
    }
  }

  const description = `创建子代理执行专业任务。当用户问题涉及特定专业领域时，应调用相应的子代理。${availableAgents}

参数：
- task: 任务描述（必填）
- agentId: 指定 Agent 类型（从上面的可用类型中选择）
- timeout: 超时时间（秒），默认 60

**重要**：遇到专业领域问题，优先使用此工具委托给专家子代理，不要自己回答。

返回执行结果。`;

  return {
    name: 'sessions_spawn',
    label: '创建子代理',
    description,
    parameters: SessionsSpawnParamsSchema,

    async execute(
      _toolCallId: string,
      params: SessionsSpawnParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: SessionsSpawnDetails }> {
      const agentId = params.agentId || 'main';
      const parentAgent = params.parentAgentId || currentAgentId;

      // ===== 日志：工具调用开始 =====
      console.log(`${LOG_PREFIX} ═════════════ 工具调用 sessions_spawn ═════════════`);
      console.log(`${LOG_PREFIX} 📋 调用参数:`);
      console.log(`${LOG_PREFIX}    - agentId: ${agentId}`);
      console.log(`${LOG_PREFIX}    - parentAgentId: ${parentAgent}`);
      console.log(`${LOG_PREFIX}    - task: ${params.task.substring(0, 80)}${params.task.length > 80 ? '...' : ''}`);
      console.log(`${LOG_PREFIX}    - timeout: ${params.timeout || 60}s`);

      try {
        // 检查是否可以创建
        if (!manager.canSpawn()) {
          console.log(`${LOG_PREFIX} ❌ 已达最大并发数`);
          return {
            content: [{ type: 'text', text: '错误: 已达到最大并发子代理数' }],
            details: {
              subagentId: '',
              sessionKey: '',
              success: false,
              error: 'Maximum concurrent subagents reached'
            }
          };
        }

        // 创建并执行子代理
        console.log(`${LOG_PREFIX} 🚀 调用 SubagentManager.spawnAndExecute()...`);
        const result = await manager.spawnAndExecute({
          task: params.task,
          agentId: params.agentId,
          parentAgentId: parentAgent,
          timeout: params.timeout ? params.timeout * 1000 : undefined,
          skills: params.skills,
          model: params.model
        });

        // 返回结果
        if (result.success) {
          const info = manager.get(result.subagentId);
          console.log(`${LOG_PREFIX} ✅ 子代理执行成功`);
          console.log(`${LOG_PREFIX}    - subagentId: ${result.subagentId}`);
          console.log(`${LOG_PREFIX}    - duration: ${result.duration}ms`);
          console.log(`${LOG_PREFIX} ══════════════════════════════════════════════════════`);
          return {
            content: [{ type: 'text', text: result.data || '任务执行成功' }],
            details: {
              subagentId: result.subagentId,
              sessionKey: info?.sessionKey ?? '',
              success: true,
              result: result.data
            }
          };
        } else {
          console.log(`${LOG_PREFIX} ❌ 子代理执行失败: ${result.error}`);
          console.log(`${LOG_PREFIX} ══════════════════════════════════════════════════════`);
          const info = manager.get(result.subagentId);
          return {
            content: [{ type: 'text', text: `错误: ${result.error}` }],
            details: {
              subagentId: result.subagentId,
              sessionKey: info?.sessionKey ?? '',
              success: false,
              error: result.error
            }
          };
        }

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log(`${LOG_PREFIX} ❌ 异常: ${message}`);
        console.log(`${LOG_PREFIX} ══════════════════════════════════════════════════════`);
        return {
          content: [{ type: 'text', text: `错误: ${message}` }],
          details: {
            subagentId: '',
            sessionKey: '',
            success: false,
            error: message
          }
        };
      }
    }
  };
}

/**
 * 创建 subagents 工具
 *
 * @param manager - 子代理管理器
 */
export function createSubagentsTool(manager: SubagentManager) {
  return {
    name: 'subagents',
    label: '管理子代理',
    description: `管理子代理：列出、获取详情、终止、查看统计。

操作类型：
- list: 列出活跃子代理
- get: 获取子代理详情（需要 target）
- kill: 终止子代理（需要 target）
- stats: 查看统计信息`,
    parameters: SubagentsParamsSchema,

    async execute(
      _toolCallId: string,
      params: SubagentsParams
    ): Promise<{ content: Array<{ type: 'text'; text: string }>; details: SubagentsDetails }> {
      switch (params.action) {
        case 'list': {
          const list = manager.getActive();
          const text = list.length === 0
            ? '当前没有活跃的子代理'
            : list.map(info => `- ${info.id} (${info.agentId}): ${info.status}`).join('\n');
          return {
            content: [{ type: 'text', text }],
            details: { action: 'list', data: list }
          };
        }

        case 'get': {
          if (!params.target) {
            return {
              content: [{ type: 'text', text: '错误: get 操作需要提供 target 参数' }],
              details: { action: 'get', data: 'Error: target is required' }
            };
          }
          const info = manager.get(params.target);
          if (!info) {
            return {
              content: [{ type: 'text', text: `错误: 子代理 ${params.target} 不存在` }],
              details: { action: 'get', data: `Subagent ${params.target} not found` }
            };
          }
          const text = formatSubagentInfo(info);
          return {
            content: [{ type: 'text', text }],
            details: { action: 'get', data: info }
          };
        }

        case 'kill': {
          if (!params.target) {
            return {
              content: [{ type: 'text', text: '错误: kill 操作需要提供 target 参数' }],
              details: { action: 'kill', data: 'Error: target is required' }
            };
          }
          const success = manager.kill(params.target);
          const text = success
            ? `已终止子代理: ${params.target}`
            : `终止失败: 子代理 ${params.target} 状态不允许终止`;
          return {
            content: [{ type: 'text', text }],
            details: { action: 'kill', data: success }
          };
        }

        case 'stats': {
          const stats = manager.getStats();
          const text = `子代理统计:\n- 总数: ${stats.total}\n- 活跃: ${stats.active}\n- 完成: ${stats.completed}\n- 失败: ${stats.failed}\n- 最大并发: ${stats.maxConcurrent}`;
          return {
            content: [{ type: 'text', text }],
            details: { action: 'stats', data: stats }
          };
        }

        default:
          return {
            content: [{ type: 'text', text: `错误: 未知操作 ${params.action}` }],
            details: { action: params.action, data: `Unknown action: ${params.action}` }
          };
      }
    }
  };
}

/**
 * 格式化子代理信息为字符串
 *
 * @param info - 子代理信息
 */
export function formatSubagentInfo(info: {
  id: string;
  agentId: string;
  status: string;
  task: string;
  createdAt: Date;
  parentAgentId?: string;
  result?: string;
  error?: string;
}): string {
  const lines = [
    `ID: ${info.id}`,
    `Agent: ${info.agentId}`,
    `Status: ${info.status}`,
    `Task: ${info.task}`,
    `Created: ${info.createdAt.toISOString()}`
  ];

  if (info.parentAgentId) {
    lines.push(`Parent: ${info.parentAgentId}`);
  }

  if (info.result) {
    const preview = info.result.length > 100
      ? info.result.slice(0, 100) + '...'
      : info.result;
    lines.push(`Result: ${preview}`);
  }

  if (info.error) {
    lines.push(`Error: ${info.error}`);
  }

  return lines.join('\n');
}