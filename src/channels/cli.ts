/**
 * CLI 通道
 * 命令行交互界面
 */
import * as readline from 'readline';
import type { MiniclawAgent } from '../core/agent/index.js';

/**
 * CLI 通道类
 */
export class CliChannel {
  private agent: MiniclawAgent;
  private rl: readline.Interface | null = null;
  private running = false;

  constructor(agent: MiniclawAgent) {
    this.agent = agent;
  }

  /**
   * 启动 CLI 界面
   */
  async start(): Promise<void> {
    this.running = true;

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

        const response = await this.processInput(trimmed);
        
        if (response === '__EXIT__') {
          this.rl!.close();
          this.running = false;
          resolve();
          return;
        }

        if (response) {
          console.log(response);
          console.log('');
        }

        this.rl!.prompt();
      });

      this.rl!.on('close', () => {
        console.log('\n再见！');
        resolve();
      });
    });
  }

  /**
   * 处理用户输入
   */
  async processInput(input: string): Promise<string> {
    // 处理命令
    if (input.startsWith('/')) {
      return this.handleCommand(input);
    }

    // 普通对话
    const response = await this.agent.chat(input);
    return response.content;
  }

  /**
   * 处理命令
   */
  private handleCommand(command: string): string {
    const cmd = command.toLowerCase();

    switch (cmd) {
      case '/exit':
      case '/quit':
      case '/q':
        return '__EXIT__';

      case '/reset':
        this.agent.reset();
        return '对话已重置';

      case '/help':
      case '/h':
        return this.getHelpText();

      case '/history':
        const history = this.agent.getHistory();
        if (history.length === 0) {
          return '暂无对话历史';
        }
        return history.map((msg: any, i: number) => `[${i}] ${msg.role}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content).slice(0, 100)}`).join('\n');

      default:
        return `未知命令: ${command}\n输入 /help 查看帮助`;
    }
  }

  /**
   * 获取帮助文本
   */
  private getHelpText(): string {
    return `
Miniclaw 命令帮助:

  /help, /h     显示帮助
  /exit, /q     退出程序
  /reset        重置对话
  /history      查看对话历史

其他输入将作为对话内容发送给 AI。
`.trim();
  }

  /**
   * 停止 CLI
   */
  stop(): void {
    if (this.rl) {
      this.rl.close();
    }
    this.running = false;
  }
}