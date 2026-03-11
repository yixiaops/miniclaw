# Miniclaw 三期需求文档 (v0.3)

> 引入网关架构，实现路由和 Session 管理

## 一、背景

### 1.1 当前架构

```
┌─────────────────────────────────────────┐
│              Miniclaw 单进程              │
├─────────────────────────────────────────┤
│  CLI  │  API  │  Web  │  Feishu  (通道)   │
│    \    |    /    \    /                  │
│     \   |   /      \  /                   │
│      ┌──┴──┐                            │
│      │Agent│  (单一 Agent)               │
│      └─────┘                            │
└─────────────────────────────────────────┘
```

**问题**：
- 所有通道共享一个 Agent，无法隔离
- 无 Session 管理，对话历史混乱
- 无路由机制，无法区分不同用户/来源

### 1.2 目标架构

```
┌─────────────────────────────────────────────────────┐
│                    Miniclaw Gateway                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│   │   CLI   │  │   API   │  │  Feishu │  (通道层)  │
│   └────┬────┘  └────┬────┘  └────┬────┘            │
│        │            │            │                  │
│        └────────────┼────────────┘                  │
│                     │                               │
│              ┌──────┴──────┐                        │
│              │   Router    │  (路由层)              │
│              └──────┬──────┘                        │
│                     │                               │
│              ┌──────┴──────┐                        │
│              │Session Manager│ (会话层)            │
│              └──────┬──────┘                        │
│                     │                               │
│        ┌────────────┼────────────┐                  │
│        │            │            │                  │
│   ┌────┴────┐  ┌────┴────┐  ┌────┴────┐            │
│   │ Agent 1 │  │ Agent 2 │  │ Agent N │  (Agent池) │
│   └─────────┘  └─────────┘  └─────────┘            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 二、核心功能

### 2.1 网关 (Gateway)

**职责**：
- 统一入口，管理所有通道
- 生命周期管理（启动/停止）
- 配置管理
- 日志和监控

**接口设计**：

```typescript
interface Gateway {
  /** 启动网关 */
  start(): Promise<void>;
  /** 停止网关 */
  stop(): Promise<void>;
  /** 注册通道 */
  registerChannel(channel: Channel): void;
  /** 获取状态 */
  getStatus(): GatewayStatus;
}
```

### 2.2 路由器 (Router)

**职责**：
- 根据来源（通道、用户、群组）路由到对应 Session
- 支持路由规则配置
- 支持默认路由

**路由规则**：

```typescript
interface RouteRule {
  /** 规则 ID */
  id: string;
  /** 匹配条件 */
  match: {
    channel?: string;      // 通道类型：cli、api、feishu
    userId?: string;       // 用户 ID
    groupId?: string;      // 群组 ID
    pattern?: RegExp;      // 消息模式匹配
  };
  /** 目标 Session ID */
  targetSessionId: string;
  /** 优先级（数字越大优先级越高） */
  priority: number;
}
```

**路由策略**：

| 来源 | 默认路由 | 说明 |
|------|----------|------|
| CLI | `session-cli` | 独立 Session |
| API | `session-api-{clientId}` | 按 clientId 隔离 |
| Feishu 私聊 | `session-{userId}` | 按用户隔离 |
| Feishu 群聊 | `session-{groupId}` | 按群组隔离 |

### 2.3 Session 管理器 (SessionManager)

**职责**：
- 创建/销毁 Session
- Session 持久化
- Session 过期清理
- 对话历史管理

**Session 定义**：

```typescript
interface Session {
  /** Session ID */
  id: string;
  /** 关联的 Agent */
  agentId: string;
  /** 创建时间 */
  createdAt: Date;
  /** 最后活跃时间 */
  lastActiveAt: Date;
  /** 对话历史 */
  messages: Message[];
  /** 元数据 */
  metadata: {
    channel: string;
    userId?: string;
    groupId?: string;
  };
}
```

**Session 配置**：

```typescript
interface SessionConfig {
  /** 最大历史消息数 */
  maxHistoryLength: number;
  /** Session 过期时间（毫秒） */
  sessionTtl: number;
  /** 最大并发 Session 数 */
  maxConcurrentSessions: number;
  /** 持久化存储 */
  persistence: 'memory' | 'sqlite' | 'file';
}
```

### 2.4 Agent 池 (AgentPool)

**职责**：
- 管理 Agent 实例
- Agent 复用
- 资源限制

**实现**：

```typescript
class AgentPool {
  private agents: Map<string, MiniclawAgent> = new Map();
  private config: Config;
  
  /** 获取或创建 Agent */
  getOrCreate(agentId: string): MiniclawAgent;
  
  /** 销毁 Agent */
  destroy(agentId: string): void;
  
  /** 获取所有 Agent */
  getAll(): MiniclawAgent[];
}
```

---

## 三、技术设计

### 3.1 目录结构

```
src/
├── core/
│   ├── gateway/          # 网关模块
│   │   ├── index.ts      # Gateway 主类
│   │   ├── router.ts     # 路由器
│   │   ├── session.ts    # Session 管理
│   │   └── agent-pool.ts # Agent 池
│   ├── agent/            # Agent（已有）
│   ├── lifecycle.ts      # 生命周期（已有）
│   └── config.ts         # 配置（已有）
├── channels/             # 通道（已有）
├── storage/              # 存储层
│   ├── memory.ts         # 内存存储
│   ├── sqlite.ts         # SQLite 存储
│   └── file.ts           # 文件存储
└── index.ts              # 入口
```

### 3.2 消息流程

```
用户消息
    │
    ▼
┌──────────┐
│  Channel │  接收消息
└────┬─────┘
     │
     ▼
┌──────────┐
│  Router  │  路由到 Session
└────┬─────┘
     │
     ▼
┌─────────────┐
│SessionManager│  获取/创建 Session
└─────┬───────┘
      │
      ▼
┌──────────┐
│  Agent   │  处理消息
└────┬─────┘
     │
     ▼
   响应
```

### 3.3 配置示例

```json
{
  "gateway": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "router": {
    "rules": [
      {
        "id": "feishu-group-1",
        "match": { "channel": "feishu", "groupId": "oc_xxx" },
        "targetSessionId": "session-group-1",
        "priority": 10
      }
    ],
    "defaultStrategy": "byUser"
  },
  "session": {
    "maxHistoryLength": 50,
    "sessionTtl": 3600000,
    "maxConcurrentSessions": 100,
    "persistence": "sqlite"
  },
  "channels": {
    "cli": { "enabled": true },
    "api": { "enabled": true, "port": 3001 },
    "feishu": { "enabled": true, "appId": "xxx", "appSecret": "xxx" }
  }
}
```

---

## 四、接口设计

### 4.1 Gateway API

```typescript
// src/core/gateway/index.ts

export class MiniclawGateway {
  constructor(config: GatewayConfig);
  
  /** 启动网关 */
  async start(): Promise<void>;
  
  /** 停止网关 */
  async stop(): Promise<void>;
  
  /** 处理消息（由通道调用） */
  async handleMessage(ctx: MessageContext): Promise<Response>;
  
  /** 获取 Session */
  getSession(sessionId: string): Session | undefined;
  
  /** 获取状态 */
  getStatus(): GatewayStatus;
}
```

### 4.2 Router API

```typescript
// src/core/gateway/router.ts

export class Router {
  constructor(config: RouterConfig);
  
  /** 添加路由规则 */
  addRule(rule: RouteRule): void;
  
  /** 移除路由规则 */
  removeRule(ruleId: string): void;
  
  /** 路由消息到 Session */
  route(ctx: MessageContext): string;  // 返回 Session ID
}
```

### 4.3 SessionManager API

```typescript
// src/core/gateway/session.ts

