# Miniclaw

> 轻量级个人 AI 助手

一个基于 TypeScript 的轻量级 AI 助手框架，支持多通道接入、Session 管理、工具调用。

## 功能特性

- 🤖 **多模型支持** - 支持阿里云百炼等 OpenAI 兼容 API
- 🔌 **多通道接入** - CLI / API / Web / 飞书
- 📝 **Session 管理** - 按用户/群组隔离对话
- 🛠️ **工具调用** - 文件读写、Shell 执行、网络请求
- 💾 **记忆系统** - 双层记忆结构（短期 + 长期），支持去重、敏感检测
- 🧩 **可扩展** - 模块化架构，易于扩展

## 记忆系统

Miniclaw 采用双层记忆结构，参考 OpenClaw 设计：

```
┌───────────────────────────────────────────────────────┐
│                  记忆系统架构                          │
├───────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐    │
│  │   Short-term        │  │   Long-term         │    │
│  │   短期记忆          │  │   长期记忆          │    │
│  │                     │  │                     │    │
│  │  - 会话上下文        │  │  - 用户偏好         │    │
│  │  - 临时决策          │  │  - 重要决策         │    │
│  │  - TTL 24h           │  │  - 工作记录         │    │
│  │  - Session隔离       │  │  - 持久化存储       │    │
│  └─────────────────────┘  └─────────────────────┘    │
│           │                          │               │
│           └──────────┬────────────────┘               │
│                      ▼                                │
│          ┌─────────────────────┐                      │
│          │   MemoryPromoter    │                      │
│          │                     │                      │
│          │  - 重要性晋升        │                      │
│          │  - TTL清理           │                      │
│          │  - 自动迁移          │                      │
│          └─────────────────────┘                      │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 功能 | 文件 |
|------|------|------|
| **ShortTermMemory** | 短期记忆存储（Session隔离） | `src/memory/store/short-term.ts` |
| **LongTermMemory** | 长期记忆持久化 | `src/memory/store/long-term.ts` |
| **SessionManager** | Session 生命周期管理 | `src/memory/store/session-manager.ts` |
| **TTLManager** | TTL 过期清理 | `src/memory/store/ttl-manager.ts` |
| **MemoryPromoter** | 记忆晋升机制 | `src/memory/promotion/promoter.ts` |
| **MemorySearchTool** | 双层检索工具 | `src/memory/tools/search.ts` |
| **EmbeddingService** | 向量嵌入服务 | `src/memory/embedding/` |
| **DeduplicationChecker** | 去重检查器 | `src/memory/write/` |
| **SensitiveDetector** | 敏感信息检测 | `src/memory/write/` |
| **MemoryWriteTool** | 写入工具接口 | `src/memory/tools/` |

### 使用示例

```typescript
import { ShortTermMemory } from './memory/store/short-term.js';
import { LongTermMemory } from './memory/store/long-term.js';
import { MemoryPromoter } from './memory/promotion/promoter.js';
import { TTLManager } from './memory/store/ttl-manager.js';
import { MemorySearchTool } from './memory/tools/search.js';

// 初始化组件
const sessionManager = new SessionManager();
const shortTerm = new ShortTermMemory(sessionManager);
const longTerm = new LongTermMemory('./memory');
const promoter = new MemoryPromoter(shortTerm, longTerm);
const ttlManager = new TTLManager(shortTerm, promoter);
const searchTool = new MemorySearchTool(shortTerm, longTerm, embeddingService);

// 写入短期记忆
const sessionId = sessionManager.create();
await shortTerm.write('User context', sessionId, { importance: 0.8 });

// 晋升重要记忆
await promoter.promoteAll();

// 搜索
const results = await searchTool.search({ query: 'User' });
```

### 记忆晋升规则

- **重要性阈值**: 0.5（可配置）
- **晋升时机**: TTL过期前自动检查
- **晋升后**: 从短期记忆移除，持久化到长期记忆

### TTL 清理

- **默认 TTL**: 24 小时
- **清理间隔**: 1 小时
- **清理策略**: 过期前检查重要性，决定晋升或删除

### 文档

详细文档：
- [API文档](docs/api/memory-write.md)
- [架构设计](docs/architecture/dual-layer.md)

---

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