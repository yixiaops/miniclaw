/**
 * @fileoverview Soul 模块类型定义
 *
 * 定义 SoulLoader 相关的类型接口。
 *
 * @module soul/types
 */

/**
 * Soul 配置
 */
export interface SoulConfig {
  /** soul.md 文件路径，默认 ~/.miniclaw/soul.md */
  filePath: string;
  /** 是否启用 soul 注入，默认 true */
  enabled: boolean;
}