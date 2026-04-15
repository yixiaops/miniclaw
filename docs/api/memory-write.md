# Memory Write API 文档

## 概述

`memory_write` 工具用于将记忆内容写入存储系统，支持去重、敏感信息检测等功能。

---

## API

### MemoryWriteTool

```typescript
import { MemoryWriteTool } from './memory/tools/write.js';

const tool = new MemoryWriteTool(
  store,               // MemoryStore 实例
  deduplicationChecker, // DeduplicationChecker 实例
  sensitiveDetector    // SensitiveDetector 实例
);
```

### execute(params)

执行记忆写入操作。

**参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | string | ✅ | 记忆内容 |
| `type` | 'short-term' \| 'long-term' | ✅ | 记忆类型 |
| `metadata` | MemoryMetadata | ❌ | 元数据（sessionId, importance, tags 等） |
| `force` | boolean | ❌ | 强制写入，跳过去重检查 |

**返回值：**

```typescript
interface WriteResult {
  status: 'created' | 'updated' | 'skipped' | 'error';
  id?: string;      // 记忆 ID（created/updated 时）
  reason?: string;  // 原因（skipped/error 时）
}
```

---

## 使用示例

### 基本写入

```typescript
const result = await tool.execute({
  content: 'User prefers dark mode',
  type: 'long-term'
});

// result.status = 'created'
// result.id = 'memory-xxx'
```

### 带元数据写入

```typescript
const result = await tool.execute({
  content: 'User session context',
  type: 'short-term',
  metadata: {
    sessionId: 'session-123',
    importance: 0.8,
    tags: ['context', 'session']
  }
});
```

### 强制更新

```typescript
// 先写入
await tool.execute({ content: 'Original', type: 'long-term' });

// 强制更新相同内容
const result = await tool.execute({
  content: 'Original',
  type: 'long-term',
  force: true
});

// result.status = 'updated'
```

---

## 行为说明

### 1. 敏感信息检测

写入前自动检测敏感信息，包括：

- 密码（password）
- API Key（api_key, sk-xxx）
- Token（bearer token, JWT）
- AWS Key（AKIAxxx）
- Secret Key
- SSH Key
- 数据库连接字符串
- 信用卡号

检测到敏感信息时返回 `skipped`：

```typescript
const result = await tool.execute({
  content: 'My password is secret123',
  type: 'long-term'
});

// result.status = 'skipped'
// result.reason = '包含敏感信息：包含密码信息（检测到 password 模式）'
```

### 2. 去重检查

写入前自动检查内容是否重复：

- 精确匹配：相同内容直接跳过
- 语义相似：相似度 ≥ 0.95 时跳过

```typescript
// 先写入
await tool.execute({ content: 'User prefers Python', type: 'long-term' });

// 再次写入相同内容
const result = await tool.execute({
  content: 'User prefers Python',
  type: 'long-term'
});

// result.status = 'skipped'
// result.reason = '内容重复，已跳过'
```

### 3. 参数验证

自动验证必填参数：

```typescript
const result = await tool.execute({
  content: '',
  type: 'long-term'
});

// result.status = 'error'
// result.reason = 'content 参数不能为空'
```

---

## 统计信息

### getStats()

获取写入统计：

```typescript
const stats = tool.getStats();

// {
//   total: 10,    // 总写入次数
//   created: 7,   // 创建次数
//   updated: 1,   // 更新次数
//   skipped: 2,   // 跳过次数
//   errors: 0     // 错误次数
// }
```

### resetStats()

重置统计信息：

```typescript
tool.resetStats();
```

---

## 相关模块

- **MemoryStore**: 记忆存储服务
- **EmbeddingService**: 嵌入向量服务
- **DeduplicationChecker**: 去重检查器
- **SensitiveDetector**: 敏感信息检测器

---

## 最佳实践

1. **短期记忆**: 使用 `short-term` 类型，设置 TTL
2. **长期记忆**: 使用 `long-term` 类型，设置 importance
3. **批量写入**: 先检查去重，避免重复
4. **敏感内容**: 确保内容不含敏感信息

---

*文档版本: 1.0.0 | 更新时间: 2026-04-14*