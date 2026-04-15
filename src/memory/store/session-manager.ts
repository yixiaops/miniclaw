/**
 * @fileoverview Session 管理器实现
 *
 * 管理 Session 的创建、活动和销毁。
 *
 * @module memory/store/session-manager
 */

/**
 * Session 信息
 */
export interface SessionInfo {
  /** Session ID */
  id: string;
  /** 创建时间 */
  createdAt: Date;
  /** 最后活动时间 */
  lastActivity: Date;
  /** 记忆数量 */
  memoryCount: number;
}

/**
 * Session 管理器
 *
 * 跟踪所有活跃的 Session。
 *
 * @example
 * ```ts
 * const manager = new SessionManager();
 * const sessionId = manager.create();
 * manager.updateActivity(sessionId);
 * ```
 */
export class SessionManager {
  /** Session 映射 */
  private sessions: Map<string, SessionInfo> = new Map();

  /**
   * 创建新 Session
   *
   * @returns Session ID
   */
  create(): string {
    const id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    this.sessions.set(id, {
      id,
      createdAt: now,
      lastActivity: now,
      memoryCount: 0
    });

    return id;
  }

  /**
   * 获取 Session 信息
   */
  get(sessionId: string): SessionInfo | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * 更新 Session 活动
   */
  updateActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * 列出活跃 Session
   *
   * @param activityThreshold - 活跃阈值（毫秒），默认 30 分钟
   */
  listActive(activityThreshold?: number): SessionInfo[] {
    const threshold = activityThreshold || 30 * 60 * 1000; // 30min
    const now = Date.now();

    return Array.from(this.sessions.values()).filter(
      s => now - s.lastActivity.getTime() < threshold
    );
  }

  /**
   * 销毁 Session
   */
  destroy(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /**
   * 获取 Session 数量
   */
  count(): number {
    return this.sessions.size;
  }

  /**
   * 清除所有 Session
   */
  clear(): void {
    this.sessions.clear();
  }
}