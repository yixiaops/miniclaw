/**
 * 待推送消息存储模块
 *
 * 存储用户离线时未能送达的提醒消息
 *
 * @module scheduler/pending-store
 */

import fs from 'fs';
import path from 'path';
import type {
  PendingMessage,
  PendingMessageStoreData,
  Channel,
} from './types.js';

/** 默认存储路径 */
const DEFAULT_STORE_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '~',
  '.miniclaw',
  'pending-messages.json'
);

/** 最大重试次数 */
const MAX_RETRY_COUNT = 3;

/**
 * 待推送消息存储类
 *
 * 负责离线消息的存储、查询和清理
 */
export class PendingMessageStore {
  private filePath: string;
  private messages: Map<string, PendingMessage> = new Map();

  /**
   * 创建 PendingMessageStore 实例
   *
   * @param filePath - 存储文件路径（可选）
   */
  constructor(filePath?: string) {
    this.filePath = filePath || DEFAULT_STORE_PATH;
    this.load();
  }

  /**
   * 从文件加载消息数据
   */
  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.save();
        return;
      }

      const content = fs.readFileSync(this.filePath, 'utf-8');
      const data: PendingMessageStoreData = JSON.parse(content);

      for (const msg of data.messages || []) {
        this.messages.set(msg.messageId, msg);
      }
    } catch (error) {
      console.warn(
        `[PendingMessageStore] Failed to load ${this.filePath}, creating new store`
      );
      this.messages.clear();
      this.save();
    }
  }

  /**
   * 保存消息数据到文件
   */
  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data: PendingMessageStoreData = {
      messages: Array.from(this.messages.values()),
    };

    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 获取所有待推送消息
   *
   * @returns 消息列表
   */
  getAll(): PendingMessage[] {
    return Array.from(this.messages.values());
  }

  /**
   * 根据 messageId 获取消息
   *
   * @param messageId - 消息 ID
   * @returns 消息对象或 undefined
   */
  getById(messageId: string): PendingMessage | undefined {
    return this.messages.get(messageId);
  }

  /**
   * 根据 userId 获取消息列表
   *
   * @param userId - 用户 ID
   * @returns 该用户的待推送消息列表
   */
  getByUserId(userId: string): PendingMessage[] {
    return this.getAll().filter((msg) => msg.userId === userId);
  }

  /**
   * 根据渠道获取消息列表
   *
   * @param channel - 渠道类型
   * @returns 该渠道的待推送消息列表
   */
  getByChannel(channel: Channel): PendingMessage[] {
    return this.getAll().filter((msg) => msg.channel === channel);
  }

  /**
   * 添加待推送消息
   *
   * @param message - 消息对象
   * @returns 添加的消息
   */
  add(message: PendingMessage): PendingMessage {
    this.messages.set(message.messageId, message);
    this.save();
    return message;
  }

  /**
   * 移除消息（已推送成功）
   *
   * @param messageId - 消息 ID
   * @returns 是否移除成功
   */
  remove(messageId: string): boolean {
    if (!this.messages.has(messageId)) {
      return false;
    }

    this.messages.delete(messageId);
    this.save();
    return true;
  }

  /**
   * 按创建时间排序获取消息
   *
   * @returns 按时间升序排列的消息列表
   */
  getOrderedByTime(): PendingMessage[] {
    return this.getAll().sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeA - timeB;
    });
  }

  /**
   * 增加重试计数
   *
   * @param messageId - 消息 ID
   * @returns 更新后的重试次数
   */
  incrementRetry(messageId: string): number {
    const msg = this.messages.get(messageId);
    if (!msg) {
      return 0;
    }

    // 不超过最大重试次数
    const newCount = Math.min(msg.retryCount + 1, MAX_RETRY_COUNT);
    const updated = { ...msg, retryCount: newCount };

    this.messages.set(messageId, updated);
    this.save();
    return newCount;
  }

  /**
   * 获取可重试的消息（重试次数未达上限）
   *
   * @returns 可重试的消息列表
   */
  getRetryable(): PendingMessage[] {
    return this.getAll().filter((msg) => msg.retryCount < MAX_RETRY_COUNT);
  }

  /**
   * 清理过期消息
   *
   * @param maxAgeMs - 最大保留时间（毫秒）
   * @returns 清理的消息数量
   */
  cleanExpired(maxAgeMs: number): number {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const msg of this.getAll()) {
      const age = now - new Date(msg.createdAt).getTime();
      if (age > maxAgeMs) {
        toDelete.push(msg.messageId);
      }
    }

    for (const messageId of toDelete) {
      this.messages.delete(messageId);
    }

    if (toDelete.length > 0) {
      this.save();
    }

    return toDelete.length;
  }

  /**
   * 获取待推送消息数量
   *
   * @returns 消息数量
   */
  count(): number {
    return this.messages.size;
  }

  /**
   * 检查是否有用户的待推送消息
   *
   * @param userId - 用户 ID
   * @returns 是否有待推送消息
   */
  hasPendingForUser(userId: string): boolean {
    return this.getByUserId(userId).length > 0;
  }
}