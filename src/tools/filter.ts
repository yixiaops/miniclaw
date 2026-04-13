/**
 * 工具过滤模块
 *
 * 根据配置的 allow/deny 列表过滤 Agent 可用的工具集。
 *
 * ## 设计原则
 *
 * 1. **默认全开放**: 无配置时返回所有工具
 * 2. **allow 白名单**: 限制为只使用指定工具
 * 3. **deny 黑名单**: 禁止特定工具（优先于 allow）
 * 4. **简单匹配**: 精确字符串匹配，暂不支持 glob 模式
 *
 * @module tools/filter
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 简化的工具类型（只需要 name 属性）
 */
interface SimpleTool {
  name: string;
}

/**
 * 工具策略配置
 *
 * 定义 Agent 可用的工具集。
 */
export interface ToolPolicy {
  /** 白名单：允许的工具名称列表 */
  allow?: string[];

  /** 黑名单：禁止的工具名称列表 */
  deny?: string[];
}

/**
 * 过滤统计信息
 */
export interface FilterStats {
  /** 内置工具总数 */
  total: number;

  /** 最终允许的工具数 */
  allowed: number;

  /** 被 deny 的工具数 */
  denied: number;

  /** 配置中不存在的工具名 */
  unknown: string[];
}

/**
 * 有效工具列表结果
 */
export interface EffectiveToolList<T extends SimpleTool = SimpleTool> {
  /** 工具列表 */
  tools: T[];

  /** 过滤统计 */
  stats: FilterStats;
}

// ============================================================================
// 常量定义
// ============================================================================

/**
 * 内置工具名称列表
 */
export const BUILTIN_TOOL_NAMES = [
  'read_file',
  'write_file',
  'shell',
  'glob',
  'grep',
  'ls',
  'edit',
  'multi_edit',
  'web_fetch',
  'web_search',
  'memory_search',
  'memory_get'
];

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 验证配置中的工具名称
 *
 * 检查配置中的工具名称是否存在于内置工具列表中。
 * 对于不存在的工具名，返回警告信息。
 *
 * @param toolNames - 待验证的工具名称列表
 * @returns 不存在的工具名称列表
 */
export function validateToolNames(toolNames: string[]): string[] {
  const unknown: string[] = [];

  for (const name of toolNames) {
    if (!BUILTIN_TOOL_NAMES.includes(name)) {
      unknown.push(name);
    }
  }

  return unknown;
}

/**
 * 根据策略过滤工具
 *
 * 过滤逻辑：
 * 1. 如果 allow 存在且非空：只保留 allow 列表中的工具
 * 2. 如果 deny 存在且非空：从结果中移除 deny 列表中的工具
 * 3. deny 优先于 allow（冲突时工具被禁止）
 *
 * @param allTools - 所有可用工具
 * @param policy - 工具策略配置
 * @returns 过滤后的工具列表和统计信息
 */
export function filterToolsByPolicy<T extends SimpleTool>(
  allTools: T[],
  policy?: ToolPolicy
): EffectiveToolList<T> {
  // 无配置时返回全部工具
  if (!policy || (!policy.allow && !policy.deny)) {
    return {
      tools: allTools,
      stats: {
        total: allTools.length,
        allowed: allTools.length,
        denied: 0,
        unknown: []
      }
    };
  }

  // 获取所有工具名称
  const allToolNames = allTools.map(t => t.name);
  const toolMap = new Map<string, T>();
  for (const tool of allTools) {
    toolMap.set(tool.name, tool);
  }

  // 验证配置中的工具名
  const configuredNames = [...(policy.allow || []), ...(policy.deny || [])];
  const unknown = validateToolNames(configuredNames);

  // 记录警告日志
  if (unknown.length > 0) {
    console.warn(`[ToolFilter] 配置中存在未知的工具名: ${unknown.join(', ')}`);
  }

  // 步骤 1: 根据 allow 确定初始候选列表
  let candidateNames: string[];

  if (policy.allow && policy.allow.length > 0) {
    // 使用 allow 白名单
    candidateNames = policy.allow.filter(name => toolMap.has(name));
  } else {
    // allow 为空或未配置，使用全部工具
    candidateNames = allToolNames;
  }

  // 步骤 2: 根据 deny 移除禁止的工具
  if (policy.deny && policy.deny.length > 0) {
    const deniedSet = new Set(policy.deny);
    candidateNames = candidateNames.filter(name => !deniedSet.has(name));
  }

  // 构建结果
  const effectiveTools = candidateNames
    .map(name => toolMap.get(name))
    .filter((tool): tool is T => tool !== undefined);

  // 计算统计
  const deniedCount = policy.deny
    ? policy.deny.filter(name => toolMap.has(name)).length
    : 0;

  return {
    tools: effectiveTools,
    stats: {
      total: allTools.length,
      allowed: effectiveTools.length,
      denied: deniedCount,
      unknown
    }
  };
}

/**
 * 解析并计算有效工具列表
 *
 * 从配置中读取工具策略并应用过滤。
 *
 * @param allTools - 所有可用工具
 * @param config - Agent 配置（包含 tools 字段）
 * @returns 过滤后的工具列表和统计信息
 */
export function resolveEffectiveToolList<T extends SimpleTool>(
  allTools: T[],
  config?: { tools?: ToolPolicy }
): EffectiveToolList<T> {
  return filterToolsByPolicy(allTools, config?.tools);
}