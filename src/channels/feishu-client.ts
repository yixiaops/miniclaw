/**
 * 飞书 API 客户端
 * T1.1 飞书客户端实现
 *
 * 负责：获取 token、发送消息、API 调用
 */

export interface FeishuConfig {
  appId: string;
  appSecret: string;
}

export interface SendMessageParams {
  receiveId: string;
  msgType: 'text';
  content: string;
  replyToMessageId?: string;
}

export interface SendMessageResult {
  messageId: string;
}

interface TokenCache {
  token: string;
  expireAt: number; // 过期时间戳（毫秒）
}

interface FeishuApiResponse {
  code: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
  data?: {
    message_id: string;
  };
}

export class FeishuClient {
  private config: FeishuConfig;
  private tokenCache: TokenCache | null = null;

  constructor(config: FeishuConfig) {
    this.config = config;
  }

  /**
   * 获取 tenant_access_token
   * 自动缓存，过期前刷新
   */
  async getAccessToken(): Promise<string> {
    // 检查缓存
    if (this.tokenCache && this.tokenCache.expireAt > Date.now()) {
      return this.tokenCache.token;
    }

    // 调用 API 获取 token
    const response = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: this.config.appId,
          app_secret: this.config.appSecret,
        }),
      }
    );

    const data: FeishuApiResponse = await response.json();

    if (data.code !== 0) {
      throw new Error(`获取 token 失败: ${data.msg || `code ${data.code}`}`);
    }

    if (!data.tenant_access_token || !data.expire) {
      throw new Error('获取 token 失败: 返回数据不完整');
    }

    // 缓存 token（过期前 5 分钟刷新）
    this.tokenCache = {
      token: data.tenant_access_token,
      expireAt: Date.now() + (data.expire - 300) * 1000,
    };

    return this.tokenCache.token;
  }

  /**
   * 发送消息
   */
  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    const token = await this.getAccessToken();

    const body: Record<string, unknown> = {
      receive_id: params.receiveId,
      msg_type: params.msgType,
      content: JSON.stringify({ text: params.content }),
    };

    // 话题回复
    if (params.replyToMessageId) {
      body.reply_to_message_id = params.replyToMessageId;
    }

    const response = await fetch(
      'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=user_id',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      }
    );

    const data: FeishuApiResponse = await response.json();

    if (data.code !== 0) {
      throw new Error(`发送消息失败: ${data.msg || `code ${data.code}`}`);
    }

    if (!data.data?.message_id) {
      throw new Error('发送消息失败: 返回数据不完整');
    }

    return { messageId: data.data.message_id };
  }

  /**
   * 清空 token 缓存（强制刷新）
   */
  clearTokenCache(): void {
    this.tokenCache = null;
  }
}