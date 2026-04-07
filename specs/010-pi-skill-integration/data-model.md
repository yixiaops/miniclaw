# Data Model: pi-coding-agent Skill API Integration

**Feature**: 010-pi-skill-integration
**Date**: 2026-04-07

## Core Entities

### PiSkillManager

Wrapper for pi-coding-agent Skill APIs. Manages skill loading, matching, and prompt formatting.

```typescript
interface PiSkillManagerOptions {
  /** Skills directory path */
  skillsDir?: string;
  /** Source identifier for loaded skills */
  source?: string;
  /** Enable/disable skill system */
  enabled?: boolean;
}

class PiSkillManager {
  // Properties
  private skills: Skill[];           // Loaded skills from pi-coding-agent
  private matcher: SkillMatcher;     // Existing matcher for matching logic
  private skillsDir: string;         // Configured directory
  private enabled: boolean;          // Is skill system enabled

  // Methods
  load(): void;                      // Load skills from directory
  match(input: string): Skill | null; // Match user input to skill
  getPrompt(skill: Skill): string;   // Get formatted prompt for skill
  count(): number;                   // Number of loaded skills
  getNames(): string[];              // List of skill names
  getAll(): Skill[];                 // All loaded skills
  getStatus(): SkillSystemStatus;    // System status
}
```

### Skill (pi-coding-agent type)

```typescript
// From @mariozechner/pi-coding-agent
interface Skill {
  name: string;           // Skill name
  description: string;    // Skill description (contains triggers)
  filePath: string;       // Absolute path to skill file
  baseDir: string;        // Base directory for skill
  sourceInfo: SourceInfo; // Source metadata
  disableModelInvocation: boolean; // If true, exclude from auto-prompt
}
```

### SkillMatchResult

Result from matching user input to skills.

```typescript
interface SkillMatchResult {
  skill: Skill;           // Matched skill
  matchType: 'trigger' | 'description'; // How it matched
  matchedKeyword: string; // The keyword that triggered match
}
```

### SkillSystemStatus

Status information for the skill system.

```typescript
interface SkillSystemStatus {
  skillCount: number;     // Number of loaded skills
  skillNames: string[];   // Names of loaded skills
  skillsDir: string;      // Directory path
  enabled: boolean;       // Is system enabled
  diagnostics: ResourceDiagnostic[]; // Any loading errors
}
```

---

## Relationships

```
PiSkillManager
    │
    ├── uses ──► loadSkillsFromDir (pi-coding-agent)
    │
    ├── uses ──► formatSkillsForPrompt (pi-coding-agent)
    │
    ├── uses ──► SkillMatcher (existing)
    │               │
    │               └──► triggers: string[] (from Skill.description)
    │
    └── produces ──► SkillMatchResult
                      │
                      └──► Skill
```

---

## State Transitions

### Skill Loading

```
[Uninitialized] ──► load() ──► [Loaded]
                      │
                      ├── skills populated
                      ├── matcher initialized
                      └── diagnostics logged
```

### Skill Matching

```
[Loaded] ──► match(input) ──► [Matched] or [NoMatch]
                │
                ├── Matched → getPrompt() → inject into Agent
                └── NoMatch → normal Agent operation
```

---

## Validation Rules

| Field | Rule |
|-------|------|
| `skillsDir` | Must exist if configured, warn if missing |
| `Skill.name` | Required, non-empty |
| `Skill.description` | Required, non-empty |
| `disableModelInvocation` | Boolean, default false |

---

## Configuration Extension

```typescript
// Add to src/core/config.ts Config interface
interface Config {
  // ... existing fields
  skills?: {
    /** Skills directory path, default ~/.miniclaw/skills */
    dir?: string;
    /** Enable skill system, default true */
    enabled?: boolean;
  }
}
```

Environment variables:
- `MINICLAW_SKILLS_DIR` - Custom skills directory
- `MINICLAW_SKILLS_ENABLED` - Enable/disable (true/false)