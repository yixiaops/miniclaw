# Miniclaw

> 轻量级个人 AI 助手

一个基于 TypeScript 的轻量级 AI 助手框架，支持多通道接入、Session 管理、工具调用。

## 功能特性

- 🤖 **多模型支持** - 支持阿里云百炼等 OpenAI 兼容 API
- 🔌 **多通道接入** - CLI / API / Web / 飞书
- 📝 **Session 管理** - 按用户/群组隔离对话
- 🛠️ **工具调用** - 文件读写、Shell 执行、网络请求
- 💾 **记忆系统** - 对话历史持久化
- 🧩 **可扩展** - 模块化架构，易于扩展

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Miniclaw                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                    通道层 (Channels)                  │   │
│   │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐        │   │
│   │  │  CLI   │ │  API   │ │  Web   │ │ Feishu │        │   │
│   │  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘        │   │
│   └──────┼──────────┼──────────┼──────────┼─────────────┘   │
│          │          │          │          │                  │
│          └──────────┴──────────┴──────────┘                  │
│                          │                                  │
│   ┌──────────────────────┴──────────────────────────────┐   │
│   │                   核心层 (Core)                       │   │
│   │                                                     │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│   │  │   Router    │  │  Session    │  │   Agent     │  │   │
│   │  │   路由器    │  │  Manager    │  │   核心      │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│   │                                                     │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│   │  │   Config    │  │  Lifecycle  │  │   Memory    │  │   │
│   │  │   配置      │  │   生命周期  │  │   记忆      │  │   │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                    工具层 (Tools)                     │   │
│   │  read_file │ write_file │ shell │ web_fetch          │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 核心组件

| 组件 | 职责 | 文件 |
|------|------|------|
| **Router** | 消息路由，决定消息归属哪个 Session | `src/core/gateway/router.ts` |
| **SessionManager** | Session 创建、销毁、过期管理 | `src/core/gateway/session.ts` |
| **Agent** | 与大模型交互、工具调用 | `src/core/agent/index.ts` |
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
│   │   ├── agent/           # Agent 核心
│   │   ├── gateway/         # 路由和 Session
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
├── doc/                     # 文档
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

- ✅ 121 tests passed
- 📊 平均覆盖率：72%

| 模块 | 覆盖率 |
|------|--------|
| Router | 82% |
| SessionManager | 94% |
| Agent | 72% |
| Config | 87% |
| Lifecycle | 89% |

## 文档

- [三期需求：网关架构设计](doc/REQUIREMENTS_V3.md)
- [四期需求：Gateway 主类 + 记忆系统](doc/REQUIREMENTS_V4.md)

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript 5.x
- **框架**: pi-agent-core (嵌入式 Agent 框架)
- **测试**: Vitest
- **HTTP**: Express 5.x
- **WebSocket**: Socket.IO

## 版本历史

### v0.1.0 (2026-03-13) - MVP

- ✅ 基础 Agent 框架
- ✅ CLI / API / Web / 飞书通道
- ✅ 工具调用（文件、Shell、网络）
- ✅ Session 管理
- ✅ 路由机制
- ✅ 121 个测试用例

### 未来计划

- 🔮 Gateway 主类
- 🔮 记忆持久化
- 🔮 关键词搜索
- 🔮 向量语义搜索

## License

MIT