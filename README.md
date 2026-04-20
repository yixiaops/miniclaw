# Miniclaw

> 轻量级个人 AI 助手

一个基于 TypeScript 的轻量级 AI 助手框架，支持多通道接入、Session 管理、工具调用。

## 功能特性

- 🤖 **多模型支持** - 支持阿里云百炼等 OpenAI 兼容 API
- 🔌 **多通道接入** - CLI / API / Web / 飞书
- 📝 **Session 管理** - 按用户/群组隔离对话
- 🛠️ **工具调用** - 文件读写、Shell 执行、网络请求
- 🔧 **工具过滤** - 支持白名单/黑名单限制 Agent 可用工具
- 📄 **可配置提示词** - YAML frontmatter 格式，支持多 Agent 配置
- 🧠 **技能系统** - 基于 pi-coding-agent Skill API，渐进式披露
- 💾 **记忆系统** - 双层记忆结构（短期 + 长期），支持去重、敏感检测
- 🧩 **可扩展** - 模块化架构，易于扩展

## 记忆系统

Miniclaw 采用三层记忆结构，区分对话历史和晋升候选池：

### 第一层：对话历史（Session.json）- 真正的短期记忆

- **存储位置**: `~/.miniclaw/sessions/*.json`
- **内容**: 完整对话历史（role + content + timestamp）
- **写入时机**: 每次对话立即写入
- **持久化**: ✅ 文件持久化，重启可恢复
- **用途**: 恢复对话上下文

### 第二层：晋升候选池（MemoryCandidatePool）- 待晋升记忆

- **存储位置**: 内存 Map（不持久化）
- **内容**: 候选记忆内容 + importance + TTL（24h）
- **写入时机**: 每次对话同时写入内存
- **持久化**: ❌ 内存 Map，重启丢失
- **用途**: 等待 TTLManager 判断是否晋升

### 第三层：长期记忆（LongTermMemory）- 持久化存储

- **存储位置**: `~/.miniclaw/memory-storage/`
- **内容**: MEMORY.md（可读）+ long-term.json（程序读取）
- **写入时机**: TTL 清理时晋升写入
- **持久化**: ✅ 文件持久化
- **用途**: 跨 Session 知识检索

### 三层对比

| 维度 | Session.json | CandidatePool | LongTermMemory |
|------|-------------|---------------|----------------|
| **存储** | 文件（持久化） | 内存 Map | 文件（持久化） |
| **写入时机** | 每次对话立即 | 每次对话同时 | TTL 清理晋升 |
| **重启恢复** | ✅ 可恢复 | ❌ 丢失 | ✅ 可恢复 |
| **生命周期** | 永久保存 | 24h TTL 或晋升 | 永久保存 |
| **用途** | 对话上下文 | 晋升前缓存 | 跨 Session 知识 |

### 核心模块

| 模块 | 功能 | 文件 |
|------|------|------|
| **SimpleMemoryStorage** | 对话历史存储（Session.json） | `src/core/memory/simple.ts` |
| **MemoryCandidatePool** | 晋升候选池（内存 Map） | `src/memory/store/candidate-pool.ts` |
| **LongTermMemory** | 长期记忆持久化 | `src/memory/store/long-term.ts` |
| **SessionManager** | Session 生命周期管理 | `src/memory/store/session-manager.ts` |
| **TTLManager** | TTL 过期清理 + 触发晋升 | `src/memory/store/ttl-manager.ts` |
| **MemoryPromoter** | 记忆晋升机制 | `src/memory/promotion/promoter.ts` |
| **AutoMemoryWriter** | 自动写入对话到候选池 | `src/memory/auto-writer.ts` |
| **MemoryManager** | 统一入口，协调各组件 | `src/memory/manager.ts` |


