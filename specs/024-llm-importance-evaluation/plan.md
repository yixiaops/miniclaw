# Implementation Plan: LLM Importance Evaluation

**Branch**: `024-llm-importance-evaluation` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/024-llm-importance-evaluation/spec.md`

## Summary

让 LLM 动态评估消息重要性，解决当前所有记忆都不会晋升的根本问题（固定 importance=0.3 < promotionThreshold=0.5）。通过在 LLM 回复末尾输出 `[IMPORTANCE:X]` 标记，解析并提取重要性值，传递给 AutoMemoryWriter 写入记忆条目的 metadata。同时引入 soul.md 文件记录 AI 人格信息，包含核心规则。

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: @mariozechner/pi-agent-core (^0.57.1), @mariozechner/pi-ai (^0.57.1), Express 5.x, Vitest 4.x
**Storage**: MemoryCandidatePool (内存候选池), LongTermMemory (长期记忆), SimpleMemoryStorage (Session历史)
**Testing**: Vitest 4.x (unit + integration tests)
**Target Platform**: Node.js server (CLI/API/Web/Feishu channels)
**Project Type**: AI assistant framework with multi-channel support
**Performance Goals**: importance 解析延迟 < 5ms, 不影响主对话流程
**Constraints**: importance 值必须在 0-1 范围内，默认值 0.3 作为 fallback
**Scale/Scope**: 个人 AI 助手，支持多 Session、多 Agent 实例

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

项目当前无正式 constitution 文件，采用以下原则：

### I. 测试优先 (Test-First)
- 新模块必须有单元测试覆盖核心逻辑
- 解析逻辑、边界情况必须测试

### II. 静默降级 (Silent Degradation)
- importance 解析失败不应中断主对话流程
- 使用默认值 0.3 作为 fallback

### III. 简洁实现 (Simplicity)
- 新增模块最小化，复用现有代码结构
- 不引入新的外部依赖

**Gate Status**: ✅ PASS - 无原则冲突

## Project Structure

### Documentation (this feature)

```text
specs/024-llm-importance-evaluation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── memory/
│   ├── importance/           # 新增模块目录
│   │   ├── evaluator.ts      # ImportanceEvaluator 主逻辑
│   │   └── parser.ts         # importance 标记解析器
│   │   └── index.ts          # 模块导出
│   ├── auto-writer.ts        # 修改：接收动态 importance
│   ├── promotion/promoter.ts # 无需修改
│   └── store/ttl-manager.ts  # 无需修改
├── core/
│   ├── agent/index.ts        # 修改：注入 importance 评估规则到 system prompt
│   ├── gateway/index.ts      # 修改：解析 importance 并传递给 autoWriter
├── soul/
│   ├── loader.ts             # 新增：soul.md 文件加载器
│   └── index.ts              # 新增：模块导出

tests/
├── unit/
│   ├── importance/
│   │   ├── evaluator.test.ts
│   │   └── parser.test.ts
│   ├── soul/
│   │   └── loader.test.ts
├── integration/
│   └── importance-flow.test.ts
```

**Structure Decision**: 使用 Option 1 (Single project)，新增 `src/memory/importance/` 和 `src/soul/` 目录，修改现有 `auto-writer.ts`、`agent/index.ts`、`gateway/index.ts`。

## Complexity Tracking

> **无 Constitution Check 违规，无需记录**