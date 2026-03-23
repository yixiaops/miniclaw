# Tasks: Improve Test Coverage

**Input**: Design documents from `/specs/002-improve-test-coverage/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: This feature IS about improving test coverage, so all tasks are test-writing tasks.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- Paths shown below use the existing project structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify existing test infrastructure and establish baseline coverage

- [x] T001 Run `npm run test:coverage` to establish baseline coverage metrics
- [x] T002 Document current coverage percentages per module in `specs/002-improve-test-coverage/coverage-baseline.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: None required - project already has test infrastructure in place

**⚠️ Note**: This project already has Vitest configured with 192 existing tests. No foundational setup needed.

**Checkpoint**: Ready to implement user stories immediately

---

## Phase 3: User Story 1 - Developer Verifies Test Coverage Improvements (Priority: P1) 🎯 MVP

**Goal**: Achieve target coverage metrics (Total: 75%+, Branches: 65%+, Gateway: 70%+)

**Independent Test**: Run `npm run test:coverage` and verify all target thresholds are met

### Implementation for User Story 1

#### Gateway Tests (Primary Focus)

- [x] T003 [P] [US1] Add `initialize()` tests for session restoration in `tests/unit/core/gateway/index.test.ts`
- [x] T004 [P] [US1] Add `initialize()` empty storage test in `tests/unit/core/gateway/index.test.ts`
- [x] T005 [P] [US1] Add `streamHandleMessage()` streaming tests in `tests/unit/core/gateway/index.test.ts`
- [x] T006 [P] [US1] Add `getOrCreateAgent()` tests in `tests/unit/core/gateway/index.test.ts`
- [x] T007 [P] [US1] Add getter method tests (getRouter, getSessionManager, getAgentRegistry, getConfig) in `tests/unit/core/gateway/index.test.ts`

#### CLI Channel Tests (Branch Coverage)

- [x] T008 [P] [US1] Add `/model` command tests in `tests/unit/channels/cli.test.ts`
- [x] T009 [P] [US1] Add `/history` command tests in `tests/unit/channels/cli.test.ts`
- [x] T010 [P] [US1] Add empty input handling tests in `tests/unit/channels/cli.test.ts`
- [x] T011 [P] [US1] Add error handling tests in `processInput()` in `tests/unit/channels/cli.test.ts`

#### API Channel Tests (Branch Coverage)

- [x] T012 [P] [US1] Add POST `/chat` endpoint tests in `tests/unit/channels/api.test.ts`
- [x] T013 [P] [US1] Add GET `/status` endpoint tests in `tests/unit/channels/api.test.ts`
- [x] T014 [P] [US1] Add request validation tests in `tests/unit/channels/api.test.ts`
- [x] T015 [P] [US1] Add error response tests in `tests/unit/channels/api.test.ts`

#### Web Channel Tests (Branch Coverage)

- [x] T016 [P] [US1] Add WebSocket connection tests in `tests/unit/channels/web.test.ts`
- [x] T017 [P] [US1] Add message event tests in `tests/unit/channels/web.test.ts`
- [x] T018 [P] [US1] Add disconnection handling tests in `tests/unit/channels/web.test.ts`

#### Feishu Channel Tests (Branch Coverage)

- [x] T019 [P] [US1] Add webhook handling tests in `tests/unit/channels/feishu.test.ts`
- [x] T020 [P] [US1] Add event processing tests in `tests/unit/channels/feishu.test.ts`
- [x] T021 [P] [US1] Add error handling tests for invalid payloads in `tests/unit/channels/feishu.test.ts`

### Validation for User Story 1

- [x] T022 [US1] Run `npm run test:coverage` and verify total coverage ≥ 75%
- [x] T023 [US1] Verify branch coverage ≥ 65% in coverage report (currently 65.58%)
- [x] T024 [US1] Verify Gateway class coverage ≥ 70% in coverage report

**Checkpoint**: Coverage targets achieved - MVP complete

---

## Phase 4: User Story 2 - Developer Identifies Coverage Gaps (Priority: P2)

**Goal**: Document coverage gaps for future improvements

**Independent Test**: Review gap documentation and verify it matches coverage report

### Implementation for User Story 2

