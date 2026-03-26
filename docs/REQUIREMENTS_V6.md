# Miniclaw 六期需求文档 (v0.6)

> 技能系统 + 多 Agent 协作

## 一、背景

### 1.1 当前状态 (2026-03-25)

**已完成模块：**

| 模块 | 状态 | 说明 |
|------|:----:|------|
| Gateway | ✅ | 统一消息入口 |
| Router | ✅ | 消息路由 |
| SessionManager | ✅ | Session 管理 |
| AgentRegistry | ✅ | Agent 实例管理（单类型） |
| SimpleMemoryStorage | ✅ | 对话历史持久化 |
| MemorySearchManager | ✅ | 记忆搜索 |
| Channels | ✅ | CLI/API/Web/Feishu 通道 |
| Tools | ✅ | 文件/Shell/网络/记忆工具 |

**待开发能力：**

| 能力 | 影响 | 原因 |
|------|------|------|
| 无技能系统 | 无法扩展专业能力 | 没有插件/技能架构 |
| 无多 Agent 协作 | 无法并行处理复杂任务 | 只支持单 Agent |
| 无子代理调度 | 无法分工协作 | 没有 spawn 机制 |

### 1.2 目标

参考 OpenClaw 的成熟实现，为 miniclaw 增加：

1. **技能系统** - 通过 SKILL.md 定义可扩展的专业能力
2. **多 Agent 协作** - 主代理 + 子代理架构，支持并行任务

---

## 二、技能系统设计（P1）

### 2.1 设计目标

- 通过 `SKILL.md` 文件定义技能，Agent 自动识别并执行
- 技能可包含：触发条件、使用场景、命令模板、注意事项
- 支持内置技能和用户自定义技能

### 2.2 技能目录结构

```
~/.miniclaw/skills/
├── weather/                    # 天气查询技能
│   └── SKILL.md
│
├── github/                     # GitHub 操作技能
│   └── SKILL.md
│
├── web-search/                 # 网页搜索技能
│   └── SKILL.md
│
└── custom/                     # 用户自定义技能
    ├── etf-analysis/
    │   └── SKILL.md
    └── report-generator/
        └── SKILL.md
```

### 2.3 SKILL.md 规范

参考 OpenClaw 的技能格式：

```markdown
---
name: weather
description: "获取天气和天气预报。触发词：天气、气温、下雨。NOT for: 历史天气、气象分析。"
---

# Weather Skill

获取当前天气和天气预报。

## When to Use

✅ **使用场景：**
- "今天天气怎么样？"
- "明天会下雨吗？"
- "北京气温多少？"
- 周末出行天气查询

## When NOT to Use

❌ **不适用场景：**
- 历史天气数据 → 使用气象档案
- 气候分析趋势 → 使用专业数据源
- 极端天气预警 → 查看官方气象台

## Commands

### 当前天气

\`\`\`bash
# 一行摘要
curl "wttr.in/Beijing?format=3"

# 详细信息
curl "wttr.in/Beijing?0"
\`\`\`

### 天气预报

\`\`\`bash
# 三天预报
curl "wttr.in/Beijing"

# JSON 输出
curl "wttr.in/Beijing?format=j1"
\`\`\`

## Notes

- 无需 API Key
- 支持全球主要城市
- 支持机场代码：`curl wttr.in/PEK`
```

### 2.4 SKILL.md 元数据规范

```yaml
---
name: string              # 技能名称（必填）
description: string       # 技能描述（必填），包含触发词
homepage?: string         # 相关链接
metadata?: {
  tools?: string[]        # 依赖的工具
  bins?: string[]         # 依赖的命令行工具
  env?: string[]          # 依赖的环境变量
}
---
```

### 2.5 核心组件设计

#### SkillManager

