# 双层记忆架构设计

> 版本: 1.0 | 更新时间: 2026-04-14

## 概述

双层记忆结构将记忆分为短期记忆和长期记忆，参考 OpenClaw 设计。

---

## 1. 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    双层记忆架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Session Context                         │   │
│  │  ┌─────────────────┐  ┌───────────────────────┐     │   │
│  │  │  Short-term     │  │  Session Manager      │     │   │
│  │  │  短期记忆        │  │                       │     │   │
│  │  │                 │  │  - sessionId          │     │   │
│  │  │  - TTL 24h       │  │  - createdAt          │     │   │
│  │  │  - Session隔离   │  │  - lastActivity       │     │   │
│  │  │  - 会话上下文     │  │  - activeSessions    │     │   │
│  │  │  - 临时决策      │  │                       │     │   │
│  │  └─────────────────┘  └───────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ 晋升机制                         │
│                          │ (importance > threshold)         │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Long-term Storage                       │   │
│  │  ┌─────────────────┐  ┌───────────────────────┐     │   │
│  │  │  Long-term      │  │  Persistence          │     │   │
│  │  │  长期记忆        │  │                       │     │   │
│  │  │                 │  │  - MEMORY.md          │     │   │
│  │  │  - 用户偏好      │  │  - daily-notes/       │     │   │
│  │  │  - 重要决策      │  │  - JSON metadata      │     │   │
│  │  │  - 工作记录      │  │                       │     │   │
│  │  │                 │  │  跨 Session 持久化     │     │   │
│  │  └─────────────────┘  └───────────────────────┘     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              TTL Manager                             │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  Cleanup Job                                   │  │   │
│  │  │  - 定时清理过期记忆                            │  │   │
│  │  │  - 默认间隔: 1h                                │  │   │
│  │  │  - 短期记忆 TTL: 24h                           │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 记忆类型定义

### 2.1 短期记忆（Short-term）

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `sessionId` | 所属会话 ID | 必填 |
| `TTL` | 过期时间 | 24h |
| `importance` | 重要性评分 | 0.0 |
| `createdAt` | 创建时间 | now |

**用途**：
- 当前会话上下文
- 临时决策
- 暂时性信息

### 2.2 长期记忆（Long-term）

| 属性 | 说明 | 默认值 |
|------|------|--------|
| `persisted` | 持久化状态 | true |
| `importance` | 重要性评分 | ≥ 0.5 |
| `promotedAt` | 晋升时间 |晋升时 |
| `filePath` | 存储文件路径 | MEMORY.md |

**用途**：
- 用户偏好
- 重要决策
- 工作记录
- 关键信息

---

## 3. 晋升机制

### 3.1 晋升条件

```typescript
interface PromotionRule {
  /** 重要性阈值 */
  importanceThreshold: number;  // 默认 0.5
  
  /** 访问次数阈值 */
  accessThreshold: number;  // 默认 3
  
  /** 时间阈值（小时） */
  timeThreshold: number;  // 默认 1h
}
```

**晋升条件（任一满足）**：
1. `importance >= importanceThreshold`
2. `accessCount >= accessThreshold`
3. 存在时间超过 `timeThreshold` 且被标记为重要

### 3.2 晋升流程

```
短期记忆
    │
    │ 检测晋升条件
    │ (PromotionChecker)
    ▼
满足条件？
    │ Yes
    ▼
调用 promote()
    │
    │ 1. 复制内容
    │ 2. 更新类型为 long-term
    │ 3. 设置 promotedAt
    │ 4. 持久化到文件
    ▼
长期记忆
    │
    │ 从短期记忆中删除原记录
    ▼
完成
```

---

## 4. TTL 管理

### 4.1 TTL 配置

```typescript
interface TTLConfig {
  /** 短期记忆 TTL（毫秒） */
  shortTermTTL: number;  // 默认 24 * 60 * 60 * 1000
  
  /** 清理间隔（毫秒） */
  cleanupInterval: number;  // 默认 60 * 60 * 1000
  
  /** 是否启用自动清理 */
  autoCleanup: boolean;  // 默认 true
}
```

