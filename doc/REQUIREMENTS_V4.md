# Miniclaw 四期需求文档 (v0.4)

> Gateway 主类实现 + 记忆系统设计

## 一、背景

### 1.1 当前状态分析 (2026-03-13)

**已完成模块：**

| 模块 | 状态 | 说明 |
|------|------|------|
| Router | ✅ 已实现 | 路由消息到对应 Session |
| SessionManager | ✅ 已实现 | Session 创建/销毁/管理 |
| Agent | ✅ 已实现 | 与大模型交互、工具调用 |
| Channels | ✅ 已实现 | CLI/API/Web/Feishu 通道 |

**问题分析：**

| 问题 | 影响 | 原因 |
|------|------|------|
| Gateway 主类缺失 | Router/SessionManager 未集成 | 缺少统一入口 |
| 记忆系统空缺 | 重启后记忆丢失 | 只有内存中的对话历史 |
| 无持久化 | Session/历史无法恢复 | 存储层未实现 |

---

### 1.2 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Miniclaw Gateway                          │
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
│   │                 Gateway 主类 (新增)                   │   │
│   │  - 统一消息入口                                        │   │
│   │  - 整合 Router + SessionManager                       │   │
│   │  - Agent 运行时注册表                                  │   │
│   └──────────────────────┬──────────────────────────────┘   │
│                          │                                  │
│          ┌───────────────┼───────────────┐                  │
│          │               │               │                  │
│   ┌──────┴──────┐ ┌──────┴──────┐ ┌──────┴──────┐          │
│   │   Router    │ │SessionManager│ │ AgentRegistry│          │
│   │   (已有)    │ │   (已有)     │ │  (新增)      │          │
│   └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐   │
│   │                 记忆系统 (新增)                        │   │
│   │  - 短期记忆：对话历史 (Session 内)                     │   │
│   │  - 长期记忆：知识库 (跨 Session)                       │   │
│   │  - 持久化：SQLite 存储                                 │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、核心需求

### 2.1 Gateway 主类

**职责：**
- 统一消息入口，所有通道通过 Gateway 处理消息
- 整合 Router、SessionManager
- 管理活跃 Agent 实例（运行时注册表）
- 提供状态监控

**接口设计：**

```typescript
/**
 * Gateway 配置
 */
interface GatewayConfig {
  /** 路由器配置 */
  router: RouterConfig;
  /** Session 配置 */
  session: SessionConfig;
  /** Agent 配置 */
  agent: AgentConfig;
  /** 存储配置 */
  storage: StorageConfig;
}

/**
 * Gateway 主类（简化版）
 * 
 * 不负责启动服务器，只负责消息处理和组件协调。
 * 生命周期由入口 main() 管理。
 */
class MiniclawGateway {
  /** 路由器 */
  private router: Router;
  /** Session 管理器 */
  private sessionManager: SessionManager;
  /** Agent 运行时注册表 */
  private activeAgents: Map<string, MiniclawAgent>;
  /** 配置 */
  private config: Config;
  
  /**
   * 处理消息（核心方法）
   * 
   * @param ctx - 消息上下文
   * @returns 响应内容
   */
  async handleMessage(ctx: MessageContext): Promise<Response>;
  
  /**
   * 获取状态
   */
  getStatus(): GatewayStatus;
  
  /**
   * 清理资源
   */
  cleanup(): void;
}
```

**消息处理流程：**

```
handleMessage(ctx)
    │
    ├─→ 1. Router.route(ctx) → sessionKey
    │
    ├─→ 2. SessionManager.getOrCreate(sessionKey) → session
    │
    ├─→ 3. getOrCreateAgent(sessionKey) → agent
    │
    ├─→ 4. agent.chat(ctx.content) → response
    │
    ├─→ 5. session.addMessage(user + assistant)
    │
    └─→ 6. 返回 response
```

---

### 🔮 优化方向（未来版本）

**当前设计与 OpenClaw 的差异：**

