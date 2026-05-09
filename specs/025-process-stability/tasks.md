---

description: "Task list for Process Stability Guard feature implementation"
---

# Tasks: Process Stability Guard

**Input**: Design documents from `/specs/025-process-stability/`
**Prerequisites**: plan.md, spec.md, clarify.md

**Tests**: Tests are REQUIRED per user request for TDD approach.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Project root**: `/root/job/miniclaw`
- **Source**: `src/`
- **Tests**: `tests/`
- **Config**: `config/`
- **Logs**: `logs/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and directory structure

- [ ] T001 Create logs/ directory at project root for exception logs
- [ ] T002 [P] Update TypeScript config if needed for new exception handler module

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Define exception log JSON format structure (timestamp, type, message, stack, source)
- [ ] T004 [P] Install pm2-logrotate module for PM2 log rotation

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - 异常捕获进程保活 (Priority: P1) 🎯 MVP

**Goal**: Implement global exception handlers to catch uncaught exceptions and unhandled rejections, keeping process alive and logging details.

**Independent Test**: Trigger exception with `throw new Error('test')` - verify process stays alive and exception logged.

### Tests for User Story 1 (TDD - Write FIRST, Must FAIL)

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T005 [P] [US1] Unit test for exception handler in tests/unit/exception-handler.test.ts
  - Test: uncaughtException handler logs exception without exiting
  - Test: unhandledRejection handler logs rejection without exiting
  - Test: exception log format matches JSON structure (timestamp, type, message, stack, source)
- [ ] T006 [P] [US1] Integration test for global exception handling in tests/integration/process-stability.test.ts
  - Test: Process remains alive after uncaught exception
  - Test: Process remains alive after unhandled rejection
  - Test: Feishu WebSocket callback exceptions are caught globally

### Implementation for User Story 1

- [ ] T007 [P] [US1] Add exceptionNotification config field to src/core/config.ts
  - Field: `exceptionNotification.enabled` (boolean, default: false)
  - Field: `exceptionNotification.feishuTarget` (optional, for notification target)
- [ ] T008 [US1] Create global exception handler in src/core/exception-handler.ts
  - Implement `setupGlobalExceptionHandler(config)` function
  - Register `process.on('uncaughtException')` handler
  - Register `process.on('unhandledRejection')` handler
  - Log exception to `logs/exception.log` in JSON format
  - Optionally send Feishu notification if enabled
  - DO NOT exit process after handling
- [ ] T009 [US1] Register exception handler in src/index.ts before main() execution
  - Import and call `setupGlobalExceptionHandler(config)`
  - Call BEFORE starting any channels
- [ ] T010 [US1] Verify feishu.ts WebSocket callbacks don't require modification (should be caught globally)

**Checkpoint**: User Story 1 complete - process survives exceptions, logs recorded, tests pass

---

## Phase 4: User Story 2 - 进程崩溃自动重启 (Priority: P2)

**Goal**: Configure PM2 to automatically restart crashed processes with restart delay.

**Independent Test**: Kill process with `kill -9` - verify PM2 restarts within 1 second.

### Tests for User Story 2 (TDD - Write FIRST, Must FAIL)

- [ ] T011 [US2] Integration test for PM2 auto-restart in tests/integration/process-stability.test.ts
  - Test: Process restarts within 1 second after crash
  - Test: PM2 respects restart_delay configuration

### Implementation for User Story 2

- [ ] T012 [P] [US2] Create PM2 ecosystem config in config/ecosystem.config.js
  - App name: 'miniclaw'
  - Script: 'npm run start:feishu' or 'dist/index.js'
  - restart_delay: 1000 (1 second)
  - wait_ready: true (wait for ready signal)
  - max_restarts: 5 (limit restart attempts)
- [ ] T013 [US2] Configure PM2 log rotation in ecosystem.config.js
  - Set log_date_format: 'YYYY-MM-DD HH:mm:ss'
  - Set merge_logs: false (separate error/output logs)
  - Set log file paths: logs/combined.log, logs/error.log

**Checkpoint**: User Story 2 complete - PM2 auto-restart configured, tests pass

---

## Phase 5: User Story 3 - 开机自启动服务 (Priority: P3)

**Goal**: Provide startup script with PM2 save and startup commands for auto-start on boot.

**Independent Test**: Run startup script - verify pm2 save succeeds, startup command generated.

### Tests for User Story 3 (Manual Test Only)

> **NOTE**: Auto-start on boot requires server restart - document as manual test

- [ ] T014 [US3] Create manual test documentation for PM2 startup in tests/integration/process-stability.test.ts
  - Document: pm2 startup command generates correct init script
  - Document: pm2 save persists process list

### Implementation for User Story 3

- [ ] T015 [P] [US3] Create PM2 startup script in config/pm2-start.sh
  - Command: `pm2 start ecosystem.config.js`
  - Command: `pm2 save`
  - Comment: `pm2 startup` command (require user to run manually)
  - Add shebang and execution permission
- [ ] T016 [US3] Document pm2-logrotate installation in pm2-start.sh comments
  - Command: `pm2 install pm2-logrotate` (run once)
  - Note: pm2-logrotate handles log rotation automatically

**Checkpoint**: User Story 3 complete - startup script ready, auto-start documented

---

## Phase 6: User Story 4 - 内存溢出保护 (Priority: P4)

**Goal**: Configure PM2 memory threshold to auto-restart when memory exceeds limit.

**Independent Test**: Simulate memory growth - verify PM2 restarts at threshold.

### Tests for User Story 4 (Manual Test Only)

> **NOTE**: Memory threshold test requires memory simulation - document as manual test

- [ ] T017 [US4] Create manual test documentation for memory threshold in tests/integration/process-stability.test.ts
  - Document: PM2 restarts when memory exceeds 500MB

### Implementation for User Story 4

- [ ] T018 [US4] Add max_memory_restart to ecosystem.config.js
  - Set max_memory_restart: '500M'
  - Note: Value configurable via config.json override if needed

**Checkpoint**: User Story 4 complete - memory protection configured

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup

- [ ] T019 Run all tests: `npm test` - verify all tests pass
- [ ] T020 Run quality gate: `npm run precommit` - verify lint, typecheck, tests all pass
- [ ] T021 [P] Update CLAUDE.md with exception handler architecture notes
- [ ] T022 [P] Add exception log format documentation to README or docs

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed sequentially in priority order (P1 → P2 → P3 → P4)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P2)**: Can start after User Story 1 - Uses ecosystem.config.js created in US1 tests phase
- **User Story 3 (P3)**: Can start after User Story 2 - Uses ecosystem.config.js from US2
- **User Story 4 (P4)**: Can start after User Story 2 - Modifies ecosystem.config.js from US2

### Within Each User Story

- Tests MUST be written and FAIL before implementation (TDD)
- Implementation tasks may have dependencies within the story
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T001 and T002 can run in parallel
- **Phase 2**: T003 and T004 can run in parallel
- **Phase 3**: T005 and T006 (tests) can run in parallel
- **Phase 3**: T007 can run in parallel with T008-T010 implementation
- **Phase 4**: T011 and T012 can run in parallel
- **Phase 5**: T014 and T015 can run in parallel
- **Phase 7**: T021 and T022 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together (TDD - write first):
Task: "T005: Unit test for exception handler in tests/unit/exception-handler.test.ts"
Task: "T006: Integration test in tests/integration/process-stability.test.ts"

# After tests written and failing, launch parallel implementation:
Task: "T007: Add exceptionNotification config to src/core/config.ts"
Task: "T008: Create exception handler in src/core/exception-handler.ts"
# T009 depends on T008 complete - must wait
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (异常捕获进程保活)
4. **STOP and VALIDATE**: Test exception handling independently
5. Deploy/demo - process survives exceptions

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test → Deploy (MVP!)
3. Add User Story 2 → PM2 auto-restart configured → Deploy
4. Add User Story 3 → Startup script ready → Deploy
5. Add User Story 4 → Memory protection configured → Deploy
6. Polish → All tests pass, quality gate passes

---

## Summary

| Phase | Tasks | Story | Parallel |
|-------|-------|-------|----------|
| Setup | 2 | - | 1 |
| Foundational | 2 | - | 1 |
| US1 (P1) | 6 | US1 | 3 |
| US2 (P2) | 3 | US2 | 1 |
| US3 (P3) | 3 | US3 | 1 |
| US4 (P4) | 2 | US4 | 0 |
| Polish | 4 | - | 2 |
| **Total** | **22** | - | **9** |

---

## Notes

- Tests are required for TDD approach (write first, fail, then implement)
- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Each user story should be independently testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently