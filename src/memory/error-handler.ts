/**
 * @fileoverview 记忆系统错误处理器
 *
 * 提供静默降级执行机制，确保记忆系统失败不阻断主流程。
 *
 * @module memory/error-handler
 */

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  /** 是否记录错误日志，默认 true */
  logErrors?: boolean;
  /** 操作名称前缀，用于日志 */
  operationPrefix?: string;
}

/**
 * MemoryErrorHandler 类
 *
 * 静默执行记忆操作，失败时返回 fallback 或 undefined，不抛出异常。
 *
 * @example
 * ```ts
 * const handler = new MemoryErrorHandler();
 *
 * // 静默执行
 * const result = await handler.silentExecute(
 *   async () => memoryManager.write('content'),
 *   undefined  // 失败时的 fallback
 * );
 *
 * // 失败不会抛异常，只返回 undefined
 * ```
 */
export class MemoryErrorHandler {
  private config: ErrorHandlerConfig;

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      logErrors: config.logErrors ?? true,
      operationPrefix: config.operationPrefix ?? '[Memory]'
    };
  }

  /**
   * 静默执行异步操作
   *
   * @param operation - 要执行的操作
   * @param fallback - 失败时返回的值（可选）
   * @returns 操作结果或 fallback
   */
  async silentExecute<T>(
    operation: () => Promise<T>,
    fallback?: T
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.logError('async-operation', error as Error);
      return fallback;
    }
  }

  /**
   * 静默执行同步操作
   *
   * @param operation - 要执行的操作
   * @param fallback - 失败时返回的值（可选）
   * @returns 操作结果或 fallback
   */
  silentExecuteSync<T>(
    operation: () => T,
    fallback?: T
  ): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.logError('sync-operation', error as Error);
      return fallback;
    }
  }

  /**
   * 记录错误日志
   *
   * @param operation - 操作名称
   * @param error - 错误对象
   */
  logError(operation: string, error: Error): void {
    if (!this.config.logErrors) return;

    const prefix = this.config.operationPrefix;
    console.error(`${prefix} ${operation} failed:`, error.message);
  }

  /**
   * 获取当前配置
   *
   * @returns 配置对象
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }

  /**
   * 创建新配置的错误处理器
   *
   * @param newConfig - 新配置
   * @returns 新的错误处理器实例
   */
  withConfig(newConfig: Partial<ErrorHandlerConfig>): MemoryErrorHandler {
    return new MemoryErrorHandler({
      ...this.config,
      ...newConfig
    });
  }
}

/**
 * 工厂函数：创建带 fallback 的静默执行器
 *
 * @param fallback - 默认 fallback 值
 * @param config - 配置
 * @returns 静默执行函数
 */
export function wrapWithFallback<T>(
  fallback: T,
  config?: ErrorHandlerConfig
): (operation: () => Promise<T>) => Promise<T> {
  const handler = new MemoryErrorHandler(config);
  return (operation: () => Promise<T>) => 
    handler.silentExecute(operation, fallback) as Promise<T>;
}