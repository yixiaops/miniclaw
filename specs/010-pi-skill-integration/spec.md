# Feature Specification: pi-coding-agent Skill API Integration

**Feature Branch**: `010-pi-skill-integration`
**Created**: 2026-04-07
**Status**: Draft
**Input**: User description: "为 miniclaw 项目集成 @mariozechner/pi-coding-agent 的 Skill API。背景：miniclaw 项目原有的 skill 系统已被注释掉，需要使用 pi-coding-agent 的 Skill API 重新实现。需求：1. 创建 src/core/skill/pi-manager.ts，使用 pi-coding-agent API 实现 SkillManager；2. 改造 src/index.ts，使用新的 pi SkillManager；3. 改造 src/core/agent/index.ts，在 Agent 构造时注入 skill prompt。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Skill Loading at Startup (Priority: P1)

When the Miniclaw application starts, the system automatically loads skill definitions from the configured skills directory and makes them available to all Agent instances. Users can see which skills are loaded through startup logs.

**Why this priority**: This is the foundation for all skill functionality. Without loading skills, no skill matching or prompt injection can occur.

**Independent Test**: Can be fully tested by starting the application in CLI mode and verifying that startup logs show the number of skills loaded.

**Acceptance Scenarios**:

1. **Given** a skills directory exists with valid skill files, **When** the application starts, **Then** the startup logs display the count of successfully loaded skills
2. **Given** no skills directory exists, **When** the application starts, **Then** the system gracefully handles this with a warning message and continues normal operation
3. **Given** a skills directory contains invalid skill files, **When** the application starts, **Then** the system reports errors for those specific files without crashing

---

### User Story 2 - Skill Matching During Conversation (Priority: P2)

During a conversation, when a user sends a message, the system automatically identifies which skill (if any) matches the user's intent based on triggers defined in the skill metadata. The matched skill's prompt content is injected into the Agent's system prompt.

**Why this priority**: This enables the core value proposition - dynamically enhancing Agent capabilities based on user intent.

**Independent Test**: Can be tested by sending specific trigger phrases in CLI mode and observing log output indicating skill matching.

**Acceptance Scenarios**:

1. **Given** a skill "git-commit" with trigger "commit", **When** the user sends "commit the current changes", **Then** the Agent logs show skill "git-commit" was matched
2. **Given** multiple skills could match the user input, **When** the user sends a message, **Then** the system selects the best matching skill based on defined priority rules
3. **Given** no skill matches the user input, **When** the user sends a message, **Then** the Agent processes the message normally without skill prompt injection

---

### User Story 3 - Skill Prompt Injection into Agent (Priority: P3)

When a skill is matched, its prompt content is formatted using the pi-coding-agent API and appended to the Agent's system prompt, providing context-specific guidance for the current request. After processing, the original system prompt is restored.

**Why this priority**: This enables the actual enhancement of Agent behavior through skill prompts while maintaining clean state management.

**Independent Test**: Can be tested by matching a skill and verifying the Agent's response follows the skill's guidance.

**Acceptance Scenarios**:

1. **Given** a skill is matched, **When** the Agent processes the request, **Then** the skill prompt is visible in the Agent's context logs as part of the system prompt
2. **Given** a skill with detailed instructions is matched, **When** the Agent generates a response, **Then** the response content reflects the skill's guidance
3. **Given** a skill was matched and processing completes, **When** the next request arrives, **Then** the Agent's system prompt has returned to its original state

---

### Edge Cases

- What happens when the skills directory path is not configured? System uses a default directory or gracefully continues without skills.
- How does the system handle a skill file that is syntactically valid but has empty trigger definitions? The skill is loaded but never matches.
- What happens when two skills have identical trigger patterns? The first loaded skill or the one with higher priority wins.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST load skill definitions from a specified directory using `loadSkillsFromDir` API from pi-coding-agent
- **FR-002**: System MUST format matched skills into prompt strings using `formatSkillsForPrompt` API from pi-coding-agent
- **FR-003**: SkillManager MUST provide a method to match user input against skill triggers
- **FR-004**: Agent MUST accept a SkillManager instance during construction
- **FR-005**: Agent MUST inject skill prompt into system prompt when a skill matches user input
- **FR-006**: Agent MUST restore original system prompt after processing a matched request
- **FR-007**: System MUST log skill loading status at application startup
- **FR-008**: System MUST log skill matching events during conversation processing
- **FR-009**: The integration MUST maintain backward compatibility with existing Agent functionality when no skills are configured
- **FR-010**: Skill loading MUST be synchronous at startup to ensure skills are available before first user interaction

### Key Entities

- **Skill**: Represents a skill definition with metadata (name, triggers, source) and content (prompt text). Loaded from markdown files in the skills directory.
- **SkillManager**: Manages the collection of loaded skills, provides matching functionality, and exposes the pi-coding-agent API integration.
- **Agent**: Enhanced to accept SkillManager and perform skill matching/prompt injection during chat operations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Application startup completes within 2 seconds even with 50+ skills loaded
- **SC-002**: Skill matching decision is made within 100 milliseconds of receiving user input
- **SC-003**: Agent responses with matched skills show measurable improvement in task-specific accuracy (verified through manual testing)
- **SC-004**: All existing Agent functionality continues to work unchanged when no skills are configured
- **SC-005**: Error messages for invalid skill files clearly identify the problematic file and error reason