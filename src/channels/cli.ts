/**
 * @fileoverview CLI 通道 - 命令行交互界面
 * @module channels/cli
 * @author Miniclaw Team
 * @created 2026-03-10
 */

import * as readline from 'readline';
import type { MiniclawGateway } from '../core/gateway/index.js';
import { handleCliCommand } from './cli-commands.js';
import { globalLifecycle } from '../core/lifecycle.js';

/**
 * CLI 通道类
 *
 * 提供命令行交互界面，支持：
 * - 与 AI 对话
 * - 执行内置命令（/help、/exit 等）
 * - 流式输出
 *
 * @example
 * ```ts
 * const cli = new CliChannel(gateway);
 * await cli.start();
 * ```
 *
 * @class
 * @public
 */
export class CliChannel implements Channel {
  /** Gateway 实例 */
  private gateway: MiniclawGateway;
  /** readline 接口 */
  private rl: readline.Interface | null = null;
  /** 是否运行中 */
  private running = false;

  /**
   * 创建 CLI 通道实例
   *
   * @param gateway - Miniclaw Gateway 实例
   */
  constructor(gateway: MiniclawGateway) {
    this.gateway = gateway;
  }

  /**
   * 启动 CLI 界面
   *
   * 开始监听用户输入，直到用户输入 /exit 或 /quit
   */
  async start(): Promise<void> {
    this.running = true;

    // 注册到生命周期管理器
    globalLifecycle.register('cli', this);

    // 创建 readline 接口
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'miniclaw> '
    });

    console.log('Miniclaw CLI 已启动，输入 /help 查看帮助\n');
    this.rl.prompt();

    return new Promise((resolve) => {
      this.rl!.on('line', async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          this.rl!.prompt();
          return;
        }

        await this.processInput(trimmed);
        this.rl!.prompt();
      });

      this.rl!.on('close', () => {
        this.running = false;
        resolve();
      });
    });
  }

  /**
   * 处理用户输入
   *
   * @param input - 用户输入的文本
   */
  async processInput(input: string): Promise<void> {
    // 获取 Agent 用于命令处理
    const { agent } = this.gateway.getOrCreateAgent({
      channel: 'cli',
      content: input
    });

    // 先检查是否是命令
    const isCommand = await handleCliCommand(input, agent);

    if (isCommand) {
      return;
    }

    // 普通对话 - 流式输出
    process.stdout.write('\n');

    const generator = this.gateway.streamHandleMessage({
      channel: 'cli',
      content: input
    });

    for await (const chunk of generator) {
      // 显示工具执行状态
      if (chunk.toolName && chunk.toolStatus) {
        if (chunk.toolStatus === 'start') {
          process.stdout.write(`\n🔧 执行工具: ${chunk.toolName}...\n`);
        } else if (chunk.toolStatus === 'end') {
          // 工具执行完成，可以在这里显示结果摘要
        }
      }

      // 显示文本内容
      if (chunk.content) {
        process.stdout.write(chunk.content);
      }

      if (chunk.done) {
        break;
      }
    }

    process.stdout.write('\n\n');
  }

  /**
   * 停止 CLI
   */
  async stop(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.running = false;
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * 通道接口
 */
interface Channel {
  stop: () => Promise<void>;
  isRunning?: () => boolean;
}