```typescript
/**
 * 技能管理器
 */
interface Skill {
  name: string;
  description: string;
  triggers: string[];       // 触发词（从 description 提取）
  content: string;          // SKILL.md 内容
  path: string;             // 技能路径
}

interface SkillManagerConfig {
  skillsDir: string;        // 技能目录，默认 ~/.miniclaw/skills
  autoLoad: boolean;        // 启动时自动加载，默认 true
}

class SkillManager {
  private skills: Map<string, Skill>;

  /**
   * 加载所有技能
   */
  loadAll(): Promise<void>;

  /**
   * 加载单个技能
   */
  load(skillPath: string): Promise<Skill>;

  /**
   * 根据用户输入匹配合适的技能
   */
  match(input: string): Skill | null;

  /**
   * 获取所有已加载的技能
   */
  getAll(): Skill[];

  /**
   * 获取技能的完整内容（注入到 system prompt）
   */
  getPrompt(skillName: string): string;
}
```

#### 技能匹配逻辑

```typescript
/**
 * 技能匹配算法
 */
match(input: string): Skill | null {
  const lowerInput = input.toLowerCase();

  for (const skill of this.skills.values()) {
    // 1. 触发词匹配
    for (const trigger of skill.triggers) {
      if (lowerInput.includes(trigger.toLowerCase())) {
        return skill;
      }
    }

    // 2. 描述关键词匹配
    if (this.matchDescription(skill.description, lowerInput)) {
      return skill;
    }
  }

  return null;
}
```

#### 与 Agent 集成

```typescript
// 在 Agent.chat() 中集成技能

async chat(userMessage: string): Promise<string> {
  // 1. 尝试匹配技能
  const skill = this.skillManager.match(userMessage);

  // 2. 构建 system prompt
  let systemPrompt = this.config.systemPrompt;
  if (skill) {
    systemPrompt += `\n\n## Active Skill: ${skill.name}\n\n${skill.content}`;
  }

  // 3. 调用大模型
  return this.llm.chat(systemPrompt, userMessage);
}
```

### 2.6 内置技能列表

| 技能 | 触发词 | 说明 |
|------|--------|------|
| **weather** | 天气、气温、下雨、预报 | 天气查询 |
| **github** | PR、issue、repo、merge | GitHub 操作 |
| **web-search** | 搜索、查询、找一下 | 网页搜索 |
| **shell** | 执行、运行、命令 | Shell 命令执行 |
| **file** | 文件、读取、写入 | 文件操作 |

### 2.7 用户自定义技能

用户可在 `~/.miniclaw/skills/custom/` 目录下创建自己的技能：

```
~/.miniclaw/skills/custom/
├── etf-analysis/
│   └── SKILL.md           # ETF 分析技能
│
└── report-generator/
    └── SKILL.md           # 报告生成技能
```

---

## 三、多 Agent 协作设计（P1）

### 3.1 设计目标

- 支持多种类型的 Agent（main、etf、policy 等）
- 主 Agent 可创建子代理执行特定任务
- 子代理并行执行，结果汇总到主 Agent

### 3.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     Miniclaw Gateway                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   用户消息                                                   │
│       │                                                      │
│       ▼                                                      │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                  Main Agent                          │   │
│   │  - 处理用户对话                                      │   │
│   │  - 决定是否需要子代理                                │   │
│   │  - 创建/管理子代理                                   │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                   │
│              ┌───────────┼───────────┐                       │
│              │           │           │                       │
│              ▼           ▼           ▼                       │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│   │  ETF Agent   │ │ Policy Agent │ │ Custom Agent │        │
│   │  (子代理 1)  │ │  (子代理 2)  │ │  (子代理 N)  │        │
│   └──────┬───────┘ └──────┬───────┘ └──────┬───────┘        │
│          │                │                │                 │
│          └────────────────┼────────────────┘                 │
│                           │                                  │
│                           ▼                                  │
│                    结果汇总到 Main Agent                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Agent 类型配置

```typescript
// 配置文件结构
interface MiniclawConfig {
  agents: {
    defaults: AgentDefaults;
    list: AgentConfig[];
  };
}

