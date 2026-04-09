# Test Tasks: Skill Lazy Loading System

**Branch**: `011-skill-lazy-loading` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)

## Summary

Add comprehensive tests to verify the skill lazy loading mechanism. Implementation is already complete (PR #31), but tests are needed to ensure the behavior matches spec requirements.

## Test Coverage Goals

| Metric | Current | Target | Threshold |
|--------|---------|--------|-----------|
| Line Coverage | ~70% | 80%+ | 70% (vitest) |
| Function Coverage | ~70% | 85%+ | 70% (vitest) |
| Branch Coverage | ~60% | 75%+ | 60% (vitest) |

## Tasks

### Phase 1: Unit Tests for PiSkillManager

**File**: `tests/unit/skill/pi-manager.test.ts`

#### Task 1.1: Constructor and Initialization Tests
- [ ] Test default skillsDir path (`~/.miniclaw/skills`)
- [ ] Test custom skillsDir via options
- [ ] Test enabled/disabled flag
- [ ] Test source parameter

#### Task 1.2: load() Method Tests (FR-001, FR-002)
- [ ] Test load returns skills metadata only (no content field)
- [ ] Test load returns empty array when disabled
- [ ] Test load returns empty array when directory doesn't exist
- [ ] Test load handles malformed skill files gracefully (FR-008)
- [ ] Test load returns diagnostics for errors/warnings

#### Task 1.3: getAllPrompts() Method Tests (FR-003, FR-004)
- [ ] Test output is `<available_skills>` XML format
- [ ] Test each skill has `<skill>` element with `<name>` and `<description>`
- [ ] Test each skill includes `<location>` tag with file path
- [ ] Test skills with `disableModelInvocation` are filtered out
- [ ] Test returns empty string when no skills or disabled

#### Task 1.4: Helper Methods Tests
- [ ] Test count() returns correct skill count
- [ ] Test getNames() returns array of skill names
- [ ] Test getAll() returns skill array copy
- [ ] Test getStatus() returns complete status object
- [ ] Test isEnabled() returns correct state

### Phase 2: Integration Tests

**File**: `tests/integration/skill-lazy-loading.test.ts`

#### Task 2.1: Skill Discovery Flow (User Story 1)
- [ ] Test startup loads only metadata (file content not accessed)
- [ ] Test skill names appear in system prompt
- [ ] Test skill content is NOT in system prompt at startup

#### Task 2.2: Model Decision Flow (User Story 2)
- [ ] Test agent system prompt contains skill metadata
- [ ] Test skill metadata format matches pi-coding-agent standard
- [ ] Test model can see multiple skills and choose relevant one

#### Task 2.3: On-Demand Content Loading (User Story 3)
- [ ] Test read_file tool can load SKILL.md content
- [ ] Test only selected skill file is read (not all files)
- [ ] Test skill file path matches `<location>` in metadata

#### Task 2.4: Full Lazy Loading Cycle
- [ ] Test complete flow: startup → metadata injection → model read → content loaded
- [ ] Test concurrent skill content requests use cached results
- [ ] Test skill file deleted after metadata load (error handling)

### Phase 3: Edge Case Tests

**File**: `tests/unit/skill/pi-manager-edge.test.ts`

#### Task 3.1: Error Handling Tests
- [ ] Test skill file deleted after metadata loaded (edge case #1)
- [ ] Test skill file permission denied
- [ ] Test skill file read timeout
- [ ] Test malformed YAML frontmatter

#### Task 3.2: Configuration Tests (User Story 5)
- [ ] Test MINICLAW_SKILLS_DIR environment variable (FR-009)
- [ ] Test MINICLAW_SKILLS_ENABLED=false behavior
- [ ] Test default configuration when no env vars set

#### Task 3.3: Performance Tests (Success Criteria)
- [ ] Test startup time with 10 skills < 2 seconds (SC-001)
- [ ] Test system prompt size with 10 skills < 2000 chars (SC-004)
- [ ] Test only 1 skill file read when model selects one skill (SC-003)

### Phase 4: Test Fixtures

**Directory**: `tests/fixtures/pi-skills/`

#### Task 4.1: Create Test Skill Files
- [ ] Create `weather/SKILL.md` with valid frontmatter
- [ ] Create `github/SKILL.md` with valid frontmatter
- [ ] Create `malformed/SKILL.md` with invalid frontmatter
- [ ] Create `disabled/SKILL.md` with `disableModelInvocation: true`

## Test Matrix

| Spec Requirement | Test Location | Coverage |
|------------------|---------------|----------|
| FR-001: Metadata only | Task 1.2 | ✅ |
| FR-002: No content at startup | Task 1.2, 2.1 | ✅ |
| FR-003: Metadata format | Task 1.3 | ✅ |
| FR-004: Model sees skills | Task 2.2 | ✅ |
| FR-005: Model decision | Task 2.2 | ✅ |
| FR-006: Content on demand | Task 2.3 | ✅ |
| FR-007: Load only selected | Task 2.3 | ✅ |
| FR-008: Graceful error handling | Task 1.2, 3.1 | ✅ |
| FR-009: Environment variables | Task 3.2 | ✅ |
| SC-001: Startup time | Task 3.3 | ✅ |
| SC-003: Single file read | Task 3.3 | ✅ |
| SC-004: Prompt size | Task 3.3 | ✅ |

## Execution Order

1. **Phase 1** - Unit tests (foundation)
2. **Phase 4** - Test fixtures (needed for Phases 2-3)
3. **Phase 2** - Integration tests (core flow)
4. **Phase 3** - Edge cases and performance (polish)

## Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/unit/skill/pi-manager.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Dependencies

- `vitest` - Test framework (already installed)
- `@vitest/coverage-v8` - Coverage reporter (already installed)
- `@mariozechner/pi-coding-agent` - Skill API (already installed)

## Notes

- PiSkillManager uses `loadSkillsFromDir` from pi-coding-agent, which already implements lazy loading
- The existing `tests/unit/skill/manager.test.ts` and `tests/unit/skill/loader.test.ts` are for the deprecated SkillManager, not PiSkillManager
- New tests should follow the same vitest patterns as existing tests