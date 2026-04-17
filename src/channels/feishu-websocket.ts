/**
 * 飞书 WebSocket 连接
 * T1.2 WebSocket 连接实现
 *
 * 负责：长连接管理、消息解析、重连机制
 */

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
  rootId?: string; // 群聊话题根消息
}

interface FeishuWebSocketMessage {
  type: string;
  data?: {
    message?: {
      message_id: string;
      chat_id: string;
      chat_type: 'p2p' | 'group';
      content: string;
      sender?: {
        sender_id?: {
          user_id?: string;
        };
      };
      root_id?: string;
    };
  };
}

export class FeishuWebSocket {
  private config: { appId: string; appSecret: string };
  private client: FeishuClient;
  private options: FeishuWebSocketOptions;

  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
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

    // 获取 token
    const token = await this.client.getAccessToken();

    // 构建 WebSocket URL
    // 飞书 WebSocket 地址格式：wss://ws.feishu.cn/ws/{app_id}?token={token}
    const url = `wss://ws.feishu.cn/ws/${this.config.appId}?token=${token}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onclose = (event) => {
        this.connected = false;

        if (!this.stopped) {
          this.scheduleReconnect();
        }
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = () => {
        if (!this.connected) {
          reject(new Error('WebSocket 连接失败'));
        }
      };
    });
  }

  /**
   * 停止连接
   */
  stop(): void {
    this.stopped = true;
    this.connected = false;

    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.connected;
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
  private handleMessage(data: string): void {
    try {
      const message: FeishuWebSocketMessage = JSON.parse(data);

      // 只处理消息接收事件
      if (message.type !== 'im.message.receive_v1') {
        return;
      }

      if (!message.data?.message) {
        return;
      }

      const msg = message.data.message;

      // 解析内容（飞书消息内容是 JSON 字符串）
      let content = '';
      try {
        const contentObj = JSON.parse(msg.content);
        content = contentObj.text || '';
      } catch {
        content = msg.content;
      }

      const event: FeishuEvent = {
        type: message.type,
        messageId: msg.message_id,
        chatId: msg.chat_id,
        chatType: msg.chat_type,
        senderId: msg.sender?.sender_id?.user_id || '',
        content,
        rootId: msg.root_id,
      };

      if (this.messageCallback) {
        this.messageCallback(event);
      }
    } catch (error) {
      // 解析失败，忽略消息
      console.error('解析 WebSocket 消息失败:', error);
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxRetries!) {
      console.error('达到最大重连次数，停止重连');
      return;
    }

    // 指数退避
    const delay = Math.min(
      this.options.initialDelay! * Math.pow(2, this.reconnectAttempts),
      this.options.maxDelay!
    );

    this.reconnectAttempts++;

    setTimeout(() => {
      if (!this.stopped) {
        this.start().catch(() => {
          // 重连失败，会触发 onclose 再次重连
        });
      }
    }, delay);
  }
}