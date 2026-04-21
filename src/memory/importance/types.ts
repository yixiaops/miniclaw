/**
 * @fileoverview Importance 模块类型定义
 *
 * 定义 ImportanceEvaluator 相关的类型接口。
 *
 * @module memory/importance/types
 */

/**
 * Importance 解析结果
 */
export interface ImportanceParseResult {
  /** 解析出的 importance 值（0-1），null 表示未找到标记 */
  importance: number | null;
  /** 剥离标记后的回复文本 */
  strippedContent: string;
  /** 是否成功解析 */
  parsed: boolean;
}

/**
 * ImportanceEvaluator 配置
 */
export interface ImportanceEvaluatorConfig {
  /** 默认 importance 值（fallback），默认 0.3 */
  defaultImportance: number;
  /** importance 标记正则表达式 */
  pattern: RegExp;
  /** 是否启用解析日志（调试） */
  logParsed: boolean;
}