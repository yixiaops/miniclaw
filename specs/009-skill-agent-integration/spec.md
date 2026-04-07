# Feature Specification: Skill-Agent Integration

**Feature Branch**: `009-skill-agent-integration`
**Created**: 2026-04-07
**Status**: Draft
**Input**: Skill 系统与 Agent 集成：将 SkillManager 与 MiniclawAgent 集成，使 chat() 方法能自动匹配技能并注入 system prompt，子代理也能使用技能系统

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent Auto-Matches Skills (Priority: P1)

As a user, when I send a message to the agent containing a skill trigger keyword, the system automatically matches and activates the corresponding skill, injecting its prompt into the conversation context. This provides specialized behavior without manual configuration.

**Why this priority**: This is the core functionality - without automatic skill matching, the entire Skill system remains unused despite being fully implemented.

**Independent Test**: Can be fully tested by sending a message containing a known skill trigger word and verifying that the skill prompt is injected into the system prompt and that a log message shows the matched skill name.

**Acceptance Scenarios**:

1. **Given** a SkillManager with a "weather" skill configured with trigger "天气", **When** user sends "今天天气怎么样？", **Then** the agent matches the "weather" skill and includes the weather skill prompt in the system prompt
2. **Given** a SkillManager with no matching skills, **When** user sends any message, **Then** the agent proceeds normally without skill injection
3. **Given** a SkillManager with multiple skills, **When** user message matches one skill's trigger, **Then** only that skill's prompt is injected (single skill matching)

---

### User Story 2 - Sub-Agent Skill Inheritance (Priority: P2)

As a user, when the main agent spawns a sub-agent, the sub-agent inherits access to the SkillManager and can also match and use skills automatically, ensuring consistent behavior across the agent hierarchy.

**Why this priority**: Extends the core functionality to sub-agents, ensuring feature parity and consistent user experience across all agent types.

**Independent Test**: Can be fully tested by triggering a sub-agent spawn and sending a message that matches a skill, then verifying skill activation in the sub-agent context.

**Acceptance Scenarios**:

1. **Given** a main agent with SkillManager, **When** a sub-agent is spawned, **Then** the sub-agent has access to the same SkillManager
2. **Given** a sub-agent with SkillManager, **When** the sub-agent processes a message matching a skill trigger, **Then** the skill is matched and its prompt injected
3. **Given** a sub-agent without SkillManager, **When** processing any message, **Then** the sub-agent functions normally without skill matching (graceful degradation)

---

### User Story 3 - Logging and Observability (Priority: P3)

As a developer or operator, I can see log messages when skills are matched, helping me understand and debug the skill activation behavior.

**Why this priority**: Provides observability for debugging but is not essential to core functionality.

**Independent Test**: Can be fully tested by triggering skill matches and checking console/log output for the expected messages.

**Acceptance Scenarios**:

1. **Given** an agent with SkillManager, **When** a skill is matched during chat(), **Then** a log message "[Agent] 匹配到技能: {skillName}" is output
2. **Given** an agent with SkillManager, **When** no skill matches, **Then** no skill-related log message appears

---

### Edge Cases

- What happens when SkillManager.match() returns null? The agent should proceed normally without any skill prompt injection.
- What happens when SkillManager.getPrompt() returns empty string? The agent should proceed normally, as if no skill was matched.
- What happens when skillManager is undefined in agent options? The agent should skip skill matching entirely and function normally.
- What happens when multiple skills could match the same message? The matcher should return only one skill (first match wins based on implementation order).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: MiniclawAgent constructor MUST accept an optional `skillManager` parameter of type `SkillManager`
- **FR-002**: MiniclawAgent MUST store the `skillManager` as a private member when provided
- **FR-003**: The `chat()` method MUST call `skillManager.match(userMessage)` when a SkillManager is available
- **FR-004**: When a skill is matched, the `chat()` method MUST retrieve the skill prompt via `skillManager.getPrompt(skillName)`
- **FR-005**: The matched skill prompt MUST be appended to the base system prompt before sending to the LLM
- **FR-006**: A log message indicating the matched skill name MUST be output when a skill is matched
- **FR-007**: The `createAgentFactory` function MUST accept and pass the `skillManager` to agent creation
- **FR-008**: The `AgentRegistry.createAgent` method MUST support passing `skillManager` in agent options
- **FR-009**: The `SubagentManager.spawn` method MUST pass the `skillManager` to spawned sub-agents
- **FR-010**: When no `skillManager` is provided, the agent MUST function identically to pre-integration behavior (backward compatibility)
- **FR-011**: When `skillManager.match()` returns null, the agent MUST proceed without skill prompt injection

### Key Entities

- **SkillManager**: Existing component that manages skill loading, matching, and prompt retrieval. Already implemented with `match(message)` and `getPrompt(skillName)` methods.
- **MiniclawAgent**: The main agent class that processes user messages. Needs modification to accept and use SkillManager.
- **MiniclawAgentOptions**: Options interface for agent creation. Needs new `skillManager` property.
- **AgentRegistry**: Registry for creating and managing agent instances. Needs to propagate skillManager to created agents.
- **SubagentManager**: Manager for spawning sub-agents. Needs to pass skillManager to spawned agents.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Agent with SkillManager matches skills correctly 100% of the time when message contains trigger keywords
- **SC-002**: Skill prompt is correctly appended to system prompt when matched
- **SC-003**: Log message "[Agent] 匹配到技能: {name}" appears in console output when skill is matched
- **SC-004**: Agent without SkillManager behaves identically to pre-integration behavior (backward compatibility)
- **SC-005**: Sub-agents can match skills and have skill prompts injected
- **SC-006**: All existing unit tests continue to pass (no regression)
- **SC-007**: Integration test demonstrates end-to-end skill matching from message to prompt injection

## Assumptions

- The SkillManager component is fully implemented and tested (as per REQUIREMENTS_V8.md status table)
- The SkillManager.match() method signature returns `{ name: string }` or null
- The SkillManager.getPrompt() method signature returns a string (possibly empty)
- The existing agent architecture supports optional dependencies via the options pattern
- TypeScript compilation and testing infrastructure is in place