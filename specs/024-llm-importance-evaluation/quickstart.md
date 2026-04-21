# Quickstart: LLM Importance Evaluation

**Date**: 2026-04-21
**Feature**: 024-llm-importance-evaluation

## Overview

本指南帮助开发者快速实现 LLM 动态评估消息重要性功能。

---

## 1. 添加新模块

### 1.1 ImportanceEvaluator

**路径**: `src/memory/importance/evaluator.ts`

```typescript
import type { ImportanceEvaluatorConfig, ImportanceParseResult } from './types.js';

const DEFAULT_CONFIG: ImportanceEvaluatorConfig = {
  defaultImportance: 0.3,
  pattern: /\[IMPORTANCE:([0-9.]+)\]/g,
  logParsed: false
};

export class ImportanceEvaluator {
  private config: ImportanceEvaluatorConfig;

  constructor(config?: Partial<ImportanceEvaluatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  parse(responseContent: string): ImportanceParseResult {
    // 1. 匹配所有标记
    const matches = responseContent.matchAll(this.config.pattern);
    const allMatches = Array.from(matches);

    // 2. 无标记，返回 null
    if (allMatches.length === 0) {
      return {
        importance: null,
        strippedContent: responseContent,
        parsed: false
      };
    }

    // 3. 取最后一个标记
    const lastMatch = allMatches[allMatches.length - 1];
    const rawValue = parseFloat(lastMatch[1]);

    // 4. Clamp 到 0-1
    const importance = Math.max(0, Math.min(1, rawValue));

    // 5. 剥离所有标记
    const strippedContent = responseContent.replace(this.config.pattern, '').trim();

    return {
      importance,
      strippedContent,
      parsed: true
    };
  }
}
```

### 1.2 类型定义

**路径**: `src/memory/importance/types.ts`

```typescript
export interface ImportanceParseResult {
  importance: number | null;
  strippedContent: string;
  parsed: boolean;
}

export interface ImportanceEvaluatorConfig {
  defaultImportance: number;
  pattern: RegExp;
  logParsed: boolean;
}
```

### 1.3 模块导出

**路径**: `src/memory/importance/index.ts`

```typescript
export { ImportanceEvaluator } from './evaluator.js';
export type { ImportanceParseResult, ImportanceEvaluatorConfig } from './types.js';
```

---

## 2. 添加 SoulLoader

### 2.1 实现

**路径**: `src/soul/loader.ts`

```typescript
import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_SOUL = `# Miniclaw Soul

## AI 人格
我是 Miniclaw，一个专业、可靠的 AI 助手。

## 爱好
帮助用户解决问题，记录重要信息。

## 核心规则
**每次回复必须在末尾包含 [IMPORTANCE:X] 标记**

X 为 0-1 的数值，表示当前对话的重要性：
- 0.7-0.9: 包含个人信息（姓名、偏好、联系方式）
- 0.6-0.8: 重要决策或结论
- 0.4-0.6: 一般对话内容
- 0.1-0.3: 简单问候或闲聊
`;

export interface SoulConfig {
  filePath: string;
  enabled: boolean;
}

export class SoulLoader {
  private config: SoulConfig;

  constructor(config?: Partial<SoulConfig>) {
    this.config = {
      filePath: process.env.MINICLAW_SOUL_FILE || path.join(os.homedir(), '.miniclaw', 'soul.md'),
      enabled: true,
      ...config
    };
  }

  async load(): Promise<string> {
    if (!this.config.enabled) {
      return '';
    }

    const filePath = this.expandHome(this.config.filePath);

    if (!fs.existsSync(filePath)) {
      return DEFAULT_SOUL;
    }

    return fs.readFileSync(filePath, 'utf-8');
  }

  getDefault(): string {
    return DEFAULT_SOUL;
  }

  private expandHome(filePath: string): string {
    if (filePath.startsWith('~')) {
      return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
  }
}
```

---

## 3. 修改 AutoMemoryWriter

### 3.1 改造 writeConversation

**路径**: `src/memory/auto-writer.ts`

```typescript
// 在现有 writeConversation 方法中添加 importance 参数
async writeConversation(
  sessionId: string,
  userMsg: string,
  assistantMsg: string,
  importance?: number  // ✅ 新增参数
): Promise<boolean> {
  if (!this.config.enabled) {
    return false;
  }

  // 使用传入的 importance 或默认值
  const finalImportance = importance ?? this.config.defaultImportance;

  const results = await Promise.all([
    this.errorHandler.silentExecute(
      async () => {
        await this.memoryManager.write(userMsg, sessionId, {
          importance: finalImportance,  // ✅ 使用 finalImportance
          source: 'user'
        });
        return true;
      },
      false
    ),
    this.errorHandler.silentExecute(
      async () => {
        await this.memoryManager.write(assistantMsg, sessionId, {
          importance: finalImportance,  // ✅ 使用 finalImportance
          source: 'assistant'
        });
        return true;
      },
      false
    )
  ]);

  return results.every(r => r === true);
}
```

---

## 4. 修改 Gateway

### 4.1 添加 ImportanceEvaluator

**路径**: `src/core/gateway/index.ts`

```typescript
import { ImportanceEvaluator } from '../../memory/importance/index.js';
import { SoulLoader } from '../../soul/loader.js';

export class MiniclawGateway {
  // ✅ 新增
  private importanceEvaluator: ImportanceEvaluator;
  private soulLoader: SoulLoader;

  constructor(config: Config, gatewayConfig: GatewayConfig) {
    // ... 原有初始化 ...

    // ✅ 新增：初始化 ImportanceEvaluator
    this.importanceEvaluator = new ImportanceEvaluator({
      defaultImportance: config.memory?.defaultImportance ?? 0.3
    });

    // ✅ 新增：初始化 SoulLoader
    this.soulLoader = new SoulLoader();
  }
}
```

