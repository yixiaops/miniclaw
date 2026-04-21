# ImportanceEvaluator Contract

**Module**: `src/memory/importance/evaluator.ts`
**Version**: 1.0.0
**Date**: 2026-04-21

## Overview

ImportanceEvaluator 负责：
1. 从 LLM 回复中解析 `[IMPORTANCE:X]` 标记
2. 剥离标记，返回干净的回复文本
3. 处理边界情况（超出范围、格式错误）

---

## Interface

### Constructor

```typescript
class ImportanceEvaluator {
  constructor(config?: Partial<ImportanceEvaluatorConfig>);
}
```

**Parameters**:
- `config`: 可选配置，包含 defaultImportance、pattern、logParsed

### parse()

```typescript
parse(responseContent: string): ImportanceParseResult;
```

**Input**:
- `responseContent`: LLM 的原始回复文本

**Output**:
- `ImportanceParseResult`: 包含 importance 值和剥离后的文本

**Behavior**:
1. 使用正则表达式匹配所有 `[IMPORTANCE:X]` 标记
2. 取最后一个标记的值
3. Clamp 值到 0-1 范围
4. 剥离所有标记，返回干净文本
5. 解析失败时返回 null importance

**Examples**:

```typescript
// 正常解析
evaluator.parse("你好！[IMPORTANCE:0.3]");
// → { importance: 0.3, strippedContent: "你好！", parsed: true }

// 多个标记，取最后一个
evaluator.parse("消息1[IMPORTANCE:0.5]消息2[IMPORTANCE:0.8]");
// → { importance: 0.8, strippedContent: "消息1消息2", parsed: true }

// 超出范围，clamp
evaluator.parse("重要信息[IMPORTANCE:1.5]");
// → { importance: 1.0, strippedContent: "重要信息", parsed: true }

// 无标记，fallback
evaluator.parse("普通回复");
// → { importance: null, strippedContent: "普通回复", parsed: false }
```

---

## Error Handling

| Scenario | Result |
|----------|--------|
| 无标记 | `importance: null`, `parsed: false` |
| 格式错误 `[IMPORTANCE:abc]` | `importance: null`, `parsed: false` |
| 超出范围 `[IMPORTANCE:-0.5]` | `importance: 0.0`, `parsed: true` |
| 超出范围 `[IMPORTANCE:2.0]` | `importance: 1.0`, `parsed: true` |

---

## Dependencies

- 无外部依赖
- 使用 JavaScript 内置 RegExp

---

## Testing Requirements

- 单元测试覆盖率 ≥ 90%
- 边界情况必须测试
- 性能测试：解析延迟 < 5ms