# AutoMemoryWriter Contract (Modified)

**Module**: `src/memory/auto-writer.ts`
**Version**: 2.0.0 (Modified from 1.0.0)
**Date**: 2026-04-21

## Overview

AutoMemoryWriter 改造：
1. 接收可选的 importance 参数
2. 保持向后兼容
3. fallback 使用 defaultImportance

---

## Interface Changes

### writeConversation() (Modified)

```typescript
// 原接口
async writeConversation(
  sessionId: string,
  userMsg: string,
  assistantMsg: string
): Promise<boolean>

// 改造后接口
async writeConversation(
  sessionId: string,
  userMsg: string,
  assistantMsg: string,
  importance?: number  // ✅ 新增可选参数
): Promise<boolean>
```

**New Parameter**:
- `importance`: 可选，0-1 范围内的数值
- 如果未提供，使用 `this.config.defaultImportance`

**Behavior Changes**:
1. 如果传入 importance，使用传入值写入两条消息
2. 如果未传入，使用 defaultImportance（保持原有行为）
3. importance 值写入 `MemoryMetadata.importance` 字段

**Examples**:

```typescript
// 使用动态 importance
await writer.writeConversation('session-1', '用户消息', '助手回复', 0.7);
// → 两条消息的 importance 都为 0.7

// 不传入 importance（向后兼容）
await writer.writeConversation('session-1', '用户消息', '助手回复');
// → 两条消息的 importance 都为 defaultImportance (0.3)
```

### writeUserMessage() (Modified)

```typescript
async writeUserMessage(
  sessionId: string,
  userMsg: string,
  importance?: number  // ✅ 新增
): Promise<boolean>
```

### writeAssistantMessage() (Modified)

```typescript
async writeAssistantMessage(
  sessionId: string,
  assistantMsg: string,
  importance?: number  // ✅ 新增
): Promise<boolean>
```

---

## Config Changes

```typescript
interface AutoWriterConfig {
  enabled?: boolean;
  defaultImportance?: number;
  useDynamicImportance?: boolean;  // ✅ 新增
}
```

**New Field**:
- `useDynamicImportance`: 是否接收外部 importance（默认 true）

---

## Backward Compatibility

- 不传入 importance 参数时，行为与原版本完全一致
- 现有调用无需修改

---

## Testing Requirements

- 向后兼容测试
- importance 传入测试
- 边界值测试（0, 1, 超出范围）