# MiniclawGateway Contract (Modified)

**Module**: `src/core/gateway/index.ts`
**Version**: 2.0.0 (Modified from 1.0.0)
**Date**: 2026-04-21

## Overview

MiniclawGateway 改造：
1. 在消息处理流程中添加 importance 解析步骤
2. 剥离 importance 标记后返回给用户
3. 传递 importance 值给 AutoMemoryWriter

---

## Interface Changes

### handleMessage() (Modified)

```typescript
async handleMessage(ctx: MessageContext): Promise<Response>
```

**Behavior Changes**:

新增步骤 4-6：

```typescript
async handleMessage(ctx: MessageContext): Promise<Response> {
  // 1-3: 原有路由、Session、Agent 获取

  // 4. 调用 Agent 处理消息（原步骤）
  const response = await agent.chat(ctx.content);

  // ✅ 5. 解析 importance（新增）
  const parseResult = this.importanceEvaluator.parse(response.content);

  // ✅ 6. 使用剥离后的内容（新增）
  const cleanContent = parseResult.strippedContent;

  // 7. 记录消息到 Session 历史（原步骤，使用 cleanContent）
  session.addMessage({ role: 'user', content: ctx.content });
  session.addMessage({ role: 'assistant', content: cleanContent });

  // 8. 保存对话历史（原步骤）

  // ✅ 9. 自动写入记忆（改造，传入 importance）
  if (this.autoWriter) {
    const importance = parseResult.importance ?? this.config.memory?.defaultImportance ?? 0.3;
    await this.autoWriter.writeConversation(sessionId, ctx.content, cleanContent, importance);
  }

  // 10. 返回响应（使用 cleanContent）
  return { content: cleanContent, sessionId };
}
```

### streamHandleMessage() (Modified)

```typescript
async *streamHandleMessage(ctx: MessageContext): AsyncGenerator<StreamChatEvent & { sessionId: string }>
```

**Behavior Changes**:

流式处理需要在完成时解析 importance：

```typescript
async *streamHandleMessage(ctx: MessageContext): AsyncGenerator<...> {
  // 1-5: 原有流程，收集 fullContent

  // ✅ 6. 流结束后解析 importance（新增）
  const parseResult = this.importanceEvaluator.parse(fullContent);

  // ✅ 7. 使用剥离后的内容记录（新增）
  session.addMessage({ role: 'assistant', content: parseResult.strippedContent });

  // ✅ 8. 自动写入记忆（改造）
  if (this.autoWriter) {
    const importance = parseResult.importance ?? this.config.memory?.defaultImportance ?? 0.3;
    await this.autoWriter.writeConversation(sessionId, ctx.content, parseResult.strippedContent, importance);
  }
}
```

---

## New Dependencies

```typescript
class MiniclawGateway {
  // ✅ 新增
  private importanceEvaluator: ImportanceEvaluator;
}
```

---

## Constructor Changes

```typescript
constructor(config: Config, gatewayConfig: GatewayConfig) {
  // ... 原有初始化 ...

  // ✅ 新增：初始化 ImportanceEvaluator
  this.importanceEvaluator = new ImportanceEvaluator({
    defaultImportance: config.memory?.defaultImportance ?? 0.3
  });
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| 解析失败 | 使用 defaultImportance，不中断流程 |
| importance 为 null | 使用 defaultImportance |
| 解析延迟 | 不影响用户体验，异步处理 |

---

## Testing Requirements

- 单元测试：解析集成
- 集成测试：完整消息流程
- 流式处理测试