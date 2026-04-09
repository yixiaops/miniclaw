# Feature Specification: Skill Lazy Loading System

**Feature Branch**: `011-skill-lazy-loading`
**Created**: 2026-04-08
**Status**: Draft
**Input**: User description: "miniclaw skill 系统重构：实现懒加载机制。核心需求：1) 启动时只加载元数据（name、description、keywords）；2) 大模型根据元数据决策使用哪个 skill；3) 确定使用后按需加载完整内容。参考 PR #31: https://github.com/yixiaops/miniclaw/pull/31"

## User Scenarios & Testing

### User Story 1 - Skill Discovery at Startup (Priority: P1)

When the application starts, the skill system scans the skills directory and loads only metadata (name, description, keywords/triggers) for each skill. This enables fast startup while allowing the AI model to discover available skills.

**Why this priority**: This is the foundational capability - without metadata loading, the model cannot know what skills exist. It directly addresses the startup performance concern.

**Independent Test**: Can be fully tested by starting the application with skills configured, checking logs for metadata-only loading behavior, and verifying that skill names appear in the system prompt without full content.

**Acceptance Scenarios**:

1. **Given** skills directory contains 3 skill files, **When** application starts, **Then** only skill metadata (name, description, triggers) is loaded, not full content
2. **Given** skills directory does not exist, **When** application starts, **Then** skill system initializes gracefully with zero skills loaded
3. **Given** a skill file has malformed frontmatter, **When** application starts, **Then** the system logs a warning and continues loading other skills

---

### User Story 2 - Model Decision Based on Metadata (Priority: P1)

The AI model receives skill metadata in its system prompt. Based on this metadata, the model autonomously decides which skill (if any) is relevant to the user's request. The model can see available skills and their descriptions without needing to read full skill files.

**Why this priority**: This is the core behavioral change - shifting skill selection from code-based matching to model-based decision. Without this, lazy loading cannot function.

**Independent Test**: Can be tested by sending a message that should trigger a specific skill and verifying the model's response indicates awareness of that skill's availability.

**Acceptance Scenarios**:

1. **Given** a weather skill metadata is in system prompt, **When** user asks "郑州今天天气", **Then** model recognizes the weather skill is available and indicates it should use that skill
2. **Given** multiple skill metadata is available, **When** user asks a question, **Then** model can decide which skill is most relevant based on descriptions and triggers
3. **Given** no skills match the user request, **When** user asks a general question, **Then** model responds without attempting to load any skill

---

### User Story 3 - On-Demand Content Loading (Priority: P1)

After the model decides to use a specific skill, it requests the full skill content. The skill system provides a mechanism for the model to read the complete skill instructions. Only the selected skill's content is loaded, not all skills.

**Why this priority**: This completes the lazy loading cycle - metadata → decision → content loading. Without on-demand loading, the system would still need to load all content at startup.

**Independent Test**: Can be tested by triggering a skill and verifying that only that specific skill's full content is accessed (via file read), while other skill files remain unopened.

**Acceptance Scenarios**:

1. **Given** model has decided to use weather skill, **When** model requests skill content, **Then** only weather skill's SKILL.md is read, other skill files are not accessed
2. **Given** model requests skill content via read tool, **When** skill file is read, **Then** the full skill content (including instructions, examples, constraints) is returned to the model
3. **Given** skill content is requested, **When** skill file does not exist, **Then** appropriate error is returned and model can proceed without the skill

---

### User Story 4 - Skill Metadata Format Injection (Priority: P2)

Skill metadata is injected into the system prompt in a standardized format (like `<available_skills>` tag) that the model can easily parse and understand. This format is consistent with pi-coding-agent conventions.

**Why this priority**: Proper formatting helps the model understand available skills. While important, the core lazy loading logic (P1 stories) can work with any reasonable format.

**Independent Test**: Can be tested by examining the system prompt content and verifying the metadata format follows the expected structure.

**Acceptance Scenarios**:

1. **Given** skills are loaded, **When** system prompt is constructed, **Then** skill metadata appears in `<available_skills>` format with name and description for each skill
2. **Given** skill has triggers/keywords defined, **When** metadata is formatted, **Then** triggers are included to help model understand when skill is relevant
3. **Given** skill has `disableModelInvocation` flag, **When** metadata is formatted, **Then** that skill is excluded from the available skills list

---

### User Story 5 - Configuration and Environment Variables (Priority: P3)

Users can configure the skills directory path and enable/disable the skill system via environment variables. The configuration follows existing miniclaw conventions (MINICLAW_SKILLS_DIR, MINICLAW_SKILLS_ENABLED).

**Why this priority**: Configuration flexibility is important for production use, but core functionality works with defaults. Can be added after core lazy loading works.

