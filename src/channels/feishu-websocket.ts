/**
 * 飞书 WebSocket 连接（使用飞书官方 SDK）
 * T1.2 WebSocket 连接实现
 *
 * 负责：长连接管理、消息解析、重连机制
 */

import * as Lark from '@larksuiteoapi/node-sdk';
import { FeishuClient } from './feishu-client.js';

export interface FeishuWebSocketOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
}

export interface FeishuEvent {
  type: string;
  messageId: string;
  chatId: string;
  chatType: 'p2p' | 'group';
  senderId: string;
  content: string;
  rootId?: string;
}

export class FeishuWebSocket {
  private config: { appId: string; appSecret: string };
  private client: FeishuClient;
  private options: FeishuWebSocketOptions;

  private wsClient: Lark.WSClient | null = null;
  private connected: boolean = false;
  private messageCallback: ((event: FeishuEvent) => void) | null = null;
  private stopped: boolean = false;

  constructor(
    config: { appId: string; appSecret: string },
    client: FeishuClient,
    options?: FeishuWebSocketOptions
  ) {
    this.config = config;
    this.client = client;
    this.options = {
      maxRetries: options?.maxRetries ?? 10,
      initialDelay: options?.initialDelay ?? 1000,
      maxDelay: options?.maxDelay ?? 30000,
    };
  }

  /**
   * 启动 WebSocket 连接
   */
  async start(): Promise<void> {
    this.stopped = false;

    const baseConfig = {
      appId: this.config.appId,
      appSecret: this.config.appSecret,
    };

    this.wsClient = new Lark.WSClient({
      ...baseConfig,
      loggerLevel: Lark.LoggerLevel.info,
    });

    const eventDispatcher = new Lark.EventDispatcher({}).register({
      'im.message.receive_v1': async (data: any) => {
        console.log('[WebSocket] 收到 im.message.receive_v1 事件:', JSON.stringify(data, null, 2));
        this.handleMessage(data);
      },
    });

    console.log('WebSocket 连接中...');

    await this.wsClient.start({
      eventDispatcher,
    });

    this.connected = true;
    console.log('WebSocket 已连接');
  }

  /**
   * 停止连接
   */
  stop(): void {
    this.stopped = true;
    this.connected = false;

    if (this.wsClient) {
      // SDK 没有 stop 方法，但可以通过 stopped 标志控制
      this.wsClient = null;
    }

    console.log('WebSocket 已停止');
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected && !this.stopped;
  }

  /**
   * 设置消息回调
   */
  onMessage(callback: (event: FeishuEvent) => void): void {
    this.messageCallback = callback;
  }

  /**
   * 处理消息
   */
  private handleMessage(data: any): void {
    try {
      const message = data.message;
      const sender = data.sender?.sender_id || {};

      // 解析内容
      let content = '';
      try {
        const contentObj = JSON.parse(message.content);
        content = contentObj.text || '';
      } catch {
        content = message.content;
      }

      const event: FeishuEvent = {
        type: 'im.message.receive_v1',
        messageId: message.message_id,
        chatId: message.chat_id,
        chatType: message.chat_type,
        senderId: sender.open_id || sender.user_id || '',
        content,
        rootId: message.root_id,
      };

      console.log('收到消息:', {
        messageId: event.messageId,
        senderId: event.senderId,
        content: event.content.substring(0, 50),
      });

      if (this.messageCallback) {
        this.messageCallback(event);
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  }
}