### 4.2 清理流程

```
CleanupJob (定时任务)
    │
    │ 每 cleanupInterval 执行一次
    ▼
遍历短期记忆
    │
    │ 检查 createdAt + TTL < now
    ▼
过期？
    │ Yes
    ▼
删除记忆
    │
    │ 检查是否需要晋升
    ▼
需要晋升？
    │ Yes → 调用 promote()
    │ No → 直接删除
    ▼
继续下一个
```

---

## 5. 双层检索

### 5.1 检索流程

```
memory_search(query)
    │
    │ 1. 解析 types 参数
    ▼
types 参数？
    │ 'short-term' → 仅检索短期
    │ 'long-term' → 仅检索长期
    │ undefined → 双层合并检索
    ▼
检索对应层级
    │
    │ 计算相似度
    │ 按时间 + 相关性排序
    ▼
合并结果
    │
    │ 时间权重 0.6 + 相关性权重 0.4
    ▼
返回结果
```

### 5.2 排序规则

```typescript
interface RankingConfig {
  /** 时间权重 */
  timeWeight: number;  // 默认 0.6
  
  /** 相关性权重 */
  relevanceWeight: number;  // 默认 0.4
  
  /** 时间衰减因子 */
  timeDecayFactor: number;  // 默认 0.95
}
```

---

## 6. 持久化方案

### 6.1 文件结构

```
memory/
├── MEMORY.md           # 长期记忆主文件
├── daily-notes/        # 每日记忆
│   ├── 2026-04-14.md
│   ├── 2026-04-15.md
│   └── ...
├── metadata/           # JSON 元数据
│   ├── long-term.json  # 长期记忆索引
│   └── sessions.json   # 会话状态
└── cache/              # 临时缓存
    └── short-term.json # 短期记忆缓存
```

### 6.2 文件格式

**MEMORY.md 格式**：
```markdown
# MEMORY.md - 长期记忆

## 用户偏好
- User prefers dark mode | importance: 0.8 | createdAt: 2026-04-14T10:00:00Z

## 重要决策
- Decision: Use TDD for all code | importance: 0.9 | createdAt: 2026-04-14T11:00:00Z
```

**long-term.json 格式**：
```json
{
  "entries": [
    {
      "id": "memory-xxx",
      "content": "User prefers dark mode",
      "type": "long-term",
      "importance": 0.8,
      "createdAt": "2026-04-14T10:00:00Z",
      "promotedAt": "2026-04-14T11:00:00Z",
      "filePath": "MEMORY.md"
    }
  ]
}
```

---

## 7. API 设计

### 7.1 短期记忆 API

```typescript
class ShortTermMemory {
  write(content: string, sessionId: string): Promise<string>;
  read(id: string): Promise<MemoryEntry | null>;
  list(sessionId: string): Promise<MemoryEntry[]>;
  delete(id: string): Promise<boolean>;
}
```

### 7.2 长期记忆 API

```typescript
class LongTermMemory {
  write(content: string): Promise<string>;
  read(id: string): Promise<MemoryEntry | null>;
  list(): Promise<MemoryEntry[]>;
  delete(id: string): Promise<boolean>;
  persist(): Promise<void>;
  load(): Promise<void>;
}
```

### 7.3 晋升 API

```typescript
class MemoryPromoter {
  check(entry: MemoryEntry): boolean;
  promote(id: string): Promise<boolean>;
}
```

---

## 8. 关键指标

| 指标 | 目标值 |
|------|--------|
| 短期记忆容量 | ≤ 100 条/Session |
| 长期记忆容量 | 无限制 |
| 晋升延迟 | ≤ 100ms |
| 清理延迟 | ≤ 50ms |
| 检索延迟（100条） | ≤ 200ms |

---

*文档版本: 1.0.0 | 更新时间: 2026-04-14*