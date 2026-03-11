/**
 * 飞书通道
 * 飞书机器人消息处理
 */
import type { MiniclawAgent } from '../core/agent/index.js';
import type { Config } from '../core/config.js';

/**
 * 飞书消息类型
 */
export interface FeishuMessage {
  messageId: string;
  messageType: 'text' | 'post' | 'image' | 'file';
  content: string;
  senderId: string;
  chatId?: string;
}

/**
 * 飞书回复类型
 */
export interface FeishuReply {
  msgType: 'text' | 'post';
  content: string;
}

/**
 * 飞书通道类
 */
export class FeishuChannel {
  private agent: MiniclawAgent;
  private running = false;

  constructor(agent: MiniclawAgent, config: Config) {
    if (!config.feishu) {
      throw new Error('Feishu configuration is required');
    }

    this.agent = agent;
  }

  /**
   * 启动飞书通道
   */
  async start(): Promise<void> {
    // TODO: 实现 WebSocket 连接
    // 飞书长连接模式需要初始化 WebSocket 客户端
    this.running = true;
    console.log('飞书通道已启动');
  }

  /**
   * 停止飞书通道
   */
  stop(): void {
    this.running = false;
    console.log('飞书通道已停止');
  }

  /**
   * 处理接收到的消息
   */
  async processMessage(message: FeishuMessage): Promise<FeishuReply | null> {
    // 忽略空消息
    if (!message.content || message.content.trim() === '') {
      return null;
    }

    // 只处理文本消息
    if (message.messageType !== 'text') {
      return {
        msgType: 'text',
        content: '暂不支持此类型消息'
      };
    }

    // 调用 Agent 处理
    const response = await this.agent.chat(message.content);

    return {
      msgType: 'text',
      content: response.content
    };
  }

  /**
   * 发送回复
   */
  async sendReply(messageId: string, reply: FeishuReply): Promise<void> {
    // TODO: 实现发送回复逻辑
    // 需要调用飞书 API 发送消息
    console.log(`Reply to ${messageId}: ${reply.content}`);
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.running;
  }
}