# Research: pi-coding-agent Skill API Integration

**Feature**: 010-pi-skill-integration
**Date**: 2026-04-07

## 1. pi-coding-agent Skill API

### Key APIs

```typescript
// From @mariozechner/pi-coding-agent/dist/core/skills.d.ts

interface LoadSkillsFromDirOptions {
  dir: string;        // Directory to scan for skills
  source: string;     // Source identifier for these skills
}

interface LoadSkillsResult {
  skills: Skill[];
  diagnostics: ResourceDiagnostic[];
}

interface Skill {
  name: string;
  description: string;
  filePath: string;
  baseDir: string;
  sourceInfo: SourceInfo;
  disableModelInvocation: boolean;
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
  "disable-model-invocation"?: boolean;
  [key: string]: unknown;
}

// Main functions
function loadSkillsFromDir(options: LoadSkillsFromDirOptions): LoadSkillsResult;
function formatSkillsForPrompt(skills: Skill[]): string;
```

### Usage Pattern

```typescript
import { loadSkillsFromDir, formatSkillsForPrompt } from '@mariozechner/pi-coding-agent';

// Load skills from directory
const result = loadSkillsFromDir({
  dir: '/path/to/skills',
  source: 'miniclaw'
});

// Access loaded skills
console.log(`Loaded ${result.skills.length} skills`);

// Format for system prompt (XML format per Agent Skills standard)
const promptText = formatSkillsForPrompt(result.skills);
```

### Discovery Rules

Per pi-coding-agent implementation:
1. If a directory contains `SKILL.md`, treat it as a skill root and do not recurse further
2. Otherwise, load direct `.md` children in the root
3. Recurse into subdirectories to find `SKILL.md`

### formatSkillsForPrompt Output Format

Uses XML format per Agent Skills standard (https://agentskills.io/integrate-skills):

```xml
<skill name="skill-name">
<description>Skill description</description>
...
</skill>
```

Skills with `disableModelInvocation=true` are excluded from prompt.

---

## 2. Matching Strategy

### Problem

pi-coding-agent provides loading and formatting but NOT matching functionality.

### Options Evaluated

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Keep existing matcher | Well-tested, trigger-based matching | Uses different Skill type | **Selected** |
| Implement keyword matching | Simple | New code, needs testing | Rejected |
| Use description substring | Fast | Less precise | Rejected |

### Decision

Keep existing matcher from `src/core/skill/matcher.ts`, adapt to work with pi Skill type.

### Implementation

Create adapter that:
1. Converts pi Skill to local Skill format for matching
2. Uses existing `SkillMatcher.findBestMatch()` logic
3. Returns matched skill for prompt injection

---

## 3. Backward Compatibility

### Current State

- Skill system commented out in `src/index.ts` (lines 104-110)
- Skill system commented out in `src/core/agent/index.ts` (lines 41-42, 71, 574-595, 755-776)

### Requirements (per spec FR-009)

- Agent must work normally when no SkillManager configured
- No skill prompt injection if SkillManager is undefined

### Implementation

```typescript
// In MiniclawAgent constructor
constructor(config: Config, options?: MiniclawAgentOptions) {
  // ...
  this.skillManager = options?.skillManager;  // Optional
}

// In chat/streamChat
if (this.skillManager) {
  const matched = this.skillManager.match(input);
  if (matched) {
    // Inject prompt
  }
}
// else: no skill injection, normal operation
```

---

## 4. Skill Directory Configuration

### Default Location

Following pi-coding-agent convention:
- Global: `~/.pi/agent/skills/`
- Local: `<project>/.skills/`

### Miniclaw Configuration

Add to Config:
```typescript
interface Config {
  // ... existing fields
  skills?: {
    dir?: string;      // Custom skills directory
    enabled?: boolean; // Enable/disable skill system
  }
}
```

Default: `~/.miniclaw/skills/` (consistent with existing Miniclaw convention)

---

## 5. Error Handling

### Loading Errors

- `loadSkillsFromDir` returns diagnostics for invalid files
- Log errors but continue loading valid skills
- Startup continues even if skill loading fails

### Matching Errors

- No match → return null, normal operation
- Match but no prompt → empty string, no injection

---

## Summary

| Decision | Rationale |
|----------|-----------|
| Use `loadSkillsFromDir` + `formatSkillsForPrompt` | Standardized loading/formatting |
| Keep existing matcher | Well-tested, trigger-based matching |
| Optional SkillManager injection | Backward compatibility |
| Default directory `~/.miniclaw/skills/` | Consistent with Miniclaw convention |
| Graceful error handling | Robust startup behavior |