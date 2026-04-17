/**
 * 飞书通道
 * 集成 WebSocket 连接 + 消息去重 + Gateway 调用
 */
import type { MiniclawGateway } from '../core/gateway/index.js';
import { FeishuClient } from './feishu-client.js';
import { FeishuWebSocket } from './feishu-websocket.js';
import { MessageDeduplicator } from './feishu-dedup.js';
import { FeishuReactions } from './feishu-reactions.js';

/**
 * 飞书配置
 */
export interface FeishuConfig {
  appId: string;
  appSecret: string;
}

/**
 * 飞书通道类
 */
export class FeishuChannel {
  private gateway: MiniclawGateway;
  private config: FeishuConfig;
  private running = false;

  // 组件
  private client: FeishuClient;
  private websocket: FeishuWebSocket;
  private deduplicator: MessageDeduplicator;
  private reactions: FeishuReactions;

  constructor(gateway: MiniclawGateway) {
    const config = gateway.getConfig();
    if (!config.feishu) {
      throw new Error('Feishu configuration is required');
    }

    this.gateway = gateway;
    this.config = config.feishu;

    // 初始化组件
    this.client = new FeishuClient(this.config);
    this.websocket = new FeishuWebSocket(this.config, this.client);
    this.deduplicator = new MessageDeduplicator({ maxSize: 10000 });
    this.reactions = new FeishuReactions(this.config);

    // 设置消息回调
    this.websocket.onMessage(this.handleMessage.bind(this));
  }

  /**
   * 启动飞书通道
   */
  async start(): Promise<void> {
    await this.websocket.start();
    this.running = true;
    console.log('飞书通道已启动');
  }

  /**
   * 停止飞书通道
   */
  stop(): void {
    this.websocket.stop();
    this.running = false;
    console.log('飞书通道已停止');
  }

  /**
   * 检查是否运行中
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * 获取客户端（测试用）
   */
  getClient(): FeishuClient {
    return this.client;
  }

  /**
   * 获取 WebSocket（测试用）
   */
  getWebSocket(): FeishuWebSocket {
    return this.websocket;
  }

  /**
   * 获取去重器（测试用）
   */
  getDeduplicator(): MessageDeduplicator {
    return this.deduplicator;
  }

  /**
   * 处理消息
   */
  private async handleMessage(event: {
    type: string;
    messageId: string;
    chatId: string;
    chatType: 'p2p' | 'group';
    senderId: string;
    content: string;
    rootId?: string;
  }): Promise<void> {
    // 去重检查
    if (this.deduplicator.isDuplicate(event.messageId)) {
      console.log(`消息 ${event.messageId} 已处理过，跳过`);
      return;
    }

    // 添加表情回应，表示正在处理
    const reactionResult = await this.reactions.addProcessingReaction(event.messageId);
    const reactionId = reactionResult.reactionId;

    try {
      // 调用 Gateway 处理
      const response = await this.gateway.handleMessage({
        channel: 'feishu',
        userId: event.senderId,
        groupId: event.chatType === 'group' ? event.chatId : undefined,
        content: event.content,
      });

      // 发送回复
      if (response.content) {
        const receiveIdType = event.chatType === 'p2p' ? 'open_id' : 'chat_id';
        await this.client.sendMessage({
          receiveId: event.chatType === 'p2p' ? event.senderId : event.chatId,
          receiveIdType,
          msgType: 'post', // 使用富文本消息，与 OpenClaw 一致
          content: response.content,
          replyToMessageId: event.rootId, // 群聊话题回复
        });
      }
    } finally {
      // 处理完成后删除表情回应
      if (reactionId) {
        await this.reactions.deleteReaction(event.messageId, reactionId);
      }
    }
  }
}