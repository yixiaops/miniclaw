/**
 * @fileoverview Soul 加载器
 *
 * 加载 soul.md 文件，提供 AI 人格和核心规则注入。
 *
 * @module soul/loader
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import type { SoulConfig } from './types.js';

/**
 * 默认 Soul 内容
 */
export const DEFAULT_SOUL = `# Miniclaw Soul

## AI 人格
我是 Miniclaw，一个专业、可靠的 AI 助手。

## 爱好
帮助用户解决问题，记录重要信息。

## 核心规则
**每次回复必须在末尾包含 [IMPORTANCE:X] 标记**

X 为 0-1 的数值，表示当前对话的重要性：
- 0.7-0.9: 包含个人信息（姓名、偏好、联系方式）
- 0.6-0.8: 重要决策或结论
- 0.4-0.6: 一般对话内容
- 0.1-0.3: 简单问候或闲聊

## 其他规则
- 保持简洁回复
- 不确定的先询问
`;

/**
 * 默认配置
 */
const DEFAULT_CONFIG: SoulConfig = {
  filePath: process.env.MINICLAW_SOUL_FILE || path.join(os.homedir(), '.miniclaw', 'soul.md'),
  enabled: true
};

/**
 * SoulLoader 类
 *
 * 负责：
 * 1. 加载 soul.md 文件
 * 2. 提供默认 soul 内容
 * 3. 验证 soul 内容包含必需规则
 *
 * @example
 * ```ts
 * const loader = new SoulLoader();
 *
 * // 加载 soul 内容
 * const content = await loader.load();
 * // → soul.md 文件内容或 DEFAULT_SOUL
 *
 * // 获取默认内容
 * const defaultContent = loader.getDefault();
 * ```
 */
export class SoulLoader {
  private config: SoulConfig;

  /**
   * 创建 SoulLoader 实例
   *
   * @param config - 可选配置
   */
  constructor(config?: Partial<SoulConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 加载 soul 内容
   *
   * Behavior:
   * 1. 检查是否启用
   * 2. 检查文件是否存在
   * 3. 如果不存在，返回 DEFAULT_SOUL
   * 4. 读取文件内容
   * 5. 返回内容字符串
   *
   * @returns soul 内容字符串
   */
  async load(): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    const filePath = this.expandHome(this.config.filePath);

    if (!fs.existsSync(filePath)) {
      console.log(`[SoulLoader] File not found: ${filePath}, using DEFAULT_SOUL`);
      return DEFAULT_SOUL;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`[SoulLoader] Loaded soul from: ${filePath}`);
    return content;
  }

  /**
   * 获取默认 soul 内容
   *
   * @returns 默认 soul 内容字符串
   */
  getDefault(): string {
    return DEFAULT_SOUL;
  }

  /**
   * 获取配置
   *
   * @returns 配置对象
   */
  getConfig(): SoulConfig {
    return { ...this.config };
  }

  /**
   * 扩展 ~ 为用户家目录
   *
   * @param filePath - 文件路径
   * @returns 扩展后的路径
   */
  private expandHome(filePath: string): string {
    if (filePath.startsWith('~')) {
      return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
  }
}