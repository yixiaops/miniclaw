# Data Model: Tool Injection Optimization

**Feature**: 013-optimize-tool-injection
**Date**: 2026-04-10

## Entities

### 1. ToolPolicy (新增)

工具策略配置，定义 Agent 可用的工具集。

```typescript
interface ToolPolicy {
  /** 白名单：允许的工具名称列表 */
  allow?: string[];

  /** 黑名单：禁止的工具名称列表 */
  deny?: string[];
}
```

**Validation Rules**:
- `allow` 和 `deny` 可以同时存在
- 工具名称必须是有效的内置工具名
- deny 优先于 allow（冲突时工具被禁止）

### 2. AgentConfig (修改)

扩展现有的 Agent 配置，添加工具策略字段。

```typescript
interface AgentConfig {
  id: string;
  name?: string;
  model?: string;
  systemPrompt?: string;
  workspace?: string;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  subagents?: {
    allowAgents?: string[];
    maxConcurrent?: number;
  };

  // 新增/已存在
  tools?: ToolPolicy;
}
```

**State Transitions**: 无状态变化，配置在 Agent 创建时读取

### 3. EffectiveToolList (运行时)

运行时计算的有效工具列表。

```typescript
interface EffectiveToolList {
  /** 工具名称列表 */
  tools: string[];

  /** 过滤统计 */
  stats: {
    total: number;      // 内置工具总数
    allowed: number;    // 最终允许的工具数
    denied: number;     // 被 deny 的工具数
    unknown: string[];  // 配置中不存在的工具名
  };
}
```

## Relationships

```
┌─────────────────┐
│  AgentConfig    │
│  ─────────────  │
│  id: string     │
│  tools?: {...}  │
└────────┬────────┘
         │
         │ 1:1
         ▼
┌─────────────────┐
│   ToolPolicy    │
│  ─────────────  │
│  allow?: string[]│
│  deny?: string[] │
└────────┬────────┘
         │
         │ 解析
         ▼
┌─────────────────┐
│EffectiveToolList│
│  ─────────────  │
│  tools: string[]│
│  stats: {...}   │
└─────────────────┘
```

## Configuration Example

```json
{
  "agents": {
    "defaults": {
      "model": "qwen-plus",
      "maxConcurrent": 50,
      "subagents": {
        "maxConcurrent": 5,
        "defaultTimeout": 60000
      }
    },
    "list": [
      {
        "id": "main",
        "name": "Main Agent"
        // 无 tools 配置 → 所有工具
      },
      {
        "id": "readonly",
        "name": "Read-Only Agent",
        "tools": {
          "allow": ["read_file", "glob", "grep", "ls"]
        }
      },
      {
        "id": "safe",
        "name": "Safe Agent",
        "tools": {
          "deny": ["shell", "write_file"]
        }
      },
      {
        "id": "restricted",
        "name": "Restricted Agent",
        "tools": {
          "allow": ["read_file", "shell"],
          "deny": ["shell"]
          // deny 优先 → 只有 read_file
        }
      },
      {
        "id": "no-tools",
        "name": "Chat Only Agent",
        "tools": {
          "allow": []
          // 空数组 → 无工具
        }
      }
    ]
  }
}
```

## Filtering Algorithm

```
输入: allTools (12 个内置工具), policy (ToolPolicy)
输出: effectiveTools (过滤后的工具列表)

1. 初始化:
   - effectiveTools = allTools (默认全部)

2. 如果 policy.allow 存在且非空:
   - effectiveTools = 只有在 allow 列表中的工具

3. 如果 policy.deny 存在且非空:
   - 从 effectiveTools 中移除 deny 列表中的工具

4. 记录警告:
   - 对于配置中不存在的工具名，记录警告日志

返回: effectiveTools
```