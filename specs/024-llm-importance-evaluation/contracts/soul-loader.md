# SoulLoader Contract

**Module**: `src/soul/loader.ts`
**Version**: 1.0.0
**Date**: 2026-04-21

## Overview

SoulLoader 负责：
1. 加载 soul.md 文件
2. 提供默认 soul 内容
3. 验证 soul 内容包含必需规则

---

## Interface

### Constructor

```typescript
class SoulLoader {
  constructor(config?: Partial<SoulConfig>);
}
```

**Parameters**:
- `config`: 可选配置，包含 filePath、enabled

### load()

```typescript
load(): Promise<string>;
```

**Output**:
- soul.md 文件内容字符串

**Behavior**:
1. 检查文件是否存在
2. 如果不存在，返回 DEFAULT_SOUL
3. 读取文件内容
4. 返回内容字符串

**Examples**:

```typescript
// 文件存在
const loader = new SoulLoader({ filePath: '~/.miniclaw/soul.md' });
await loader.load();
// → "# Miniclaw Soul\n## AI 人格\n..."

// 文件不存在，返回默认
const loader = new SoulLoader({ filePath: '/nonexistent/soul.md' });
await loader.load();
// → DEFAULT_SOUL 内容
```

### getDefault()

```typescript
getDefault(): string;
```

**Output**:
- 默认 soul 内容字符串

---

## Default Soul Content

```markdown
# Miniclaw Soul

## AI 人格
我是 Miniclaw，一个专业、可靠的 AI 助手。

## 爱好
帮助用户解决问题，记录重要信息。

## 核心规则
**每次回复必须在末尾包含 [IMPORTANCE:X] 标记**

X 为 0-1 的数值，表示当前对话的重要性：
- 0.7-0.9: 包含个人信息（姓名、偏好、联系方式）
- 0.6-0.8: 重要决策或结论
- 0.4-0.6: 一般对话内容
- 0.1-0.3: 单问候或闲聊
```

---

## Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| filePath | string | `~/.miniclaw/soul.md` | soul 文件路径 |
| enabled | boolean | true | 是否启用 soul 注入 |

---

## Dependencies

- Node.js fs 模块
- 路径处理（expandHome）

---

## Testing Requirements

- 单元测试覆盖率 ≥ 80%
- 文件存在/不存在场景测试
- 默认内容测试