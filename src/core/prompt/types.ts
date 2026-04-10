/**
 * 系统提示词核心类型定义
 *
 * 定义提示词模块的核心接口和类型
 */

/**
 * 系统提示词模板
 *
 * 表示一个完整的提示词模板，包含元数据和内容。
 * 存储为 markdown 文件，格式参考 pi-coding-agent scout.md。
 */
export interface PromptTemplate {
  /** 模板名称 */
  name: string;

  /** 模板描述 */
  description?: string;

  /** 推荐使用的模型 */
  model?: string;

  /** 可用工具列表（未来扩展） */
  tools?: string[];

  /** 模板标签（用于分类） */
  tags?: string[];

  /** 模板版本 */
  version?: string;

  /** 模板作者 */
  author?: string;

  /** 提示词内容 */
  content: string;

  /** 模板文件路径（如果是从文件加载） */
  filePath?: string;

  /** 加载时间戳 */
  loadedAt?: number;
}

/**
 * 提示词引用
 *
 * 用于配置文件中的 systemPrompt 字段，支持两种模式：
 * 1. 直接文本内容（向后兼容）
 * 2. 文件路径引用
 */
export type PromptReference = string; // 直接文本或文件路径

/**
 * 检查是否为文件路径引用
 */
export function isFilePathReference(ref: PromptReference): boolean {
  return (
    ref.startsWith('file://') ||
    ref.startsWith('./') ||
    ref.startsWith('~/') ||
    ref.startsWith('/')
  );
}

/**
 * 模板加载选项
 */
export interface PromptLoadOptions {
  /** 是否缓存解析结果 */
  cache?: boolean;

  /** 后备提示词（加载失败时使用） */
  fallback?: string;

  /** 是否记录详细日志 */
  verbose?: boolean;

  /** 基础目录（用于解析相对路径） */
  baseDir?: string;
}

/**
 * 模板解析结果
 */
export interface PromptParseResult {
  /** 是否成功 */
  success: boolean;

  /** 解析后的模板 */
  template?: PromptTemplate;

  /** 错误信息 */
  error?: string;

  /** 是否使用了后备值 */
  usedFallback?: boolean;
}

/**
 * 提示词加载错误
 */
export class PromptLoadError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PromptLoadError';
  }
}

/**
 * 模板解析错误
 */
export class PromptParseError extends Error {
  constructor(
    message: string,
    public readonly content: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PromptParseError';
  }
}

/**
 * YAML frontmatter 结构
 */
export interface FrontmatterResult {
  /** YAML 元数据 */
  yaml: Record<string, unknown>;

  /** markdown 正文内容 */
  markdown: string;
}