## 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Miniclaw 系统架构                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        通道层 (Channels)                             │   │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │   │
│   │  │   CLI   │  │   API   │  │   Web   │  │ Feishu  │                  │   │
│   │  │ 终端交互 │  │ HTTP接口│  │WebSocket│  │ 飞书机器人│                  │   │
│   │  └───┬─────┘  └───┬─────┘  └───┬─────┘  └───┬─────┘                  │   │
│   └──────────┼────────────┼────────────┼────────────┼─────────────────────┘   │
│              │            │            │            │                         │
│              └────────────┴────────────┴────────────┘                         │
│                              │                                              │
│                              ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      Gateway (核心协调器)                             │   │
│   │  ┌───────────────────────────────────────────────────────────────┐  │   │
│   │  │  handleMessage(ctx)                                            │  │   │
│   │  │    1. Router.route(ctx) → sessionId                            │  │   │
│   │  │    2. SessionManager.getOrCreate(sessionId) → session          │  │   │
│   │  │    3. AgentRegistry.getOrCreate(sessionId) → agent             │  │   │
│   │  │    4. agent.chat(content) → response                           │  │   │
│   │  │    5. session.addMessage(user + assistant)                     │  │   │
│   │  │    6. storage.save(session) → 持久化                            │  │   │
│   │  └───────────────────────────────────────────────────────────────┘  │   │
│   └──────────┬────────────────┬────────────────┬──────────────────────────┘   │
│              │                │                │                              │
│   ┌──────────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐                      │
│   │      Router      │ │SessionManager│ │ AgentRegistry│                      │
│   │     路由器       │ │  会话管理器  │ │ Agent注册表  │                      │
│   │                  │ │              │ │              │                      │
│   │ • byUser        │ │ • getOrCreate│ │ • getOrCreate│                      │
│   │ • byGroup       │ │ • destroy    │ │ • destroy    │                      │
│   │ • byChannel     │ │ • cleanup    │ │ • cleanupIdle│                      │
│   │ • 自定义规则     │ │ • TTL过期    │ │ • 权限检查   │                      │
│   └──────────────────┘ └──────────────┘ │ • 多Agent类型│                      │
│                                         └──────────────┘                      │
│                              │                                              │
│                              ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     Agent 核心 (MiniclawAgent)                       │   │
│   │  ┌───────────────────────────────────────────────────────────────┐  │   │
│   │  │  MiniclawAgent                                                 │  │   │
│   │  │  • chat(content) → 调用 LLM                                     │  │   │
│   │  │  • streamChat(content) → 流式响应                               │  │   │
│   │  │  • registerTool(tool) → 注册工具                                │  │   │
│   │  │  • setSystemPrompt(prompt) → 设置系统提示                       │  │   │
│   │  └───────────────────────────────────────────────────────────────┘  │   │
│   └──────────┬────────────────┬────────────────┬──────────────────────────┘   │
│              │                │                │                              │
│   ┌──────────┴───────┐ ┌──────┴───────┐ ┌──────┴───────┐                      │
│   │     Tools        │ │    Memory    │ │   Subagent   │                      │
│   │    工具层        │ │   记忆系统   │ │   子代理系统 │                      │
│   │                  │ │              │ │              │                      │
│   │ • read_file     │ │ • load       │ │ • spawn      │                      │
│   │ • write_file    │ │ • save       │ │ • execute    │                      │
│   │ • shell         │ │ • delete     │ │ • kill       │                      │
│   │ • web_fetch     │ │ • listSessions│ │ • await      │                      │
│   │ • sessions_spawn│ │              │ │ • cleanup    │                      │
│   │ • subagents     │ │              │ │              │                      │
│   └──────────────────┘ └──────────────┘ └──────────────┘                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 职责 | 文件 |
|------|------|------|
| **Gateway** | 统一消息入口，整合所有组件 | `src/core/gateway/index.ts` |
| **Router** | 消息路由，决定消息归属哪个 Session | `src/core/gateway/router.ts` |
| **SessionManager** | Session 创建、销毁、过期管理 | `src/core/gateway/session.ts` |
| **AgentRegistry** | Agent 实例管理，复用和清理 | `src/core/agent/registry.ts` |
| **PromptManager** | 系统提示词加载与解析（YAML frontmatter） | `src/core/prompt/manager.ts` |
| **ToolFilter** | 工具白名单/黑名单过滤 | `src/tools/filter.ts` |
| **PiSkillManager** | 技能加载与匹配（pi-coding-agent API） | `src/core/skill/pi-manager.ts` |
| **SessionKeyBuilder** | Session Key 构建/解析 | `src/core/session-key/index.ts` |
| **Agent** | 与大模型交互、工具调用 | `src/core/agent/index.ts` |
| **Memory** | 对话历史持久化 | `src/core/memory/simple.ts` |
| **Channels** | 接收用户消息、返回响应 | `src/channels/*.ts` |
| **Tools** | 文件操作、Shell、网络请求 | `src/tools/*.ts` |

