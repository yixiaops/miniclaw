/**
 * @fileoverview Session Key 构建和解析工具
 * @module core/session-key
 */

/**
 * Session Key 的 scope 类型
 */
export type ScopeType = 'main' | 'channel' | 'peer' | 'group';

/**
 * 主 Session Scope
 */
export interface MainScope {
  type: 'main';
}

/**
 * 通道 Session Scope
 */
export interface ChannelScope {
  type: 'channel';
  channel: string;
}

/**
 * 用户 Session Scope
 */
export interface PeerScope {
  type: 'peer';
  channel: string;
  peerId: string;
}

/**
 * 群组 Session Scope
 */
export interface GroupScope {
  type: 'group';
  channel: string;
  groupId: string;
}

/**
 * Session Scope 联合类型
 */
export type SessionScope = MainScope | ChannelScope | PeerScope | GroupScope;

/**
 * 解析后的 Session Key
 */
export interface ParsedSessionKey {
  agentId: string;
  scope: SessionScope;
}

/**
 * Session Key 构建器
 *
 * Session Key 格式: agent:{agentId}:{scope}
 *
 * scope 类型:
 * - main → 主 Session，示例：agent:main:main
 * - channel:{channel} → 按通道隔离，示例：agent:main:channel:cli
 * - channel:{channel}:peer:{peerId} → 按通道+用户隔离，示例：agent:main:channel:feishu:peer:ou_123
 * - channel:{channel}:group:{groupId} → 按通道+群组隔离，示例：agent:main:channel:feishu:group:oc_456
 */
export class SessionKeyBuilder {
  private static readonly PREFIX = 'agent:';

  /**
   * 构建主 Session Key
   * @param agentId - Agent ID
   * @returns Session Key
   */
  static buildMain(agentId: string): string {
    return `${this.PREFIX}${agentId}:main`;
  }

  /**
   * 构建 CLI Session Key
   * @param agentId - Agent ID
   * @returns Session Key
   */
  static buildCli(agentId: string): string {
    return `${this.PREFIX}${agentId}:channel:cli`;
  }

  /**
   * 构建用户 Session Key
   * @param agentId - Agent ID
   * @param channel - 通道名称
   * @param peerId - 用户 ID
   * @returns Session Key
   */
  static buildUser(agentId: string, channel: string, peerId: string): string {
    return `${this.PREFIX}${agentId}:channel:${channel}:peer:${peerId}`;
  }

  /**
   * 构建群组 Session Key
   * @param agentId - Agent ID
   * @param channel - 通道名称
   * @param groupId - 群组 ID
   * @returns Session Key
   */
  static buildGroup(agentId: string, channel: string, groupId: string): string {
    return `${this.PREFIX}${agentId}:channel:${channel}:group:${groupId}`;
  }

  /**
   * 解析 Session Key
   * @param sessionKey - Session Key 字符串
   * @returns 解析结果，无效格式返回 null
   */
  static parse(sessionKey: string): ParsedSessionKey | null {
    if (!sessionKey || !sessionKey.startsWith(this.PREFIX)) {
      return null;
    }

    const parts = sessionKey.split(':');

    // 格式: agent:{agentId}:{scope...}
    if (parts.length < 3) {
      return null;
    }

    const agentId = parts[1];
    const scopeParts = parts.slice(2);

    // 解析 scope
    const scope = this.parseScope(scopeParts);
    if (!scope) {
      return null;
    }

    return { agentId, scope };
  }

  /**
   * 解析 scope 部分
   */
  private static parseScope(parts: string[]): SessionScope | null {
    const [first, ...rest] = parts;

    if (first === 'main') {
      return { type: 'main' };
    }

    if (first === 'channel') {
      if (rest.length === 0) {
        return null; // 缺少 channel 名称
      }

      const channel = rest[0];
      const remaining = rest.slice(1);

      if (remaining.length === 0) {
        // channel:{channel}
        return { type: 'channel', channel };
      }

      const [scopeType, ...idParts] = remaining;

      if (scopeType === 'peer') {
        if (idParts.length === 0) {
          return null; // 缺少 peerId
        }
        return { type: 'peer', channel, peerId: idParts.join(':') };
      }

      if (scopeType === 'group') {
        if (idParts.length === 0) {
          return null; // 缺少 groupId
        }
        return { type: 'group', channel, groupId: idParts.join(':') };
      }

      return null;
    }

    return null;
  }
}