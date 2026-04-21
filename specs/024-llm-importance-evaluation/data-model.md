# Data Model: LLM Importance Evaluation

**Date**: 2026-04-21
**Feature**: 024-llm-importance-evaluation

## Overview

本文档定义 LLM Importance Evaluation 功能涉及的数据实体及其关系。

---

## 1. Existing Entities (无需修改)

### MemoryEntry

已存在，无需修改。

```typescript
interface MemoryEntry {
  id: string;
  content: string;
  type: 'candidate' | 'long-term';
  metadata: MemoryMetadata;
  createdAt: Date;
  updatedAt: Date;
}
```

### MemoryMetadata

已存在，`importance` 字段已支持。

```typescript
interface MemoryMetadata {
  sessionId?: string;
  timestamp?: Date;
  source?: string;
  importance?: number;  // ✅ 已存在，0-1 范围
  tags?: string[];
  ttl?: number;
  persisted?: boolean;
  promotedAt?: Date;
}
```

---

## 2. New Entities

### ImportanceParseResult

解析 LLM 回复后的结果。

```typescript
interface ImportanceParseResult {
  /** 解析出的 importance 值（0-1），null 表示未找到标记 */
  importance: number | null;
  /** 剥离标记后的回复文本 */
  strippedContent: string;
  /** 是否成功解析 */
  parsed: boolean;
}
```

**字段说明**:
- `importance`: 从 `[IMPORTANCE:X]` 提取的数值，clamp 到 0-1
- `strippedContent`: 去除所有 `[IMPORTANCE:X]` 标记后的文本
- `parsed`: 布尔值，表示是否找到有效标记

**Validation Rules**:
- `importance` 为 null 或 0-1 范围内的数值
- `strippedContent` 不包含 `[IMPORTANCE:...]` 标记

---

### SoulConfig

soul.md 文件配置。

```typescript
interface SoulConfig {
  /** soul.md 文件路径 */
  filePath: string;
  /** 是否启用 soul 注入 */
  enabled: boolean;
  /** soul 内容（加载后） */
  content?: string;
}
```

**字段说明**:
- `filePath`: 默认 `~/.miniclaw/soul.md`
- `enabled`: 控制是否注入到 system prompt
- `content`: 文件加载后的内容

**Validation Rules**:
- `filePath` 必须是有效路径（如果文件存在）
- `content` 必须包含 `[IMPORTANCE:X]` 规则说明

---

### ImportanceEvaluatorConfig

ImportanceEvaluator 模块配置。

```typescript
interface ImportanceEvaluatorConfig {
  /** 默认 importance 值（fallback） */
  defaultImportance: number;
  /** importance 标记正则表达式 */
  pattern: RegExp;
  /** 是否启用解析日志 */
  logParsed: boolean;
}
```

**字段说明**:
- `defaultImportance`: 默认 0.3
- `pattern`: 默认 `/\[IMPORTANCE:([0-9.]+)\]/g`
- `logParsed`: 调试开关

**Validation Rules**:
- `defaultImportance` 在 0-1 范围内
- `pattern` 是有效正则表达式

---

## 3. Modified Entities

### AutoWriterConfig

修改现有配置，添加 importance 相关选项。

```typescript
interface AutoWriterConfig {
  enabled?: boolean;
  defaultImportance?: number;
  /** ✅ 新增：是否使用动态 importance */
  useDynamicImportance?: boolean;
}
```

**新增字段**:
- `useDynamicImportance`: 是否接收外部传入的 importance 值（默认 true）

---

## 4. Entity Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                     Message Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  User Message                                                 │
│       │                                                       │
│       ▼                                                       │
│  MiniclawAgent.chat()                                         │
│       │                                                       │
│       ▼                                                       │
│  LLM Response (含 [IMPORTANCE:X])                             │
│       │                                                       │
│       ▼                                                       │
│  ImportanceEvaluator.parse() ──► ImportanceParseResult       │
│       │                                                       │
│       ├──────────────────────────────► strippedContent        │
│       │                                   (返回给用户)         │
│       ▼                                                       │
│  AutoMemoryWriter.writeConversation(importance)               │
│       │                                                       │
│       ▼                                                       │
│  MemoryEntry.metadata.importance                              │
│       │                                                       │
│       ▼                                                       │
│  TTLManager.cleanup()                                         │
│       │                                                       │
│       ▼                                                       │
│  MemoryPromoter.check(importance >= threshold)                │
│       │                                                       │
│       ▼                                                       │
│  LongTermMemory (晋升) 或 Delete (删除)                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Soul Loading                              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ~/.miniclaw/soul.md                                          │
│       │                                                       │
│       ▼                                                       │
│  SoulLoader.load() ──► SoulConfig                             │
│       │                                                       │
│       ▼                                                       │
│  MiniclawAgent.setSystemPrompt(prompt + soulContent)          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. State Transitions

### Importance Value Lifecycle

```
[LLM Output]
    │
    ├── 包含 [IMPORTANCE:X] ──► parseImportance() ──► X (clamp 0-1)
    │                                                │
    │                                                ▼
    └──────────────────────────────────────────► MemoryEntry.metadata.importance
                                                 │
                                                 ├── ≥ 0.5 ──► 晋升到 LongTermMemory
                                                 │
                                                 └── < 0.5 ──► TTL 过期后删除

[无标记或解析失败]
    │
    └──► defaultImportance (0.3) ──► MemoryEntry.metadata.importance
                                      │
                                      └──► < 0.5 ──► TTL 过期后删除
```

---

## 6. File Schema

### soul.md 结构

```markdown
# Miniclaw Soul

## AI 人格
[描述 AI 身份]

## 爱好
[AI 的爱好/兴趣]

## 核心规则
**每次回复必须在末尾包含 [IMPORTANCE:X] 标记**

X 为 0-1 的数值，表示当前对话的重要性：
- 0.7-0.9: 包含个人信息
- 0.6-0.8: 重要决策
- 0.4-0.6: 一般内容
- 0.1-0.3: 简单问候

## 其他规则
[其他行为规则]
```

**Schema**:
- 文件格式: Markdown
- 必须包含 `[IMPORTANCE:X]` 规则说明
- 位置: `~/.miniclaw/soul.md`
- 备选: 环境变量 `MINICLAW_SOUL_FILE`

---

## Summary

| Entity | Type | Description |
|--------|------|-------------|
| MemoryEntry | Existing | 已有 importance 字段 |
| MemoryMetadata | Existing | importance 字段已支持 |
| ImportanceParseResult | New | 解析结果封装 |
| SoulConfig | New | soul.md 配置 |
| ImportanceEvaluatorConfig | New | Evaluator 配置 |
| AutoWriterConfig | Modified | 新增 useDynamicImportance |