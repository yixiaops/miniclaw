# Tasks: LLM Importance Evaluation

**Input**: Design documents from `/specs/024-llm-importance-evaluation/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are included as per spec.md Success Criteria SC-005 (coverage ≥ 70%)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- This project uses single project structure as per plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create new module directories and type definitions

- [X] T001 Create src/memory/importance/ directory structure
- [X] T002 [P] Create ImportanceParseResult type definition in src/memory/importance/types.ts
- [X] T003 [P] Create ImportanceEvaluatorConfig type definition in src/memory/importance/types.ts
- [X] T004 [P] Create SoulConfig type definition in src/soul/types.ts
- [X] T005 Create module exports in src/memory/importance/index.ts
- [X] T006 [P] Create module exports in src/soul/index.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core modules that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Implement ImportanceEvaluator.parse() in src/memory/importance/evaluator.ts
- [X] T008 [P] Implement SoulLoader.load() in src/soul/loader.ts
- [X] T009 [P] Implement SoulLoader.getDefault() in src/soul/loader.ts
- [X] T010 Create DEFAULT_SOUL constant in src/soul/loader.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 动态评估重要性 (Priority: P1) 🎯 MVP

**Goal**: LLM 动态评估消息重要性，解决当前所有记忆都不会晋升的根本问题（固定 importance=0.3 < promotionThreshold=0.5）

**Independent Test**: 模拟对话并检查记忆条目的 importance 值是否为 LLM 评估值而非固定值

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T011 [P] [US1] Unit test for normal importance parsing in tests/unit/importance/evaluator.test.ts
- [X] T012 [P] [US1] Unit test for multiple markers (取最后一个) in tests/unit/importance/evaluator.test.ts
- [X] T013 [P] [US1] Unit test for clamp value above 1 in tests/unit/importance/evaluator.test.ts
- [X] T014 [P] [US1] Unit test for clamp value below 0 in tests/unit/importance/evaluator.test.ts
- [X] T015 [P] [US1] Unit test for no marker fallback in tests/unit/importance/evaluator.test.ts
- [X] T016 [P] [US1] Unit test for invalid format in tests/unit/importance/evaluator.test.ts
- [X] T017 [P] [US1] Unit test for stripping markers in tests/unit/importance/evaluator.test.ts
- [X] T018 [P] [US1] Unit test for SoulLoader file exists scenario in tests/unit/soul/loader.test.ts
- [X] T019 [P] [US1] Unit test for SoulLoader file not exists scenario in tests/unit/soul/loader.test.ts
- [X] T020 [P] [US1] Unit test for SoulLoader getDefault() in tests/unit/soul/loader.test.ts

### Implementation for User Story 1

- [X] T021 [US1] Modify AutoMemoryWriter.writeConversation() to accept optional importance parameter in src/memory/auto-writer.ts
- [X] T022 [US1] Modify AutoMemoryWriter.writeUserMessage() to accept optional importance parameter in src/memory/auto-writer.ts
- [X] T023 [US1] Modify AutoMemoryWriter.writeAssistantMessage() to accept optional importance parameter in src/memory/auto-writer.ts
- [X] T024 [US1] Add ImportanceEvaluator initialization in MiniclawGateway constructor in src/core/gateway/index.ts
- [X] T025 [US1] Add SoulLoader initialization in MiniclawGateway constructor in src/core/gateway/index.ts
- [X] T026 [US1] Add importance parsing step in MiniclawGateway.handleMessage() in src/core/gateway/index.ts
- [X] T027 [US1] Add importance parsing step in MiniclawGateway.streamHandleMessage() in src/core/gateway/index.ts
- [X] T028 [US1] Pass importance value to AutoMemoryWriter.writeConversation() in src/core/gateway/index.ts
- [X] T029 [US1] Strip importance marker from response content before returning to user in src/core/gateway/index.ts
- [X] T030 [US1] Inject soul content into Agent system prompt in src/core/agent/registry.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - TTL过期时晋升决策 (Priority: P2)

**Goal**: 候选池记忆 TTL 过期时，使用存储的 importance 値断断是否晋升到长期记忆

**Independent Test**: 创建带有不同 importance 值的记忆条目，触发 TTL 清理，检查高 importance 值的条目是否被晋升

### Tests for User Story 2

- [X] T031 [P] [US2] Integration test for importance ≥ threshold promotion in tests/integration/importance-flow.test.ts
- [X] T032 [P] [US2] Integration test for importance < threshold deletion in tests/integration/importance-flow.test.ts
- [X] T033 [P] [US2] Integration test for multiple entries with different importance in tests/integration/importance-flow.test.ts

### Implementation for User Story 2

- [X] T034 [US2] Verify TTLManager uses entry.metadata.importance for promotion decision in src/memory/store/ttl-manager.ts (read and confirm, no modification needed)
- [X] T035 [US2] Verify MemoryPromoter.check() uses importance threshold correctly in src/memory/promotion/promoter.ts (read and confirm, no modification needed)
- [X] T036 [US2] Add integration test setup with memory entries having different importance values in tests/integration/importance-flow.test.ts

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 用户查看长期记忆 (Priority: P3)

**Goal**: 用户可以查看被晋升到长期记忆的对话记录，验证重要信息已被持久保存

**Independent Test**: 通过 memory_get 工具或 API 查询长期记忆存储的内容

### Tests for User Story 3

- [X] T037 [P] [US3] Integration test for viewing promoted long-term memory in tests/integration/importance-flow.test.ts
- [X] T038 [P] [US3] Integration test for empty long-term memory response in tests/integration/importance-flow.test.ts

### Implementation for User Story 3

- [X] T039 [US3] Verify memory_get tool returns long-term memory entries in src/tools/ (read and confirm existing functionality)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T040 [P] Update CLAUDE.md with new modules and architecture in CLAUDE.md
- [X] T041 [P] Add config documentation for MINICLAW_SOUL_FILE environment variable in README.md (if exists)
- [ ] T042 [P] Run quickstart.md validation to verify complete implementation
- [ ] T043 Code cleanup and refactoring across importance and soul modules
- [X] T044 [P] Additional edge case tests for importance parsing in tests/unit/importance/evaluator.test.ts
- [X] T045 Run full test suite and verify coverage ≥ 70% (SC-005) - 862 tests passed

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 output (importance values) but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Integrates with US2 output (promoted memories) but independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Core modules (evaluator, soul-loader) before gateway modification
- Gateway modification before agent registry modification
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for normal importance parsing in tests/unit/importance/evaluator.test.ts"
Task: "Unit test for multiple markers in tests/unit/importance/evaluator.test.ts"
Task: "Unit test for clamp value above 1 in tests/unit/importance/evaluator.test.ts"
Task: "Unit test for clamp value below 0 in tests/unit/importance/evaluator.test.ts"
Task: "Unit test for no marker fallback in tests/unit/importance/evaluator.test.ts"
Task: "Unit test for invalid format in tests/unit/importance/evaluator.test.ts"
Task: "Unit test for stripping markers in tests/unit/importance/evaluator.test.ts"
Task: "Unit test for SoulLoader file exists scenario in tests/unit/soul/loader.test.ts"
Task: "Unit test for SoulLoader file not exists scenario in tests/unit/soul/loader.test.ts"
Task: "Unit test for SoulLoader getDefault() in tests/unit/soul/loader.test.ts"

# Then implement sequentially after tests are written:
Task: "Modify AutoMemoryWriter.writeConversation() in src/memory/auto-writer.ts"
Task: "Add ImportanceEvaluator initialization in src/core/gateway/index.ts"
# ... etc
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (type definitions, module exports)
2. Complete Phase 2: Foundational (ImportanceEvaluator, SoulLoader)
3. Complete Phase 3: User Story 1 (动态评估重要性)
4. **STOP and VALIDATE**: Test User Story 1 independently - verify importance values are parsed correctly
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Verify promotion decision works
4. Add User Story 3 → Test independently → Verify long-term memory viewing works
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (tests + implementation)
   - Developer B: User Story 2 (tests + verification)
   - Developer C: User Story 3 (tests + verification)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- **[Story]** label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- User Story 2 and 3 primarily require verification of existing TTLManager and MemoryPromoter behavior - no modification needed per plan.md