**Independent Test**: Can be tested by setting different environment variables and verifying the skill system respects the configuration.

**Acceptance Scenarios**:

1. **Given** MINICLAW_SKILLS_DIR is set to custom path, **When** application starts, **Then** skills are loaded from that custom directory
2. **Given** MINICLAW_SKILLS_ENABLED=false, **When** application starts, **Then** skill system is disabled and no skills are loaded
3. **Given** no environment variables set, **When** application starts, **Then** defaults apply (~/.miniclaw/skills, enabled=true)

---

### Edge Cases (Clarified)

**Clarification Date**: 2026-04-09

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Skill file deleted after metadata loaded but before content requested | Return error when read tool is called, model can proceed without the skill |
| Concurrent requests for same skill content | Cache results - first read loads file, subsequent reads get cached content |
| Skill directory contains subdirectories with SKILL.md files | Supported - each SKILL.md represents a separate skill |
| Metadata suggests skill exists but file read fails | Return appropriate error (file not found / permission denied), model handles gracefully |
| Skill metadata with very long descriptions | Truncate or summarize in metadata injection, full content available on read |

### Design Decisions (Clarified)

**Q1: How does model request skill content?**
- **Decision**: Model directly calls `read` tool to load SKILL.md file
- **Reference**: pi-coding-agent official design - "When a task matches, the agent uses `read` to load the full SKILL.md"
- **Implication**: No special tool needed - model uses existing file read capability

**Q2: What behavior indicates model has decided to use a skill?**
- **Decision**: Model calling `read` tool to load that skill's SKILL.md file
- **Implication**: This is the trigger point for lazy loading - no separate "select skill" mechanism required

**Q3: Environment variables vs constructor parameters?**
- **Decision**: Prioritize constructor parameters, optionally support environment variables
- **Rationale**: Constructor params are more explicit and testable; env vars for convenience

**Q4: formatSkillsForPrompt format?**
- **Decision**: Follow pi-coding-agent implementation pattern
- **Reference**: See pi-coding-agent source for `<available_skills>` format

## Requirements

### Functional Requirements

- **FR-001**: Skill system MUST load only metadata (name, description, triggers, path) during application startup
- **FR-002**: Skill system MUST NOT load full skill content during startup phase
- **FR-003**: Skill metadata MUST be injected into system prompt in a format the model can understand
- **FR-004**: Model MUST be able to see all available skills via the injected metadata
- **FR-005**: Model MUST autonomously decide which skill to use based on user request and skill metadata
- **FR-006**: Skill system MUST provide mechanism for model to load full skill content on demand
- **FR-007**: Skill content MUST be loaded only for the specific skill model decides to use
- **FR-008**: Skill system MUST gracefully handle missing or malformed skill files
- **FR-009**: Skill system MUST support configuration via environment variables (MINICLAW_SKILLS_DIR, MINICLAW_SKILLS_ENABLED)
- **FR-010**: Skill system MUST follow pi-coding-agent conventions for skill format and metadata structure
- **FR-011**: Skill system MUST support both standalone .md files and SKILL.md in subdirectories
- **FR-012**: Skill system MUST log appropriate warnings/errors when skill loading fails

### Key Entities

- **SkillMetadata**: Lightweight information about a skill (name, description, triggers/keywords, file path, priority). Used for startup loading and injection into system prompt. Does not contain full skill content.
- **SkillContent**: Complete skill instructions and guidelines. Loaded only when model decides to use the skill. Contains the markdown body after frontmatter.
- **SkillFile**: Physical representation of a skill as a markdown file. Can be standalone .md file or SKILL.md in a subdirectory. Contains YAML frontmatter with metadata and markdown body with content.
- **SkillDirectory**: Directory containing skill files. Configurable path, defaults to ~/.miniclaw/skills.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Application startup time with 10 skills must be under 2 seconds (previously would load all skill content)
- **SC-002**: Model correctly identifies relevant skill based on metadata for 90% of test queries
- **SC-003**: Only 1 skill file is read when model decides to use a specific skill (not all skill files)
- **SC-004**: System prompt size with 10 skills metadata is under 2000 characters (previously would include all skill content)
- **SC-005**: Skill system handles malformed skill files without crashing application (graceful degradation)
- **SC-006**: Model can access and use skill content within 1 second of deciding to use a skill

## Assumptions

- Skills are stored as markdown files with YAML frontmatter (name, description fields required)
- Triggers/keywords are extracted from description text wrapped in brackets `[trigger]`
- The model has access to a file read tool (read_file) to load skill content
- pi-coding-agent library provides the skill loading and formatting functions
- Default skills directory is ~/.miniclaw/skills (configurable)
- Model can understand `<available_skills>` format for skill discovery