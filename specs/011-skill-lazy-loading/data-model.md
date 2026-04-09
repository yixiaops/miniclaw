# Data Model: Skill Lazy Loading System

**Feature**: 011-skill-lazy-loading
**Date**: 2026-04-09

## Entity Overview

```
┌─────────────────────┐     ┌─────────────────────┐
│   PiSkillManager    │────▶│   Skill (from pi)   │
├─────────────────────┤     ├─────────────────────┤
│ - skills: Skill[]   │     │ - name: string      │
│ - skillsDir: string │     │ - description: str  │
│ - source: string    │     │ - filePath: string  │
│ - enabled: boolean  │     │ - baseDir: string   │
│ - diagnostics: []   │     │ - sourceInfo: obj   │
└─────────────────────┘     │ - disableModel...   │
         │                  └─────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│   MiniclawAgent     │     │   SKILL.md File     │
├─────────────────────┤     ├─────────────────────┤
│ - skillManager?     │     │ ---                 │
│ - agent: Agent      │     │ name: skill-name    │
│ - systemPrompt: str │     │ description: ...    │
└─────────────────────┘     │ ---                 │
         │                  │ # Skill Content     │
         │                  │ (markdown body)     │
         ▼                  └─────────────────────┘
┌─────────────────────┐
│   System Prompt     │
├─────────────────────┤
│ ...base prompt...   │
│                     │
│ <available_skills>  │
│   <skill>           │
│     <name>...</name>│
│     <description>...│
│     <location>...   │←─ filePath (for read tool)
│   </skill>          │
│ </available_skills> │
└─────────────────────┘
```

## Key Entities

### 1. Skill (from pi-coding-agent)

Lightweight metadata object. Does NOT contain content.

| Field | Type | Description |
|-------|------|-------------|
| name | string | Skill identifier (lowercase, hyphens only) |
| description | string | Skill description (shown to model) |
| filePath | string | Absolute path to SKILL.md |
| baseDir | string | Parent directory of SKILL.md |
| sourceInfo | object | Source metadata (local, user, project, etc.) |
| disableModelInvocation | boolean | If true, exclude from prompt |

**Note**: Skill type does NOT include `content` field. Content is loaded separately via `read` tool.

### 2. PiSkillManager

Manages skill loading and prompt formatting.

| Field | Type | Description |
|-------|------|-------------|
| skills | Skill[] | Loaded skill metadata |
| skillsDir | string | Directory to scan for skills |
| source | string | Source identifier ('miniclaw') |
| enabled | boolean | Whether skill system is enabled |
| diagnostics | ResourceDiagnostic[] | Loading warnings/errors |

**Key Methods**:

| Method | Returns | Description |
|--------|---------|-------------|
| load() | LoadSkillsResult | Load skill metadata from directory |
| getAllPrompts() | string | Format skills for system prompt injection |
| count() | number | Number of loaded skills |
| getNames() | string[] | List of skill names |
| getAll() | Skill[] | Get all skill objects |

### 3. MiniclawAgent

Core agent class, receives skillManager during construction.

| Field | Type | Description |
|-------|------|-------------|
| skillManager | PiSkillManager? | Optional skill manager |
| agent | Agent | Underlying pi-agent-core Agent |
| config | Config | Miniclaw configuration |

**Skill Integration Flow**:

1. Constructor receives `skillManager` option
2. If skillManager exists, call `getAllPrompts()`
3. Append prompts to systemPrompt
4. Model sees `<available_skills>` with `<location>` paths
5. Model uses `read_file` tool to load skill content

## Data Flow

### Startup Flow

```
main()
  │
  ├──▶ createPiSkillManager({ skillsDir, enabled })
  │
  ├──▶ skillManager.load()
  │      │
  │      └──▶ loadSkillsFromDir({ dir, source })
  │             │
  │             └──▶ for each SKILL.md:
  │                    parse frontmatter
  │                    create Skill object (name, description, filePath)
  │                    return { skills, diagnostics }
  │
  └──▶ createAgentFactory(registry, subagentManager, skillManager)
         │
         └──▶ new MiniclawAgent(config, { skillManager })
                │
                ├──▶ skillManager.getAllPrompts()
                │      │
                │      └──▶ formatSkillsForPrompt(skills)
                │             │
                │             └──▶ return `<available_skills>...<location>${filePath}</location>...</available_skills>`
                │
                └──▶ systemPrompt += skillPrompts
```

### Model Decision Flow

```
User Input: "今天天气怎么样？"
  │
  ▼
Model sees system prompt with:
  <available_skills>
    <skill>
      <name>weather</name>
      <description>获取天气信息</description>
      <location>/home/user/.miniclaw/skills/weather/SKILL.md</location>
    </skill>
  </available_skills>
  │
  ▼
Model decides: "This matches the weather skill"
  │
  ▼
Model calls: read_file({ path: "/home/user/.miniclaw/skills/weather/SKILL.md" })
  │
  ▼
ReadFileTool.execute()
  │
  └──▶ Returns full SKILL.md content (frontmatter + body)
  │
  ▼
Model now has full skill instructions
  │
  ▼
Model follows skill instructions to complete task
```

## Validation Rules

### Skill Name Validation (from pi-coding-agent)

- Must match parent directory name
- Max 64 characters
- Only lowercase a-z, 0-9, hyphens
- Cannot start or end with hyphen
- Cannot contain consecutive hyphens

### Skill Description Validation

- Required field
- Max 1024 characters

## State Transitions

```
[App Start]
     │
     ▼
[SkillManager Created]
     │
     ▼
[load() called] ──▶ [Skills loaded (metadata only)]
     │
     ▼
[Agent Created with skillManager]
     │
     ▼
[systemPrompt injected with skill metadata]
     │
     ▼
[Model sees <available_skills>]
     │
     ├──▶ [Model ignores skills] ──▶ [Normal response]
     │
     └──▶ [Model reads skill file] ──▶ [Skill content loaded] ──▶ [Model follows skill]
```

## Performance Characteristics

| Metric | Value | Notes |
|--------|-------|-------|
| Startup time | O(n) | n = number of skill directories |
| Metadata size | ~100-200 bytes/skill | name + description + filePath |
| Prompt overhead | ~200 bytes/skill | XML format in system prompt |
| Content load | On-demand | Only when model calls read tool |
| Memory | Minimal | Only metadata stored; content read on demand |