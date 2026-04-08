# Tasks: pi-coding-agent Skill API Integration

**Input**: Design documents from `/specs/010-pi-skill-integration/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: Not explicitly requested in specification - omitted.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Configuration and project structure updates

- [X] T001 Add skills configuration to Config interface in src/core/config.ts
- [X] T002 [P] Add skills-related environment variable parsing in src/core/config.ts
- [X] T003 [P] Update exports in src/core/skill/index.ts for new pi-manager

---

## Phase 2: Foundational

**Purpose**: Core SkillManager implementation that MUST complete before Agent integration

**⚠️ CRITICAL**: No user story work can begin until PiSkillManager exists

- [X] T004 Create PiSkillManager class skeleton in src/core/skill/pi-manager.ts
- [X] T005 Implement PiSkillManager constructor with options (skillsDir, source, enabled)
- [X] T006 Implement PiSkillManager.load() using loadSkillsFromDir from pi-coding-agent
- [X] T007 [P] Implement PiSkillManager.count() and getNames() helper methods
- [X] T008 [P] Implement PiSkillManager.getAll() and getStatus() methods

**Checkpoint**: PiSkillManager can load skills - foundation ready for user stories ✅

---

## Phase 3: User Story 1 - Skill Loading at Startup (Priority: P1) 🎯 MVP

**Goal**: System loads skill definitions at startup and logs status

**Independent Test**: Start application in CLI mode, verify startup logs show skill count

### Implementation for User Story 1

- [X] T009 [US1] Initialize PiSkillManager in src/index.ts main function
- [X] T010 [US1] Log skill loading status at startup in src/index.ts
- [X] T011 [US1] Handle missing skills directory gracefully in src/index.ts
- [X] T012 [US1] Pass SkillManager to AgentRegistry via createAgentFactory in src/index.ts

**Checkpoint**: Application loads skills at startup and logs status - US1 complete ✅

---

## Phase 4: User Story 2 - Skill Matching During Conversation (Priority: P2)

**Goal**: System matches user input to skills based on triggers

**Independent Test**: Send trigger phrase in CLI, observe log showing skill matched

### Implementation for User Story 2

- [X] T013 [US2] Import existing SkillMatcher in src/core/skill/pi-manager.ts
- [X] T014 [US2] Implement PiSkillManager.match(input) method using SkillMatcher
- [X] T015 [US2] Extract triggers from Skill.description for matcher initialization
- [X] T016 [US2] Return SkillMatchResult or null from match() method
- [X] T017 [P] [US2] Add match logging in PiSkillManager.match() method

**Checkpoint**: Skill matching works - US2 complete and independently testable ✅

---

## Phase 5: User Story 3 - Skill Prompt Injection into Agent (Priority: P3)

**Goal**: Matched skill prompt injected into Agent system prompt, restored after processing

**Independent Test**: Match a skill, verify Agent response follows skill guidance

### Implementation for User Story 3

- [X] T018 [US3] Add skillManager to MiniclawAgentOptions in src/core/agent/index.ts
- [X] T019 [US3] Store skillManager reference in MiniclawAgent constructor
- [X] T020 [US3] Implement PiSkillManager.getPrompt(skill) using formatSkillsForPrompt
- [X] T021 [US3] Add skill matching in MiniclawAgent.chat() before agent.prompt()
- [X] T022 [US3] Inject skill prompt into system prompt when matched
- [X] T023 [US3] Restore original system prompt after processing in chat()
- [X] T024 [P] [US3] Add skill matching in MiniclawAgent.streamChat() method
- [X] T025 [P] [US3] Implement same prompt injection/restoration for streamChat()
- [X] T026 [US3] Add skill injection logging in Agent chat methods

**Checkpoint**: Skill prompt injection works - US3 complete, all user stories functional ✅

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation and validation

- [X] T027 Run quickstart.md validation - test CLI mode with sample skill
- [X] T028 [P] Update CLAUDE.md with skills configuration documentation
- [X] T029 Verify backward compatibility - test Agent without SkillManager

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational completion
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational - No dependencies on other stories
- **US2 (P2)**: Can start after Foundational - Depends on PiSkillManager.load() from US1
- **US3 (P3)**: Can start after US2 - Needs match() and getPrompt() methods

### Within Each User Story

- Configuration before implementation
- Core methods before helper methods
- Integration after component implementation

### Parallel Opportunities

- T001-T003 (Setup) - different files, can run in parallel
- T007-T008 (Foundational) - helper methods, independent
- T024-T025 (US3) - streamChat is separate from chat method

---

## Parallel Example: Phase 1 Setup

```bash
# Launch all Setup tasks together:
Task: "Add skills configuration to Config interface in src/core/config.ts"
Task: "Add skills-related environment variable parsing in src/core/config.ts"
Task: "Update exports in skill/index.ts for new pi-manager"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test startup logs show skills loaded
5. Application can start with skill system enabled

### Incremental Delivery

1. Setup + Foundational → PiSkillManager loads skills
2. US1 → Startup initialization, logs skill count
3. US2 → Matching user input to skills
4. US3 → Full integration: match → inject → restore
5. Polish → Validate quickstart, update docs

---

## Notes

- [P] tasks = different files or methods, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Backward compatibility verified in T029 - Agent works without SkillManager