export class SessionManager {
  constructor(config: SessionConfig);
  
  /** 获取或创建 Session */
  getOrCreate(sessionId: string, metadata?: SessionMetadata): Session;
  
  /** 获取 Session */
  get(sessionId: string): Session | undefined;
  
  /** 销毁 Session */
  destroy(sessionId: string): void;
  
  /** 清理过期 Session */
  cleanup(): void;
  
  /** 持久化 Session */
  persist(session: Session): Promise<void>;
  
  /** 恢复 Session */
  restore(sessionId: string): Promise<Session | undefined>;
}
```

---

## 五、TDD 测试计划

### 5.1 Router 测试

```typescript
describe('Router', () => {
  it('应该按用户 ID 路由');
  it('应该按群组 ID 路由');
  it('应该按通道类型路由');
  it('应该支持自定义路由规则');
  it('应该按优先级匹配规则');
  it('应该支持默认路由策略');
});
```

### 5.2 SessionManager 测试

```typescript
describe('SessionManager', () => {
  it('应该创建新 Session');
  it('应该获取已存在的 Session');
  it('应该更新 Session 最后活跃时间');
  it('应该销毁 Session');
  it('应该清理过期 Session');
  it('应该持久化 Session');
  it('应该恢复 Session');
  it('应该限制最大 Session 数');
});
```

### 5.3 AgentPool 测试

```typescript
describe('AgentPool', () => {
  it('应该创建 Agent');
  it('应该复用已存在的 Agent');
  it('应该销毁 Agent');
  it('应该限制最大 Agent 数');
});
```

### 5.4 Gateway 测试

```typescript
describe('MiniclawGateway', () => {
  it('应该启动网关');
  it('应该停止网关');
  it('应该处理消息并返回响应');
  it('应该正确路由消息');
  it('应该管理多个 Session');
});
```

---

## 六、实施计划

### 6.1 阶段一：核心组件

| 任务 | 工时 | 优先级 |
|------|------|--------|
| SessionManager 实现 | 2h | P0 |
| SessionManager 测试 | 1h | P0 |
| Router 实现 | 2h | P0 |
| Router 测试 | 1h | P0 |

### 6.2 阶段二：集成

| 任务 | 工时 | 优先级 |
|------|------|--------|
| AgentPool 实现 | 1h | P0 |
| Gateway 主类实现 | 2h | P0 |
| Gateway 测试 | 1h | P0 |
| 集成测试 | 1h | P1 |

### 6.3 阶段三：持久化

| 任务 | 工时 | 优先级 |
|------|------|--------|
| 内存存储实现 | 1h | P1 |
| SQLite 存储实现 | 2h | P2 |
| 文件存储实现 | 1h | P2 |

---

## 七、验收标准

### 7.1 功能验收

- [ ] CLI 通道有独立 Session
- [ ] API 通道按 clientId 隔离
- [ ] Feishu 私聊按用户隔离
- [ ] Feishu 群聊按群组隔离
- [ ] 支持自定义路由规则
- [ ] Session 可以持久化和恢复

### 7.2 测试验收

- [ ] Router 测试覆盖率 ≥ 80%
- [ ] SessionManager 测试覆盖率 ≥ 80%
- [ ] Gateway 测试覆盖率 ≥ 70%
- [ ] 所有测试通过

### 7.3 性能验收

- [ ] Session 创建 < 10ms
- [ ] 消息路由 < 5ms
- [ ] 支持 100+ 并发 Session

---

## 八、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| Session 内存占用过大 | OOM | 定期清理 + 持久化 |
| 路由规则冲突 | 消息路由错误 | 优先级机制 + 规则校验 |
| Agent 资源泄漏 | 内存泄漏 | Agent 池限制 + 销毁机制 |

---

## 九、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-11 | v0.3.0 | 三期需求文档初稿：网关架构设计 |

---

_待确认后执行_