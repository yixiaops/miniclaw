# Tasks: 定时任务与动态配置加载

**Input**: Design documents from `/specs/026-scheduler-hot-reload/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 项目遵循 TDD 规范，包含测试任务

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- New modules: `src/scheduler/`, `src/core/config-watcher/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and dependency setup

- [x] T001 Install dependencies node-cron and chokidar via npm
- [x] T002 [P] Create scheduler module directory structure at src/scheduler/
- [x] T003 [P] Create config-watcher module directory structure at src/core/config-watcher/
- [x] T004 [P] Create test directory structure at tests/unit/scheduler/ and tests/unit/config-watcher/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types and storage infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 [P] Define ScheduledTask types in src/scheduler/types.ts
- [x] T006 [P] Define ConfigWatcher types in src/core/config-watcher/types.ts
- [x] T007 Implement TaskStore (JSON file persistence) in src/scheduler/task-store.ts
- [x] T008 [P] Implement PendingMessageStore in src/scheduler/pending-store.ts
- [x] T009 [P] Write unit tests for TaskStore in tests/unit/scheduler/task-store.test.ts
- [x] T010 [P] Write unit tests for PendingMessageStore in tests/unit/scheduler/pending-store.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 自然语言创建定时提醒 (Priority: P1) 🎯 MVP

**Goal**: 用户通过自然语言创建定时任务，AI 解析时间并确认，任务触发时发送提醒

**Independent Test**: 用户发送"明天早上9点提醒我开会"，系统在指定时间向用户发送提醒消息

### Tests for User Story 1

- [x] T011 [P] [US1] Write unit tests for SchedulerManager in tests/unit/scheduler/manager.test.ts
- [x] T012 [P] [US1] Write unit tests for TaskExecutor in tests/unit/scheduler/executor.test.ts
- [x] T013 [P] [US1] Write unit tests for dedup logic in tests/unit/scheduler/dedup.test.ts
- [x] T014 [US1] Write integration test for task creation flow in tests/integration/scheduler-flow.test.ts

### Implementation for User Story 1

- [x] T015 [P] [US1] Implement dedup module (time window + similarity) in src/scheduler/dedup.ts
- [x] T016 [US1] Implement TaskExecutor (reminder/instruction dispatch) in src/scheduler/executor.ts
- [x] T017 [US1] Implement SchedulerManager (node-cron integration) in src/scheduler/manager.ts
- [x] T018 [US1] Create scheduler module entry point in src/scheduler/index.ts
- [ ] T019 [US1] Implement scheduler_create tool in src/tools/scheduler-create.ts
- [ ] T020 [US1] Register scheduler tools in src/tools/index.ts
- [ ] T021 [US1] Add scheduler handling rules to default Soul in src/soul/default-soul.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 查看和管理定时任务列表 (Priority: P2)

**Goal**: 用户可以查看、删除、修改自己的定时任务列表

**Independent Test**: 用户发送"查看我的定时任务"，AI 返回任务列表；用户发送"取消任务xxx"，AI 删除任务

### Tests for User Story 2

- [ ] T022 [P] [US2] Write unit tests for scheduler_list tool in tests/unit/scheduler/scheduler-list.test.ts
- [ ] T023 [P] [US2] Write unit tests for scheduler_delete tool in tests/unit/scheduler/scheduler-delete.test.ts
- [ ] T024 [P] [US2] Write unit tests for scheduler_update tool in tests/unit/scheduler/scheduler-update.test.ts

### Implementation for User Story 2

- [ ] T025 [P] [US2] Implement scheduler_list tool in src/tools/scheduler-list.ts
- [ ] T026 [P] [US2] Implement scheduler_delete tool in src/tools/scheduler-delete.ts
- [ ] T027 [P] [US2] Implement scheduler_update tool in src/tools/scheduler-update.ts
- [ ] T028 [US2] Add task list/delete/update handling to Soul rules in src/soul/default-soul.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 动态添加子 Agent (Priority: P1) 🎯 MVP

**Goal**: 运维人员添加新 Agent 配置文件，系统自动检测并加载，用户可立即调用新 Agent

**Independent Test**: 添加新 Agent 配置文件到 ~/.miniclaw/prompts/，系统在5秒内检测到变更并加载新 Agent

### Tests for User Story 3

- [ ] T029 [P] [US3] Write unit tests for ConfigWatcher in tests/unit/config-watcher/watcher.test.ts
- [ ] T030 [P] [US3] Write unit tests for ConfigLoader in tests/unit/config-watcher/loader.test.ts
- [ ] T031 [US3] Write integration test for hot reload flow in tests/integration/hot-reload-flow.test.ts

### Implementation for User Story 3

