# Implementation Plan: Skill Lazy Loading System

**Branch**: `011-skill-lazy-loading` | **Date**: 2026-04-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-skill-lazy-loading/spec.md`

## Summary

Implement a skill lazy loading mechanism for miniclaw: load only metadata (name, description, triggers) at startup, inject metadata into system prompt, let the AI model decide which skill to use, then load full content on-demand via the model's `read` tool call. This follows the pi-coding-agent convention and reduces startup time/prompt size.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js >=18
**Primary Dependencies**: @mariozechner/pi-coding-agent v0.65.2 (provides `loadSkillsFromDir`, `formatSkillsForPrompt`), express v5.2.1, socket.io v4.8.3
**Storage**: File system - skills stored in ~/.miniclaw/skills/ directory as SKILL.md files
**Testing**: vitest v4.0.18
**Target Platform**: Node.js CLI + API + Web service (multi-channel)
**Project Type**: CLI + API + Web service hybrid (channels: cli, api, feishu, web)
**Performance Goals**: Startup time <2 seconds with 10 skills; system prompt with metadata <2000 chars
**Constraints**: Model uses existing `read` tool to load skill content; no special skill-loading tool needed
**Scale/Scope**: 10+ skills expected, each SKILL.md ~1-5KB content

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: No constitution file found in project. Using standard development practices:
- [x] Tests required for new functionality
- [x] TypeScript strict mode compliance
- [x] Follow existing code patterns in src/core/skill/
- [x] No breaking changes to existing PiSkillManager API

**Gates Passed**: All clear to proceed.

## Project Structure

### Documentation (this feature)

```text
specs/011-skill-lazy-loading/
├── plan.md              # This file
├── spec.md              # Feature specification (completed)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (if needed)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── skill/
│   │   ├── index.ts           # Module entry (exports)
│   │   ├── types.ts           # Type definitions
│   │   ├── pi-manager.ts      # PiSkillManager (current implementation)
│   │   ├── loader.ts          # Skill loader (deprecated, for reference)
│   │   ├── manager.ts         # Old SkillManager (deprecated)
│   │   └── matcher.ts         # Skill matcher (deprecated)
│   ├── agent/
│   ├── gateway/
│   └── ...
├── channels/
│   ├── cli.ts
│   ├── api.ts
│   ├── web.ts
│   └── feishu.ts
├── tools/
│   ├── read-file.ts           # Read tool (model uses this for lazy loading)
│   └── ...
└── index.ts

tests/
├── unit/
│   └── skill/
│   │   ├── pi-manager.test.ts
│   │   └── loader.test.ts
│   └── ...
└── integration/
```

**Structure Decision**: Follow existing pattern in src/core/skill/. Modify pi-manager.ts to enhance lazy loading support. No new files needed - leverage existing read-file.ts tool.

## Complexity Tracking

> No Constitution violations - design follows existing patterns and uses pi-coding-agent standard APIs.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | No complexity introduced | Design uses existing pi-coding-agent API |

## Phase 0: Research

### Research Tasks

1. **Understand pi-coding-agent Skill API behavior**
   - How does `loadSkillsFromDir` work? Does it load content or just metadata?
   - What format does `formatSkillsForPrompt` produce?
   - Source: pi-coding-agent source code and documentation

2. **Understand model read tool usage**
   - How does the model know which file to read?
   - How is skill file path exposed to model?
   - Source: Existing read-file.ts implementation

3. **Review existing PiSkillManager implementation**
   - What is current behavior?
   - What changes are needed for lazy loading?
   - Source: src/core/skill/pi-manager.ts

### Research Findings

**Finding 1**: pi-coding-agent Skill API already implements lazy loading
- `loadSkillsFromDir` reads file but only extracts metadata (name, description, filePath)
- Skill type does NOT include content field
- `formatSkillsForPrompt` outputs `<available_skills>` XML with `<location>` tag
- Source: `/root/job/miniclaw/node_modules/@mariozechner/pi-coding-agent/dist/core/skills.js`

**Finding 2**: Model uses existing `read_file` tool for content loading
- `<location>` tag in prompt provides absolute file path
- Model can directly call `read_file({ path: "..." })`
- No special tool needed for skill loading

**Finding 3**: Current implementation is already complete!
- PiSkillManager correctly uses loadSkillsFromDir and formatSkillsForPrompt
- MiniclawAgent receives skillManager and injects prompts
- All channels (cli, api, web, feishu) properly initialize skillManager
- Source: `/root/job/miniclaw/src/index.ts`, `/root/job/miniclaw/src/core/agent/index.ts`

## Phase 1: Design & Contracts

**Status**: ✅ Completed

### Generated Artifacts

1. **research.md** - Research findings and decisions
2. **data-model.md** - Entity definitions and data flow
3. **quickstart.md** - Usage guide and examples

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Metadata loading | Use pi-coding-agent loadSkillsFromDir | Already implements lazy loading |
| Prompt format | Use formatSkillsForPrompt | Standard Agent Skills XML format |
| Content loading | Model uses read_file tool | No new tool needed |
| Configuration | Constructor params + config file | Follows existing pattern |

### Implementation Status

**No code changes needed!** The lazy loading system is already fully implemented:

- ✅ `PiSkillManager.load()` - Loads metadata only
- ✅ `PiSkillManager.getAllPrompts()` - Formats with `<location>`
- ✅ `MiniclawAgent` constructor - Injects skill prompts
- ✅ `main()` - Initializes and passes skillManager
- ✅ `read_file` tool - Available for model to load content

### Testing Requirements

While implementation is complete, tests should verify:

1. **Unit Tests**:
   - PiSkillManager.load() returns metadata only
   - getAllPrompts() produces valid XML with `<location>`
   - Skill filtering by disableModelInvocation

2. **Integration Tests**:
   - Agent system prompt contains skill metadata
   - Model can read skill files via read_file tool
   - Skill content is not loaded until read

### Contracts

No external contracts needed - the system uses pi-coding-agent's standard Skill API.

### Constitution Re-check

- [x] Tests required for new functionality → Need to add tests
- [x] TypeScript strict mode compliance → Existing code is compliant
- [x] Follow existing code patterns → Using pi-coding-agent patterns
- [x] No breaking changes to existing API → No changes made

## Phase 2: Tasks

Tasks will be generated by `/speckit.tasks` command.

### Recommended Tasks

1. **Add unit tests for PiSkillManager**
   - Test load() returns metadata only
   - Test getAllPrompts() format
   - Test skill filtering

2. **Add integration tests**
   - Test full lazy loading flow
   - Test model read tool integration

3. **Update documentation**
   - Add skill development guide
   - Update README with skill system info