### 4.2 改造 handleMessage

```typescript
async handleMessage(ctx: MessageContext): Promise<Response> {
  // 1-3: 原有路由、Session、Agent 获取
  const sessionId = this.router.route(this.toRouteContext(ctx));
  const session = this.sessionManager.getOrCreate(sessionId, { ... });
  const agent = this.agentRegistry.getOrCreate(sessionId);

  // 4. 调用 Agent 处理消息
  const response = await agent.chat(ctx.content);

  // ✅ 5. 解析 importance
  const parseResult = this.importanceEvaluator.parse(response.content);

  // ✅ 6. 使用剥离后的内容
  const cleanContent = parseResult.strippedContent;

  // 7. 记录消息到 Session 历史
  session.addMessage({ role: 'user', content: ctx.content });
  session.addMessage({ role: 'assistant', content: cleanContent });

  // 8. 保存对话历史
  await this.saveSessionHistory(session);

  // ✅ 9. 自动写入记忆（传入 importance）
  if (this.autoWriter) {
    const importance = parseResult.importance ?? this.config.memory?.defaultImportance ?? 0.3;
    await this.autoWriter.writeConversation(sessionId, ctx.content, cleanContent, importance);
  }

  // 10. 返回响应
  return { content: cleanContent, sessionId };
}
```

---

## 5. 注入 Soul 到 Agent

### 5.1 修改 AgentRegistry

**路径**: `src/core/agent/registry.ts`

```typescript
import { SoulLoader } from '../../soul/loader.js';

export class AgentRegistry {
  private soulLoader: SoulLoader;

  constructor(config: Config, createAgentFn: CreateAgentFn, maxAgents?: number) {
    // ... 原有初始化 ...
    this.soulLoader = new SoulLoader();
  }

  async getOrCreate(sessionId: string): MiniclawAgent {
    // ... 原有逻辑 ...

    // ✅ 注入 soul
    const soulContent = await this.soulLoader.load();
    const systemPrompt = `${basePrompt}\n\n${soulContent}`;

    const agent = this.createAgentFn(sessionId, {
      ...this.config,
      systemPrompt
    });

    // ... 原有逻辑 ...
  }
}
```

---

## 6. 添加测试

### 6.1 ImportanceEvaluator 单元测试

**路径**: `tests/unit/importance/evaluator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ImportanceEvaluator } from '../../../src/memory/importance/evaluator.js';

describe('ImportanceEvaluator', () => {
  const evaluator = new ImportanceEvaluator();

  it('should parse normal importance marker', () => {
    const result = evaluator.parse('你好！[IMPORTANCE:0.3]');
    expect(result.importance).toBe(0.3);
    expect(result.strippedContent).toBe('你好！');
    expect(result.parsed).toBe(true);
  });

  it('should take last marker when multiple', () => {
    const result = evaluator.parse('消息1[IMPORTANCE:0.5]消息2[IMPORTANCE:0.8]');
    expect(result.importance).toBe(0.8);
    expect(result.strippedContent).toBe('消息1消息2');
  });

  it('should clamp value above 1', () => {
    const result = evaluator.parse('重要信息[IMPORTANCE:1.5]');
    expect(result.importance).toBe(1.0);
  });

  it('should clamp value below 0', () => {
    const result = evaluator.parse('普通信息[IMPORTANCE:-0.2]');
    expect(result.importance).toBe(0.0);
  });

  it('should return null when no marker', () => {
    const result = evaluator.parse('普通回复');
    expect(result.importance).toBe(null);
    expect(result.parsed).toBe(false);
  });

  it('should return null for invalid format', () => {
    const result = evaluator.parse('消息[IMPORTANCE:abc]');
    expect(result.importance).toBe(null);
    expect(result.parsed).toBe(false);
  });
});
```

---

## 7. 创建 soul.md

**路径**: `~/.miniclaw/soul.md`

```markdown
# Miniclaw Soul

## AI 人格
我是 Miniclaw，一个专业、可靠的 AI 助手。

## 爱好
帮助用户解决问题，记录重要信息。

## 核心规则
**每次回复必须在末尾包含 [IMPORTANCE:X] 标记**

X 为 0-1 的数值，表示当前对话的重要性：
- 0.7-0.9: 包含个人信息（姓名、偏好、联系方式）
- 0.6-0.8: 重要决策或结论
- 0.4-0.6: 一般对话内容
- 0.1-0.3: 简单问候或闲聊
```

---

## 8. 验证

### 8.1 运行测试

```bash
npm test
```

### 8.2 运行 CLI 测试

```bash
npm run debug:cli
# 输入: "我叫张三"
# 检查回复末尾是否有 [IMPORTANCE:X]
# 检查记忆 importance 值是否为 X
```

---

## Summary

| Step | Action | File |
|------|--------|------|
| 1 | 创建 ImportanceEvaluator | `src/memory/importance/evaluator.ts` |
| 2 | 创建类型定义 | `src/memory/importance/types.ts` |
| 3 | 创建 SoulLoader | `src/soul/loader.ts` |
| 4 | 修改 AutoMemoryWriter | `src/memory/auto-writer.ts` |
| 5 | 修改 Gateway | `src/core/gateway/index.ts` |
| 6 | 修改 AgentRegistry | `src/core/agent/registry.ts` |
| 7 | 添加单元测试 | `tests/unit/importance/*.test.ts` |
| 8 | 创建 soul.md | `~/.miniclaw/soul.md` |