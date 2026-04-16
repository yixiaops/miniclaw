/**
 * @fileoverview 自动记忆写入器
 *
 * 负责自动写入对话到短期记忆，静默降级处理失败。
 *
 * @module memory/auto-writer
 */

import type { MemoryManager } from './manager.js';
import { MemoryErrorHandler } from './error-handler.js';

/**
 * AutoMemoryWriter 配置
 */
export interface AutoWriterConfig {
  /** 是否启用自动写入，默认 true */
  enabled?: boolean;
  /** 默认重要性分数，默认 0.3 */
  defaultImportance?: number;
}

/**
 * AutoMemoryWriter 类
 *
 * 自动写入对话到短期记忆，失败时静默降级不阻断主流程。
 *
 * @example
 * ```ts
 * const writer = new AutoMemoryWriter(memoryManager);
 *
 * // 自动写入对话
 * await writer.writeConversation('session-1', '用户消息', '助手回复');
 *
 * // 失败时不会抛异常，静默降级
 * ```
 */
export class AutoMemoryWriter {
  private memoryManager: MemoryManager;
  private errorHandler: MemoryErrorHandler;
  private config: AutoWriterConfig;

  constructor(
    memoryManager: MemoryManager,
    config: AutoWriterConfig = {}
  ) {
    this.memoryManager = memoryManager;
    this.config = {
      enabled: config.enabled ?? true,
      defaultImportance: config.defaultImportance ?? 0.3
    };
    this.errorHandler = new MemoryErrorHandler({ logErrors: true });
  }

  /**
   * 自动写入对话（用户 + 助手消息）
   *
   * @param sessionId - Session ID
   * @param userMsg - 用户消息
   * @param assistantMsg - 助手消息
   * @returns 写入结果（成功返回 true，失败返回 false）
   */
  async writeConversation(
    sessionId: string,
    userMsg: string,
    assistantMsg: string
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // 使用 silentExecute 并行写入两条消息
    const importance = this.config.defaultImportance;

    const results = await Promise.all([
      this.errorHandler.silentExecute(
        async () => {
          await this.memoryManager.write(userMsg, sessionId, {
            importance,
            source: 'user'
          });
          return true;
        },
        false
      ),
      this.errorHandler.silentExecute(
        async () => {
          await this.memoryManager.write(assistantMsg, sessionId, {
            importance,
            source: 'assistant'
          });
          return true;
        },
        false
      )
    ]);

    // 返回是否两条都写入成功
    return results.every(r => r === true);
  }

  /**
   * 只写入用户消息
   *
   * @param sessionId - Session ID
   * @param userMsg - 用户消息
   * @returns 是否写入成功
   */
  async writeUserMessage(
    sessionId: string,
    userMsg: string
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    return await this.errorHandler.silentExecute(
      async () => {
        await this.memoryManager.write(userMsg, sessionId, {
          importance: this.config.defaultImportance,
          source: 'user'
        });
        return true;
      },
      false
    ) ?? false;
  }

  /**
   * 只写入助手消息
   *
   * @param sessionId - Session ID
   * @param assistantMsg - 助手消息
   * @returns 是否写入成功
   */
  async writeAssistantMessage(
    sessionId: string,
    assistantMsg: string
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    return await this.errorHandler.silentExecute(
      async () => {
        await this.memoryManager.write(assistantMsg, sessionId, {
          importance: this.config.defaultImportance,
          source: 'assistant'
        });
        return true;
      },
      false
    ) ?? false;
  }

  /**
   * 获取当前配置
   *
   * @returns 配置对象
   */
  getConfig(): AutoWriterConfig {
    return { ...this.config };
  }

  /**
   * 创建新配置的写入器
   *
   * @param newConfig - 新配置
   * @returns 新的写入器实例
   */
  withConfig(newConfig: Partial<AutoWriterConfig>): AutoMemoryWriter {
    return new AutoMemoryWriter(this.memoryManager, {
      ...this.config,
      ...newConfig
    });
  }
}