/**
 * @fileoverview MiniclawAgent 上下文截断测试
 *
 * 测试 transformContext 机制是否能防止工具返回的大内容导致 context 爆炸
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MiniclawAgent, truncateMessages, estimateMessagesTokens, estimateTokens } from '../../src/core/agent/index.js';
import type { AgentMessage } from '@mariozechner/pi-agent-core';
import type { Config } from '../../src/core/config.js';

// Mock Config
const mockConfig: Config = {
  bailian: {
    apiKey: 'test-api-key',
    model: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
};

describe('MiniclawAgent 上下文截断', () => {
  describe('estimateTokens', () => {
    it('应该正确估算中文文本的 token 数量', () => {
      const text = '这是一段中文文本';
      const tokens = estimateTokens(text);
      // 中文约 1.5 字符 = 1 token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });

    it('应该正确估算英文文本的 token 数量', () => {
      const text = 'This is English text';
      const tokens = estimateTokens(text);
      // 英文约 4 字符 = 1 token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length / 2);
    });

    it('应该正确估算混合文本的 token 数量', () => {
      const text = '这是中文 and this is English';
      const tokens = estimateTokens(text);
      expect(tokens).toBeGreaterThan(0);
    });

    it('空文本应该返回 0', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('   ')).toBe(1); // 空格也有开销
    });
  });

  describe('truncateMessages', () => {
    it('应该在超过阈值时截断消息', () => {
      // 创建超大的消息列表
      const messages: AgentMessage[] = [];
      const largeContent = 'x'.repeat(10000); // 每条消息 10K 字符

      for (let i = 0; i < 100; i++) {
        messages.push({
          role: 'user',
          content: largeContent,
          timestamp: Date.now()
        });
      }

      const contextWindow = 100000; // 100K context window
      const systemPrompt = 'System prompt';

      const truncatedCount = truncateMessages(messages, contextWindow, systemPrompt);

      expect(truncatedCount).toBeGreaterThan(0);
      expect(messages.length).toBeLessThan(100);
    });

    it('应该保留 system 消息不被截断', () => {
      const messages: AgentMessage[] = [
        { role: 'system', content: 'System', timestamp: Date.now() },
        { role: 'user', content: 'x'.repeat(10000), timestamp: Date.now() },
        { role: 'user', content: 'x'.repeat(10000), timestamp: Date.now() }
      ];

      const contextWindow = 5000;
      const systemPrompt = 'System prompt';

      truncateMessages(messages, contextWindow, systemPrompt);

      // system 消息应该保留
      expect(messages.some(m => m.role === 'system')).toBe(true);
    });

    it('应该保留最后 minKeep 条消息', () => {
      const messages: AgentMessage[] = [];
      for (let i = 0; i < 50; i++) {
        messages.push({
          role: 'user',
          content: `Message ${i}`,
          timestamp: Date.now()
        });
      }

      const contextWindow = 100; // 很小的窗口
      const systemPrompt = '';

      truncateMessages(messages, contextWindow, systemPrompt, 10);

      // 至少保留 10 条
      expect(messages.length).toBeGreaterThanOrEqual(10);
    });

    it('未超限时不应截断', () => {
      const messages: AgentMessage[] = [
        { role: 'user', content: 'Hello', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi', timestamp: Date.now() }
      ];

      const contextWindow = 128000;
      const systemPrompt = 'System';

      const truncatedCount = truncateMessages(messages, contextWindow, systemPrompt);

      expect(truncatedCount).toBe(0);
      expect(messages.length).toBe(2);
    });
  });

  describe('工具结果大小限制', () => {
    it('web_fetch 应该限制返回内容大小', async () => {
      // 这个测试验证 web_fetch 工具的大小限制
      // 目前应该失败，因为 web_fetch 没有大小限制
      const { webFetchTool } = await import('../../../src/tools/web-fetch.js');

      // 模拟一个超大内容
      const largeContent = 'x'.repeat(1000000); // 1M 字符

      // 检查工具是否有 MAX_CONTENT_SIZE 限制
      // 目前应该没有这个限制，测试会失败
      const toolDefinition = webFetchTool;

      // 验证工具定义中是否有大小限制相关的配置
      // 这是一个设计测试 - 我们期望有这个配置但目前没有
      expect(toolDefinition).toHaveProperty('maxContentSize');
    });
  });

  describe('transformContext 机制', () => {
    it('MiniclawAgent 应该配置 transformContext', async () => {
      // 这个测试验证 MiniclawAgent 是否配置了 transformContext
      // 目前应该失败，因为 MiniclawAgent 没有使用 transformContext

      const agent = new MiniclawAgent(mockConfig, {
        systemPrompt: 'Test prompt',
        agentId: 'test'
      });

      // 检查 Agent 是否有 transformContext 配置
      const agentState = agent.getConfig();

      // 我们期望 transformContext 被配置，但目前没有
      // 这会导致测试失败 - 这正是 TDD 的红灯阶段
      expect(agent).toHaveProperty('transformContextConfigured');
    });
  });

  describe('上下文爆炸防护集成测试', () => {
    it('应该通过双层防护防止 context 爆炸', async () => {
      // 这个测试验证双层防护机制：
      // 1. web_fetch 返回时限制内容大小（50K）
      // 2. transformContext 截断旧消息

      // 模拟 web_fetch 返回的内容（已被限制为 50K）
      const MAX_CONTENT_SIZE = 50000;
      const limitedContent = 'x'.repeat(MAX_CONTENT_SIZE);

      // 创建多条消息，累积后超过阈值
      const messages: AgentMessage[] = [];

      // 添加多条 50K 大小的工具结果（累积超过阈值）
      for (let i = 0; i < 10; i++) {
        messages.push({
          role: 'toolResult',
          toolCallId: `tool-${i}`,
          toolName: 'web_fetch',
          content: [{ type: 'text', text: limitedContent }],
          timestamp: Date.now()
        });
      }

      // 计算总 token（约 500K 内容）
      const totalTokens = estimateMessagesTokens(messages);

      // 验证累积后超过阈值
      expect(totalTokens).toBeGreaterThan(128000 * 0.75);

      // 应用截断
      const contextWindow = 128000;
      const systemPrompt = 'System prompt';

      const truncatedCount = truncateMessages(messages, contextWindow, systemPrompt);

      // 验证截断生效
      expect(truncatedCount).toBeGreaterThan(0);

      // 验证截断后的 token 数在安全范围内
      const newTokens = estimateMessagesTokens(messages);
      expect(newTokens).toBeLessThan(contextWindow * 0.75);
    });

    it('web_fetch 应该截断超大内容', async () => {
      // 验证 web_fetch 的截断逻辑
      const { webFetchTool } = await import('../../src/tools/web-fetch.js');

      // 验证工具定义有 maxContentSize
      expect(webFetchTool.maxContentSize).toBe(50000);

      // 模拟超大内容被截断
      const oversizedContent = 'x'.repeat(100000);
      const maxSize = webFetchTool.maxContentSize;

      // 验证截断后的大小
      expect(maxSize).toBeLessThan(oversizedContent.length);
    });
  });
});