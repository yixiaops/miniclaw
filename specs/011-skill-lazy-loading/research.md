# Research: Skill Lazy Loading System

**Feature**: 011-skill-lazy-loading
**Date**: 2026-04-09

## Research Tasks

### 1. pi-coding-agent Skill API Behavior

**Question**: Does `loadSkillsFromDir` load content or just metadata?

**Finding**: `loadSkillsFromDir` reads the entire file but extracts **only metadata**:
- `name`: from frontmatter
- `description`: from frontmatter
- `filePath`: absolute path to SKILL.md
- `baseDir`: parent directory
- `sourceInfo`: source metadata
- `disableModelInvocation`: flag from frontmatter

The Skill type does NOT include a `content` field. This means the API is already "lazy" - it loads metadata only, not content.

**Source**: `pi-coding-agent/dist/core/skills.js:211-244` (loadSkillFromFile)

---

### 2. formatSkillsForPrompt Format

**Question**: What format does `formatSkillsForPrompt` produce?

**Finding**: Generates XML format per Agent Skills standard:

```xml
<available_skills>
  <skill>
    <name>skill-name</name>
    <description>skill description</description>
    <location>/path/to/SKILL.md</location>
  </skill>
</available_skills>
```

Key insight: `<location>` element contains the filePath, enabling the model to use the `read` tool to load full content.

**Source**: `pi-coding-agent/dist/core/skills.js:260-281`

---

### 3. Model Read Tool Usage

**Question**: How does the model know which file to read?

**Finding**: The `<location>` element in formatSkillsForPrompt output provides the absolute file path. The model uses the existing `read` tool to load the complete SKILL.md file.

Flow:
1. Startup: loadSkillsFromDir → Skill objects with filePath
2. Prompt injection: formatSkillsForPrompt → `<location>` shows file path
3. Model decision: sees task matches skill description
4. Lazy load: model calls read tool on `<location>` path
5. Full content: read returns complete SKILL.md (frontmatter + body)

**Source**: pi-coding-agent design, spec.md clarification

---

### 4. Current PiSkillManager Analysis

**Question**: Does current implementation support lazy loading?

**Finding**: **YES!** Current `PiSkillManager` already implements lazy loading correctly:

```typescript
// pi-manager.ts:168-181
getAllPrompts(): string {
  const activeSkills = this.skills.filter(s => !s.disableModelInvocation);
  return formatSkillsForPrompt(activeSkills);  // Includes <location>
}
```

- `load()` calls `loadSkillsFromDir` → metadata only
- `getAllPrompts()` uses `formatSkillsForPrompt` → includes `<location>`
- Model uses existing read tool to load content

**Gap**: Need to verify:
1. read tool is properly registered for model use
2. system prompt includes getAllPrompts() output
3. skill files are accessible (correct paths)

---

## Research Conclusions

### Decision 1: Leverage Existing pi-coding-agent API

**Decision**: Use existing pi-coding-agent Skill API (loadSkillsFromDir, formatSkillsForPrompt)
**Rationale**: Already implements lazy loading; no new code needed for metadata/formatting
**Alternatives Rejected**:
- Custom loader: unnecessary, pi-coding-agent already does this
- Custom format: would deviate from Agent Skills standard

### Decision 2: No New Skill-Loading Tool Needed

**Decision**: Model uses existing `read` tool to load SKILL.md content
**Rationale**: pi-coding-agent design specifies this; `<location>` provides path
**Alternatives Rejected**:
- New "load-skill" tool: redundant with read tool
- Pre-load content: defeats lazy loading purpose

### Decision 3: Minimal Changes to PiSkillManager

**Decision**: Only ensure integration points are correct:
1. System prompt includes `getAllPrompts()` output
2. Read tool available to model
3. Skill directory paths are correct

---

## Clarifications Resolved

| Item | Status | Resolution |
|------|--------|------------|
| Model requests skill content | RESOLVED | Model uses `read` tool on `<location>` path |
| Model "decides to use skill" | RESOLVED | Behavior = `read` tool call on skill file |
| Edge cases | RESOLVED | Use reasonable defaults (file not found → error) |
| Environment variables | OPTIONAL | Support via constructor params; env vars for convenience |
| formatSkillsForPrompt | RESOLVED | Follow pi-coding-agent XML format |

---

## Next Steps

Phase 1 tasks:
1. Verify system prompt integration (where does getAllPrompts() output go?)
2. Verify read tool availability in channels (cli, api, web, feishu)
3. Create/update tests for lazy loading behavior
4. Document usage in quickstart.md