## 消息流程

```
用户消息
    │
    ▼
┌──────────────┐
│   Channel    │  1. 接收消息
│ (CLI/Feishu) │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Agent     │  2. 处理消息
│   .chat()    │     - 构建上下文
└──────┬───────┘     - 调用大模型
       │             - 执行工具
       ▼             - 生成响应
┌──────────────┐
│   响应用户    │  3. 返回响应
└──────────────┘
```

### 工具调用流程

```
用户: "帮我创建 a.txt 文件"
         │
         ▼
┌──────────────────┐
│ Agent 分析意图   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 决定调用工具     │  write_file(path, content)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 执行工具         │  创建文件
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 返回结果         │  "文件已创建: a.txt"
└──────────────────┘
```

## Agent 协作系统

### 什么是 sessions_spawn？

`sessions_spawn` 是 Miniclaw 的核心工具，用于**动态创建子代理**执行专业任务。

**命名由来**：源自计算机术语 **Spawn（衍生/孵化）**

| 领域 | 含义 |
|------|------|
| **操作系统** | `spawn` 指从当前进程创建新子进程（如 `posix_spawn`） |
| **游戏开发** | 生成新实体（如 "spawn point" 出生点） |
| **Miniclaw** | 从当前 Agent "孵化" 出新的子 Agent |

**核心特点**：
- 子 Agent **独立运行**，有自己的 Session 和对话历史
- 执行完成后**返回结果**，自动销毁
- 支持**多级嵌套**（子代理可继续创建子代理）
- 有**权限控制**和**并发限制**

### 工作原理

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       sessions_spawn 工作流程                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   用户消息: "帮我分析一下这个 ETF 的投资策略"                                  │
│                              │                                              │
│                              ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     Main Agent (主代理)                              │   │
│   │  分析意图 → ETF 专业问题 → 决定调用子代理                            │   │
│   │                              │                                      │   │
│   │                              ▼                                      │   │
│   │  Tool Call: sessions_spawn                                         │   │
│   │  { task: "分析ETF投资策略", agentId: "etf" }                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                   SubagentManager (子代理管理器)                     │   │
│   │  ┌───────────────────────────────────────────────────────────────┐  │   │
│   │  │  1. 权限检查                                                    │  │   │
│   │  │     AgentRegistry.canSpawnSubagent("main", "etf")               │  │   │
│   │  │     → 检查 main 的 subagents.allowAgents 是否包含 "etf"         │  │   │
│   │  │                                                                 │  │   │
│   │  │  2. 并发检查                                                    │  │   │
│   │  │     getActiveCount() < maxConcurrent (默认 5)                   │  │   │
│   │  │                                                                 │  │   │
│   │  │  3. 创建子代理                                                  │  │   │
│   │  │     id = "sub-uuid-xxxx"                                        │  │   │
│   │  │     sessionKey = "subagent:etf:sub-uuid-xxxx"                   │  │   │
│   │  │                                                                 │  │   │
│   │  │  4. 创建 Agent 实例                                             │  │   │
│   │  │     AgentRegistry.getOrCreate(sessionKey, "etf")                │  │   │
│   │  │     → 加载 etf 配置 (systemPrompt, skills, tools)               │  │   │
│   │  │                                                                 │  │   │
│   │  │  5. 执行任务                                                    │  │   │
│   │  │     agent.chat(task)                                            │  │   │
│   │  │                                                                 │  │   │
│   │  │  6. 返回结果                                                    │  │   │
│   │  │     result = "ETF分析报告..."                                    │  │   │
│   │  └───────────────────────────────────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      ETF Agent (子代理)                              │   │
│   │  System Prompt: "你是 ETF 分析师，专长于基金市场分析..."              │   │
│   │  独立 Session → 独立对话历史                                        │   │
│   │  执行任务 → 生成分析报告                                            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                     Main Agent (整合回复)                            │   │
│   │  收到子代理结果 → 整理、总结 → 回复用户                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 核心机制

