/**
 * @fileoverview 简单的内存持久化存储
 *
 * 将对话历史保存到本地文件系统。
 *
 * @module core/memory/simple
 */

import { mkdir, readFile, writeFile, unlink, readdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

/**
 * 消息类型
 */
export interface Message {
  /** 角色 */
  role: 'user' | 'assistant' | 'system';
  /** 内容 */
  content: string;
  /** 时间戳（可选） */
  timestamp?: string;
}

/**
 * 存储的数据格式
 */
interface StorageData {
  /** Session Key */
  sessionKey: string;
  /** 消息列表 */
  messages: Message[];
  /** 更新时间 */
  updatedAt: string;
}

/**
 * SimpleMemoryStorage 类
 *
 * 提供对话历史的持久化存储功能。
 *
 * ## 存储格式
 *
 * 存储目录：`~/.miniclaw/sessions/`
 * 文件格式：JSON 文件，文件名为 sessionKey 的安全编码
 *
 * ```json
 * {
 *   "sessionKey": "agent:main:main",
 *   "messages": [
 *     {"role": "user", "content": "你好", "timestamp": "2026-03-13T12:00:00Z"},
 *     {"role": "assistant", "content": "你好！", "timestamp": "2026-03-13T12:00:01Z"}
 *   ],
 *   "updatedAt": "2026-03-13T12:00:01Z"
 * }
 * ```
 *
 * @example
 * ```ts
 * const storage = new SimpleMemoryStorage();
 *
 * // 保存消息
 * await storage.save('agent:main:main', [
 *   { role: 'user', content: '你好' },
 *   { role: 'assistant', content: '你好！' }
 * ]);
 *
 * // 加载消息
 * const messages = await storage.load('agent:main:main');
 * ```
 */
export class SimpleMemoryStorage {
  /** 存储目录 */
  private storageDir: string;

  /**
   * 创建 SimpleMemoryStorage 实例
   *
   * @param storageDir - 存储目录路径（默认为 ~/.miniclaw/sessions/）
   */
  constructor(storageDir?: string) {
    this.storageDir = storageDir || join(process.env.HOME || '', '.miniclaw', 'sessions');
  }

  /**
   * 确保存储目录存在
   */
  private async ensureDir(): Promise<void> {
    if (!existsSync(this.storageDir)) {
      await mkdir(this.storageDir, { recursive: true });
    }
  }

  /**
   * 将 sessionKey 转换为安全的文件名
   *
   * 替换特殊字符为下划线
   *
   * @param sessionKey - Session Key
   * @returns 安全的文件名
   */
  private sessionKeyToFilename(sessionKey: string): string {
    // 替换 : 和 / 为下划线
    return sessionKey.replace(/[:/]/g, '_') + '.json';
  }

  /**
   * 获取文件路径
   *
   * @param sessionKey - Session Key
   * @returns 文件路径
   */
  private getFilePath(sessionKey: string): string {
    return join(this.storageDir, this.sessionKeyToFilename(sessionKey));
  }

  /**
   * 保存 Session 的对话历史
   *
   * @param sessionKey - Session Key
   * @param messages - 消息列表
   */
  async save(sessionKey: string, messages: Message[]): Promise<void> {
    await this.ensureDir();

    const data: StorageData = {
      sessionKey,
      messages,
      updatedAt: new Date().toISOString()
    };

    const filePath = this.getFilePath(sessionKey);
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 加载 Session 的对话历史
   *
   * @param sessionKey - Session Key
   * @returns 消息列表，如果不存在则返回空数组
   */
  async load(sessionKey: string): Promise<Message[]> {
    const filePath = this.getFilePath(sessionKey);

    try {
      const content = await readFile(filePath, 'utf-8');
      const data: StorageData = JSON.parse(content);
      return data.messages;
    } catch {
      // 文件不存在或解析失败，返回空数组
      return [];
    }
  }

  /**
   * 删除 Session 的对话历史
   *
   * @param sessionKey - Session Key
   */
  async delete(sessionKey: string): Promise<void> {
    const filePath = this.getFilePath(sessionKey);

    try {
      await unlink(filePath);
    } catch {
      // 文件不存在，静默处理
    }
  }

  /**
   * 列出所有 Session Key
   *
   * @returns Session Key 数组
   */
  async listSessions(): Promise<string[]> {
    await this.ensureDir();

    try {
      const files = await readdir(this.storageDir);
      const sessionKeys: string[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = join(this.storageDir, file);
          try {
            const content = await readFile(filePath, 'utf-8');
            const data: StorageData = JSON.parse(content);
            if (data.sessionKey) {
              sessionKeys.push(data.sessionKey);
            }
          } catch {
            // 解析失败，跳过
          }
        }
      }

      return sessionKeys;
    } catch {
      return [];
    }
  }
}