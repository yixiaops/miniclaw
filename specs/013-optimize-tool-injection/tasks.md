# Tasks: Tool Injection Optimization

**Input**: Design documents from `/specs/013-optimize-tool-injection/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 测试任务已包含，因为这是核心功能变更。

**Organization**: 任务按用户故事组织，支持独立实现和测试。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事（US1, US2, US3, US4）
- 描述中包含精确的文件路径

---

## Phase 1: Setup (共享基础设施)

**Purpose**: 工具过滤功能的基础结构

- [X] T001 在 src/tools/filter.ts 创建工具过滤模块骨架

---

## Phase 2: Foundational (阻塞性前置条件)

**Purpose**: 核心过滤逻辑，所有用户故事依赖此阶段

**⚠️ CRITICAL**: 用户故事实现必须等待此阶段完成

- [X] T002 实现 ToolPolicy 类型定义，扩展 src/core/config.ts 中的 AgentConfig
- [X] T003 实现 filterToolsByPolicy 函数在 src/tools/filter.ts
- [X] T004 实现 resolveEffectiveToolList 函数在 src/tools/filter.ts
- [X] T005 [P] 实现 validateToolNames 函数在 src/tools/filter.ts（验证配置中的工具名是否存在）
- [X] T006 从 src/tools/index.ts 导出过滤函数

**Checkpoint**: 工具过滤核心逻辑就绪 - 用户故事实现可以开始

---

## Phase 3: User Story 1 - Default Full Tool Access (Priority: P1) 🎯 MVP

**Goal**: 所有 Agent 默认拥有全部 12 个内置工具

**Independent Test**: 创建任意 Agent 并验证其工具数量为 12

### Tests for User Story 1

- [X] T007 [P] [US1] 创建单元测试 tests/unit/tools/filter.test.ts，测试默认行为（无配置时返回全部工具）

### Implementation for User Story 1

- [X] T008 [US1] 在 src/tools/filter.ts 中确保空配置返回所有工具
- [X] T009 [US1] 修改 src/index.ts，在 Agent 创建时应用默认工具策略

**Checkpoint**: 默认全工具访问功能完成，可独立验证

---

## Phase 4: User Story 2 - Tool Allowlist Configuration (Priority: P1)

**Goal**: 通过 tools.allow 列表限制 Agent 可用工具

**Independent Test**: 配置 allow 列表后验证 Agent 只拥有指定工具

### Tests for User Story 2

- [X] T010 [P] [US2] 在 tests/unit/tools/filter.test.ts 添加 allow 列表过滤测试
- [X] T011 [P] [US2] 添加空 allow 列表测试（agent 无工具）
- [X] T012 [P] [US2] 添加不存在的工具名测试（记录警告，忽略该名）

### Implementation for User Story 2

- [X] T013 [US2] 在 src/tools/filter.ts 实现 allow 列表过滤逻辑
- [X] T014 [US2] 修改 src/index.ts，读取 AgentConfig.tools.allow 并应用过滤
- [X] T015 [US2] 添加警告日志记录（配置中不存在的工具名）

**Checkpoint**: 白名单功能完成，可独立验证

---

## Phase 5: User Story 3 - Tool Denylist Configuration (Priority: P1)

**Goal**: 通过 tools.deny 列表禁止特定工具，deny 优先于 allow

**Independent Test**: 配置 deny 列表后验证工具被正确排除

### Tests for User Story 3

- [X] T016 [P] [US3] 在 tests/unit/tools/filter.test.ts 添加 deny 列表过滤测试
- [X] T017 [P] [US3] 添加 allow + deny 冲突测试（deny 优先）

### Implementation for User Story 3

- [X] T018 [US3] 在 src/tools/filter.ts 实现 deny 列表过滤逻辑（优先于 allow）
- [X] T019 [US3] 修改 src/index.ts，读取 AgentConfig.tools.deny 并应用过滤

**Checkpoint**: 黑名单功能完成，可独立验证

---

## Phase 6: User Story 4 - Runtime Tool Management (Priority: P2)

**Goal**: Agent 支持运行时动态注册和清除工具

**Independent Test**: 运行时调用 registerTool/clearTools 方法并验证工具列表变化

### Tests for User Story 4

- [X] T020 [P] [US4] 在 tests/unit/agent-tools.test.ts 创建运行时工具管理测试（已存在于 agent.test.ts）

### Implementation for User Story 4

- [X] T021 [US4] 确认 MiniclawAgent 在 src/core/agent/index.ts 中暴露 registerTool 方法（已存在于 line 948）
- [X] T022 [US4] 确认 MiniclawAgent 在 src/core/agent/index.ts 中暴露 clearTools 方法（已存在于 line 968）
- [X] T023 [US4] 如果不存在，在 MiniclawAgent 中实现 registerTool/clearTools 方法（已存在）

**Checkpoint**: 运行时工具管理功能完成

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨用户故事的改进

- [X] T024 [P] 更新 CLAUDE.md 文档，记录工具配置功能
- [ ] T025 集成测试：验证完整配置流程（配置文件 → Agent 工具列表）
- [ ] T026 运行 quickstart.md 中的验证步骤
- [ ] T027 代码审查和清理

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖 - 可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - 阻塞所有用户故事
- **User Stories (Phase 3-6)**: 全部依赖 Foundational 完成
  - US1, US2, US3 可以并行开发（P1 优先级）
  - US4 依赖 US1-3 完成
- **Polish (Phase 7)**: 依赖所有用户故事完成

### User Story Dependencies

- **User Story 1 (P1)**: Foundational 完成后可开始 - 无其他故事依赖
- **User Story 2 (P1)**: Foundational 完成后可开始 - 独立可测试
- **User Story 3 (P1)**: Foundational 完成后可开始 - 独立可测试
- **User Story 4 (P2)**: 建议 US1-3 完成后开始

### Within Each User Story

- 测试先于实现
- 核心逻辑在前，日志/验证在后
- 故事完成后再进入下一个

### Parallel Opportunities

- T005 可与 T002-T004 并行
- T007, T010-T012 测试任务可并行
- T016-T017 测试任务可并行
- US1, US2, US3 可由不同开发者并行开发

---

## Parallel Example: User Story 1-3 Tests

```bash
# 并行启动所有测试任务：
Task: T007 "创建单元测试 tests/unit/tool-filter.test.ts，测试默认行为"
Task: T010 "在 tests/unit/tool-filter.test.ts 添加 allow 列表过滤测试"
Task: T011 "添加空 allow 列表测试"
Task: T012 "添加不存在的工具名测试"
Task: T016 "添加 deny 列表过滤测试"
Task: T017 "添加 allow + deny 冲突测试"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Phase 1: Setup
2. 完成 Phase 2: Foundational
3. 完成 Phase 3: User Story 1
4. **STOP and VALIDATE**: 测试默认工具访问
5. 部署/演示

### Incremental Delivery

1. Setup + Foundational → 基础就绪
2. Add User Story 1 → 独立测试 → MVP
3. Add User Story 2 → 独立测试 → 白名单功能
4. Add User Story 3 → 独立测试 → 黑名单功能
5. Add User Story 4 → 独立测试 → 运行时管理

---

## Notes

- [P] 任务 = 不同文件，无依赖
- [Story] 标签映射到具体用户故事
- 每个用户故事应独立可完成和测试
- 测试先于实现
- 每个 checkpoint 后验证功能
- 提交按任务或逻辑组进行