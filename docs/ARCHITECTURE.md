# Miniclaw 架构设计文档

> 版本：v0.4.0 | 更新日期：2026-03-13

## 一、系统架构

### 1.1 整体架构图

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
│   │                 Gateway 主类                          │   │
│   │  - handleMessage() 统一消息入口                        │   │
│   │  - getStatus() 状态监控                                │   │
│   │  - cleanup() 资源清理                                  │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                  │
│          ┌───────────────┼───────────────┐                  │
│          │               │               │                  │
│   ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐          │
│   │   Router    │ │SessionManager│ │AgentRegistry│          │
│   │   路由器    │ │  会话管理器  │ │ Agent注册表 │          │
│   └──────┬──────┘ └──────┬──────┘ └──────┬──────┘          │
│          │               │               │                  │
│          └───────────────┼───────────────┘                  │
│                          │                                  │
│   ┌──────────────────────┴──────────────────────────────┐   │
│   │                    Agent 核心                         │   │
│   │  - chat() 对话交互                                    │   │
│   │  - streamChat() 流式响应                              │   │
│   │  - registerTool() 工具注册                            │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                  │
│   ┌──────────────────────┴──────────────────────────────┐   │
│   │                   记忆系统                            │   │
│   │  - SimpleMemoryStorage 对话历史持久化                │   │
│   │  - load() / save() / delete()                        │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                    工具层 (Tools)                     │   │
│   │  read_file │ write_file │ shell │ web_fetch          │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 模块职责

| 模块 | 职责 | 文件位置 |
|------|------|----------|
| **Gateway** | 统一消息入口，整合所有组件 | `src/core/gateway/index.ts` |
| **Router** | 消息路由，决定消息归属哪个 Session | `src/core/gateway/router.ts` |
| **SessionManager** | Session 创建、销毁、过期管理 | `src/core/gateway/session.ts` |
| **AgentRegistry** | Agent 实例管理，复用和清理 | `src/core/agent/registry.ts` |
| **Agent** | 与大模型交互、工具调用 | `src/core/agent/index.ts` |
| **Channels** | 接收用户消息、返回响应 | `src/channels/*.ts` |
| **Tools** | 文件操作、Shell、网络请求 | `src/tools/*.ts` |
| **Memory** | 对话历史持久化 | `src/core/memory/simple.ts` |

---

## 二、核心数据流

### 2.1 消息处理流程

```
用户消息
    │
    ▼
┌──────────────┐
│   Channel    │  1. 接收消息
│ (CLI/Feishu) │     - 解析消息内容
└──────┬───────┘     - 提取上下文信息
       │
       ▼
┌──────────────┐
│   Gateway    │  2. 统一入口
│ .handle()    │     - 调用 Router 路由
└──────┬───────┘     - 获取/创建 Session
       │             - 获取/创建 Agent
       ▼
┌──────────────┐
│    Router    │  3. 路由决策
│   .route()   │     - 根据 channel/userId/groupId
└──────┬───────┘     - 生成 Session Key
       │
       ▼
┌──────────────┐
│SessionManager│  4. Session 管理
│.getOrCreate()│     - 创建新 Session 或返回已有
└──────┬───────┘     - 加载历史消息（如有）
       │
       ▼
┌──────────────┐
│AgentRegistry │  5. Agent 管理
│.getOrCreate()│     - 创建新 Agent 或返回已有
└──────┬───────┘     - Agent 实例复用
       │
       ▼
┌──────────────┐
│    Agent     │  6. 处理消息
│   .chat()    │     - 构建上下文（历史消息 + 系统提示词）
└──────┬───────┘     - 调用大模型 API
       │             - 执行工具调用（如有）
       ▼             - 生成响应
┌──────────────┐
│SimpleMemory  │  7. 保存历史
│   .save()    │     - 持久化对话历史
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   响应用户    │  8. 返回响应
└──────────────┘
```

### 2.2 工具调用流程

```
用户: "帮我创建 a.txt 文件，内容是 Hello"
         │
         ▼
┌──────────────────┐
│ Agent 分析意图   │  1. 识别用户意图
│                  │     - 需要创建文件
└────────┬─────────┘     - 参数：path="a.txt", content="Hello"
         │
         ▼
┌──────────────────┐
│ 决定调用工具     │  2. 工具选择
│                  │     - 工具名：write_file
└────────┬─────────┘     - 参数：{ path, content }
         │
         ▼
┌──────────────────┐
│ 执行工具         │  3. 工具执行
│ write_file       │     - 创建目录（如需）
└────────┬─────────┘     - 写入文件
         │               - 返回结果
         ▼
┌──────────────────┐
│ Agent 生成响应   │  4. 响应生成
│                  │     - 整合工具结果
└────────┬─────────┘     - 生成自然语言响应
         │
         ▼
┌──────────────────┐
│ 返回给用户       │  5. 结果返回
│ "文件已创建..."  │
└──────────────────┘
```

