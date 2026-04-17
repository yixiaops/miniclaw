# Implementation Plan: 飞书通道 MVP

**Branch**: `017-feishu-channel` | **Date**: 2026-04-17 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-feishu-channel/spec.md`

## Summary

实现 miniclaw 飞书通道核心功能：WebSocket 长连接接收消息 + HTTP API 发送回复。参考 OpenClaw 飞书扩展，采用 TypeScript + TDD 开发模式。

## Technical Context

**Language/Version**: TypeScript 5.9 / Node.js 24.14.0  
**Primary Dependencies**: @larksuiteoapi/node-sdk（飞书官方 SDK）  
**Storage**: N/A（无持久化，内存去重）  
**Testing**: Vitest 4.0  
**Target Platform**: Linux server  
**Project Type**: CLI/service  
**Performance Goals**: 响应时间 < 3s，支持并发消息  
**Constraints**: 内存去重缓存 < 10000 条  
**Scale/Scope**: 单用户 MVP

## Constitution Check

*GATE: Must pass before Phase 0 research.*

| 检查项 | 状态 | 说明 |
|--------|:----:|------|
| 测试优先 | ✅ | TDD 模式，先写测试 |
| 代码简洁 | ✅ | 单文件模块，无复杂架构 |
| 无冗余依赖 | ✅ | 只用飞书 SDK |

## Project Structure

### Documentation

```text
specs/017-feishu-channel/
├── spec.md              # 功能规格
├── plan.md              # 本文件
├── tasks.md             # 任务拆分（待生成）
```

### Source Code

```text
src/channels/
├── feishu.ts              # 飞书通道主类（现有）
├── feishu-client.ts       # 飞书 API 客户端（新增）
├── feishu-websocket.ts    # WebSocket 连接管理（新增）
├── feishu-dedup.ts        # 消息去重（新增）
└── feishu-types.ts        # 类型定义（新增）

tests/unit/channels/
├── feishu-client.test.ts
├── feishu-websocket.test.ts
├── feishu-dedup.test.ts
└── feishu.test.ts
```

---

## Phase 1: 基础连接 (P0)

### T1.1 飞书客户端类

**文件**: `src/channels/feishu-client.ts`

**职责**:
- 获取 tenant_access_token
- 发送消息 API
- 错误处理

**关键接口**:
```typescript
export class FeishuClient {
  constructor(config: FeishuConfig);
  
  // 获取 access token（自动缓存、刷新）
  async getAccessToken(): Promise<string>;
  
  // 发送文本消息
  async sendMessage(params: {
    receiveId: string;
    msgType: 'text';
    content: string;
    replyToMessageId?: string;
  }): Promise<{ messageId: string }>;
}
```

**测试要点**:
- token 获取成功
- token 过期自动刷新
- 发送消息成功
- API 错误处理

---

### T1.2 WebSocket 连接

**文件**: `src/channels/feishu-websocket.ts`

**职责**:
- WebSocket 长连接
- 消息解析
- 重连机制

**关键接口**:
```typescript
export class FeishuWebSocket {
  constructor(config: FeishuConfig, client: FeishuClient);
  
  // 启动连接
  async start(): Promise<void>;
  
  // 停止连接
  stop(): void;
  
  // 消息回调
  onMessage(callback: (event: FeishuEvent) => void): void;
  
  // 连接状态
  isConnected(): boolean;
}
```

**重连策略**:
```typescript
const reconnectConfig = {
  maxRetries: 10,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2
};
```

**测试要点**:
- 连接成功
- 消息解析正确
- 断开后自动重连
- 重连延迟指数增长

---

### T1.3 事件处理

**关键事件类型**:
```typescript
interface FeishuEvent {
  type: 'im.message.receive_v1';
  data: {
    messageId: string;
    chatId: string;
    chatType: 'p2p' | 'group';
    senderId: string;
    content: string;
  };
}
```

**处理流程**:
```
WebSocket 收到事件 → 解析 JSON → 去重检查 → 调用 Gateway.handleMessage()
```

---

### T1.4 tenant_access_token

**API**: `POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal`

**请求**:
```json
{
  "app_id": "cli_xxx",
  "app_secret": "xxx"
}
```

**响应**:
```json
{
  "tenant_access_token": "t-xxx",
  "expire": 7200
}
```

**缓存策略**:
- 内存缓存 token
- 过期前 5 分钟自动刷新
- 失败时重试 3 次

---

### T1.5 消息去重

**文件**: `src/channels/feishu-dedup.ts`

**职责**:
- 基于 messageId 去重
- 内存缓存，达到上限清理

**接口**:
```typescript
export class MessageDeduplicator {
  private seenMessages: Set<string>;
  private maxSize = 10000;
  
  isDuplicate(messageId: string): boolean;
  clear(): void;
}
```

**测试要点**:
- 首次消息不去重
- 重复消息被过滤
- 达到上限自动清理

---

### T1.6 错误处理与重连

**场景处理**:

| 场景 | 处理 |
|------|------|
| WebSocket 断开 | 自动重连（指数退避） |
| token 过期 | 刷新 token |
| API 错误 | 记录日志，跳过该消息 |
| 网络超时 | 重试 3 次 |

---

## Phase 2: 消息发送 (P0)

### T2.1 发送文本消息

**API**: `POST https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=user_id`

**请求**:
```json
{
  "receive_id": "ou_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"回复内容\"}"
}
```

**测试要点**:
- 私聊消息发送
- 群聊消息发送
- 话题回复（reply_to_message_id）

---

### T2.2 群聊话题回复

**群聊场景**:
- `chatType === 'group'`
- 需要用 `root_id`（话题根消息）回复

**处理逻辑**:
```typescript
if (chatType === 'group' && rootId) {
  // 话题回复
  replyParams.replyToMessageId = rootId;
}
```

---

## Phase 3: 流式输出 (P1)

### T3.1 分块发送

**原理**: Agent.streamChat() 返回 AsyncGenerator，分块发送

**实现**:
```typescript
for await (const chunk of agent.streamChat(message)) {
  if (chunk.type === 'text') {
    // 累积文本
    accumulated += chunk.content;
    
    // 每 500 字符发送一次
    if (accumulated.length >= 500) {
      await client.sendMessage({
        receiveId,
        msgType: 'text',
        content: accumulated
      });
      accumulated = '';
    }
  }
}
```

---

### T3.2 打字机效果

**配置**:
```typescript
const streamConfig = {
  chunkDelayMs: 100,  // 每块延迟 100ms
  minChunkSize: 50    // 最小发送块
};
```

---

## 验收标准

| 标准 | 要求 |
|------|------|
| 测试覆盖率 | >= 70% |
| Phase 1-2 | 必须完成 |
| Phase 3 | 可选 |
| 启动测试 | `npm run start:feishu` 能连接飞书 |

---

## 技术依赖

### 飞书 SDK

```bash
npm install @larksuiteoapi/node-sdk
```

### WebSocket

使用 Node.js 内置 WebSocket（无需额外依赖）

---

## 风险与对策

| 风险 | 对策 |
|------|------|
| 飞书 API 变化 | 参考 OpenClaw 最新实现 |
| WebSocket 不稳定 | 重连机制 |
| token 过期处理 | 自动刷新 |