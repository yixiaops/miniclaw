# Feature Specification: Skill System

**Feature Branch**: `006-skill-system`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "实现技能系统，通过 SKILL.md 文件定义可扩展的专业能力，Agent 可自动识别并执行技能"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Loads Skills on Startup (Priority: P1)

As the Miniclaw system, I want to automatically load all skills from the skills directory on startup so that agents can immediately use available capabilities.

**Why this priority**: This is the foundation of the skill system - without automatic loading, no skills would be available for use.

**Independent Test**: Can be fully tested by placing SKILL.md files in `~/.miniclaw/skills/`, starting the agent, and verifying skills are loaded and accessible.

**Acceptance Scenarios**:

1. **Given** skill files exist in `~/.miniclaw/skills/weather/SKILL.md` and `~/.miniclaw/skills/github/SKILL.md`, **When** the system starts, **Then** both skills are loaded and accessible via SkillManager
2. **Given** the skills directory does not exist, **When** the system starts, **Then** it creates the directory and continues without errors
3. **Given** a malformed SKILL.md file (missing required fields), **When** the system loads skills, **Then** the error is logged and other skills continue to load

---

### User Story 2 - Agent Matches Skill Based on User Input (Priority: P1)

As an AI Agent, I want to match the appropriate skill based on user input triggers so that I can activate the most relevant capability for the user's request.

**Why this priority**: Skill matching is the core functionality that enables intelligent skill activation - without it, skills cannot be used contextually.

**Independent Test**: Can be tested by calling SkillManager.match() with various inputs and verifying correct skill matches.

**Acceptance Scenarios**:

1. **Given** a weather skill with triggers ["天气", "气温", "下雨"], **When** user input contains "今天天气怎么样", **Then** the weather skill is matched
2. **Given** multiple skills with overlapping triggers, **When** user input matches multiple triggers, **Then** the skill with the most specific match is returned
3. **Given** user input that doesn't match any skill triggers, **When** match() is called, **Then** null is returned

---

### User Story 3 - Skill Content Injected into System Prompt (Priority: P1)

As an AI Agent, I want the matched skill's content injected into my system prompt so that I can execute the skill correctly.

**Why this priority**: This is how skills affect agent behavior - the prompt injection is essential for the LLM to understand how to use the skill.

**Independent Test**: Can be tested by matching a skill and verifying the generated system prompt contains the skill content.

**Acceptance Scenarios**:

1. **Given** weather skill is matched, **When** the agent builds its system prompt, **Then** the prompt includes "## Active Skill: weather" followed by the skill content
2. **Given** no skill is matched, **When** the agent builds its system prompt, **Then** no skill section is added
3. **Given** a skill with YAML frontmatter, **When** the skill is loaded, **Then** only the markdown content (not frontmatter) is injected into the prompt

---

### User Story 4 - User Creates Custom Skills (Priority: P2)

As a user, I want to create my own skills in the custom skills directory so that I can extend the agent's capabilities for my specific needs.

**Why this priority**: User extensibility is a key value proposition, but builds on the core skill loading and matching functionality.

**Independent Test**: Can be tested by creating a custom SKILL.md file and verifying it is loaded and matches correctly.

**Acceptance Scenarios**:

1. **Given** a custom skill at `~/.miniclaw/skills/custom/my-skill/SKILL.md`, **When** the system loads skills, **Then** the custom skill is included
2. **Given** a custom skill with valid YAML frontmatter and markdown content, **When** the skill is loaded, **Then** it has correct name, description, and content
3. **Given** user wants to know available skills, **When** they check SkillManager.getAll(), **Then** both built-in and custom skills are listed

---

### User Story 5 - SKILL.md Metadata Parsing (Priority: P2)

As the SkillManager, I want to parse YAML frontmatter from SKILL.md files so that I can extract skill metadata (name, description, dependencies).

**Why this priority**: Proper metadata parsing enables rich skill definitions and dependency management.

**Independent Test**: Can be tested by creating SKILL.md files with various frontmatter formats and verifying correct parsing.

**Acceptance Scenarios**:

1. **Given** a SKILL.md with YAML frontmatter containing name, description, and metadata, **When** the skill is loaded, **Then** all fields are correctly parsed
2. **Given** a SKILL.md without frontmatter, **When** the skill is loaded, **Then** default values are used (name from directory, description empty)
3. **Given** a SKILL.md with metadata.tools field, **When** the skill is loaded, **Then** the tools array is available for dependency checking

---

### Edge Cases