---

## 三、Session Key 设计

### 3.1 格式定义

```
agent:{agentId}:{scope}
```

### 3.2 Scope 类型

| Scope 格式 | 含义 | 示例 |
|-----------|------|------|
| `main` | 主 Session（默认） | `agent:main:main` |
| `channel:{channel}` | 按通道隔离 | `agent:main:channel:cli` |
| `channel:{channel}:peer:{peerId}` | 按通道+用户隔离 | `agent:main:channel:feishu:peer:ou_123` |
| `channel:{channel}:group:{groupId}` | 按通道+群组隔离 | `agent:main:channel:feishu:group:oc_456` |

### 3.3 通道隔离规则

| 通道 | 隔离方式 | Session Key 示例 |
|------|---------|-----------------|
| **CLI** | 通道隔离 | `agent:main:channel:cli` |
| **API** | clientId 隔离 | `agent:main:channel:api:peer:{clientId}` |
| **Web** | clientId 隔离 | `agent:main:channel:web:peer:{clientId}` |
| **Feishu 私聊** | 用户隔离 | `agent:main:channel:feishu:peer:{userId}` |
| **Feishu 群聊** | 群组隔离 | `agent:main:channel:feishu:group:{groupId}` |

### 3.4 构建方法

```typescript
import { SessionKeyBuilder } from './core/session-key';

// 主 Session
SessionKeyBuilder.buildMain('main');
// → 'agent:main:main'

// CLI Session
SessionKeyBuilder.buildChannel('main', 'cli');
// → 'agent:main:channel:cli'

// Feishu 用户 Session
SessionKeyBuilder.buildUser('main', 'feishu', 'ou_123');
// → 'agent:main:channel:feishu:peer:ou_123'

// Feishu 群组 Session
SessionKeyBuilder.buildGroup('main', 'feishu', 'oc_456');
// → 'agent:main:channel:feishu:group:oc_456'
```

---

## 四、核心接口

### 4.1 Gateway 接口

```typescript
interface MessageContext {
  channel: string;        // 通道类型
  userId?: string;        // 用户 ID
  groupId?: string;       // 群组 ID
  clientId?: string;      // API 客户端 ID
  content: string;        // 消息内容
}

interface Response {
  content: string;        // 响应内容
  sessionKey: string;     // Session Key
}

interface GatewayStatus {
  sessionCount: number;   // Session 数量
  agentCount: number;     // Agent 数量
  sessionKeys: string[];  // Session Key 列表
}

class MiniclawGateway {
  handleMessage(ctx: MessageContext): Promise<Response>;
  getStatus(): GatewayStatus;
  cleanup(): void;
}
```

### 4.2 Router 接口

```typescript
interface RouteContext {
  channel: string;
  userId?: string;
  groupId?: string;
  clientId?: string;
  content: string;
}

interface RouteRule {
  id: string;
  match: {
    channel?: string;
    userId?: string;
    groupId?: string;
    pattern?: RegExp;
  };
  targetSessionKey: string;
  priority: number;
}

class Router {
  route(ctx: RouteContext): string;  // 返回 Session Key
  addRule(rule: RouteRule): void;
  removeRule(ruleId: string): void;
  getRules(): RouteRule[];
}
```

### 4.3 SessionManager 接口

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface SessionMetadata {
  channel: string;
  userId?: string;
  groupId?: string;
}

class Session {
  id: string;
  messages: Message[];
  metadata: SessionMetadata;
  createdAt: Date;
  lastActiveAt: Date;
  
  addMessage(message: Message): void;
  clear(): void;
  isExpired(ttl: number): boolean;
}

class SessionManager {
  getOrCreate(sessionId: string, metadata?: SessionMetadata): Session;
  get(sessionId: string): Session | undefined;
  destroy(sessionId: string): void;
  cleanup(): void;
  count(): number;
}
```

### 4.4 AgentRegistry 接口

```typescript
interface AgentEntry {
  agent: MiniclawAgent;
  sessionKey: string;
  createdAt: Date;
  lastActiveAt: Date;
}

class AgentRegistry {
  getOrCreate(sessionKey: string): MiniclawAgent;
  get(sessionKey: string): MiniclawAgent | undefined;
  destroy(sessionKey: string): void;
  cleanupIdle(idleTimeoutMs: number): void;
  count(): number;
  getSessionKeys(): string[];
}
```

### 4.5 Memory 接口

```typescript
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

