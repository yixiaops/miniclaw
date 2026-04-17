# Tasks: 飞书通道 MVP

**Branch**: `017-feishu-channel` | **Date**: 2026-04-17
**Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

---

## Phase 1: 基础连接 (P0)

### T1.1 飞书客户端类

**依赖**: 无

**文件**: 
- `src/channels/feishu-client.ts` (实现)
- `tests/unit/channels/feishu-client.test.ts` (测试)

**测试要点**:
```typescript
describe('FeishuClient', () => {
  // 获取 token
  it('should get tenant_access_token', async () => {
    const client = new FeishuClient(config);
    const token = await client.getAccessToken();
    expect(token).toMatch(/^t-/);
  });
  
  // token 缓存
  it('should cache token and refresh before expiry', async () => {
    // 模拟 token 过期前 5 分钟
    // 验证自动刷新
  });
  
  // 发送消息
  it('should send text message', async () => {
    const result = await client.sendMessage({
      receiveId: 'ou_xxx',
      msgType: 'text',
      content: 'test'
    });
    expect(result.messageId).toBeDefined();
  });
  
  // 错误处理
  it('should handle API errors', async () => {
    // 模拟 API 返回错误
    // 验证异常抛出
  });
});
```

**实现步骤**:
1. 定义 `FeishuConfig` 类型
2. 实现 `getAccessToken()`（调用飞书 API）
3. 实现 token 缓存机制
4. 实现 `sendMessage()`
5. 添加错误处理

**验收**: 测试覆盖率 >= 70%

---

### T1.2 WebSocket 连接

**依赖**: T1.1 (需要 FeishuClient)

**文件**:
- `src/channels/feishu-websocket.ts` (实现)
- `tests/unit/channels/feishu-websocket.test.ts` (测试)

**测试要点**:
```typescript
describe('FeishuWebSocket', () => {
  // 连接成功
  it('should connect to WebSocket', async () => {
    const ws = new FeishuWebSocket(config, client);
    await ws.start();
    expect(ws.isConnected()).toBe(true);
  });
  
  // 消息解析
  it('should parse incoming message', async () => {
    // 模拟 WebSocket 消息
    // 验证事件解析正确
  });
  
  // 重连机制
  it('should reconnect with exponential backoff', async () => {
    // 模拟断开
    // 验证重连延迟: 1s -> 2s -> 4s -> ...
  });
  
  // 停止连接
  it('should stop cleanly', async () => {
    ws.stop();
    expect(ws.isConnected()).toBe(false);
  });
});
```

**实现步骤**:
1. 使用飞书 SDK WebSocket API
2. 实现 `start()` 连接
3. 实现消息解析
4. 实现重连逻辑（指数退避）
5. 实现 `stop()` 清理

**验收**: 重连测试通过

---

### T1.3 事件处理

**依赖**: T1.2 (需要 FeishuWebSocket)

**文件**: `src/channels/feishu.ts` (更新现有文件)

**测试要点**:
```typescript
describe('FeishuChannel event handling', () => {
  // 私聊消息
  it('should handle private chat message', async () => {
    // 模拟 im.message.receive_v1 事件
    // 验证调用 Gateway.handleMessage()
  });
  
  // 群聊消息
  it('should handle group chat message', async () => {
    // 模拟群聊事件
    // 验证 chatType 正确识别
  });
});
```

**实现步骤**:
1. 定义 `FeishuEvent` 类型
2. 在 WebSocket 消息回调中解析事件
3. 调用 `Gateway.handleMessage()`
4. 区分私聊/群聊

**验收**: 事件解析正确

---

### T1.4 tenant_access_token

**依赖**: T1.1 (已包含)

**说明**: token 获取逻辑已在 T1.1 实现，此任务验证细节。

**测试要点**:
```typescript
describe('Token management', () => {
  // 刷新机制
  it('should refresh token 5 minutes before expiry', async () => {
    // 模拟 token 2 小时有效期
    // 在 1小时55分钟时触发刷新
  });
  
  // 并发安全
  it('should handle concurrent token requests', async () => {
    // 多个并发请求
    // 验证只调用一次 API
  });
});
```

---

### T1.5 消息去重

**依赖**: 无（独立组件）

**文件**:
- `src/channels/feishu-dedup.ts` (实现)
- `tests/unit/channels/feishu-dedup.test.ts` (测试)

