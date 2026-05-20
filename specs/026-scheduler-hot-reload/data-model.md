# Data Model: 定时任务与动态配置加载

**Feature**: 026-scheduler-hot-reload  
**Date**: 2026-05-15

## 1. ScheduledTask（定时任务实体）

### 核心属性

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| taskId | string | ✅ | 任务唯一标识（UUID v4） |
| userId | string | ✅ | 用户标识（用于权限隔离） |
| channel | enum | ✅ | 创建渠道：'cli' \| 'api' \| 'web' \| 'feishu' |
| content | string | ✅ | 任务内容（用户原始描述） |
| summary | string | ✅ | 内容摘要（用于去重匹配，关键词提取） |
| executeTime | Date \| string | ✅ | 执行时间（ISO 时间戳 或 cron 表达式） |
| taskType | enum | ✅ | 任务类型：'one-time' \| 'recurring' |
| actionType | enum | ✅ | 动作类型：'reminder' \| 'instruction' |
| actionParams | object | ❌ | 动作参数（如 { agentId: 'etf' }） |
| status | enum | ✅ | 状态：'pending' \| 'executed' \| 'cancelled' \| 'failed' \| 'waiting-push' |
| createdAt | Date | ✅ | 创建时间 |
| updatedAt | Date | ❌ | 最后更新时间 |
| retryCount | number | ✅ | 重试次数（默认 0，最大 3） |
| lastExecuteTime | Date | ❌ | 最后执行时间（周期性任务） |
| nextExecuteTime | Date | ❌ | 下次执行时间（周期性任务） |

### 状态转换

```
pending ──► executed (成功执行)
    │
    ├──► waiting-push (用户离线)
    │        │
    │        └──► executed (用户上线后推送)
    │
    ├──► failed (执行失败，重试3次后)
    │
    └──► cancelled (用户取消)
```

### JSON Schema

```typescript
// src/scheduler/types.ts
interface ScheduledTask {
  taskId: string;
  userId: string;
  channel: 'cli' | 'api' | 'web' | 'feishu';
  content: string;
  summary: string;
  executeTime: string; // ISO 或 cron
  taskType: 'one-time' | 'recurring';
  actionType: 'reminder' | 'instruction';
  actionParams?: {
    agentId?: string;
    instruction?: string;
  };
  status: 'pending' | 'executed' | 'cancelled' | 'failed' | 'waiting-push';
  createdAt: string;
  updatedAt?: string;
  retryCount: number;
  lastExecuteTime?: string;
  nextExecuteTime?: string;
}
```

### 存储位置

- **路径**: `~/.miniclaw/scheduled-tasks.json`
- **格式**: `{ tasks: ScheduledTask[] }`

---

## 2. TaskExecutionLog（任务执行日志）

### 核心属性

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| logId | string | ✅ | 日志唯一标识 |
| taskId | string | ✅ | 关联任务 ID |
| executeTime | Date | ✅ | 实际执行时间 |
| result | enum | ✅ | 结果：'success' \| 'failed' \| 'waiting' |
| errorMessage | string | ❌ | 错误信息（失败时） |
| channelUsed | enum | ✅ | 实际使用的渠道 |
| messageSent | boolean | ✅ | 消息是否已发送 |

### JSON Schema

```typescript
interface TaskExecutionLog {
  logId: string;
  taskId: string;
  executeTime: string;
  result: 'success' | 'failed' | 'waiting';
  errorMessage?: string;
  channelUsed: 'cli' | 'api' | 'web' | 'feishu';
  messageSent: boolean;
}
```

### 存储位置

- **路径**: `~/.miniclaw/task-logs.json`
- **格式**: `{ logs: TaskExecutionLog[] }`

---

## 3. PendingMessage（待推送消息）

### 核心属性

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| messageId | string | ✅ | 消息唯一标识 |
| taskId | string | ✅ | 关联任务 ID |
| userId | string | ✅ | 目标用户 |
| channel | enum | ✅ | 目标渠道 |
| content | string | ✅ | 消息内容 |
| createdAt | Date | ✅ | 创建时间 |
| retryCount | number | ✅ | 重试次数 |

### JSON Schema

```typescript
interface PendingMessage {
  messageId: string;
  taskId: string;
  userId: string;
  channel: 'cli' | 'api' | 'web' | 'feishu';
  content: string;
  createdAt: string;
  retryCount: number;
}
```

### 存储位置

- **路径**: `~/.miniclaw/pending-messages.json`

---

## 4. CachedAgentConfig（缓存的 Agent 配置）

### 核心属性

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| agentId | string | ✅ | Agent ID（从 YAML frontmatter name 字段） |
| path | string | ✅ | 配置文件路径 |
| version | string | ❌ | 配置版本（从 YAML frontmatter version 字段） |
| mtime | number | ✅ | 文件修改时间（毫秒） |
| systemPrompt | string | ✅ | 系统提示词内容 |
| tools | string[] | ❌ | 推荐工具列表 |
| model | string | ❌ | 推荐模型 |

### JSON Schema

```typescript
interface CachedAgentConfig {
  agentId: string;
  path: string;
  version?: string;
  mtime: number;
  systemPrompt: string;
  tools?: string[];
  model?: string;
}
```

### 存储位置

- **内存缓存**: `Map<string, CachedAgentConfig>`
- **不持久化**: 每次启动重新加载

---

## 5. ConfigChangeEvent（配置变更事件）

### 核心属性

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| eventId | string | ✅ | 事件唯一标识 |
| changeType | enum | ✅ | 变更类型：'add' \| 'modify' \| 'delete' |
| path | string | ✅ | 配置文件路径 |
| agentId | string | ❌ | Agent ID（删除时可能无法获取） |
| timestamp | Date | ✅ | 事件时间 |
| success | boolean | ✅ | 处理是否成功 |
| errorMessage | string | ❌ | 错误信息 |

---

## 6. 实体关系图

```
┌─────────────────────┐
│   ScheduledTask     │
│─────────────────────│
│ taskId (PK)         │
│ userId              │
│ channel             │
│ content             │
│ executeTime         │
│ ...                 │
└─────────┬───────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│  TaskExecutionLog   │
│─────────────────────│
│ logId (PK)          │
│ taskId (FK)         │
│ executeTime         │
│ result              │
│ ...                 │
└─────────────────────┘

┌─────────────────────┐
│   PendingMessage    │
│─────────────────────│
│ messageId (PK)      │
│ taskId (FK)         │
│ userId              │
│ channel             │
│ content             │
└─────────────────────┘

┌─────────────────────┐
│ CachedAgentConfig   │
│─────────────────────│
│ agentId (PK)        │
│ path                │
│ mtime               │
│ systemPrompt        │
│ ...                 │
└─────────────────────┘
          │
          │ 1:N
          ▼
┌─────────────────────┐
│ ConfigChangeEvent   │
│─────────────────────│
│ eventId (PK)        │
│ path                │
│ changeType          │
│ timestamp           │
│ ...                 │
└─────────────────────┘
```

---

## 7. 验证规则

### ScheduledTask 验证

- `taskId`: UUID v4 格式
- `userId`: 非空字符串
- `channel`: 必须是有效渠道枚举值
- `executeTime`: ISO 时间戳或有效 cron 表达式
- `retryCount`: 0 ≤ retryCount ≤ 3

### Cron 表达式验证

使用 node-cron 的 `cron.validate(expression)` 方法验证。

---

## 8. 唯一性约束

- `taskId`: 全局唯一（UUID 自动保证）
- `userId + executeTime + summary`: 去重匹配键（非强制唯一，用于智能合并判断）