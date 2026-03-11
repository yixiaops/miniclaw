/**
 * Router 单元测试
 * TDD: Red 阶段 - 先写失败的测试
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Router', () => {
  let Router: typeof import('../../../src/core/gateway/router.js').Router;
  let router: InstanceType<typeof Router>;

  beforeEach(async () => {
    const module = await import('../../../src/core/gateway/router.js');
    Router = module.Router;
    router = new Router({
      rules: [],
      defaultStrategy: 'byUser'
    });
  });

  afterEach(() => {
    // cleanup
  });

  describe('route', () => {
    it('应该按用户 ID 路由', () => {
      const sessionId = router.route({
        channel: 'feishu',
        userId: '123',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-user-123');
    });

    it('应该按群组 ID 路由', () => {
      const sessionId = router.route({
        channel: 'feishu',
        groupId: '456',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-group-456');
    });

    it('应该按通道类型路由（CLI）', () => {
      const sessionId = router.route({
        channel: 'cli',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-cli');
    });

    it('API 通道应该按 clientId 路由', () => {
      const sessionId = router.route({
        channel: 'api',
        clientId: 'client-789',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-api-client-789');
    });

    it('API 通道无 clientId 时应该使用默认', () => {
      const sessionId = router.route({
        channel: 'api',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-api-default');
    });
  });

  describe('自定义路由规则', () => {
    it('应该支持自定义路由规则', async () => {
      const module = await import('../../../src/core/gateway/router.js');
      const customRouter = new module.Router({
        rules: [
          {
            id: 'rule-1',
            match: { channel: 'feishu', groupId: 'oc_special' },
            targetSessionId: 'session-special-group',
            priority: 10
          }
        ],
        defaultStrategy: 'byUser'
      });

      const sessionId = customRouter.route({
        channel: 'feishu',
        groupId: 'oc_special',
        userId: '123',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-special-group');
    });

    it('应该按优先级匹配规则', async () => {
      const module = await import('../../../src/core/gateway/router.js');
      const customRouter = new module.Router({
        rules: [
          {
            id: 'rule-low',
            match: { channel: 'feishu' },
            targetSessionId: 'session-low',
            priority: 1
          },
          {
            id: 'rule-high',
            match: { channel: 'feishu', groupId: 'group-1' },
            targetSessionId: 'session-high',
            priority: 10
          }
        ],
        defaultStrategy: 'byUser'
      });

      const sessionId = customRouter.route({
        channel: 'feishu',
        groupId: 'group-1',
        content: 'Hello'
      });

      // 应该匹配高优先级规则
      expect(sessionId).toBe('session-high');
    });

    it('无匹配规则时应该使用默认策略', async () => {
      const module = await import('../../../src/core/gateway/router.js');
      const customRouter = new module.Router({
        rules: [
          {
            id: 'rule-1',
            match: { channel: 'feishu', groupId: 'not-match' },
            targetSessionId: 'session-special',
            priority: 10
          }
        ],
        defaultStrategy: 'byUser'
      });

      const sessionId = customRouter.route({
        channel: 'feishu',
        userId: '123',
        content: 'Hello'
      });

      // 无匹配规则，使用默认策略
      expect(sessionId).toBe('session-user-123');
    });
  });

  describe('addRule / removeRule', () => {
    it('应该能够添加路由规则', () => {
      router.addRule({
        id: 'new-rule',
        match: { channel: 'cli' },
        targetSessionId: 'session-new',
        priority: 5
      });

      const sessionId = router.route({
        channel: 'cli',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-new');
    });

    it('应该能够移除路由规则', () => {
      router.addRule({
        id: 'temp-rule',
        match: { channel: 'cli' },
        targetSessionId: 'session-temp',
        priority: 100
      });

      router.removeRule('temp-rule');

      const sessionId = router.route({
        channel: 'cli',
        content: 'Hello'
      });

      // 规则已移除，使用默认策略
      expect(sessionId).toBe('session-cli');
    });
  });

  describe('默认路由策略', () => {
    it('byGroup 策略应该优先使用群组 ID', async () => {
      const module = await import('../../../src/core/gateway/router.js');
      const groupRouter = new module.Router({
        rules: [],
        defaultStrategy: 'byGroup'
      });

      const sessionId = groupRouter.route({
        channel: 'feishu',
        userId: '123',
        groupId: '456',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-group-456');
    });

    it('byUser 策略应该优先使用用户 ID', async () => {
      const module = await import('../../../src/core/gateway/router.js');
      const userRouter = new module.Router({
        rules: [],
        defaultStrategy: 'byUser'
      });

      const sessionId = userRouter.route({
        channel: 'feishu',
        userId: '123',
        groupId: '456',
        content: 'Hello'
      });

      expect(sessionId).toBe('session-user-123');
    });
  });

  describe('getRules', () => {
    it('应该返回所有路由规则', () => {
      router.addRule({
        id: 'rule-1',
        match: { channel: 'cli' },
        targetSessionId: 'session-1',
        priority: 1
      });

      router.addRule({
        id: 'rule-2',
        match: { channel: 'api' },
        targetSessionId: 'session-2',
        priority: 2
      });

      const rules = router.getRules();

      expect(rules).toHaveLength(2);
      expect(rules.map(r => r.id)).toContain('rule-1');
      expect(rules.map(r => r.id)).toContain('rule-2');
    });
  });
});