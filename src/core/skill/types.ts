/**
 * @fileoverview 技能系统类型定义
 * 
 * 定义技能、技能管理器配置、匹配结果等核心类型
 * 
 * 注意：部分类型被 PiSkillManager 使用，部分仅为旧版 SkillManager 定义
 *
 * @module core/skill/types
 */

/**
 * 技能元数据（依赖信息）
 */
export interface SkillMetadata {
  /** 依赖的工具列表 */
  tools?: string[];
  /** 依赖的命令行工具 */
  bins?: string[];
  /** 依赖的环境变量 */
  env?: string[];
  /** 优先级（数值越高越优先），默认为 0 */
  priority?: number;
}

/**
 * 技能轻量元数据（用于启动时快速加载）
 * 
 * 只包含匹配和排序所需的字段，不包含完整内容
 */
export interface SkillMetadataLite {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 触发词数组（从 description 提取） */
  triggers: string[];
  /** 技能文件路径 */
  path: string;
  /** 优先级 */
  priority: number;
  /** 相关链接 */
  homepage?: string;
  /** 元数据（依赖信息） */
  metadata?: SkillMetadata;
}

/**
 * SKILL.md 文件的 YAML frontmatter 结构
 */
export interface SkillFrontmatter {
  /** 技能名称（必填） */
  name: string;
  /** 技能描述（必填），可包含触发词 */
  description: string;
  /** 相关链接（可选） */
  homepage?: string;
  /** 元数据（可选） */
  metadata?: SkillMetadata;
}

/**
 * 技能对象
 * 
 * 表示一个已加载的技能，包含元数据和内容
 * 采用渐进式披露：content 可能在首次访问时才加载
 */
export interface Skill {
  /** 技能名称 */
  name: string;
  /** 技能描述 */
  description: string;
  /** 触发词数组（从 description 提取） */
  triggers: string[];
  /** 技能内容（Markdown 正文） */
  content: string;
  /** 技能文件路径 */
  path: string;
  /** 相关链接 */
  homepage?: string;
  /** 元数据 */
  metadata?: SkillMetadata;
  /** 优先级 */
  priority: number;
  /** 内容是否已加载（渐进式披露标记） */
  contentLoaded?: boolean;
}

/**
 * 技能匹配结果
 */
export interface SkillMatchResult {
  /** 匹配到的技能 */
  skill: Skill;
  /** 匹配类型 */
  matchType: 'trigger' | 'description';
  /** 匹配到的关键词 */
  matchedKeyword: string;
}

/**
 * 技能管理器配置
 */
export interface SkillManagerConfig {
  /** 技能目录路径，默认 ~/.miniclaw/skills */
  skillsDir?: string;
  /** 是否自动加载，默认 true */
  autoLoad?: boolean;
}

/**
 * 加载技能的结果
 */
export interface LoadSkillResult {
  /** 是否成功 */
  success: boolean;
  /** 加载的技能（成功时） */
  skill?: Skill;
  /** 错误信息（失败时） */
  error?: string;
  /** 文件路径 */
  path: string;
}

/**
 * 加载技能元数据的结果
 */
export interface LoadMetadataResult {
  /** 是否成功 */
  success: boolean;
  /** 加载的元数据（成功时） */
  metadata?: SkillMetadataLite;
  /** 错误信息（失败时） */
  error?: string;
  /** 文件路径 */
  path: string;
}

/**
 * 技能系统状态
 */
export interface SkillSystemStatus {
  /** 已加载的技能数量 */
  skillCount: number;
  /** 技能名称列表 */
  skillNames: string[];
  /** 技能目录路径 */
  skillsDir: string;
  /** 已加载内容的技能数量 */
  contentLoadedCount?: number;
}