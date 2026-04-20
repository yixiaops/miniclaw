# Tasks: 修复记忆持久化问题

**Input**: Design documents from `/specs/020-fix-memory-persistence/`
**Prerequisites**: plan.md, spec.md

**Tests**: TDD 模式 - 先写测试，测试失败后实现，测试通过

**Organization**: 按修复点分组，每个修复点独立可测试

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 修复点标识（FIX1, FIX2, FIX3）
- 包含精确文件路径

---

## Phase 1: Setup

**目的**: 准备测试环境和理解现有代码

- [ ] T001 确认测试框架配置正确 - 运行 `npm test` 验证现有测试通过
- [ ] T002 确认问题根因 - 阅读 src/core/gateway/index.ts:cleanup() 方法
- [ ] T003 确认配置默认值 - 阅读 src/core/config.ts:DEFAULT_MEMORY_CONFIG

---

## Phase 2: Foundational - 测试框架准备

**目的**: 确保测试基础设施可用

**⚠️ 关键**: 所有修复测试依赖此阶段完成

- [ ] T004 [P] 确认 MemoryManager mock 方法可用 - tests/unit/memory/manager.test.ts
- [ ] T005 [P] 确认 Gateway mock 方法可用 - tests/unit/core/gateway/index.test.ts

---

## Phase 3: Fix 1 - Gateway.cleanup() 调用 memoryManager.persist() 🎯 MVP

**目标**: Gateway.cleanup() 在销毁资源前持久化记忆数据

**独立验证**: 启动 Miniclaw → 发送消息 → Ctrl+C → 重启 → 记忆应被保留

### 测试 (TDD - 先写失败测试)

- [ ] T006 [FIX1] 编写 Gateway.cleanup() 持久化测试 - tests/unit/core/gateway/cleanup-persist.test.ts
  - 测试: cleanup() 应调用 memoryManager.persist()
  - 测试: cleanup() 在 persist() 失败时不应抛出异常（静默降级）

### 实现

- [ ] T007 [FIX1] 修改 Gateway.cleanup() - src/core/gateway/index.ts:342-349
  - 在销毁 Agent 和 Session 前，调用 `await this.memoryManager?.persist()`
  - 保持同步 cleanup() 方法签名（内部使用 await）

**Checkpoint**: 测试 T006 应通过

---

## Phase 4: Fix 2 - 调整 promotionThreshold 配置

**目标**: promotionThreshold <= defaultImportance，确保消息可晋升

**独立验证**: 写入 importance=0.3 的消息 → 执行 cleanup → 消息应晋升到长期记忆

### 测试 (TDD - 先写失败测试)

- [ ] T008 [P] [FIX2] 编写 promotionThreshold 配置测试 - tests/unit/core/config.test.ts
  - 测试: DEFAULT_MEMORY_CONFIG.promotionThreshold 应 <= defaultImportance

### 实现

- [ ] T009 [FIX2] 修改 DEFAULT_MEMORY_CONFIG - src/core/config.ts:135-143
  - 将 promotionThreshold 从 0.5 改为 0.3
  - 或将 defaultImportance 从 0.3 改为 0.5（推荐方案 A: promotionThreshold=0.3）

**Checkpoint**: 测试 T008 应通过

---

## Phase 5: Fix 3 - SIGINT 处理顺序优化

**目标**: SIGINT 处理时先持久化再销毁，确保数据不丢失

**独立验证**: 运行 API 模式 → Ctrl+C → 无数据丢失警告

### 测试 (TDD - 先写失败测试)

- [ ] T010 [FIX3] 编写 SIGINT 处理顺序测试 - tests/unit/index.test.ts (新增)
  - 测试: SIGINT handler 应先调用 persist() 再 destroy()

### 实现

- [ ] T011 [FIX3] 修改 SIGINT 处理顺序 - src/index.ts:294-342
  - 所有 mode 的 SIGINT handler: 在 `memoryManager.destroy()` 前添加 `await memoryManager?.persist()`
  - 或修改为: `gateway.cleanup()` → `memoryManager.persist()` → `memoryManager.destroy()`

**Checkpoint**: 测试 T010 应通过

---

## Phase 6: Polish & 集成测试

**目的**: 确保所有修复点协同工作

- [ ] T012 [P] 编写集成测试 - tests/integration/memory-persistence.test.ts
  - 测试完整流程: 初始化 → 写入 → cleanup → 重启 → 加载 → 数据存在
- [ ] T013 运行全部测试 - `npm test` 确认 121+ 测试通过
- [ ] T014 手动验证 - 启动 CLI/API 模式，测试 Ctrl+C 后记忆保留

---

## Dependencies & 执行顺序

### Phase 依赖

- **Setup (Phase 1)**: 无依赖 - 立即开始
- **Foundational (Phase 2)**: 依赖 Phase 1
- **Fix 1-3 (Phase 3-5)**: 依赖 Phase 2，可并行
- **Polish (Phase 6)**: 依赖 Phase 3-5 完成

### 并行执行

```bash
# Phase 3-5 可并行执行（不同文件）
Task: "T006 编写 Gateway.cleanup() 持久化测试"
Task: "T008 编写 promotionThreshold 配置测试"
Task: "T010 编写 SIGINT 处理顺序测试"

# 实现任务在测试完成后执行
Task: "T007 修改 Gateway.cleanup()"
Task: "T009 修改 DEFAULT_MEMORY_CONFIG"
Task: "T011 修改 SIGINT 处理顺序"
```

---

## 实现策略

### MVP (Fix 1)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: Fix 1 - Gateway.cleanup() 持久化
4. **停止并验证**: 运行测试，确认 T006 通过

### 完整修复

1. Setup + Foundational → 基础就绪
2. Fix 1 → Fix 2 → Fix 3（可并行）
3. Phase 6: Polish → 集成测试
4. 全部测试通过 → 可提交

---

## Notes

- TDD 模式: 测试失败 → 实现 → 测试通过
- [P] 任务 = 不同文件，无依赖，可并行
- [FIX] 标识对应具体修复点
- 每个修复点独立可测试、可验证
- 提交前确认全部测试通过 (`npm test`)