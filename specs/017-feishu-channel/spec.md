# 需求规格: 飞书通道完整实现

## 元数据

| 属性 | 值 |
|------|-----|
| 版本 | 1.0 |
| 创建日期 | 2026-04-17 |
| 状态 | 待实现 |
| 优先级 | P0 |
| 开发模式 | TDD |

---

## 1. 需求分析

### 1.1 背景

miniclaw 飞书通道当前只有 105 行代码，实现约 10%：
- ✅ 基础类结构
- ✅ 配置检查
- ❌ WebSocket/Webhook 连接
- ❌ 消息发送 API
- ❌ 流式输出
- ❌ 群聊话题回复

### 1.2 目标

参考 OpenClaw 飞书扩展，实现 miniclaw 飞书通道核心功能：
1. WebSocket 长连接（飞书事件推送）
2. 消息发送 API（回复用户）
3. 流式输出（打字机效果）
4. 群聊话题回复

**不做**：富文本消息、加密解密、用户白名单（Phase 1 暂不实现）

---

## 2. 技术方案

### 2.1 连接模式

| 模式 | 说明 | OpenClaw 支持 |
|------|------|:------------:|
| WebSocket | 长连接，实时推送 | ✅ |
| Webhook | HTTP回调，需公网 | ✅ |

miniclaw 优先实现 WebSocket 模式（更简单，不需要公网）。

### 2.2 飞书 API

| API | 用途 | 实现难度 |
|-----|------|:-------:|
| 获取 tenant_access_token | 认证 | 低 |
| 发送消息 (POST /im/v1/messages) | 回复 | 中 |
| 更新消息卡片 | 交互 | 中 |
| 获取用户信息 | 显示名称 | 低 |

### 2.3 流式输出

OpenClaw 实现：分块发送，模拟打字机效果。

miniclaw 方案：
```
Agent.streamChat() → yield chunks → 分块发送飞书消息
```

### 2.4 消息去重

飞书可能重复推送同一条消息，需要去重处理。

**方案**：
```typescript
class MessageDeduplicator {
  private seenMessages: Set<string> = new Set();
  private maxSize = 10000;  // 最多缓存 10000 条
  
  isDuplicate(messageId: string): boolean {
    if (this.seenMessages.has(messageId)) {
      return true;  // 已处理过
    }
    this.seenMessages.add(messageId);
    // 超出限制时清理旧消息
    if (this.seenMessages.size > this.maxSize) {
      this.seenMessages.clear();
    }
    return false;
  }
}
```

**测试要点**：
- 首次消息不应被去重
- 重复消息应被过滤
- 达到上限时自动清理

### 2.5 错误处理与重连

WebSocket 连接不稳定，需要处理：

| 场景 | 处理方式 |
|------|----------|
| 连接断开 | 自动重连（指数退避） |
| token 过期 | 刷新 tenant_access_token |
| API 错误 | 记录日志，跳过该消息 |
| 网络超时 | 重试 3 次 |

**重连策略**：
```typescript
const reconnectStrategy = {
  maxRetries: 10,
  initialDelay: 1000,   // 1 秒
  maxDelay: 30000,      // 30 秒
  backoffMultiplier: 2  // 每次翻倍
};
```

**测试要点**：
- 断开后自动重连
- 重连延迟按指数增长
- 超过最大次数后停止尝试

---

## 3. 实现清单

### Phase 1: 基础连接 (P0)

| 任务 | 测试数 | 状态 |
|------|:------:|:----:|
| T1.1 飞书客户端类 | 10 | 待实现 |
| T1.2 WebSocket 连接 | 8 | 待实现 |
| T1.3 事件处理 | 6 | 待实现 |
| T1.4 tenant_access_token | 5 | 待实现 |
| T1.5 消息去重 | 5 | 待实现 |
| T1.6 错误处理与重连 | 6 | 待实现 |

### Phase 2: 消息发送 (P0)

| 任务 | 测试数 | 状态 |
|------|:------:|:----:|
| T2.1 发送文本消息 | 8 | 待实现 |
| T2.2 群聊话题回复 | 5 | 待实现 |

### Phase 3: 流式输出 (P1)

| 任务 | 测试数 | 状态 |
|------|:------:|:----:|
| T3.1 分块发送 | 6 | 待实现 |
| T3.2 打字机效果 | 4 | 待实现 |

---

## 4. 文件结构

```
src/channels/
  ├── feishu.ts           # 飞书通道主类
  ├── feishu-client.ts    # 飞书 API 客户端
  ├── feishu-websocket.ts # WebSocket 连接
  └── feishu-types.ts     # 类型定义

tests/unit/channels/
  ├── feishu.test.ts
  ├── feishu-client.test.ts
  └── feishu-websocket.test.ts
```

---

## 5. 配置扩展

```typescript
interface FeishuConfig {
  appId: string;
  appSecret: string;
  encryptKey?: string;
  verificationToken?: string;
  
  // 新增
  connectionMode?: 'websocket' | 'webhook';
  webhookPort?: number;
  webhookPath?: string;
  
  // 流式输出
  streamingEnabled?: boolean;
  chunkDelayMs?: number;
  
  // 群聊配置
  groupSessionMode?: 'group' | 'group_sender' | 'group_topic';
}
```

---

## 6. TDD 开发流程

### 步骤 1：先写测试（红色）

创建测试文件，定义期望行为：

```typescript
describe('FeishuClient', () => {
  it('should get tenant_access_token', async () => {
    const client = new FeishuClient(config);
    const token = await client.getAccessToken();
    expect(token).toBeDefined();
  });
  
  it('should send text message', async () => {
    const client = new FeishuClient(config);
    const result = await client.sendMessage({
      receiveId: 'ou_xxx',
      msgType: 'text',
      content: 'Hello'
    });
    expect(result.messageId).toBeDefined();
  });
});
```

### 步骤 2：写实现（绿色）

实现功能，让测试通过。

### 步骤 3：重构

优化代码结构。

---

## 7. 验收标准

| 标准 | 要求 |
|------|------|
| 测试覆盖率 | >= 80% |
| 功能完整性 | Phase 1-2 必须完成 |
| 文档 | README 更新启动方式 |

---

## 8. 启动方式

```bash
# 启动飞书通道
cd /root/job/miniclaw
npm start feishu

# 或启动全部通道
npm start all
```