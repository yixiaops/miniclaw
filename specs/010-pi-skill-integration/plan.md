# Implementation Plan: pi-coding-agent Skill API Integration

**Branch**: `010-pi-skill-integration` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-pi-skill-integration/spec.md`

## Summary

Integrate @mariozechner/pi-coding-agent's Skill API into Miniclaw, replacing the existing custom skill system. This involves:
1. Creating a new SkillManager wrapper using pi-coding-agent's `loadSkillsFromDir` and `formatSkillsForPrompt` APIs
2. Updating `src/index.ts` to initialize the new SkillManager at startup
3. Enhancing `MiniclawAgent` to inject skill prompts into system prompt when matched

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: @mariozechner/pi-agent-core (^0.57.1), @mariozechner/pi-coding-agent (^0.65.2)
**Storage**: N/A (skills loaded from markdown files in filesystem)
**Testing**: Vitest (^4.0.18)
**Target Platform**: Linux server (Node.js runtime)
**Project Type**: CLI/web-service AI assistant framework
**Performance Goals**: Startup <2s with 50+ skills, matching <100ms per input
**Constraints**: Must maintain backward compatibility when no skills configured
**Scale/Scope**: Personal assistant, single user, ~10-50 skills typical

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: No constitution defined (template file only). Proceeding without gate constraints.

## Project Structure

### Documentation (this feature)

```text
specs/010-pi-skill-integration/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (N/A - internal integration)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── agent/
│   │   └── index.ts         # MiniclawAgent - needs skill integration
│   │   └── registry.ts      # AgentRegistry
│   ├── gateway/
│   │   └── index.ts         # MiniclawGateway
│   ├── skill/
│   │   ├── pi-manager.ts    # NEW: pi SkillManager wrapper
│   │   ├── index.ts         # Existing exports (to be updated)
│   │   ├── types.ts         # Existing types
│   │   └── matcher.ts       # Existing matcher
│   │   └── loader.ts        # Existing loader
│   │   └── manager.ts       # Existing manager (to be deprecated)
│   └── config.ts            # Configuration
├── index.ts                 # Main entry - needs SkillManager init
└── tools/
    └── index.ts             # Built-in tools

tests/
├── unit/
│   └── skill-manager.test.ts  # Unit tests for new pi-manager
└── integration/
    └── skill-flow.test.ts     # Integration tests for skill flow
```

**Structure Decision**: Single project structure. New file `pi-manager.ts` added to existing `src/core/skill/` directory.

## Complexity Tracking

No complexity violations - straightforward integration using existing APIs.

---

## Phase 0: Research

### Research Tasks

1. **pi-coding-agent Skill API Usage**
   - API: `loadSkillsFromDir(options)` - synchronous loading from directory
   - API: `formatSkillsForPrompt(skills)` - XML format per Agent Skills standard
   - Types: `Skill`, `SkillFrontmatter`, `LoadSkillsResult`, `LoadSkillsFromDirOptions`

2. **Skill Discovery Rules (from pi-coding-agent)**
   - If directory contains SKILL.md, treat as skill root (no recursion)
   - Otherwise, load direct .md children in root
   - Recurse into subdirectories to find SKILL.md

3. **Matching Strategy**
   - Existing custom matcher in `src/core/skill/matcher.ts` works on triggers extracted from description
   - pi-coding-agent does NOT provide matching - only loading and formatting
   - Need to keep existing matcher or implement simple keyword matching

4. **Backward Compatibility**
   - Current skill system is commented out in `src/index.ts` and `src/core/agent/index.ts`
   - Agent must work normally when no SkillManager configured

### Research Output

**Decision**: Use pi-coding-agent for loading/formatting, keep existing matcher for matching logic.

**Rationale**: pi-coding-agent provides standardized skill loading and prompt formatting, but does not include matching functionality. The existing matcher in `src/core/skill/matcher.ts` can be reused with minor adaptations.

**Alternatives Considered**:
- Implement new matcher from scratch: Rejected - existing matcher is well-tested
- Use pi-coding-agent AgentSession directly: Rejected - too invasive, would change entire architecture

---

## Phase 1: Design

### Data Model

See `data-model.md` for entity definitions.

Key entities:
- **PiSkillManager**: Wrapper for pi-coding-agent Skill APIs
- **SkillMatchResult**: Existing type, reused for matching results

### Contracts

**N/A** - This is an internal integration, no external API contracts changed.

### Integration Points

1. **src/core/skill/pi-manager.ts** (NEW)
   - Imports from `@mariozechner/pi-coding-agent`
   - `loadSkillsFromDir()` → synchronous skill loading
   - `formatSkillsForPrompt()` → prompt formatting
   - Exposes: `match(input)`, `getPrompt(skillName)`, `count()`, `getNames()`

2. **src/index.ts**
   - Initialize PiSkillManager at startup
   - Pass to AgentRegistry/createAgentFactory
   - Log loaded skill count

3. **src/core/agent/index.ts**
   - Accept SkillManager in constructor options
   - Inject skill prompt before `agent.prompt()`
   - Restore original system prompt after processing

### Quickstart

See `quickstart.md` for developer setup guide.