interface AgentConfig {
  id: string;                    // Agent 唯一标识
  name?: string;                 // 显示名称
  model: string;                 // 使用的模型
  systemPrompt?: string;         // 系统提示词
  tools?: {
    allow?: string[];            // 允许的工具
    deny?: string[];             // 禁止的工具
  };
  maxTokens?: number;            // 最大 token
  temperature?: number;          // 温度参数
}

// 示例配置
{
  "agents": {
    "defaults": {
      "model": "qwen-turbo"
    },
    "list": [
      {
        "id": "main",
        "model": "qwen-turbo",
        "systemPrompt": "你是影子，小彭的数字分身..."
      },
      {
        "id": "etf",
        "name": "ETF 分析师",
        "model": "qwen-plus",
        "systemPrompt": "你是 ETF 市场分析专家，擅长基金选择和投资策略..."
      },
      {
        "id": "policy",
        "name": "政策分析师",
        "model": "qwen-plus",
        "systemPrompt": "你是宏观经济政策分析专家，擅长行业趋势研判..."
      }
    ]
  }
}
```

### 3.4 核心组件设计

#### AgentRegistry 改造

```typescript
/**
 * Agent 注册表（支持多类型 Agent）
 */
interface AgentEntry {
  agent: MiniclawAgent;
  agentId: string;           // Agent 类型 ID
  sessionKey: string;
  createdAt: Date;
  lastActiveAt: Date;
}

interface AgentFactory {
  createAgent(agentId: string, sessionKey: string): MiniclawAgent;
}

class AgentRegistry {
  private agents: Map<string, AgentEntry>;
  private configs: Map<string, AgentConfig>;
  private factory: AgentFactory;

  /**
   * 加载 Agent 配置
   */
  loadConfigs(configs: AgentConfig[]): void;

  /**
   * 获取或创建指定类型的 Agent
   */
  getOrCreate(sessionKey: string, agentId?: string): MiniclawAgent;

  /**
   * 获取 Agent 配置
   */
  getConfig(agentId: string): AgentConfig | undefined;

  /**
   * 获取所有 Agent 类型
   */
  getAgentTypes(): string[];
}
```

#### SubagentManager（子代理管理器）

```typescript
/**
 * 子代理管理器
 */
interface SubagentInfo {
  id: string;                // 子代理实例 ID
  agentId: string;           // Agent 类型
  task: string;              // 任务描述
  status: 'running' | 'completed' | 'failed' | 'timeout';
  result?: string;           // 执行结果
  startTime: Date;
  endTime?: Date;
}

interface SpawnOptions {
  task: string;              // 任务描述
  agentId?: string;          // 指定 Agent 类型，默认 'main'
  timeout?: number;          // 超时时间（毫秒），默认 60000
  context?: string;          // 额外上下文
}

class SubagentManager {
  private subagents: Map<string, SubagentInfo>;
  private registry: AgentRegistry;

  /**
   * 创建子代理
   */
  spawn(options: SpawnOptions): Promise<string>;  // 返回子代理 ID

  /**
   * 获取子代理状态
   */
  getStatus(subagentId: string): SubagentInfo;

  /**
   * 等待子代理完成
   */
  await(subagentId: string, timeout?: number): Promise<SubagentInfo>;

  /**
   * 等待所有子代理完成
   */
  awaitAll(subagentIds: string[]): Promise<SubagentInfo[]>;

  /**
   * 终止子代理
   */
  kill(subagentId: string): void;

  /**
   * 列出所有子代理
   */
  list(): SubagentInfo[];

  /**
   * 向子代理发送消息（steer）
   */
  steer(subagentId: string, message: string): void;
}
```

### 3.5 工具设计

#### sessions_spawn 工具

```typescript
/**
 * sessions_spawn 工具
 * 创建子代理执行任务
 */
