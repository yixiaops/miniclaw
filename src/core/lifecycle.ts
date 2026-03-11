/**
 * @fileoverview 生命周期管理器 - 管理应用各通道的启动和关闭
 * @module core/lifecycle
 * @author Miniclaw Team
 * @created 2026-03-11
 */

/**
 * 通道接口
 * 定义所有通道必须实现的方法
 */
export interface Channel {
  /** 通道名称 */
  name?: string;
  /** 停止通道 */
  stop: () => Promise<void>;
  /** 检查是否运行中（可选） */
  isRunning?: () => boolean;
}

/**
 * 生命周期管理器
 * 
 * 负责管理所有通道的注册、注销和优雅关闭。
 * 当调用 shutdown 时，会依次关闭所有已注册的通道。
 * 
 * @example
 * ```ts
 * const lifecycle = new LifecycleManager();
 * 
 * // 注册通道
 * lifecycle.register('cli', cliChannel);
 * lifecycle.register('api', apiChannel);
 * 
 * // 优雅关闭
 * await lifecycle.shutdown();
 * ```
 * 
 * @class
 * @public
 */
export class LifecycleManager {
  /** 已注册的通道映射 */
  private channels: Map<string, Channel> = new Map();

  /** 是否正在关闭中 */
  private isShuttingDown = false;

  /**
   * 注册通道
   * 
   * @param name - 通道名称（用于标识和日志）
   * @param channel - 通道实例
   * 
   * @example
   * ```ts
   * lifecycle.register('cli', cliChannel);
   * ```
   */
  register(name: string, channel: Channel): void {
    this.channels.set(name, channel);
  }

  /**
   * 注销通道
   * 
   * @param name - 要注销的通道名称
   * 
   * @example
   * ```ts
   * lifecycle.unregister('cli');
   * ```
   */
  unregister(name: string): void {
    this.channels.delete(name);
  }

  /**
   * 关闭所有通道并退出
   * 
   * 会依次调用所有已注册通道的 stop 方法，
   * 即使某个通道关闭失败也会继续关闭其他通道。
   * 
   * @example
   * ```ts
   * await lifecycle.shutdown();
   * ```
   */
  async shutdown(): Promise<void> {
    // 防止重复关闭
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    console.log('\n正在关闭...');

    // 依次关闭所有通道
    for (const [name, channel] of this.channels) {
      try {
        console.log(`  关闭 ${name} 通道...`);
        await channel.stop();
      } catch (error) {
        // 记录错误但继续关闭其他通道
        console.error(`  关闭 ${name} 通道失败:`, error);
      }
    }

    console.log('再见！');
    process.exit(0);
  }

  /**
   * 获取已注册的通道名称列表
   * 
   * @returns 通道名称数组
   * 
   * @example
   * ```ts
   * const channels = lifecycle.getRegisteredChannels();
   * console.log(channels); // ['cli', 'api', 'web']
   * ```
   */
  getRegisteredChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * 检查是否正在关闭
   * 
   * @returns 是否正在关闭
   */
  isShuttingDownNow(): boolean {
    return this.isShuttingDown;
  }
}

/**
 * 全局生命周期管理器实例
 * 
 * 在整个应用中共享使用，确保统一的关闭流程。
 */
export const globalLifecycle = new LifecycleManager();