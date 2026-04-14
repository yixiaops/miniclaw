/**
 * @fileoverview Memory Store 接口定义
 *
 * 定义记忆存储的核心接口和类型。
 *
 * @module memory/store/interface
 */

/**
 * 记忆类型
 */
export type MemoryType = 'short-term' | 'long-term';

/**
 * 记忆元数据
 */
export interface MemoryMetadata {
  /** 会话 ID */
  sessionId?: string;
  /** 时间戳 */
  timestamp?: Date;
  /** 来源渠道 */
  source?: string;
  /** 重要性评分 (0-1) */
  importance?: number;
  /** 标签 */
  tags?: string[];
}

/**
 * 记忆条目
 */
export interface MemoryEntry {
  /** 记忆 ID */
  id: string;
  /** 记忆内容 */
  content: string;
  /** 记忆类型 */
  type: MemoryType;
  /** 元数据 */
  metadata: MemoryMetadata;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 搜索选项
 */
export interface SearchOptions {
  /** 搜索查询 */
  query: string;
  /** 结果数量限制 */
  limit?: number;
  /** 最小相关性阈值 */
  minScore?: number;
  /** 记忆类型过滤 */
  types?: MemoryType[];
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 记忆条目 */
  entry: MemoryEntry;
  /** 相关性评分 */
  score: number;
}

/**
 * Memory Store 接口
 *
 * 定义记忆存储的核心操作。
 */
export interface IMemoryStore {
  /**
   * 写入记忆
   *
   * @param content - 记忆内容
   * @param type - 记忆类型
   * @param metadata - 元数据
   * @returns 记忆 ID
   */
  write(content: string, type: MemoryType, metadata?: MemoryMetadata): Promise<string>;

  /**
   * 读取记忆
   *
   * @param id - 记忆 ID
   * @returns 记忆条目，不存在则返回 null
   */
  read(id: string): Promise<MemoryEntry | null>;

  /**
   * 更新记忆
   *
   * @param id - 记忆 ID
   * @param content - 新内容
   * @returns 是否成功
   */
  update(id: string, content: string): Promise<boolean>;

  /**
   * 删除记忆
   *
   * @param id - 记忆 ID
   * @returns 是否成功
   */
  delete(id: string): Promise<boolean>;

  /**
   * 列出记忆
   *
   * @param type - 记忆类型过滤（可选）
   * @returns 记忆条目列表
   */
  list(type?: MemoryType): Promise<MemoryEntry[]>;

  /**
   * 搜索记忆
   *
   * @param options - 搜索选项
   * @returns 搜索结果列表
   */
  search(options: SearchOptions): Promise<SearchResult[]>;
}