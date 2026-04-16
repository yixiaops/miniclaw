/**
 * @fileoverview memory_write 工具实现
 *
 * 实现记忆写入工具，整合去重、敏感检测等功能。
 *
 * @module memory/tools/write
 */

import type { IMemoryStore, MemoryType, MemoryMetadata } from '../store/interface.js';
import type { DeduplicationChecker } from '../write/deduplication.js';
import type { SensitiveDetector } from '../write/sensitive-detector.js';

/**
 * 写入结果状态
 */
type WriteStatus = 'created' | 'updated' | 'skipped' | 'error';

/**
 * 写入结果
 */
interface WriteResult {
  /** 状态 */
  status: WriteStatus;
  /** 记忆 ID（created/updated 时） */
  id?: string;
  /** 原因（skipped/error 时） */
  reason?: string;
}

/**
 * 写入参数
 */
interface WriteParams {
  /** 记忆内容 */
  content: string;
  /** 记忆类型 */
  type: MemoryType;
  /** 元数据（可选） */
  metadata?: MemoryMetadata;
  /** 强制写入（跳过去重检查） */
  force?: boolean;
}

/**
 * 写入统计
 */
interface WriteStats {
  /** 总写入次数 */
  total: number;
  /** 创建次数 */
  created: number;
  /** 更新次数 */
  updated: number;
  /** 跳过次数 */
  skipped: number;
  /** 错误次数 */
  errors: number;
}

/**
 * MemoryWriteTool 类
 *
 * 记忆写入工具，整合存储、去重、敏感检测。
 *
 * @example
 * ```ts
 * const tool = new MemoryWriteTool(store, dedupChecker, sensitiveDetector);
 * const result = await tool.execute({ content: 'User prefers dark mode', type: 'long-term' });
 * ```
 */
export class MemoryWriteTool {
  /** 存储服务 */
  private store: IMemoryStore;
  /** 去重检查器 */
  private deduplicationChecker: DeduplicationChecker;
  /** 敏感检测器 */
  private sensitiveDetector: SensitiveDetector;
  /** 统计信息 */
  private stats: WriteStats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };

  /**
   * 创建写入工具
   */
  constructor(
    store: IMemoryStore,
    deduplicationChecker: DeduplicationChecker,
    sensitiveDetector: SensitiveDetector
  ) {
    this.store = store;
    this.deduplicationChecker = deduplicationChecker;
    this.sensitiveDetector = sensitiveDetector;
  }

  /**
   * 执行写入操作
   *
   * @param params - 写入参数
   * @returns 写入结果
   */
  async execute(params: WriteParams): Promise<WriteResult> {
    this.stats.total++;

    // 1. 参数验证
    const validationError = this.validateParams(params);
    if (validationError) {
      this.stats.errors++;
      return { status: 'error', reason: validationError };
    }

    const { content, type, metadata, force } = params;

    // 2. 敏感信息检测
    if (this.sensitiveDetector.detect(content)) {
      this.stats.skipped++;
      return { status: 'skipped', reason: `包含敏感信息：${this.sensitiveDetector.getReason()}` };
    }

    // 3. 去重检查（除非 force=true）
    if (!force) {
      const existingEntries = await this.store.list(type);
      const existingContent = existingEntries.map(e => e.content);
      const isDuplicate = await this.deduplicationChecker.check(content, existingContent);

      if (isDuplicate) {
        this.stats.skipped++;
        return { status: 'skipped', reason: '内容重复，已跳过' };
      }
    }

    // 4. 写入记忆
    if (force) {
      // 查找已存在的相同内容
      const existingEntries = await this.store.list(type);
      const existing = existingEntries.find(e => e.content === content);

      if (existing) {
        // 更新已存在的记忆
        await this.store.update(existing.id, content);
        this.stats.updated++; // 修正：updated 而不是 created
        return { status: 'updated', id: existing.id }; // 修正：返回 existing.id
      }
    }

    // 5. 创建新记忆
    const id = await this.store.write(content, type, metadata);
    this.stats.created++;

    return { status: 'created', id };
  }

  /**
   * 验证参数
   */
  private validateParams(params: WriteParams): string | null {
    if (!params.content || params.content.trim().length === 0) {
      return 'content 参数不能为空';
    }

    if (!params.type) {
      return 'type 参数不能为空';
    }

    const validTypes: MemoryType[] = ['short-term', 'long-term'];
    if (!validTypes.includes(params.type)) {
      return `type 参数无效，必须是 ${validTypes.join(' 或 ')}`;
    }

    return null;
  }

  /**
   * 获取统计信息
   */
  getStats(): WriteStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = { total: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
  }
}