| 方面 | 当前设计 | OpenClaw 设计 | 差异说明 |
|------|---------|---------------|---------|
| 服务器职责 | Gateway 只处理消息 | Gateway 是完整服务器 | OpenClaw 包含 HTTP/WebSocket/认证等 |
| 生命周期 | 由 main() 管理 | Gateway 自管理 | OpenClaw 支持 hot reload |
| 插件系统 | 无 | 完整的插件机制 | OpenClaw 支持插件扩展 |

**未来优化建议：**
- 添加 WebSocket 支持
- 添加 HTTP API 端点
- 添加认证授权
- 添加插件机制

---

### 2.2 Session Key 设计

**格式：**

```
agent:{agentId}:{scope}
```

**scope 含义：**

| scope 值 | 含义 | 示例 |
|----------|------|------|
| `main` | 主 Session（默认） | `agent:main:main` |
| `channel:{channel}` | 按通道隔离 | `agent:main:channel:cli` |
| `channel:{channel}:peer:{peerId}` | 按通道+用户隔离 | `agent:main:channel:feishu:peer:ou_123` |
| `channel:{channel}:group:{groupId}` | 按通道+群组隔离 | `agent:main:channel:feishu:group:oc_456` |

**dmScope（私聊隔离策略）：**

| dmScope | 说明 | 生成的 Session Key |
|---------|------|-------------------|
| `main` | 所有私聊共享一个 Session | `agent:main:main` |
| `per-peer` | 每个用户独立 Session | `agent:main:peer:{peerId}` |
| `per-channel-peer` | 每个通道+用户独立 Session | `agent:main:channel:feishu:peer:{peerId}` |

**接口设计：**

```typescript
/**
 * Session Key 构建器
 */
class SessionKeyBuilder {
  /**
   * 构建主 Session Key
   */
  static buildMain(agentId: string): string;
  
  /**
   * 构建 CLI Session Key
   */
  static buildCli(agentId: string): string;
  
  /**
   * 构建用户 Session Key
   */
  static buildUser(agentId: string, channel: string, peerId: string): string;
  
  /**
   * 构建群组 Session Key
   */
  static buildGroup(agentId: string, channel: string, groupId: string): string;
  
  /**
   * 解析 Session Key
   */
  static parse(sessionKey: string): ParsedSessionKey;
}

/**
 * 解析后的 Session Key
 */
interface ParsedSessionKey {
  agentId: string;
  scope: {
    type: 'main' | 'channel' | 'peer' | 'group';
    channel?: string;
    peerId?: string;
    groupId?: string;
  };
}
```

---

### 2.3 Router 设计

**当前设计：规则列表 + 默认策略**

```typescript
/**
 * 路由规则
 */
interface RouteRule {
  /** 规则 ID */
  id: string;
  /** 匹配条件 */
  match: {
    channel?: string;
    userId?: string;
    groupId?: string;
    pattern?: RegExp;
  };
  /** 目标 Session Key */
  targetSessionKey: string;
  /** 优先级（数字越大优先级越高） */
  priority: number;
}

/**
 * 默认路由策略
 */
type DefaultStrategy = 'byUser' | 'byGroup';

/**
 * Router 类
 */
class Router {
  constructor(config: RouterConfig);
  
  /**
   * 路由消息到 Session Key
   */
  route(ctx: RouteContext): string;
  
  /**
   * 添加路由规则
   */
  addRule(rule: RouteRule): void;
  
  /**
   * 移除路由规则
   */
  removeRule(ruleId: string): void;
}
```

**默认路由行为：**

| 来源 | 默认 Session Key |
|------|-----------------|
| CLI | `agent:main:channel:cli` |
| API | `agent:main:channel:api:peer:{clientId}` |
| Web | `agent:main:channel:web:peer:{clientId}` |
| Feishu 私聊 | `agent:main:channel:feishu:peer:{userId}` |
| Feishu 群聊 | `agent:main:channel:feishu:group:{groupId}` |

---

### 🔮 优化方向（未来版本）

**当前设计与 OpenClaw 的差异：**