class SimpleMemoryStorage {
  save(sessionKey: string, messages: Message[]): Promise<void>;
  load(sessionKey: string): Promise<Message[]>;
  delete(sessionKey: string): Promise<void>;
  listSessions(): Promise<string[]>;
  exists(sessionKey: string): Promise<boolean>;
}
```

---

## 五、目录结构

```
src/
├── core/                      # 核心模块
│   ├── gateway/              # Gateway 模块
│   │   ├── index.ts          # Gateway 主类
│   │   ├── router.ts         # 路由器
│   │   └── session.ts        # Session 管理
│   ├── agent/                # Agent 模块
│   │   ├── index.ts          # Agent 核心
│   │   └── registry.ts       # Agent 注册表
│   ├── session-key/          # Session Key 模块
│   │   └── index.ts          # SessionKeyBuilder
│   ├── memory/               # 记忆系统
│   │   ├── index.ts          # 导出
│   │   └── simple.ts         # 简单持久化
│   ├── config.ts             # 配置管理
│   └── lifecycle.ts          # 生命周期
├── channels/                  # 通道层
│   ├── cli.ts                # CLI 通道
│   ├── api.ts                # HTTP API
│   ├── web.ts                # WebSocket
│   └── feishu.ts             # 飞书机器人
├── tools/                     # 工具层
│   ├── index.ts              # 工具注册
│   ├── read-file.ts          # 读取文件
│   ├── write-file.ts         # 写入文件
│   ├── shell.ts              # Shell 执行
│   └── web-fetch.ts          # 网络请求
└── index.ts                   # 入口
```

---

## 六、数据存储

### 6.1 存储位置

```
~/.miniclaw/
├── sessions/                  # 对话历史存储
│   ├── YWdlbnQ6bWFpbjptYWlu.json
│   ├── YWdlbnQ6bWFpbjpjaGFubmVsOmNsaQ==.json
│   └── ...
└── config.json               # 配置文件（可选）
```

### 6.2 存储文件格式

```json
{
  "sessionKey": "agent:main:channel:feishu:peer:ou_123",
  "messages": [
    {
      "role": "user",
      "content": "你好",
      "timestamp": "2026-03-13T12:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "你好！有什么可以帮助你的？",
      "timestamp": "2026-03-13T12:00:01.000Z"
    }
  ],
  "updatedAt": "2026-03-13T12:00:01.000Z"
}
```

---

## 七、配置

### 7.1 环境变量

```env
# 百炼 API 配置
BAILIAN_API_KEY=your-api-key
BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
BAILIAN_MODEL=qwen-turbo

# 飞书配置（可选）
FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
```

### 7.2 Gateway 配置

```typescript
interface GatewayConfig {
  router: {
    rules: RouteRule[];
    defaultStrategy: 'byUser' | 'byGroup';
  };
  session: {
    maxHistoryLength: number;      // 最大历史消息数，默认 50
    sessionTtl: number;            // Session 过期时间（毫秒），默认 3600000
    maxConcurrentSessions: number; // 最大并发 Session 数，默认 100
  };
  agent: {
    maxAgents: number;             // 最大 Agent 数，默认 50
    agentIdleTimeout: number;      // Agent 空闲超时（毫秒），默认 3600000
  };
  memory: {
    enabled: boolean;
    storagePath: string;           // 存储路径，默认 ~/.miniclaw/sessions
  };
}
```

---

## 八、扩展指南

### 8.1 添加新通道

1. 创建通道文件 `src/channels/my-channel.ts`
2. 实现 `start()` 和 `stop()` 方法
3. 在 `src/index.ts` 中添加启动逻辑

### 8.2 添加新工具

1. 创建工具文件 `src/tools/my-tool.ts`
2. 定义参数 Schema 和 execute 函数
3. 在 `src/tools/index.ts` 中注册

### 8.3 添加新的路由规则

```typescript
gateway.router.addRule({
  id: 'custom-rule-1',
  match: {
    channel: 'feishu',
    userId: 'ou_special_user'
  },
  targetSessionKey: 'agent:main:channel:feishu:peer:special',
  priority: 10
});
```

---

## 九、版本历史

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v0.1.0 | 2026-03-13 | MVP 版本：基础 Agent + 多通道 + 工具调用 |
| v0.4.0 | 2026-03-13 | 四期架构：Gateway + SessionKey + AgentRegistry + Memory |

---

## 十、参考文档

- [三期需求文档](./REQUIREMENTS_V3.md)
- [四期需求文档](./REQUIREMENTS_V4.md)
- [README](../README.md)