# Scheduler API Contract

**Feature**: 026-scheduler-hot-reload  
**Version**: 1.0  
**Date**: 2026-05-15

## Overview

定时任务模块提供 4 个工具供 LLM Agent 调用，实现自然语言创建、查询、删除、修改定时任务。

---

## Tool: scheduler_create

### Purpose

创建定时任务（提醒或预设指令）

### Parameters

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| content | string | ✅ | 任务内容描述（用户原始语言） |
| executeTime | string | ✅ | 执行时间：ISO 时间戳 或 cron 表达式 |
| taskType | enum | ✅ | 'one-time' \| 'recurring' |
| actionType | enum | ✅ | 'reminder' \| 'instruction' |
| agentId | string | ❌ | 目标 Agent ID（actionType='instruction' 时） |

### Request Schema

```json
{
  "name": "scheduler_create",
  "parameters": {
    "type": "object",
    "properties": {
      "content": { "type": "string", "description": "任务内容" },
      "executeTime": { "type": "string", "description": "执行时间（ISO 或 cron）" },
      "taskType": { "type": "string", "enum": ["one-time", "recurring"] },
      "actionType": { "type": "string", "enum": ["reminder", "instruction"] },
      "agentId": { "type": "string", "description": "目标 Agent ID（可选）" }
    },
    "required": ["content", "executeTime", "taskType", "actionType"]
  }
}
```

### Response Schema

```json
{
  "success": boolean,
  "taskId": string,
  "message": string,
  "duplicateCheck": {
    "isDuplicate": boolean,
    "existingTaskId": string | null
  }
}
```

### Behavior

1. 检查用户是否有相同任务（时间差≤30分钟 + 内容相似度≥0.7）
2. 若重复，返回 `isDuplicate: true`，让 AI 询问用户是否合并
3. 若不重复，创建任务并返回 `taskId`

### Error Cases

| Error | Condition | Message |
|-------|-----------|---------|
| INVALID_TIME | executeTime 格式无效 | "时间格式无效，请使用标准时间格式" |
| INVALID_CRON | cron 表达式无效 | "周期表达式无效" |
| PERMISSION_DENIED | 用户权限不足 | "无法创建任务" |

---

## Tool: scheduler_list

### Purpose

查询当前用户的定时任务列表

### Parameters

无参数（自动按调用用户的 userId 过滤）

### Request Schema

```json
{
  "name": "scheduler_list",
  "parameters": {
    "type": "object",
    "properties": {}
  }
}
```

### Response Schema

```json
{
  "tasks": [
    {
      "taskId": string,
      "content": string,
      "executeTime": string,
      "taskType": string,
      "actionType": string,
      "status": string,
      "nextExecuteTime": string | null
    }
  ],
  "total": number
}
```

### Behavior

1. 按 userId 过滤任务（权限隔离）
2. 仅返回 `status: 'pending'` 的任务
3. 按下次执行时间排序

---

## Tool: scheduler_delete

### Purpose

删除定时任务

### Parameters

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| taskId | string | ✅ | 任务 ID |

### Request Schema

```json
{
  "name": "scheduler_delete",
  "parameters": {
    "type": "object",
    "properties": {
      "taskId": { "type": "string", "description": "任务 ID" }
    },
    "required": ["taskId"]
  }
}
```

### Response Schema

```json
{
  "success": boolean,
  "message": string
}
```

### Behavior

1. 验证 taskId 属于当前用户（权限隔离）
2. 将任务状态改为 `cancelled`
3. 停止 node-cron 任务调度

### Error Cases

| Error | Condition | Message |
|-------|-----------|---------|
| NOT_FOUND | taskId 不存在 | "任务不存在" |
| PERMISSION_DENIED | taskId 不属于用户 | "无法删除其他用户的任务" |

---

## Tool: scheduler_update

### Purpose

修改定时任务内容或执行时间

### Parameters

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| taskId | string | ✅ | 任务 ID |
| content | string | ❌ | 新任务内容 |
| executeTime | string | ❌ | 新执行时间 |

### Request Schema

```json
{
  "name": "scheduler_update",
  "parameters": {
    "type": "object",
    "properties": {
      "taskId": { "type": "string", "description": "任务 ID" },
      "content": { "type": "string", "description": "新任务内容（可选）" },
      "executeTime": { "type": "string", "description": "新执行时间（可选）" }
    },
    "required": ["taskId"]
  }
}
```

### Response Schema

```json
{
  "success": boolean,
  "message": string,
  "updatedFields": string[]
}
```

### Behavior

1. 验证 taskId 属于当前用户
2. 更新指定字段
3. 若修改 executeTime，重新调度 node-cron 任务

---

## Integration Points

### 与 Gateway 集成

- Gateway 在初始化时启动 `SchedulerManager`
- `SchedulerManager` 注册 4 个工具到 Agent

### 与 Session 集成

- 任务执行时，通过 Session 找到用户的活跃渠道
- 若用户离线，消息存入 PendingMessageStore

### 与 Subagent 集成

- `actionType: 'instruction'` 时，调用 `sessions_spawn` 工具执行子 Agent