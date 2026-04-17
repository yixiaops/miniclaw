# Tasks: 飞书消息表情回应

**Input**: Design documents from `/specs/019-feishu-reactions/`
**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: TDD 流程，测试覆盖率目标 >= 70%

**Organization**: 按功能修复和验证阶段组织任务

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事（US1, US2, US3）
- 描述中包含精确文件路径

---

## Phase 1: Setup（项目准备）

**Purpose**: 确认项目结构和现有实现状态

- [ ] T001 确认 FeishuReactions 实现已存在于 src/channels/feishu-reactions.ts
- [ ] T002 [P] 确认 Gateway 已支持 memoryManager 参数 src/core/gateway/index.ts:67
- [ ] T003 [P] 确认 MemoryManager 实现已存在于 src/memory/manager.ts
- [ ] T004 [P] 确认表情回应测试已存在 tests/unit/channels/feishu-reactions.test.ts

**Checkpoint**: 现有实现确认完成，开始修复任务

---

## Phase 2: Foundational（记忆系统集成修复）

**Purpose**: 修复记忆系统集成问题 - Gateway 已支持但 src/index.ts 未传递 memoryManager

**⚠️ CRITICAL**: 记忆系统必须先修复，否则相关功能无法验证

### 修复任务

- [ ] T005 [P] 在 src/index.ts 添加 MemoryManager 导入（文件顶部）
- [ ] T006 在 src/index.ts main 函数中创建 MemoryManager（约第 193 行后，skillManager 初始化后）
  ```typescript
  let memoryManager: MemoryManager | undefined;
  if (config.memory?.enabled) {
    memoryManager = new MemoryManager({
      storageDir: config.memory.dir || './memory-storage',
      defaultTTL: config.memory.defaultTTL || 86400000,
      cleanupInterval: config.memory.cleanupInterval || 3600000,
      promotionThreshold: config.memory.promotionThreshold || 0.5
    });
    await memoryManager.initialize();
  }
  ```
- [ ] T007 修改 src/index.ts Gateway 创建，传递 memoryManager 参数（第 249-252 行）
- [ ] T008 在 src/index.ts cleanup 中添加 memoryManager.destroy() 调用

### 验证任务

- [ ] T009 运行 `npm test` 确认所有测试通过
- [ ] T010 运行 `npm run typecheck` 确认无类型错误

**Checkpoint**: 记忆系统集成完成，Gateway 正确接收 memoryManager

---

## Phase 3: User Story 1 - 处理状态可视化 (Priority: P1) 🎯 MVP

**Goal**: 用户发送消息后立即看到 SMILE 表情回应，处理完成后表情移除

**Independent Test**: 发送测试消息，验证表情回应出现和移除

**覆盖率目标**: >= 70%

### 测试任务（测试已存在，验证覆盖率）

- [ ] T011 [P] [US1] 验证 tests/unit/channels/feishu-reactions.test.ts 中 addReaction 测试覆盖 FR-001
- [ ] T012 [P] [US1] 验证 tests/unit/channels/feishu-reactions.test.ts 中 deleteReaction 测试覆盖 FR-002
- [ ] T013 [P] [US1] 验证 tests/unit/channels/feishu-reactions.test.ts 中 addProcessingReaction 测试覆盖 FR-005

### 运行测试验证

- [ ] T014 [US1] 运行 `npm run test:coverage` 确认 feishu-reactions.ts 覆盖率 >= 70%

**Checkpoint**: US1 测试覆盖率达标，表情回应核心功能验证完成

---

## Phase 4: User Story 2 - 错误容错 (Priority: P2)

**Goal**: 表情回应失败不中断消息处理流程，系统稳定运行

**Independent Test**: 模拟 API 失败，验证消息处理正常完成

**覆盖率目标**: >= 70%

### 测试任务（测试已存在，验证覆盖率）

- [ ] T015 [P] [US2] 验证 tests/unit/channels/feishu-reactions.test.ts 中 API 错误处理测试覆盖 FR-003
- [ ] T016 [P] [US2] 验证 tests/unit/channels/feishu-reactions.test.ts 中网络错误处理测试覆盖 FR-003

### 运行测试验证

- [ ] T017 [US2] 运行 `npm run test:coverage` 确认错误处理分支覆盖率达标

**Checkpoint**: US2 错误容错测试覆盖率达标，系统稳定性验证完成

---

## Phase 5: User Story 3 - Token 缓存管理 (Priority: P3)

**Goal**: tenant_access_token 缓存复用，减少 API 调用，提升性能

**Independent Test**: 多次调用表情回应方法，验证 token 缓存复用

**覆盖率目标**: >= 70%

### 测试任务（测试已存在，验证覆盖率）

- [ ] T018 [P] [US3] 验证 tests/unit/channels/feishu-reactions.test.ts 中 token 缓存测试覆盖 FR-004
- [ ] T019 [P] [US3] 验证 tests/unit/channels/feishu-reactions.test.ts 中 clearTokenCache 测试覆盖 FR-006

### 运行测试验证

- [ ] T020 [US3] 运行 `npm run test:coverage` 确认 token 管理覆盖率达标

**Checkpoint**: US3 Token 缓存管理测试覆盖率达标

---

## Phase 6: Polish & Cross-Cutting（配置文档）

**Purpose**: 更新文档，说明记忆系统启用方式

- [ ] T021 更新 CLAUDE.md 或 README 添加记忆系统启用配置说明
  - 配置示例：`memory.enabled: true`
  - 配置项说明：`memory.dir`, `memory.defaultTTL`, `memory.cleanupInterval`
- [ ] T022 运行完整测试套件 `npm test` 确认所有测试通过
- [ ] T023 运行代码检查 `npm run lint` 确认无 lint 错误

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup 完成 - BLOCKS 所有用户故事验证
- **User Stories (Phase 3-5)**: 依赖 Foundational 完成
  - 用户故事可并行验证（测试已存在）
- **Polish (Phase 6)**: 依赖所有验证完成

### User Story Dependencies

- **US1 (P1)**: 无依赖，可独立验证
- **US2 (P2)**: 无依赖，可独立验证（错误容错测试已存在）
- **US3 (P3)**: 无依赖，可独立验证（token 缓存测试已存在）

### Within Each Phase

- Foundational: T005 可并行，T006-T008 顺序执行
- User Stories: 所有验证任务可并行

### Parallel Opportunities

- Phase 1: T002, T003, T004 可并行
- Phase 3-5: 每个故事内的测试验证任务可并行

---

## Parallel Example: User Story 1

```bash
# 并行验证 US1 测试覆盖:
Task: "验证 addReaction 测试覆盖 FR-001"
Task: "验证 deleteReaction 测试覆盖 FR-002"
Task: "验证 addProcessingReaction 测试覆盖 FR-005"
```

---

## Implementation Strategy

### MVP First (Phase 1 + Phase 2)

1. 完成 Phase 1: Setup 确认
2. 完成 Phase 2: Foundational 记忆系统修复
3. **STOP and VALIDATE**: 运行 `npm test` 确认修复无破坏性影响

### Incremental Delivery

1. Setup + Foundational → 记忆系统修复完成
2. US1 验证 → 表情回应核心功能验证
3. US2 验证 → 错误容错验证
4. US3 验证 → Token 缓存验证
5. Polish → 文档更新

---

## Notes

- 表情回应实现已存在，本次主要是修复记忆系统集成和验证测试覆盖率
- 测试已存在于 tests/unit/channels/feishu-reactions.test.ts
- 覆盖率目标 >= 70%（SC-003）
- src/index.ts 修改需谨慎，确保不破坏现有功能