| 机制 | 说明 |
|------|------|
| **权限控制** | `AgentRegistry.canSpawnSubagent(parent, child)` 检查 `subagents.allowAgents` |
| **并发限制** | `SubagentManager.maxConcurrent` 控制最大并发数（默认 5） |
| **独立 Session** | 每个子代理有独立的 `sessionKey`，独立对话历史 |
| **工具隔离** | 子代理的工具由其 Agent 配置决定，主代理的工具不自动继承 |
| **超时控制** | 每个子代理有独立的超时时间，超时自动标记 `timeout` 状态 |
| **定期清理** | `SubagentManager.cleanup()` 定期清理已完成的子代理 |
| **结果传递** | 子代理执行结果通过 `sessions_spawn` 工具返回给主代理 |

### 多级嵌套示例

```
Main Agent (指挥官)
    │
    ├── spawn → ETF Agent (分析师)
    │               │
    │               └── spawn → Data-Fetcher Agent (数据抓取)
    │               │               │
    │               │               └── 执行 web_fetch 获取数据
    │               │               └── 返回原始数据给 ETF Agent
    │               │
    │               └── 分析数据 → 返回报告给 Main Agent
    │
    ├── spawn → Policy Agent (政策分析师)
    │               │
    │               └── 分析宏观政策 → 返回报告给 Main Agent
    │
    └───────────────┴─── 整合两份报告 → 回复用户
```

### 与 subagents 工具的区别

| 工具 | 功能 | 使用场景 |
|------|------|---------|
| **sessions_spawn** | 创建并执行子代理 | 需要委托专业任务 |
| **subagents** | 管理已有子代理 | 查看状态、终止任务 |

```typescript
// sessions_spawn: 创建子代理
{ action: "sessions_spawn", task: "分析ETF", agentId: "etf" }

// subagents: 管理子代理
{ action: "subagents", subAction: "list" }      // 列出活跃子代理
{ action: "subagents", subAction: "stats" }     // 查看统计
{ action: "subagents", subAction: "kill", target: "sub-xxx" }  // 终止子代理
```

## 快速开始

### 安装

```bash
# 克隆项目
git clone https://github.com/yixiaops/miniclaw.git
cd miniclaw

# 安装依赖
npm install

# 编译
npm run build
```

### 配置

创建 `.env` 文件：

```env
# 百炼 API 配置
BAILIAN_API_KEY=your-api-key
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_MODEL=qwen-turbo

# 飞书配置（可选）
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
```

### 运行

```bash
# CLI 模式
npm run start:cli

# API 模式
npm run start:api

# Web 模式
npm run start:web

# 飞书模式
npm run start:feishu

# 全部模式
npm run start:all
```

### 开发模式

```bash
# 开发调试（无需编译）
npm run debug:cli
npm run debug:api
npm run debug:web
```

## 工具过滤配置

Agent 可以通过 `tools.allow` 和 `tools.deny` 配置限制可用工具。