| 方面 | 当前设计 | OpenClaw 设计 | 差异说明 |
|------|---------|---------------|---------|
| 路由机制 | 规则列表 | Binding 绑定机制 | OpenClaw 支持更灵活的绑定配置 |
| Session 策略 | 简单的 byUser/byGroup | 多种 dmScope 策略 | OpenClaw 支持更细粒度的隔离 |
| 继承机制 | 无 | 支持父 Peer 继承 | OpenClaw 线程消息可继承群组绑定 |

**未来优化建议（Binding 机制）：**

```typescript
/**
 * Agent 绑定配置（未来版本）
 */
interface AgentBinding {
  // 匹配条件
  channel?: string;
  peer?: string;        // 用户 ID
  guild?: string;       // 群组 ID
  account?: string;     // 账号 ID
  
  // 目标
  agentId: string;
  
  // Session 策略
  dmScope: 'main' | 'per-peer' | 'per-channel-peer';
}

// 配置示例
bindings: [
  { channel: 'feishu', peer: 'ou_123', agentId: 'main', dmScope: 'main' },
  { channel: 'feishu', guild: 'oc_456', agentId: 'etf', dmScope: 'per-peer' }
]
```

---

### 2.4 Agent 运行时注册表

**设计目标：**
- 按需创建 Agent，不预创建
- 运行时注册，支持查询活跃 Agent
- 支持清理空闲 Agent

**接口设计：**

```typescript
/**
 * Agent 运行时注册表
 * 
 * 参考 OpenClaw 的 ACTIVE_EMBEDDED_RUNS 设计，
 * 使用全局 Map 管理活跃的 Agent 实例。
 */
class AgentRegistry {
  /** 活跃的 Agent 实例 */
  private agents: Map<string, MiniclawAgent>;
  /** 配置 */
  private config: Config;
  /** 最大 Agent 数量 */
  private maxAgents: number = 50;
  
  /**
   * 获取或创建 Agent
   * 
   * @param sessionKey - Session Key
   * @returns Agent 实例
   */
  getOrCreate(sessionKey: string): MiniclawAgent;
  
  /**
   * 获取 Agent
   */
  get(sessionKey: string): MiniclawAgent | undefined;
  
  /**
   * 销毁 Agent
   */
  destroy(sessionKey: string): void;
  
  /**
   * 清理空闲 Agent
   */
  cleanupIdle(idleTimeoutMs: number): void;
  
  /**
   * 获取活跃 Agent 数量
   */
  count(): number;
  
  /**
   * 获取所有 Session Key
   */
  getSessionKeys(): string[];
}
```

**复用策略：**

```typescript
getOrCreate(sessionKey: string): MiniclawAgent {
  // 1. 已存在则返回
  const existing = this.agents.get(sessionKey);
  if (existing) {
    return existing;
  }
  
  // 2. 检查数量限制
  if (this.agents.size >= this.maxAgents) {
    this.cleanupIdle(3600000); // 清理 1 小时未活跃的
  }
  
  // 3. 创建新 Agent
  const agent = new MiniclawAgent(this.config);
  this.agents.set(sessionKey, agent);
  return agent;
}
```

---

### 2.5 记忆系统（分阶段实现）

#### 阶段 1：简单持久化

**目标：** 对话历史持久化，重启不丢失

**接口设计：**

```typescript
/**
 * 简单记忆存储
 */
class SimpleMemoryStorage {
  /**
   * 保存 Session 的对话历史
   */
  save(sessionKey: string, messages: Message[]): Promise<void>;
  
  /**
   * 加载 Session 的对话历史
   */
  load(sessionKey: string): Promise<Message[]>;
  
  /**
   * 删除 Session 的对话历史
   */
  delete(sessionKey: string): Promise<void>;
  
  /**
   * 列出所有 Session Key
   */
  listSessions(): Promise<string[]>;
}
```

**存储格式：**

```
~/.miniclaw/sessions/
├── agent_main_main.json
├── agent_main_channel_cli.json
├── agent_main_channel_feishu_peer_ou_123.json
└── agent_main_channel_feishu_group_oc_456.json
```

---