const sessionsSpawnTool = {
  name: 'sessions_spawn',
  description: '创建子代理执行特定任务。适用于：并行处理、专业任务委托。',
  parameters: Type.Object({
    task: Type.String({ 
      description: '任务描述，清晰说明子代理需要完成什么' 
    }),
    agentId: Type.Optional(Type.String({ 
      description: '指定 Agent 类型，如 etf、policy。不填则使用默认 Agent' 
    }),
    timeout: Type.Optional(Type.Number({ 
      description: '超时时间（秒），默认 60' 
    })),
    context: Type.Optional(Type.String({ 
      description: '额外上下文信息' 
    }))
  }),

  async execute(toolCallId: string, params: SpawnParams) {
    const subagentId = await subagentManager.spawn({
      task: params.task,
      agentId: params.agentId,
      timeout: (params.timeout || 60) * 1000,
      context: params.context
    });

    // 等待完成
    const result = await subagentManager.await(subagentId);

    return {
      content: [{
        type: 'text',
        text: result.status === 'completed' 
          ? result.result 
          : `子代理执行失败: ${result.status}`
      }]
    };
  }
};
```

#### subagents 工具

```typescript
/**
 * subagents 工具
 * 管理子代理
 */
const subagentsTool = {
  name: 'subagents',
  description: '管理子代理：列出、终止、发送消息。',
  parameters: Type.Object({
    action: Type.Union([
      Type.Literal('list'),
      Type.Literal('kill'),
      Type.Literal('steer')
    ], { description: '操作类型' }),
    target: Type.Optional(Type.String({ 
      description: '子代理 ID（kill/steer 时必填）' 
    })),
    message: Type.Optional(Type.String({ 
      description: '发送给子代理的消息（steer 时必填）' 
    }))
  }),

  async execute(toolCallId: string, params: SubagentsParams) {
    switch (params.action) {
      case 'list':
        const list = subagentManager.list();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(list, null, 2)
          }]
        };

      case 'kill':
        subagentManager.kill(params.target!);
        return {
          content: [{
            type: 'text',
            text: `已终止子代理: ${params.target}`
          }]
        };

      case 'steer':
        subagentManager.steer(params.target!, params.message!);
        return {
          content: [{
            type: 'text',
            text: `已向子代理发送消息: ${params.target}`
          }]
        };
    }
  }
};
```

### 3.6 使用场景

#### 场景 1：并行分析

```
用户: "帮我分析 ETF 市场和政策环境"

Main Agent 执行：
  1. sessions_spawn({ task: "分析 ETF 市场", agentId: "etf" })
     → 返回子代理 ID: sub-001
  
  2. sessions_spawn({ task: "分析政策环境", agentId: "policy" })
     → 返回子代理 ID: sub-002
  
  3. subagents({ action: "list" })
     → 查看两个子代理状态
  
  4. 等待两个子代理完成，汇总结果返回用户
```

#### 场景 2：专业任务委托

```
用户: "帮我分析这只 ETF 基金的投资价值"

Main Agent 执行：
  sessions_spawn({ 
    task: "分析 ETF 基金投资价值", 
    agentId: "etf",
    context: "用户关注风险收益比和持有周期"
  })
  
ETF Agent 执行：
  - 调用 web_search 获取基金信息
  - 分析历史业绩
  - 给出投资建议
  
结果返回 Main Agent → 返回用户
```

### 3.7 子代理生命周期

```
┌────────────┐
│   spawn    │ ──────────────────────────────────┐
└─────┬──────┘                                   │
      │                                          │
      ▼                                          │
┌────────────┐                                   │
│  running   │ ◄─────────────────────┐          │
└─────┬──────┘                       │          │
      │                              │          │
      ├─── 正常完成 ───▶ completed ───┼──▶ 清理  │
      │                              │          │
      ├─── 执行失败 ───▶ failed ──────┼──▶ 清理  │
      │                              │          │
      ├─── 超时 ──────▶ timeout ─────┤          │
      │                              │          │
      └─── 被手动终止 ──▶ killed ─────┘          │
                                                 │
                                                 │
┌────────────┐                                   │
│   steer    │ ──▶ 向 running 状态的子代理发送消息  │
└────────────┘                                   │
                                                 │
