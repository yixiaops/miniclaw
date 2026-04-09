# Quickstart: Skill Lazy Loading System

**Feature**: 011-skill-lazy-loading
**Date**: 2026-04-09

## Overview

The skill lazy loading system allows miniclaw to:
1. Load only skill metadata at startup (fast startup)
2. Show available skills to the model in system prompt
3. Let the model decide which skill to use
4. Load full skill content on-demand via `read` tool

## Quick Start

### 1. Create a Skill

Create a skill directory and SKILL.md file:

```bash
mkdir -p ~/.miniclaw/skills/weather
cat > ~/.miniclaw/skills/weather/SKILL.md << 'EOF'
---
name: weather
description: 获取天气信息。触发词：天气、气温、温度、下雨
---

# Weather Skill

## 用途
获取指定城市的天气信息。

## 使用方式
当用户询问天气相关问题时：
1. 确认用户想查询的城市
2. 使用天气查询工具或API获取信息
3. 以友好的方式呈现天气信息

## 注意事项
- 确保城市名称正确
- 提供温度、天气状况、风力等关键信息
EOF
```

### 2. Start miniclaw

```bash
npm run start:cli
```

You should see:
```
初始化 SkillManager...
已加载 1 个技能: weather
```

### 3. Use the Skill

In the CLI:
```
miniclaw> 郑州今天天气怎么样？
```

The model will:
1. See `<available_skills>` with weather skill metadata in system prompt
2. Recognize the weather skill matches the query
3. Call `read_file` to load the full SKILL.md content
4. Follow the skill instructions

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Startup Flow                           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  main()                                                      │
│    │                                                         │
│    ├── createPiSkillManager()                                │
│    │                                                         │
│    ├── skillManager.load()                                   │
│    │     └── loadSkillsFromDir() → Skill[] (metadata only)  │
│    │                                                         │
│    └── createAgentFactory(skillManager)                      │
│          │                                                   │
│          └── new MiniclawAgent({ skillManager })             │
│                │                                             │
│                └── systemPrompt += getAllPrompts()           │
│                      └── formatSkillsForPrompt()             │
│                            └── <available_skills>...         │
│                                                              │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                    Runtime Flow                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User: "今天天气怎么样？"                                     │
│    │                                                         │
│    ▼                                                         │
│  Model sees system prompt with:                              │
│    <available_skills>                                        │
│      <skill>                                                 │
│        <name>weather</name>                                  │
│        <description>获取天气信息...</description>            │
│        <location>/path/to/weather/SKILL.md</location>        │
│      </skill>                                                │
│    </available_skills>                                       │
│    │                                                         │
│    ▼                                                         │
│  Model decides: "I should use the weather skill"             │
│    │                                                         │
│    ▼                                                         │
│  Model calls: read_file({ path: ".../weather/SKILL.md" })    │
│    │                                                         │
│    ▼                                                         │
│  Full skill content returned to model                        │
│    │                                                         │
│    ▼                                                         │
│  Model follows skill instructions                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Skill directory (optional, default: ~/.miniclaw/skills)
export MINICLAW_SKILLS_DIR=/path/to/skills

# Enable/disable skills (optional, default: true)
export MINICLAW_SKILLS_ENABLED=true
```

### Config File

In `~/.miniclaw/config.json`:

```json
{
  "skills": {
    "enabled": true,
    "dir": "~/.miniclaw/skills"
  }
}
```

## Skill File Format

SKILL.md files use YAML frontmatter:

```markdown
---
name: skill-name
description: Skill description with triggers: trigger1, trigger2
disable-model-invocation: false
---

# Skill Title

Skill instructions and content here...
```

### Required Fields

- `name`: Skill identifier (lowercase, hyphens, max 64 chars)
- `description`: What the skill does (max 1024 chars)

### Optional Fields

- `disable-model-invocation`: If true, skill won't appear in `<available_skills>`

## Key APIs

### PiSkillManager

```typescript
import { createPiSkillManager } from './core/skill/index.js';

// Create manager
const skillManager = createPiSkillManager({
  skillsDir: '~/.miniclaw/skills',
  enabled: true
});

// Load skills
const result = skillManager.load();
console.log(`Loaded ${result.skills.length} skills`);

// Get prompts for system prompt injection
const prompts = skillManager.getAllPrompts();
// Returns: <available_skills>...</available_skills>

// Get skill info
skillManager.count();        // Number of skills
skillManager.getNames();     // Array of skill names
skillManager.getAll();       // Array of Skill objects
```

### Integration with MiniclawAgent

```typescript
import { MiniclawAgent } from './core/agent/index.js';

const agent = new MiniclawAgent(config, {
  systemPrompt: 'You are a helpful assistant.',
  tools: [...],
  skillManager  // Pass skill manager here
});

// Agent will automatically inject skill metadata into system prompt
```

## Performance

| Metric | Expected Value |
|--------|----------------|
| Startup time with 10 skills | < 2 seconds |
| System prompt overhead | ~200 chars per skill |
| Skill content load time | < 1 second (read tool) |

## Troubleshooting

### Skills not loading

1. Check skill directory exists: `ls ~/.miniclaw/skills`
2. Check SKILL.md files exist in subdirectories
3. Check YAML frontmatter is valid
4. Check `name` matches directory name

### Model not using skills

1. Check system prompt contains `<available_skills>`
2. Check skill description is clear and includes triggers
3. Check `disable-model-invocation` is not set to true

### Read tool errors

1. Check file paths in `<location>` are accessible
2. Check file permissions
3. Check skill files exist (not deleted after startup)