### 配置规则

| 规则 | 说明 |
|------|------|
| **默认** | 无配置时返回所有工具 |
| **allow 白名单** | 限制为只使用指定工具 |
| **deny 黑名单** | 禁止特定工具（优先于 allow） |

### 示例配置

```json
{
  "agents": {
    "list": [
      {
        "id": "etf",
        "tools": {
          "allow": ["web_search", "web_fetch", "read_file"]
        }
      },
      {
        "id": "policy",
        "tools": {
          "deny": ["shell"]
        }
      }
    ]
  }
}
```

### 内置工具列表

| 工具 | 功能 |
|------|------|
| `read_file` | 读取文件内容 |
| `write_file` | 写入文件 |
| `shell` | 执行 Shell 命令 |
| `glob` | 文件模式搜索 |
| `grep` | 内容搜索 |
| `ls` | 目录列表 |
| `edit` | 文件编辑 |
| `multi_edit` | 多处编辑 |
| `web_fetch` | 抓取网页内容 |
| `web_search` | 搜索网页信息 |
| `memory_search` | 搜索记忆 |
| `memory_get` | 获取记忆片段 |

## 提示词配置

系统提示词使用 YAML frontmatter 格式，支持元数据和内容分离。

### 格式说明

```markdown
---
name: etf
description: ETF 市场分析专家
model: qwen3.5-plus
version: 2.0.0
tools:
  - web_search
  - web_fetch
---

你是 ETF 市场分析专家，擅长基金选择和投资策略。

# Tone and Style
...
```

### 元数据字段

| 字段 | 说明 |
|------|------|
| `name` | 提示词名称 |
| `description` | 提示词描述 |
| `model` | 推荐使用的模型 |
| `version` | 版本号 |
| `tools` | 推荐使用的工具列表 |

### Agent 配置引用

```json
{
  "agents": {
    "list": [
      {
        "id": "etf",
        "systemPrompt": "file://~/.miniclaw/prompts/etf.md"
      }
    ]
  }
}
```

## 技能系统

基于 pi-coding-agent Skill API，实现渐进式披露加载。

### 技能目录结构

```
~/.miniclaw/skills/
├── weather/SKILL.md
└── test-skill/SKILL.md
```

### SKILL.md 格式

```markdown
---
name: weather
description: 获取天气信息和预报
triggers: 天气、天气预报、今天天气
---

# Weather Skill

使用 web_fetch 工具获取天气数据...
```

### 配置

```json
{
  "skills": {
    "dir": "~/.miniclaw/skills",
    "enabled": true
  }
}
```

### 系统提示词组成

系统提示词按来源分块打印：

```
📋 系统提示词组成 (总计 1155 字符):

  [1] 提示词文件 etf.md (409 字符)
    你是 ETF 市场分析专家...

  [2] 技能数据 (2 个技能: weather, test-skill)
    <available_skills>...</available_skills>
```

## 开发指南

### 项目结构

```
miniclaw/
├── src/
│   ├── core/                 # 核心模块
│   │   ├── agent/           # Agent 核心 + 注册表
│   │   ├── gateway/         # Gateway 主类 + 路由 + Session
│   │   ├── session-key/     # Session Key 构建/解析
│   │   ├── memory/          # 记忆系统
│   │   ├── config.ts        # 配置管理
│   │   └── lifecycle.ts     # 生命周期
│   ├── channels/            # 通道层
│   │   ├── cli.ts           # CLI 通道
│   │   ├── api.ts           # HTTP API
│   │   ├── web.ts           # WebSocket
│   │   └── feishu.ts        # 飞书机器人
│   ├── tools/               # 工具层
│   │   ├── read-file.ts     # 读取文件
│   │   ├── write-file.ts    # 写入文件
│   │   ├── shell.ts         # Shell 执行
│   │   └── web-fetch.ts     # 网络请求
│   └── index.ts             # 入口
├── tests/                   # 测试
│   ├── unit/               # 单元测试
│   └── integration/        # 集成测试
├── docs/                    # 文档
│   ├── ARCHITECTURE.md     # 架构设计
│   ├── BRANCH_STRATEGY.md  # 分支策略
│   ├── REQUIREMENTS_V3.md  # 三期需求
│   └── REQUIREMENTS_V4.md  # 四期需求
└── package.json
```