**测试要点**:
```typescript
describe('MessageDeduplicator', () => {
  // 首次消息
  it('should not deduplicate first message', () => {
    const dedup = new MessageDeduplicator();
    expect(dedup.isDuplicate('msg-1')).toBe(false);
  });
  
  // 重复消息
  it('should deduplicate repeated message', () => {
    const dedup = new MessageDeduplicator();
    dedup.isDuplicate('msg-1'); // 首次
    expect(dedup.isDuplicate('msg-1')).toBe(true); // 重复
  });
  
  // 缓存上限
  it('should clear cache when reaching maxSize', () => {
    const dedup = new MessageDeduplicator({ maxSize: 100 });
    // 添加 100 条消息
    // 验证自动清理
  });
});
```

**实现步骤**:
1. 使用 `Set<string>` 存储 messageId
2. 实现 `isDuplicate(messageId)`
3. 实现 maxSize 限制和清理
4. 可选：TTL 过期清理

**验收**: 去重测试通过

---

### T1.6 错误处理与重连

**依赖**: T1.2 (已包含重连逻辑)

**说明**: 补充各种错误场景处理。

**测试要点**:
```typescript
describe('Error handling', () => {
  // WebSocket 断开
  it('should reconnect on WebSocket close', async () => {
    // 模拟断开
    // 验证重连
  });
  
  // token 过期
  it('should refresh token on expiry error', async () => {
    // 模拟 API 返回 token 过期
    // 验证刷新后重试
  });
  
  // 网络超时
  it('should retry on timeout', async () => {
    // 模拟超时
    // 验证重试 3 次
  });
});
```

---

## Phase 2: 消息发送 (P0)

### T2.1 发送文本消息

**依赖**: T1.1 (FeishuClient)

**文件**: `src/channels/feishu-client.ts` (扩展)

**测试要点**:
```typescript
describe('Send message', () => {
  // 私聊发送
  it('should send message to private chat', async () => {
    const result = await client.sendMessage({
      receiveId: 'ou_xxx',
      msgType: 'text',
      content: 'hello'
    });
    expect(result.messageId).toBeDefined();
  });
  
  // 群聊发送
  it('should send message to group chat', async () => {
    const result = await client.sendMessage({
      receiveId: 'oc_xxx',
      msgType: 'text',
      content: 'hello'
    });
    expect(result.messageId).toBeDefined();
  });
});
```

---

### T2.2 群聊话题回复

**依赖**: T2.1

**说明**: 群聊话题场景特殊处理。

**测试要点**:
```typescript
describe('Group chat topic reply', () => {
  // 话题回复
  it('should reply to topic thread', async () => {
    // 模拟群聊话题消息
    // 验证 reply_to_message_id 使用 root_id
  });
});
```

**实现步骤**:
1. 检测 `chatType === 'group'`
2. 提取 `root_id`（话题根消息）
3. 设置 `reply_to_message_id = root_id`

---

## Phase 3: 流式输出 (P1)

### T3.1 分块发送

**依赖**: Phase 1 + 2 完成

**文件**: `src/channels/feishu.ts` (扩展)

**测试要点**:
```typescript
describe('Streaming output', () => {
  // 分块发送
  it('should send message in chunks', async () => {
    // 模拟长文本 (>500 字符)
    // 验证分多次发送
  });
});
```

---

### T3.2 打字机效果

**依赖**: T3.1

**说明**: 添加延迟效果。

**测试要点**:
```typescript
describe('Typewriter effect', () => {
  // 延迟发送
  it('should delay between chunks', async () => {
    // 验证每块间隔 100ms
  });
});
```

---

## 任务依赖图

```
T1.1 (飞书客户端) ──┬── T1.2 (WebSocket)
                   │
                   ├── T1.3 (事件处理)
                   │
                   └── T2.1 (发送消息) ── T2.2 (群聊话题)

T1.5 (消息去重) ────── T1.3 (集成)

T1.2 + T1.1 ──────── T1.6 (错误处理)

Phase 1+2 ─────────── T3.1 (分块) ── T3.2 (打字机)
```

---

## 开发顺序

| 序号 | 任务 | 优先级 | 预估时间 |
|:----:|------|:------:|:--------:|
| 1 | T1.5 消息去重 | P0 | 30min |
| 2 | T1.1 飞书客户端 | P0 | 1h |
| 3 | T1.2 WebSocket | P0 | 1h |
| 4 | T1.3 事件处理 | P0 | 30min |
| 5 | T1.6 错误处理 | P0 | 30min |
| 6 | T2.1 发送消息 | P0 | 30min |
| 7 | T2.2 群聊话题 | P0 | 20min |
| 8 | T3.1 分块发送 | P1 | 30min |
| 9 | T3.2 打字机效果 | P1 | 20min |

**总计**: Phase 1-2 约 4h，Phase 3 约 1h

---

## 验收标准

- [ ] 所有测试通过
- [ ] 测试覆盖率 >= 70%
- [ ] `npm run start:feishu` 能连接飞书
- [ ] 私聊消息能正确接收和回复