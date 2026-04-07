# Quickstart: pi-coding-agent Skill API Integration

**Feature**: 010-pi-skill-integration
**Date**: 2026-04-07

## Prerequisites

- Node.js 18+
- TypeScript 5.x
- Vitest for testing

## Setup

### 1. Dependencies

Already installed in package.json:
```json
"@mariozechner/pi-coding-agent": "^0.65.2"
```

### 2. Skills Directory

Create skills directory:
```bash
mkdir -p ~/.miniclaw/skills
```

### 3. Create a Test Skill

Create a skill file:
```bash
cat > ~/.miniclaw/skills/test.md << 'EOF'
---
name: test-skill
description: A test skill for testing [test] [testing]
---

## Test Skill

This is a test skill for verifying skill integration.

When this skill is matched, the agent will follow these instructions.
EOF
```

## Running

### CLI Mode (with skills)

```bash
npm run debug:cli
```

Expected startup log:
```
Miniclaw 启动中...

模型: qwen-plus
API: https://...
初始化 SkillManager...
已加载 1 个技能: test-skill
...
```

### Testing Skill Matching

Send a message containing trigger words:
```
> test the skill system
```

Expected log showing skill match:
```
[main] 🎯 匹配到技能: test-skill
[main] 📋 已注入技能 prompt (xxx 字符)
```

## Testing

### Unit Tests

```bash
# Test pi-manager
npm run test -- tests/unit/skill-pi-manager.test.ts
```

### Integration Tests

```bash
# Test skill flow with Agent
npm run test -- tests/integration/skill-flow.test.ts
```

## Configuration

### Environment Variables

```bash
# Custom skills directory
MINICLAW_SKILLS_DIR=/path/to/skills

# Disable skills
MINICLAW_SKILLS_ENABLED=false
```

### Config File (config.yaml)

```yaml
skills:
  dir: ~/.miniclaw/skills
  enabled: true
```

## Troubleshooting

### Skills not loading

Check directory exists:
```bash
ls -la ~/.miniclaw/skills
```

Check file format (must have frontmatter):
```bash
head -5 ~/.miniclaw/skills/*.md
```

Expected:
```
---
name: skill-name
description: Skill description [trigger1] [trigger2]
---
```

### Skills not matching

Check trigger words in description:
- Triggers are words wrapped in `[]` brackets
- Example: `description: Git operations skill [git] [commit] [push]`

### Agent behavior unchanged

Check skill system enabled:
```bash
# Should show skill loading in startup logs
npm run debug:cli | grep -i skill
```

## Development Notes

### Files to Modify

| File | Change |
|------|--------|
| `src/core/skill/pi-manager.ts` | NEW - Create SkillManager wrapper |
| `src/index.ts` | Add SkillManager initialization |
| `src/core/agent/index.ts` | Add skill injection in chat/streamChat |
| `src/core/config.ts` | Add skills config options |

### Key Integration Points

1. **Startup** (`src/index.ts`)
   - Create PiSkillManager
   - Log loaded skill count

2. **Agent Construction** (`src/core/agent/index.ts`)
   - Accept SkillManager in options
   - Store for later use

3. **Chat Processing** (`src/core/agent/index.ts::chat()`)
   - Match input against skills
   - Inject matched skill prompt
   - Restore after processing