- What happens when a SKILL.md file has invalid YAML frontmatter?
- How does the system handle skills with conflicting names?
- What happens when a skill directory exists but contains no SKILL.md file?
- How does the system handle very large SKILL.md files (>100KB)?
- What happens when triggers in description contain special regex characters?
- How does the system handle Unicode triggers and descriptions?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a SkillManager class that loads, stores, and retrieves skills
- **FR-002**: The SkillManager MUST automatically load all skills from `~/.miniclaw/skills/` directory on initialization when autoLoad is true
- **FR-003**: The system MUST parse SKILL.md files containing YAML frontmatter and markdown content
- **FR-004**: SKILL.md frontmatter MUST include required fields: `name` (string), `description` (string)
- **FR-005**: SKILL.md frontmatter MAY include optional fields: `homepage` (string), `metadata.tools` (string[]), `metadata.bins` (string[]), `metadata.env` (string[])
- **FR-006**: The SkillManager MUST provide a `match(input: string)` method that returns the best matching Skill or null
- **FR-007**: Skill matching MUST use trigger words extracted from the description field (e.g., "触发词：天气、气温")
- **FR-008**: The SkillManager MUST provide a `getPrompt(skillName: string)` method that returns the skill content for system prompt injection
- **FR-009**: The system MUST support both built-in skills (weather, github, web-search, shell, file) and user-defined custom skills
- **FR-010**: Custom skills MUST be placed in `~/.miniclaw/skills/custom/` directory
- **FR-011**: The system MUST handle missing or malformed skill files gracefully without crashing
- **FR-012**: The SkillManager MUST provide a `getAll()` method returning all loaded skills

### Key Entities

- **Skill**: Represents a loaded skill with name, description, triggers array, content (markdown body), and path
- **SkillManager**: Manages skill loading, matching, and retrieval; holds a Map of skills
- **SkillManagerConfig**: Configuration for skills directory path and autoLoad behavior

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All skills in `~/.miniclaw/skills/` are loaded within 1 second on startup
- **SC-002**: Skill matching accuracy exceeds 90% for inputs containing trigger words
- **SC-003**: Users can create and use custom skills within 5 minutes
- **SC-004**: At least 2 built-in skills (weather, github) are provided and functional
- **SC-005**: No system crashes when encountering malformed skill files
- **SC-006**: Skill content is correctly injected into agent system prompts when matched

### Technical Quality Metrics

- **TQ-001**: Unit test coverage for SkillManager exceeds 80%
- **TQ-002**: TypeScript strict mode compliance with no `any` types
- **TQ-003**: All public methods have JSDoc documentation
- **TQ-004**: Integration test with MiniclawAgent verifies skill activation

## Technical Design *(optional but recommended)*

### Directory Structure

```
~/.miniclaw/skills/
├── weather/
│   └── SKILL.md
├── github/
│   └── SKILL.md
├── web-search/
│   └── SKILL.md
├── shell/
│   └── SKILL.md
├── file/
│   └── SKILL.md
└── custom/
    └── [user-defined]/
        └── SKILL.md
```

### SKILL.md Format

```markdown
---
name: skill-name
description: "Skill description with triggers: 触发词：词1、词2"
homepage: https://example.com (optional)
metadata:
  tools: [tool1, tool2] (optional)
  bins: [binary1] (optional)
  env: [ENV_VAR] (optional)
---

# Skill Title

Skill content in markdown...

## When to Use
...

## Commands
...

## Notes
...
```

### SkillManager API

```typescript
interface Skill {
  name: string;
  description: string;
  triggers: string[];
  content: string;
  path: string;
  homepage?: string;
  metadata?: {
    tools?: string[];
    bins?: string[];
    env?: string[];
  };
}

interface SkillManagerConfig {
  skillsDir: string;
  autoLoad: boolean;
}

class SkillManager {
  private skills: Map<string, Skill>;
  
  loadAll(): Promise<void>;
  load(skillPath: string): Promise<Skill>;
  match(input: string): Skill | null;
  getAll(): Skill[];
  getPrompt(skillName: string): string;
}
```

## Open Questions

1. Should skill matching use fuzzy matching or exact substring matching?
2. How should conflicting skills (same trigger words) be resolved?
3. Should skills be able to define their own tools dynamically?
4. Should there be a skill priority or weight system?
5. How should skill hot-reloading work (if at all)?

## Dependencies

- `gray-matter` or similar for YAML frontmatter parsing
- Existing MiniclawAgent class for integration
- Configuration system for skills directory path

## References

- OpenClaw AgentSkills specification: https://agentskills.io
- OpenClaw skills directory structure
- REQUIREMENTS_V6.md Section 2: 技能系统设计