# Research: LLM Importance Evaluation

**Date**: 2026-04-21
**Feature**: 024-llm-importance-evaluation

## Overview

本文档记录 LLM 动态评估消息重要性的技术研究和设计决策。

---

## 1. Importance 标记格式选择

### Decision
采用 `[IMPORTANCE:X]` 格式，其中 X 为 0-1 的数值，位于 LLM 回复末尾。

### Rationale
- 格式简单明确，易于解析
- 方括号标记在文本中易于识别，不易与正常文本混淆
- 数值范围 0-1 符合现有 importance 字段设计
- 位于末尾确保完整回复后再评估

### Alternatives Considered
- **JSON 格式**: `{ "importance": 0.7 }` - 太显眼，可能影响用户体验，解析复杂度增加
- **XML 格式**: `<importance>0.7</importance>` - 同样显眼，不符合 AI 助手对话风格
- **自然语言**: "这条消息重要性为高" - 解析困难，不确定性高
- **隐藏在 metadata**: 需要 LLM 输出结构化数据，增加复杂度

---

## 2. Importance 解析策略

### Decision
使用正则表达式解析，优先级：最后一个 `[IMPORTANCE:X]` 标记。

### Rationale
- 正则表达式性能高，延迟 < 1ms
- 取最后一个标记避免中间误插入
- 边界处理：超出范围 clamp 到 0-1

### Implementation Pattern

```typescript
// 解析器实现
const IMPORTANCE_REGEX = /\[IMPORTANCE:([0-9.]+)\]/g;

function parseImportance(text: string): number | null {
  const matches = text.matchAll(IMPORTANCE_REGEX);
  const lastMatch = Array.from(matches).pop();

  if (!lastMatch) return null;

  const value = parseFloat(lastMatch[1]);
  return Math.max(0, Math.min(1, value)); // clamp to 0-1
}

// 剥离标记
function stripImportanceMarker(text: string): string {
  return text.replace(IMPORTANCE_REGEX, '').trim();
}
```

### Alternatives Considered
- **只取第一个标记**: 可能被用户模仿，不可靠
- **取所有标记的平均值**: 增加复杂度，无明显收益
- **使用状态机解析**: 正则已足够，无需复杂状态机

---

## 3. System Prompt 注入策略

### Decision
在 soul.md 文件中定义 importance 评估规则，加载后注入到 Agent 的 system prompt 末尾。

### Rationale
- soul.md 作为 AI 人格文件，语义清晰
- 用户可自定义修改评估规则
- 与现有 skill 注入机制一致（注入到 system prompt）

### soul.md 内容结构

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
- 0.1-0.3: 简单问候或闲聊

## 其他规则
- 保持简洁回复
- 不确定的先询问
```

### Alternatives Considered
- **硬编码在 DEFAULT_SYSTEM_PROMPT**: 不灵活，用户无法自定义
- **作为独立配置文件**: 与 soul 概念分离，语义不清
- **通过 API 参数传递**: 增加接口复杂度

---

## 4. AutoMemoryWriter 改造策略

### Decision
修改 `writeConversation` 方法接收可选的 importance 参数，默认使用 config.defaultImportance。

### Rationale
- 保持向后兼容，不破坏现有调用
- 单一参数传递简单明了
- fallback 机制已存在（defaultImportance 0.3）

### Interface Change

```typescript
// 现有接口
async writeConversation(
  sessionId: string,
  userMsg: string,
  assistantMsg: string
): Promise<boolean>

// 改造后接口
async writeConversation(
  sessionId: string,
  userMsg: string,
  assistantMsg: string,
  importance?: number  // 可选参数
): Promise<boolean>
```

### Alternatives Considered
- **创建新方法 `writeConversationWithImportance`**: 代码重复，不推荐
- **修改 config.defaultImportance 为动态**: 语义不清，易出错

---

## 5. Gateway 流程改造

### Decision
在 `handleMessage` 和 `streamHandleMessage` 中添加 importance 解析步骤。

### Flow

```
用户消息 → Agent.chat → LLM 回复（含 [IMPORTANCE:X]）
          ↓
     解析 importance
          ↓
     剥离标记 → 返回给用户
          ↓
     AutoMemoryWriter.writeConversation(importance)
```

### Rationale
- Gateway 是消息处理中心，适合添加解析逻辑
- 解析结果同时用于：剥离标记 + 写入记忆

### Alternatives Considered
- **在 Agent 内部处理**: Agent 不应关心记忆系统，职责分离
- **在 AutoMemoryWriter 内部解析**: 需要访问原始 LLM 回复，耦合度高

---

## 6. Fallback 策略

### Decision
解析失败时使用 defaultImportance (0.3)，不中断对话流程。

### Rationale
- 0.3 < promotionThreshold (0.5)，未评估的记忆不会被晋升
- 用户无感知，不影响对话体验
- 与现有行为一致

### Error Handling

```typescript
// 解析失败场景
const importance = parseImportance(response.content);
// null → 使用 defaultImportance
const finalImportance = importance ?? this.config.defaultImportance;
```

---

## 7. 测试策略

### Decision
单元测试覆盖解析逻辑，集成测试验证完整流程。

### Test Cases

1. **解析正常格式**: `[IMPORTANCE:0.7]` → 0.7
2. **解析多个标记**: 取最后一个
3. **超出范围**: `[IMPORTANCE:1.5]` → 1.0, `[IMPORTANCE:-0.2]` → 0.0
4. **格式错误**: `[IMPORTANCE:abc]` → null
5. **无标记**: → null
6. **剥离标记**: 正常文本，无残留
7. **完整流程**: 模拟对话 → 检查 importance 值写入记忆

---

## 8. 文件存储位置

### Decision
soul.md 默认路径：`~/.miniclaw/soul.md`

### Rationale
- 与 config.json、skills 目录同级
- 用户可编辑，易于发现
- 支持环境变量 `MINICLAW_SOUL_FILE` 自定义路径

### Loading Strategy

```typescript
// 启动时加载
const soulFile = process.env.MINICLAW_SOUL_FILE || expandHome('~/.miniclaw/soul.md');
const soulContent = fs.existsSync(soulFile) ? fs.readFileSync(soulFile, 'utf-8') : DEFAULT_SOUL;
```

---

## Summary

| 决策项 | 选择 | 主要原因 |
|--------|------|----------|
| 标记格式 | `[IMPORTANCE:X]` | 简单明确，易于解析 |
| 解析策略 | 正则表达式，取最后标记 | 性能高，防误插入 |
| Prompt 注入 | soul.md 文件 | 用户可自定义，语义清晰 |
| Writer 改造 | 可选参数 | 向后兼容 |
| Gateway 改造 | 添加解析步骤 | 职责集中 |
| Fallback | defaultImportance 0.3 | 不中断流程 |
| 测试 | 单元+集成 | 核心逻辑覆盖 |
| 文件位置 | ~/.miniclaw/soul.md | 与配置同级 |