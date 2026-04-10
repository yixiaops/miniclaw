# Phase 0: Research - 系统提示词可配置化

## 1. 现有代码结构分析

### 1.1 系统提示词硬编码位置

**文件**: `src/core/agent/index.ts`

```typescript
const DEFAULT_SYSTEM_PROMPT = `你是 Miniclaw,一个专业、可靠的 AI 助手。
// ... 约 2KB 的提示词内容
`;
```

- 提示词长度: 约 2000 字符
- 位置: 在 `MiniclawAgent` 类定义之前，作为常量导出
- 使用: 在构造函数中作为默认值

### 1.2 Agent 创建流程

**文件**: `src/core/agent/registry.ts`

```typescript
class AgentRegistry {
  // 从配置加载 Agent 定义
  loadConfigs(configs: AgentConfig[], defaults: AgentsDefaults)

  // 获取或创建 Agent
  getOrCreate(sessionKey, agentId?, isSubagent?)
}
```

**调用链**:
1. `AgentRegistry.getOrCreate()` 获取 AgentConfig
2. 调用 `createAgentFn()` 工厂函数
3. 工厂函数创建 `MiniclawAgent` 实例，传入 `systemPrompt`

### 1.3 配置文件结构

**文件**: `~/.miniclaw/config.json`

```json
{
  "agents": {
    "defaults": { "model": "qwen3.5-plus" },
    "list": [
      {
        "id": "main",
        "name": "影子",
        "systemPrompt": "直接文本内容..."  // 当前方式
      }
    ]
  }
}
```

**类型定义**: `src/core/config.ts`

```typescript
interface AgentConfig {
  id: string;
  name?: string;
  model?: string;
  systemPrompt?: string;  // 当前只支持直接文本
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  subagents?: { allowAgents?: string[]; maxConcurrent?: number; };
  tools?: { allow?: string[]; deny?: string[]; };
}
```

### 1.4 MiniclawAgent 构造函数参数

```typescript
interface MiniclawAgentOptions {
  systemPrompt?: string;
  tools?: AgentTool[];
  agentId?: string;
  isSubagent?: boolean;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  skillManager?: PiSkillManager;
}
```

### 1.5 现有目录结构

```
~/.miniclaw/
├── config.json    # 主配置
├── memory/        # 记忆存储
├── sessions/      # 会话数据
└── skills/        # 技能目录
```

## 2. 参考实现分析

### 2.1 pi-coding-agent 模板格式 (scout.md)

```yaml
---
name: scout
description: Fast codebase recon that returns compressed context
tools: read, grep, find, ls, bash
model: claude-haiku-4-5
---

You are a scout. Quickly investigate a codebase...
```

**特点**:
- YAML frontmatter 包含元数据
- markdown 正文作为提示词内容
- 简洁清晰的结构

### 2.2 技能注入机制

**文件**: `src/core/agent/index.ts` 构造函数中

```typescript
// 启动时注入所有 skill 的元数据
if (this.skillManager) {
  const skillPrompts = this.skillManager.getAllPrompts();
  if (skillPrompts) {
    systemPrompt = `${systemPrompt}\n\n${skillPrompts}`;
  }
}
```

**启发**: 系统提示词可以在运行时拼接扩展。

## 3. 需求映射

### 3.1 功能需求到代码映射

| FR | 需求描述 | 影响模块 |
|---|---|---|
| FR-001 | 外部文件加载模板 | 新建 `src/core/prompt/` 模块 |
| FR-002 | YAML frontmatter 格式 | `PromptManager.parseTemplate()` |
| FR-003 | 默认模板位置 | `~/.miniclaw/prompts/default.md` |
| FR-004 | 配置支持文件路径 | `AgentConfig.systemPrompt` 类型扩展 |
| FR-005 | Agent 独立提示词 | `AgentRegistry.getOrCreate()` 无需修改 |
| FR-006 | 保持 setSystemPrompt 接口 | 无需修改 |
| FR-007 | 启动日志 | `PromptManager.loadPrompt()` |
| FR-008 | 后备默认值 | 保留 `DEFAULT_SYSTEM_PROMPT` 常量 |
| FR-009 | 元数据解析 | `PromptTemplate` 接口 |

### 3.2 用户故事到任务映射

| US | 故事描述 | 优先级 | 依赖 |
|---|---|---|---|
| US-1 | 外部化模板 | P1 | 无 |
| US-2 | 多 Agent 关联 | P2 | US-1 |
| US-3 | 运行时切换 | P3 | US-1, US-2 |
| US-4 | 结构化格式 | P2 | US-1 |

## 4. 技术决策

### 4.1 文件路径识别

**方案**: 使用前缀区分文件路径和直接文本
- `file://` 前缀: 文件路径
- `./` 或 `~/` 开头: 相对/绝对路径
- 其他: 直接文本内容（向后兼容）

### 4.2 模板解析

**方案**: 使用 `yaml` 库解析 frontmatter
- 解析 `---` 之间的 YAML
- 提取 markdown 正文

### 4.3 缓存策略

**方案**: 启动时加载并缓存，不热更新
- 首次访问时解析并缓存
- 运行时切换仅更新内存，不改文件
- 热重载作为 P4 功能

### 4.4 错误处理

**策略**: 优雅降级
1. 文件不存在 → 使用 DEFAULT_SYSTEM_PROMPT
2. 解析失败 → 使用文件原始内容，记录警告
3. 编码错误 → 记录错误，使用 DEFAULT_SYSTEM_PROMPT

## 5. 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|---|---|---|---|
| 模板文件权限问题 | 低 | 中 | 启动时检查权限，记录明确错误 |
| 编码问题 | 低 | 高 | 强制 UTF-8，后备默认值 |
| 模板过长超出 token 限制 | 中 | 低 | 记录警告，用户自行控制 |
| 并发读取 | 低 | 低 | 模板加载为一次性操作 |

## 6. 兼容性影响

### 6.1 现有配置向后兼容

```json
// 仍然支持直接文本
{
  "systemPrompt": "你是一个助手..."
}

// 新增支持文件路径
{
  "systemPrompt": "file://~/.miniclaw/prompts/main.md"
}
```

### 6.2 API 兼容性

- `MiniclawAgentOptions.systemPrompt`: 类型不变 (string)
- `MiniclawAgent.setSystemPrompt()`: 接口不变
- `AgentConfig.systemPrompt`: 类型不变 (string)

**变更**: 配置加载逻辑在 `AgentRegistry.createAgentFn()` 调用前处理文件路径解析。