#### 阶段 2：关键词搜索

**目标：** 支持搜索历史对话

**接口设计：**

```typescript
/**
 * 记忆条目
 */
interface MemoryEntry {
  /** 唯一 ID */
  id: string;
  /** 关联的 Session Key */
  sessionKey: string;
  /** 角色 */
  role: 'user' | 'assistant';
  /** 内容 */
  content: string;
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 关键词记忆存储
 */
class KeywordMemoryStorage extends SimpleMemoryStorage {
  /**
   * 搜索记忆
   * 
   * @param query - 搜索关键词
   * @param options - 搜索选项
   * @returns 匹配的记忆条目
   */
  search(query: string, options?: SearchOptions): Promise<MemoryEntry[]>;
}

interface SearchOptions {
  /** 最大结果数 */
  limit?: number;
  /** 限制在特定 Session */
  sessionKey?: string;
}
```

---

#### 🔮 阶段 3：向量搜索（未来版本）

**目标：** 支持语义搜索

**接口设计：**

```typescript
/**
 * 向量记忆存储
 */
class VectorMemoryStorage extends KeywordMemoryStorage {
  /**
   * 语义搜索
   */
  searchSemantic(query: string, options?: SearchOptions): Promise<MemoryEntry[]>;
}
```

**需要：**
- Embedding API（OpenAI、百炼等）
- 向量数据库（SQLite + sqlite-vec 或外部服务）

---

## 三、技术设计

### 3.1 目录结构

```
src/
├── core/
│   ├── gateway/
│   │   ├── index.ts          # Gateway 主类 (新增)
│   │   ├── router.ts         # 路由器 (已有)
│   │   └── session.ts        # Session 管理 (已有)
│   ├── agent/
│   │   ├── index.ts          # Agent 核心 (已有)
│   │   └── registry.ts       # Agent 运行时注册表 (新增)
│   ├── session-key/
│   │   └── index.ts          # Session Key 构建/解析 (新增)
│   ├── memory/
│   │   ├── index.ts          # 记忆管理器 (新增)
│   │   ├── simple.ts         # 简单持久化 (新增)
│   │   └── keyword.ts        # 关键词搜索 (新增)
│   ├── config.ts             # 配置 (已有)
│   └── lifecycle.ts          # 生命周期 (已有)
├── channels/                 # 通道 (已有)
└── index.ts                  # 入口 (需修改)
```

### 3.2 消息流程

```
用户消息
    │
    ▼
┌──────────────┐
│   Channel    │  接收消息
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Gateway    │  统一入口
│   .handle()  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Router    │  路由到 Session Key
│   .route()   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│SessionManager│  获取/创建 Session
│.getOrCreate()│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│AgentRegistry │  获取/创建 Agent
│.getOrCreate()│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Agent     │  处理消息
│   .chat()    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│SimpleMemory  │  保存对话历史
│   .save()    │
└──────────────┘
       │
       ▼
     响应
```

### 3.3 配置示例

```json
{
  "gateway": {
    "maxAgents": 50,
    "agentIdleTimeoutMs": 3600000
  },
  "router": {
    "rules": [],
    "defaultStrategy": "byUser"
  },
  "session": {
    "maxHistoryLength": 50,
    "sessionTtl": 3600000,
    "maxConcurrentSessions": 100
  },
  "memory": {
    "enabled": true,
    "storagePath": "~/.miniclaw/sessions"
  }
}
```

---

## 四、TDD 测试计划

### 4.1 Gateway 测试

```typescript
describe('MiniclawGateway', () => {
  it('应该正确路由消息到 Session');
  it('应该复用已存在的 Session');
  it('应该为新用户创建新 Session');
  it('应该正确管理 Agent 注册表');
  it('应该返回正确的响应');
});
```

### 4.2 Session Key 测试

```typescript
describe('SessionKeyBuilder', () => {
  it('应该构建主 Session Key');
  it('应该构建 CLI Session Key');
  it('应该构建用户 Session Key');
  it('应该构建群组 Session Key');
  it('应该正确解析 Session Key');
});
```