### 添加新工具

1. 创建工具文件 `src/tools/my-tool.ts`：

```typescript
import { Type, type Static } from '@sinclair/typebox';

const MyToolParamsSchema = Type.Object({
  param1: Type.String({ description: '参数说明' })
});

type MyToolParams = Static<typeof MyToolParamsSchema>;

export const myTool = {
  name: 'my_tool',
  label: '我的工具',
  description: '工具描述',
  parameters: MyToolParamsSchema,
  
  async execute(
    toolCallId: string,
    params: MyToolParams,
    signal?: AbortSignal
  ) {
    // 实现逻辑
    return {
      content: [{ type: 'text', text: '结果' }],
      details: {}
    };
  }
};
```

2. 注册工具 `src/tools/index.ts`：

```typescript
import { myTool } from './my-tool.js';

export function getBuiltinTools() {
  return [
    readFileTool,
    writeFileTool,
    shellTool,
    webFetchTool,
    myTool  // 添加新工具
  ];
}
```

### 添加新通道

1. 创建通道文件 `src/channels/my-channel.ts`
2. 实现 `start()` 和 `stop()` 方法
3. 在 `src/index.ts` 中添加启动逻辑

## 测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch

# 覆盖率报告
npm run test:coverage
```

### 当前测试状态

- ✅ 238 tests passed
- 📊 平均覆盖率：78%

| 模块 | 覆盖率 |
|------|--------|
| Gateway | 93% |
| Router | 82% |
| SessionManager | 94% |
| AgentRegistry | 95% |
| SessionKeyBuilder | 92% |
| Agent | 73% |
| Memory | 97% |
| Config | 87% |
| Lifecycle | 94% |

## 文档

- [架构设计文档](docs/ARCHITECTURE.md)
- [分支策略](docs/BRANCH_STRATEGY.md)
- [三期需求：网关架构设计](docs/REQUIREMENTS_V3.md)
- [四期需求：Gateway 主类 + 记忆系统](docs/REQUIREMENTS_V4.md)

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript 5.x
- **框架**: pi-agent-core (嵌入式 Agent 框架)
- **测试**: Vitest
- **HTTP**: Express 5.x
- **WebSocket**: Socket.IO

## 版本历史

### v0.3.0 (2026-04-10) - 提示词配置 + 工具过滤 + 技能系统

- ✅ Tool Filtering（工具白名单/黑名单过滤）
- ✅ Prompt 配置（YAML frontmatter 格式）
- ✅ PiSkillManager（pi-coding-agent Skill API）
- ✅ PromptComponent（系统提示词按组成部分显示）
- ✅ 多 Agent 配置支持

### v0.2.0 (2026-03-20) - Gateway + 记忆系统

- ✅ Gateway 主类（统一消息入口）
- ✅ AgentRegistry（Agent 实例管理）
- ✅ SessionKeyBuilder（Session Key 构建/解析）
- ✅ SimpleMemoryStorage（对话历史持久化）
- ✅ 238 个测试用例
- 📊 覆盖率提升至 78%

### v0.1.0 (2026-03-13) - MVP

- ✅ 基础 Agent 框架
- ✅ CLI / API / Web / 飞书通道
- ✅ 工具调用（文件、Shell、网络）
- ✅ Session 管理
- ✅ 路由机制
- ✅ 121 个测试用例

### 未来计划

- 🔮 关键词搜索记忆
- 🔮 向量语义搜索
- 🔮 WebSocket 增强
- 🔮 插件机制

## License

MIT