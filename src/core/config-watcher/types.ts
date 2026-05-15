/**
 * 配置监听模块类型定义
 *
 * @module core/config-watcher/types
 */

// ============================================================================
// 变更类型枚举
// ============================================================================

/** 配置变更类型 */
export type ConfigChangeType = 'add' | 'modify' | 'delete';

/** 配置加载错误类型 */
export type ConfigLoadErrorType = 'PARSE_ERROR' | 'INVALID_SCHEMA' | 'FILE_NOT_FOUND';

// ============================================================================
// 核心实体
// ============================================================================

/** 缓存的 Agent 配置 */
export interface CachedAgentConfig {
  /** Agent ID（从 YAML frontmatter name 字段） */
  agentId: string;
  /** 配置文件路径 */
  path: string;
  /** 配置版本（从 YAML frontmatter version 字段） */
  version?: string;
  /** 文件修改时间（毫秒） */
  mtime: number;
  /** 系统提示词内容 */
  systemPrompt: string;
  /** 推荐工具列表 */
  tools?: string[];
  /** 推荐模型 */
  model?: string;
}

/** 配置变更事件 */
export interface ConfigChangeEvent {
  /** 事件唯一标识 */
  eventId: string;
  /** 变更类型 */
  changeType: ConfigChangeType;
  /** 配置文件路径 */
  path: string;
  /** Agent ID（删除时可能无法获取） */
  agentId?: string;
  /** 事件时间 */
  timestamp: Date;
  /** 处理是否成功 */
  success: boolean;
  /** 错误信息 */
  errorMessage?: string;
}

/** 配置加载错误 */
export interface ConfigLoadError {
  /** 配置文件路径 */
  path: string;
  /** Agent ID */
  agentId?: string;
  /** 错误类型 */
  errorType: ConfigLoadErrorType;
  /** 错误消息 */
  message: string;
  /** 错误时间 */
  timestamp: Date;
}

// ============================================================================
// YAML Frontmatter 解析结果
// ============================================================================

/** YAML frontmatter 元数据 */
export interface YAMLFrontmatter {
  /** Agent 名称 */
  name: string;
  /** Agent 描述 */
  description?: string;
  /** 推荐模型 */
  model?: string;
  /** 版本号 */
  version?: string;
  /** 推荐工具列表 */
  tools?: string[];
}

/** YAML 配置解析结果 */
export interface YAMLConfigParseResult {
  /** 解析成功 */
  success: boolean;
  /** frontmatter 元数据 */
  frontmatter?: YAMLFrontmatter;
  /** 系统提示词内容（frontmatter 后的内容） */
  systemPrompt?: string;
  /** 解析错误 */
  error?: string;
}

// ============================================================================
// ConfigWatcher 选项
// ============================================================================

/** ConfigWatcher 配置选项 */
export interface ConfigWatcherOptions {
  /** prompts 配置目录路径 */
  promptsDir: string;
  /** 主配置文件路径 */
  configFile: string;
  /** 去抖延迟（毫秒） */
  debounceMs: number;
}

// ============================================================================
// 事件类型
// ============================================================================

/** 配置事件 payload */
export interface ConfigEventPayload {
  /** Agent ID */
  agentId: string;
  /** 配置文件路径 */
  path: string;
}

/** 配置错误事件 payload */
export interface ConfigErrorEventPayload {
  /** 配置文件路径 */
  path: string;
  /** 错误信息 */
  error: ConfigLoadError;
}