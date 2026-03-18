/**
 * @fileoverview SessionKeyBuilder 测试用例
 * @module core/session-key/index.test
 */
import { describe, it, expect } from 'vitest';
import { SessionKeyBuilder, ParsedSessionKey } from '../../../../src/core/session-key/index.js';

describe('SessionKeyBuilder', () => {
  describe('buildMain', () => {
    it('should build main session key', () => {
      const result = SessionKeyBuilder.buildMain('main');
      expect(result).toBe('agent:main:main');
    });

    it('should build main session key with custom agentId', () => {
      const result = SessionKeyBuilder.buildMain('agent-123');
      expect(result).toBe('agent:agent-123:main');
    });
  });

  describe('buildCli', () => {
    it('should build CLI session key', () => {
      const result = SessionKeyBuilder.buildCli('main');
      expect(result).toBe('agent:main:channel:cli');
    });

    it('should build CLI session key with custom agentId', () => {
      const result = SessionKeyBuilder.buildCli('agent-456');
      expect(result).toBe('agent:agent-456:channel:cli');
    });
  });

  describe('buildUser', () => {
    it('should build user session key', () => {
      const result = SessionKeyBuilder.buildUser('main', 'feishu', 'ou_123');
      expect(result).toBe('agent:main:channel:feishu:peer:ou_123');
    });

    it('should build user session key with custom agentId', () => {
      const result = SessionKeyBuilder.buildUser('agent-789', 'wechat', 'user_abc');
      expect(result).toBe('agent:agent-789:channel:wechat:peer:user_abc');
    });
  });

  describe('buildGroup', () => {
    it('should build group session key', () => {
      const result = SessionKeyBuilder.buildGroup('main', 'feishu', 'oc_456');
      expect(result).toBe('agent:main:channel:feishu:group:oc_456');
    });

    it('should build group session key with custom agentId', () => {
      const result = SessionKeyBuilder.buildGroup('agent-xyz', 'slack', 'channel_789');
      expect(result).toBe('agent:agent-xyz:channel:slack:group:channel_789');
    });
  });

  describe('parse', () => {
    it('should parse main session key', () => {
      const result = SessionKeyBuilder.parse('agent:main:main');
      expect(result).toEqual({
        agentId: 'main',
        scope: {
          type: 'main'
        }
      });
    });

    it('should parse channel session key (CLI)', () => {
      const result = SessionKeyBuilder.parse('agent:main:channel:cli');
      expect(result).toEqual({
        agentId: 'main',
        scope: {
          type: 'channel',
          channel: 'cli'
        }
      });
    });

    it('should parse channel session key (feishu)', () => {
      const result = SessionKeyBuilder.parse('agent:main:channel:feishu');
      expect(result).toEqual({
        agentId: 'main',
        scope: {
          type: 'channel',
          channel: 'feishu'
        }
      });
    });

    it('should parse peer session key', () => {
      const result = SessionKeyBuilder.parse('agent:main:channel:feishu:peer:ou_123');
      expect(result).toEqual({
        agentId: 'main',
        scope: {
          type: 'peer',
          channel: 'feishu',
          peerId: 'ou_123'
        }
      });
    });

    it('should parse group session key', () => {
      const result = SessionKeyBuilder.parse('agent:main:channel:feishu:group:oc_456');
      expect(result).toEqual({
        agentId: 'main',
        scope: {
          type: 'group',
          channel: 'feishu',
          groupId: 'oc_456'
        }
      });
    });

    it('should return null for invalid format - missing prefix', () => {
      const result = SessionKeyBuilder.parse('main:main');
      expect(result).toBeNull();
    });

    it('should return null for invalid format - wrong prefix', () => {
      const result = SessionKeyBuilder.parse('session:main:main');
      expect(result).toBeNull();
    });

    it('should return null for invalid format - empty string', () => {
      const result = SessionKeyBuilder.parse('');
      expect(result).toBeNull();
    });

    it('should return null for invalid format - incomplete peer key', () => {
      const result = SessionKeyBuilder.parse('agent:main:channel:feishu:peer');
      expect(result).toBeNull();
    });

    it('should return null for invalid format - incomplete group key', () => {
      const result = SessionKeyBuilder.parse('agent:main:channel:feishu:group');
      expect(result).toBeNull();
    });

    it('should return null for invalid format - missing channel', () => {
      const result = SessionKeyBuilder.parse('agent:main:channel');
      expect(result).toBeNull();
    });
  });

  describe('round-trip', () => {
    it('should round-trip main session key', () => {
      const key = SessionKeyBuilder.buildMain('main');
      const parsed = SessionKeyBuilder.parse(key);
      expect(parsed?.agentId).toBe('main');
      expect(parsed?.scope.type).toBe('main');
    });

    it('should round-trip CLI session key', () => {
      const key = SessionKeyBuilder.buildCli('agent-123');
      const parsed = SessionKeyBuilder.parse(key);
      expect(parsed?.agentId).toBe('agent-123');
      expect(parsed?.scope.type).toBe('channel');
      expect(parsed?.scope.channel).toBe('cli');
    });

    it('should round-trip user session key', () => {
      const key = SessionKeyBuilder.buildUser('main', 'feishu', 'ou_abc');
      const parsed = SessionKeyBuilder.parse(key);
      expect(parsed?.agentId).toBe('main');
      expect(parsed?.scope.type).toBe('peer');
      expect(parsed?.scope.channel).toBe('feishu');
      expect(parsed?.scope.peerId).toBe('ou_abc');
    });

    it('should round-trip group session key', () => {
      const key = SessionKeyBuilder.buildGroup('main', 'slack', 'C12345');
      const parsed = SessionKeyBuilder.parse(key);
      expect(parsed?.agentId).toBe('main');
      expect(parsed?.scope.type).toBe('group');
      expect(parsed?.scope.channel).toBe('slack');
      expect(parsed?.scope.groupId).toBe('C12345');
    });
  });
});