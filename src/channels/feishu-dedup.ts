/**
 * 消息去重器
 * T1.5 消息去重实现
 *
 * 基于 messageId 的内存去重，防止重复处理同一消息
 */

export interface MessageDeduplicatorOptions {
  maxSize?: number;
}

export class MessageDeduplicator {
  private seenMessages: Set<string>;
  private maxSize: number;

  constructor(options?: MessageDeduplicatorOptions) {
    this.seenMessages = new Set();
    this.maxSize = options?.maxSize ?? 10000;
  }

  /**
   * 检查消息是否重复
   * @param messageId 消息 ID
   * @returns true 表示重复，false 表示首次
   */
  isDuplicate(messageId: string): boolean {
    // 首次消息
    if (!this.seenMessages.has(messageId)) {
      // 检查是否达到上限
      if (this.seenMessages.size >= this.maxSize) {
        this.clear();
      }

      this.seenMessages.add(messageId);
      return false;
    }

    // 重复消息
    return true;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.seenMessages.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.seenMessages.size;
  }
}