### 4.3 Agent Registry 测试

```typescript
describe('AgentRegistry', () => {
  it('应该创建新 Agent');
  it('应该复用已存在的 Agent');
  it('应该销毁 Agent');
  it('应该清理空闲 Agent');
  it('应该限制最大 Agent 数');
});
```

### 4.4 Memory 测试

```typescript
describe('SimpleMemoryStorage', () => {
  it('应该保存对话历史');
  it('应该加载对话历史');
  it('应该删除对话历史');
  it('应该列出所有 Session');
});

describe('KeywordMemoryStorage', () => {
  it('应该搜索关键词');
  it('应该限制在特定 Session 搜索');
});
```

---

## 五、实施计划

### 5.1 阶段一：Gateway 主类（P0）

| 任务 | 工时 | 优先级 | 状态 |
|------|------|--------|------|
| SessionKeyBuilder 实现 | 0.5h | P0 | ⏳ 待开发 |
| AgentRegistry 实现 | 1h | P0 | ⏳ 待开发 |
| Gateway 实现 | 1.5h | P0 | ⏳ 待开发 |
| 修改入口集成 Gateway | 0.5h | P0 | ⏳ 待开发 |
| 修改 Channel 调用 Gateway | 0.5h | P0 | ⏳ 待开发 |
| 测试 | 1h | P0 | ⏳ 待开发 |

### 5.2 阶段二：记忆系统（P1）

| 任务 | 工时 | 优先级 | 状态 |
|------|------|--------|------|
| SimpleMemoryStorage 实现 | 1h | P1 | ⏳ 待开发 |
| 集成到 Gateway | 0.5h | P1 | ⏳ 待开发 |
| 测试 | 0.5h | P1 | ⏳ 待开发 |

### 5.3 阶段三：关键词搜索（P2）

| 任务 | 工时 | 优先级 | 状态 |
|------|------|--------|------|
| KeywordMemoryStorage 实现 | 1h | P2 | ⏳ 待开发 |
| 测试 | 0.5h | P2 | ⏳ 待开发 |

---

## 六、验收标准

### 6.1 功能验收

- [ ] CLI 通道有独立 Session
- [ ] API 通道按 clientId 隔离
- [ ] Feishu 私聊按用户隔离
- [ ] Feishu 群聊按群组隔离
- [ ] Agent 可以被复用
- [ ] 对话历史可以持久化
- [ ] 重启后对话历史可恢复

### 6.2 测试验收

- [ ] Gateway 测试覆盖率 ≥ 70%
- [ ] SessionKey 测试覆盖率 ≥ 80%
- [ ] AgentRegistry 测试覆盖率 ≥ 80%
- [ ] Memory 测试覆盖率 ≥ 80%
- [ ] 所有测试通过

### 6.3 性能验收

- [ ] Session 创建 < 10ms
- [ ] 消息路由 < 5ms
- [ ] Agent 复用 < 1ms
- [ ] 支持 50+ 并发 Session

---

## 七、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Agent 内存占用大 | OOM | Agent 数量限制 + 空闲清理 |
| 记忆文件过多 | 磁盘占用 | 定期清理过期 Session |
| Session Key 格式变化 | 兼容性问题 | 提供迁移工具 |

---

## 八、优化方向汇总

### 8.1 Gateway 优化方向

**当前：** 简单的消息处理核心
**未来：** 完整的服务器（HTTP/WebSocket/认证/插件）

### 8.2 Router 优化方向

**当前：** 规则列表 + 默认策略
**未来：** Binding 绑定机制（更灵活的配置方式）

### 8.3 记忆系统优化方向

**当前：** 简单持久化
**阶段 2：** 关键词搜索
**阶段 3：** 向量语义搜索（需要 Embedding API）

---

## 九、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-13 | v0.4.0 | 四期需求文档：Gateway 主类 + 记忆系统设计 |
| 2026-03-13 | v0.4.1 | 根据 OpenClaw 源码分析优化：简化 Gateway、Session Key 格式、Agent 注册表模式 |

---

_待确认后执行_