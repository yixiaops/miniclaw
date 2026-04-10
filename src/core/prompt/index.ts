/**
 * Prompt 模块入口
 *
 * 导出提示词管理相关的所有公共接口
 */

// 类型定义
export type {
  PromptTemplate,
  PromptReference,
  PromptLoadOptions,
  PromptParseResult,
  FrontmatterResult,
} from './types.js';

// 错误类
export { PromptLoadError, PromptParseError, isFilePathReference } from './types.js';

// 解析器
export { parseFrontmatter, extractYamlFrontmatter, validateTemplate } from './parser.js';

// 管理器
export { PromptManager } from './manager.js';