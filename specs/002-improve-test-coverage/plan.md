# Implementation Plan: Improve Test Coverage

**Branch**: `002-improve-test-coverage` | **Date**: 2026-03-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-improve-test-coverage/spec.md`

## Summary

提升 Miniclaw 项目的测试覆盖率，从当前 72.27% 提升到 75%+，分支覆盖率从 59.7% 提升到 65%+，Gateway 类覆盖率从 65% 提升到 70%+。采用 Vitest 测试框架，遵循项目现有测试模式，重点覆盖 Gateway 类和各 Channel 模块的未测试分支。

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: Vitest (测试框架), pi-agent-core (Agent框架)
**Storage**: SimpleMemoryStorage (内存存储，可选文件持久化)
**Testing**: Vitest with coverage (v8 provider)
**Target Platform**: Node.js server
**Project Type**: library + CLI + web-service (多通道 AI 助手框架)
**Performance Goals**: 测试执行时间 < 30秒
**Constraints**: 不改变现有代码逻辑，仅添加测试
**Scale/Scope**: 192 个现有测试用例，21 个源文件，22 个测试文件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

项目无特定 constitution 约束。遵循通用最佳实践：
- ✅ 测试独立性：每个测试可独立运行
- ✅ 无副作用：测试不改变生产代码
- ✅ 可重复性：测试结果稳定可预测

## Project Structure

### Documentation (this feature)

```text
specs/002-improve-test-coverage/
├── plan.md              # This file
├── research.md          # Coverage gap analysis
├── data-model.md        # Test data model
├── quickstart.md        # Quick reference
└── tasks.md             # Implementation tasks (created by /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── channels/           # 通道层 (CLI, API, Web, Feishu)
├── core/               # 核心层 (Gateway, Agent, Router, Session, Config)
├── tools/              # 工具层 (read_file, write_file, shell, web_fetch)
└── index.ts            # 入口

tests/
├── unit/               # 单元测试
│   ├── channels/       # 通道测试
│   ├── core/           # 核心测试
│   │   └── gateway/    # Gateway 相关测试
│   └── tools/          # 工具测试
└── integration/        # 集成测试
    └── gateway.test.ts # Gateway 集成测试
```

**Structure Decision**: 保持现有结构，在 tests/unit/ 下添加缺失的测试用例。

## Complexity Tracking

无违规需要记录。此任务仅添加测试，不改变架构。

## Coverage Targets

| 模块 | 当前覆盖率 | 目标覆盖率 | 优先级 |
|------|------------|------------|--------|
| 总体 | 72.27% | 75%+ | P1 |
| Branches | 59.7% | 65%+ | P1 |
| Gateway | 65% | 70%+ | P1 |
| CLI Channel | 48% | 60%+ | P2 |
| API Channel | 40% | 55%+ | P2 |
| Web Channel | 60% | 70%+ | P2 |
| Feishu Channel | 59% | 70%+ | P2 |