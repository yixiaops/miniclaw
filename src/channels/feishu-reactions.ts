/**
 * 飞书消息表情回应
 * 在收到消息后添加表情回应，表示正在处理
 */

export interface FeishuConfig {
  appId: string;
  appSecret: string;
}

export interface AddReactionResult {
  reactionId: string;
}

interface TokenCache {
  token: string;
  expireAt: number;
}

interface FeishuApiResponse {
  code: number;
  msg?: string;
  tenant_access_token?: string;
  expire?: number;
  data?: {
    reaction_id?: string;
  };
}

/**
 * 飞书表情回应管理器
 */
export class FeishuReactions {
  private config: FeishuConfig;
  private tokenCache: TokenCache | null = null;

  constructor(config: FeishuConfig) {
    this.config = config;
  }

  /**
   * 获取 tenant_access_token
   */
  async getAccessToken(): Promise<string> {
    // 检查缓存
    if (this.tokenCache && this.tokenCache.expireAt > Date.now()) {
      return this.tokenCache.token;
    }

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

    if (data.code !== 0 || !data.tenant_access_token) {
      throw new Error(`获取 token 失败: ${data.msg || `code ${data.code}`}`);
    }

    // 缓存 token（提前 5 分钟过期）
    this.tokenCache = {
      token: data.tenant_access_token,
      expireAt: Date.now() + (data.expire || 7200) * 1000 - 5 * 60 * 1000,
    };

    return this.tokenCache.token;
  }

  /**
   * 添加表情回应
   * @param messageId 消息 ID
   * @param emojiType 表情类型（如 'SMILE'）
   * @returns reactionId 或空字符串（失败时）
   */
  async addReaction(messageId: string, emojiType: string): Promise<AddReactionResult> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reactions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reaction_type: { emoji_type: emojiType } }),
        }
      );

      const data: FeishuApiResponse = await response.json();

      if (data.code !== 0) {
        console.warn(`添加表情回应失败: ${data.msg || `code ${data.code}`}`);
        return { reactionId: '' };
      }

      return { reactionId: data.data?.reaction_id || '' };
    } catch (error) {
      console.warn('添加表情回应异常:', error);
      return { reactionId: '' };
    }
  }

  /**
   * 删除表情回应
   * @param messageId 消息 ID
   * @param reactionId 表情回应 ID
   * @returns 是否成功
   */
  async deleteReaction(messageId: string, reactionId: string): Promise<boolean> {
    try {
      const token = await this.getAccessToken();

      const response = await fetch(
        `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reactions/${reactionId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data: FeishuApiResponse = await response.json();

      if (data.code !== 0) {
        console.warn(`删除表情回应失败: ${data.msg || `code ${data.code}`}`);
        return false;
      }

      return true;
    } catch (error) {
      console.warn('删除表情回应异常:', error);
      return false;
    }
  }

  /**
   * 便捷方法：添加"正在处理"表情回应
   * 使用 SMILE 表情
   */
  async addProcessingReaction(messageId: string): Promise<AddReactionResult> {
    return this.addReaction(messageId, 'SMILE');
  }

  /**
   * 清空 token 缓存
   */
  clearTokenCache(): void {
    this.tokenCache = null;
  }
}