┌────────────┐                                   │
│   kill     │ ──▶ 强制终止子代理 ────────────────┘
└────────────┘
```

---

## 四、配置文件设计

### 4.1 配置文件位置

```
~/.miniclaw/
├── config.json              # 主配置文件
├── skills/                  # 技能目录
│   ├── weather/
│   ├── github/
│   └── custom/
└── memory/                  # 记忆存储
    └── sessions/
```

### 4.2 配置文件结构

```json
{
  "model": {
    "provider": "bailian",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "apiKey": "${BAILIAN_API_KEY}",
    "defaultModel": "qwen-turbo"
  },

  "agents": {
    "defaults": {
      "model": "qwen-turbo",
      "maxTokens": 4096,
      "temperature": 0.7
    },
    "list": [
      {
        "id": "main",
        "systemPrompt": "你是影子，小彭的数字分身..."
      },
      {
        "id": "etf",
        "name": "ETF 分析师",
        "model": "qwen-plus",
        "systemPrompt": "你是 ETF 市场分析专家..."
      },
      {
        "id": "policy",
        "name": "政策分析师",
        "model": "qwen-plus",
        "systemPrompt": "你是宏观经济政策分析专家..."
      }
    ]
  },

  "skills": {
    "dir": "~/.miniclaw/skills",
    "autoLoad": true
  },

  "subagent": {
    "maxConcurrent": 5,
    "defaultTimeout": 60000,
    "cleanupInterval": 300000
  },

  "memory": {
    "enabled": true,
    "storagePath": "~/.miniclaw/memory"
  }
}
```

---

## 五、实施计划

### Phase 1：技能系统（3 天）

| 任务 | 工时 | 说明 |
|------|:----:|------|
| SkillManager 核心实现 | 4h | 加载、匹配、注入 |
| SKILL.md 解析器 | 2h | YAML 元数据 + Markdown 内容 |
| 内置技能（weather、github） | 2h | 参考实现 |
| 与 Agent 集成 | 2h | 注入 system prompt |
| 测试 | 2h | 单元测试 + 集成测试 |

### Phase 2：多 Agent 配置（2 天）

| 任务 | 工时 | 说明 |
|------|:----:|------|
| AgentConfig 类型定义 | 1h | TypeScript 接口 |
| 配置加载逻辑 | 2h | 读取 config.json |
| AgentRegistry 改造 | 3h | 支持多类型 |
| 测试 | 2h | 配置测试 |

### Phase 3：子代理系统（3 天）

| 任务 | 工时 | 说明 |
|------|:----:|------|
| SubagentManager 实现 | 4h | 创建、管理、结果收集 |
| sessions_spawn 工具 | 2h | 创建子代理 |
| subagents 工具 | 1h | 管理子代理 |
| 并行执行机制 | 2h | Promise.all + 超时处理 |
| 测试 | 3h | 单元测试 + 集成测试 |

---

## 六、验收标准

### 6.1 技能系统

- [ ] 启动时自动加载 skills/ 目录下的技能
- [ ] SKILL.md 格式正确解析（元数据 + 内容）
- [ ] 触发词匹配准确率 > 90%
- [ ] 匹配到的技能正确注入 system prompt
- [ ] 至少提供 2 个内置技能（weather、github）
- [ ] 支持用户自定义技能

### 6.2 多 Agent 协作

- [ ] 配置文件支持多种 Agent 类型定义
- [ ] 可通过 agentId 创建不同类型的 Agent
- [ ] sessions_spawn 可创建子代理
- [ ] 子代理并行执行任务
- [ ] 主代理可获取子代理结果
- [ ] subagents list/kill/steer 操作正常
- [ ] 超时自动终止子代理

---

## 七、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 技能匹配误判 | 执行错误技能 | 设置匹配阈值 + 人工确认 |
| 子代理资源占用 | 内存/CPU 消耗 | 数量限制 + 超时清理 |
| 并行任务死锁 | 任务无法完成 | 超时机制 + 强制终止 |
| 配置错误 | 启动失败 | 配置校验 + 默认值兜底 |

---

## 八、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-25 | v0.6.0 | 六期需求文档：技能系统 + 多 Agent 协作详细设计 |

---

_待确认后执行_