- [ ] T032 [P] [US3] Implement ConfigLoader (YAML parsing + caching) in src/core/config-watcher/loader.ts
- [ ] T033 [US3] Implement ConfigWatcher (chokidar integration) in src/core/config-watcher/watcher.ts
- [ ] T034 [US3] Create config-watcher module entry point in src/core/config-watcher/index.ts
- [ ] T035 [US3] Extend AgentRegistry with hot reload methods in src/core/agent/registry.ts
- [ ] T036 [US3] Integrate ConfigWatcher with Gateway lifecycle in src/core/gateway/index.ts

**Checkpoint**: At this point, User Story 3 should be fully functional and testable independently

---

## Phase 6: User Story 4 - 动态修改 Agent 配置 (Priority: P2)

**Goal**: 运维人员修改现有 Agent 配置，系统自动重新加载，后续对话立即生效

**Independent Test**: 修改现有 Agent 的系统提示词文件，用户下次对话中使用新提示词

### Tests for User Story 4

- [ ] T037 [P] [US4] Write unit tests for config modify detection in tests/unit/config-watcher/loader.test.ts

### Implementation for User Story 4

- [ ] T038 [US4] Implement mtime/version comparison in src/core/config-watcher/loader.ts
- [ ] T039 [US4] Implement config reload (update cache) in src/core/config-watcher/watcher.ts
- [ ] T040 [US4] Handle config deletion (cleanup cache) in src/core/config-watcher/watcher.ts
- [ ] T041 [US4] Add error logging for failed loads in src/core/config-watcher/watcher.ts

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T042 [P] Write e2e test for scheduler CLI in tests/e2e/scheduler-cli.test.ts
- [ ] T043 [P] Update CLAUDE.md with scheduler and hot-reload documentation
- [ ] T044 Integrate SchedulerManager with main entry point in src/index.ts
- [ ] T045 Add pending message push on user reconnect in src/channels/*.ts
- [ ] T046 Run all tests and verify coverage meets threshold (npm run precommit)
- [ ] T047 Run quickstart.md validation scenarios

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (Phase 3) and US3 (Phase 5) are both P1 - can proceed in parallel
  - US2 (Phase 4) depends on US1 (needs scheduler tools framework)
  - US4 (Phase 6) depends on US3 (needs ConfigWatcher infrastructure)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after US1 complete (needs scheduler tools)
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Independent from US1
- **User Story 4 (P2)**: Can start after US3 complete (needs ConfigWatcher)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Types/models before services
- Services before tools/endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- US1 and US3 can be developed in parallel (both P1, different modules)
- All tests for a user story marked [P] can run in parallel
- Tools within a story marked [P] can run in parallel

---

## Parallel Example: User Story 1 + User Story 3

```bash
# US1 tests (parallel):
Task: "Write unit tests for SchedulerManager in tests/unit/scheduler/manager.test.ts"
Task: "Write unit tests for TaskExecutor in tests/unit/scheduler/executor.test.ts"
Task: "Write unit tests for dedup logic in tests/unit/scheduler/dedup.test.ts"

# US3 tests (parallel, can run alongside US1):
Task: "Write unit tests for ConfigWatcher in tests/unit/config-watcher/watcher.test.ts"
Task: "Write unit tests for ConfigLoader in tests/unit/config-watcher/loader.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 3)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (定时任务核心) + Phase 5: User Story 3 (热重载核心) - 可并行
4. **STOP and VALIDATE**: Test US1 and US3 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 + US3 (both P1) → Test independently → Deploy/Demo (MVP!)
3. Add US2 (任务管理) → Test independently → Deploy/Demo
4. Add US4 (配置修改) → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (定时任务)
   - Developer B: User Story 3 (热重载) - 可并行！
3. Then:
   - Developer A: User Story 2 (任务管理) - 依赖 US1
   - Developer B: User Story 4 (配置修改) - 依赖 US3
4. Stories complete and integrate independently

---

## Task Summary

| Phase | User Story | Task Count | Parallelizable |
|-------|------------|------------|----------------|
| Phase 1 | Setup | 4 | 3 |
| Phase 2 | Foundational | 6 | 5 |
| Phase 3 | US1 (P1) | 11 | 6 |
| Phase 4 | US2 (P2) | 7 | 5 |
| Phase 5 | US3 (P1) | 8 | 4 |
| Phase 6 | US4 (P2) | 5 | 1 |
| Phase 7 | Polish | 6 | 2 |
| **Total** | | **47** | **26** |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- US1 and US3 are both P1 and can be developed in parallel
- US2 depends on US1 (scheduler tools)
- US4 depends on US3 (ConfigWatcher)
- Tests should FAIL before implementation (TDD)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently