/**
 * @fileoverview Importance 评估器
 *
 * 从 LLM 回复中解析 [IMPORTANCE:X] 标记，提取重要性值。
 *
 * @module memory/importance/evaluator
 */

import type { ImportanceEvaluatorConfig, ImportanceParseResult } from './types.js';

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ImportanceEvaluatorConfig = {
  defaultImportance: 0.3,
  pattern: /\[IMPORTANCE:([+-]?[0-9.]+)\]/g,
  logParsed: false
};

/**
 * ImportanceEvaluator 类
 *
 * 负责：
 * 1. 从 LLM 回复中解析 [IMPORTANCE:X] 标记
 * 2. 剥离标记，返回干净的回复文本
 * 3. 处理边界情况（超出范围、格式错误）
 *
 * @example
 * ```ts
 * const evaluator = new ImportanceEvaluator();
 *
 * // 正常解析
 * evaluator.parse("你好！[IMPORTANCE:0.3]");
 * // → { importance: 0.3, strippedContent: "你好！", parsed: true }
 *
 * // 无标记
 * evaluator.parse("普通回复");
 * // → { importance: null, strippedContent: "普通回复", parsed: false }
 * ```
 */
export class ImportanceEvaluator {
  private config: ImportanceEvaluatorConfig;

  /**
   * 创建 ImportanceEvaluator 实例
   *
   * @param config - 可选配置
   */
  constructor(config?: Partial<ImportanceEvaluatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 解析 LLM 回复中的 importance 标记
   *
   * Behavior:
   * 1. 使用正则表达式匹配所有 [IMPORTANCE:X] 标记
   * 2. 取最后一个标记的值
   * 3. Clamp 值到 0-1 范围
   * 4. 剥离所有标记，返回干净文本
   * 5. 解析失败时返回 null importance
   *
   * @param responseContent - LLM 的原始回复文本
   * @returns 解析结果
   */
  parse(responseContent: string): ImportanceParseResult {
    // 1. 匹配所有标记
    const matches = responseContent.matchAll(this.config.pattern);
    const allMatches = Array.from(matches);

    // 2. 无标记，返回 null
    if (allMatches.length === 0) {
      if (this.config.logParsed) {
        console.log('[ImportanceEvaluator] No importance marker found');
      }
      return {
        importance: null,
        strippedContent: responseContent,
        parsed: false
      };
    }

    // 3. 取最后一个标记
    const lastMatch = allMatches[allMatches.length - 1];
    const rawValue = parseFloat(lastMatch[1]);

    // 4. 处理格式错误
    if (isNaN(rawValue)) {
      if (this.config.logParsed) {
        console.log('[ImportanceEvaluator] Invalid importance value:', lastMatch[1]);
      }
      return {
        importance: null,
        strippedContent: responseContent,
        parsed: false
      };
    }

    // 5. Clamp 到 0-1
    const importance = Math.max(0, Math.min(1, rawValue));

    // 6. 剥离所有标记
    const strippedContent = responseContent.replace(this.config.pattern, '').trim();

    if (this.config.logParsed) {
      console.log('[ImportanceEvaluator] Parsed importance:', importance);
    }

    return {
      importance,
      strippedContent,
      parsed: true
    };
  }

  /**
   * 获取配置
   *
   * @returns 配置对象
   */
  getConfig(): ImportanceEvaluatorConfig {
    return { ...this.config };
  }
}