- [x] T025 [P] [US2] Generate detailed coverage report with `npm run test:coverage`
- [x] T026 [P] [US2] Document uncovered branches in `specs/002-improve-test-coverage/coverage-gaps.md`
- [x] T027 [P] [US2] Document uncovered error handling paths in `specs/002-improve-test-coverage/coverage-gaps.md`
- [x] T028 [US2] Prioritize remaining gaps for future iterations

**Checkpoint**: Coverage gaps documented and prioritized

---

## Phase 5: User Story 3 - Developer Maintains Test Quality (Priority: P3)

**Goal**: Ensure new tests are meaningful and maintainable

**Independent Test**: Run test suite and verify all tests pass with meaningful assertions

### Implementation for User Story 3

- [x] T029 [P] [US3] Review new tests for meaningful assertions
- [x] T030 [P] [US3] Verify tests follow project conventions (describe/it pattern, beforeEach/afterEach)
- [x] T031 [P] [US3] Run `npm test` and verify no flaky tests
- [x] T032 [US3] Run `npm run lint` and verify test files pass linting

**Checkpoint**: Test quality validated

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [x] T033 Run `npm run test:coverage` and capture final metrics
- [x] T034 Update `specs/002-improve-test-coverage/coverage-final.md` with final coverage percentages
- [x] T035 Verify all tests pass with `npm test`
- [x] T036 Run `npm run typecheck` to verify TypeScript types

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Skipped - existing infrastructure
- **User Stories (Phase 3-5)**: Can proceed immediately after Setup
- **Polish (Phase 6)**: Depends on User Story 1 completion

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies - primary implementation work
- **User Story 2 (P2)**: No dependencies on US1 - can run in parallel
- **User Story 3 (P3)**: Should run after US1 implementation to review new tests

### Within Each User Story

- All tasks marked [P] can run in parallel
- Gateway tests (T003-T007) are independent of Channel tests (T008-T021)
- Different channel tests are independent of each other

### Parallel Opportunities

**User Story 1 - Gateway Tests** (all parallel):
```bash
T003: initialize() tests
T004: initialize() empty storage test
T005: streamHandleMessage() tests
T006: getOrCreateAgent() tests
T007: getter method tests
```

**User Story 1 - Channel Tests** (all parallel):
```bash
T008-T011: CLI tests
T012-T015: API tests
T016-T018: Web tests
T019-T021: Feishu tests
```

---

## Parallel Example: User Story 1

```bash
# Launch Gateway tests together:
Task: "Add initialize() tests in tests/unit/core/gateway/index.test.ts"
Task: "Add initialize() empty storage test in tests/unit/core/gateway/index.test.ts"
Task: "Add streamHandleMessage() tests in tests/unit/core/gateway/index.test.ts"
Task: "Add getOrCreateAgent() tests in tests/unit/core/gateway/index.test.ts"
Task: "Add getter method tests in tests/unit/core/gateway/index.test.ts"

# Launch Channel tests together (different files):
Task: "Add /model command tests in tests/unit/channels/cli.test.ts"
Task: "Add POST /chat endpoint tests in tests/unit/channels/api.test.ts"
Task: "Add WebSocket connection tests in tests/unit/channels/web.test.ts"
Task: "Add webhook handling tests in tests/unit/channels/feishu.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (baseline metrics)
2. Skip Phase 2: Foundational (already complete)
3. Complete Phase 3: User Story 1 (all tests)
4. **STOP and VALIDATE**: Run `npm run test:coverage`
5. Verify all coverage targets met

### Incremental Delivery

1. Complete Setup → Baseline documented
2. Complete User Story 1 → Coverage targets achieved (MVP!)
3. Complete User Story 2 → Gaps documented
4. Complete User Story 3 → Quality validated
5. Complete Polish → Final validation

### Coverage Target Checklist

| Metric | Before | After | Target | Status |
|--------|--------|-------|--------|--------|
| Total | 72.27% | 78.34% | ≥ 75% | ✅ ACHIEVED |
| Branches | 59.7% | 65.58% | ≥ 65% | ✅ ACHIEVED |
| Gateway | 65% | 100% | ≥ 70% | ✅ EXCEEDED |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All tests use existing mock patterns from research.md
- Commit after each task or logical group
- Run `npm run test:coverage` frequently to track progress
- Focus on Gateway tests first (highest priority target)