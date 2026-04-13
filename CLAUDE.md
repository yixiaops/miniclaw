# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Miniclaw is a lightweight personal AI assistant framework built with TypeScript. It supports multi-channel access (CLI, API, Web, Feishu), session management, and tool calling. It uses Alibaba Cloud Bailian (百炼) API as the LLM backend via OpenAI-compatible interface.

## Commands

```bash
# Build
npm run build                  # Compile TypeScript to dist/

# Test
npm test                       # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage report
npx vitest run tests/unit/config.test.ts  # Run single test file

# Code Quality
npm run lint                   # ESLint check
npm run lint:fix               # Auto-fix lint issues
npm run format                 # Prettier format
npm run typecheck              # TypeScript type check

# Run
npm run start:cli              # CLI interactive mode
npm run start:api              # HTTP API server
npm run start:web              # WebSocket server
npm run start:feishu           # Feishu bot mode
npm run start:all              # All channels

# Debug (without compilation)
npm run debug:cli              # CLI with tsx
npm run debug:api              # API with tsx
npm run debug:web              # Web with tsx
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Miniclaw                                │
├─────────────────────────────────────────────────────────────┤
│   Channels (src/channels/)                                  │
│   CLI | API | Web | Feishu                                   │
│          │                                                   │
│          ▼                                                   │
├─────────────────────────────────────────────────────────────┤
│   Core (src/core/)                                          │
│   Gateway → Router → SessionManager → AgentRegistry → Agent │
│          │                                                   │
│          ▼                                                   │
├─────────────────────────────────────────────────────────────┤
│   Tools (src/tools/)                                        │
│   read_file | write_file | shell | web_fetch                │
└─────────────────────────────────────────────────────────────┘
```

### Message Flow

1. Channel receives user message
2. `Gateway.handleMessage()` coordinates the flow:
   - `Router.route(ctx)` → determines sessionId based on channel/user/group
   - `SessionManager.getOrCreate(sessionId)` → creates/retrieves session
   - `AgentRegistry.getOrCreate(sessionId)` → creates/retrieves agent instance
   - `Agent.chat(content)` → calls LLM and returns response
3. Response returned to channel

### Core Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Gateway | `src/core/gateway/index.ts` | Central coordinator, message handling |
| Router | `src/core/gateway/router.ts` | Routes messages to sessions by context |
| SessionManager | `src/core/gateway/session.ts` | Manages session lifecycle |
| AgentRegistry | `src/core/agent/registry.ts` | Manages agent instances per session |
| MiniclawAgent | `src/core/agent/index.ts` | LLM interaction, tool calling |

## Key Conventions

### ESM Module

This project uses ESM (`"type": "module"`). Local imports **must include `.js` extension**:

```typescript
// Correct
import { foo } from './bar.js';

// Wrong - will fail at runtime
import { foo } from './bar';
```

### Adding New Tools

1. Create `src/tools/my-tool.ts` following existing tool patterns
2. Export from `src/tools/index.ts` and add to `getBuiltinTools()`
3. Tools use `AgentTool` interface from `@mariozechner/pi-agent-core`

### Adding New Channels

1. Create `src/channels/my-channel.ts` with `start()` and `stop()` methods
2. Call `gateway.handleMessage()` or `gateway.streamHandleMessage()` with message context
3. Register in `src/index.ts` main function

## Configuration

Environment variables (prefix `MINICLAW_`):

```bash
MINICLAW_BAILIAN_API_KEY=your-key    # Required
MINICLAW_BAILIAN_MODEL=qwen-plus      # Default: qwen-plus
MINICLAW_BAILIAN_BASE_URL=https://...  # Default: Alibaba Cloud
MINICLAW_SERVER_PORT=3000             # Default: 3000
MINICLAW_FEISHU_APP_ID=...            # Optional: for Feishu channel
MINICLAW_FEISHU_APP_SECRET=...

# Skills configuration
MINICLAW_SKILLS_DIR=~/.miniclaw/skills  # Skills directory (default: ~/.miniclaw/skills)
MINICLAW_SKILLS_ENABLED=true            # Enable/disable skills (default: true)
```

### Skills System

Miniclaw uses [@mariozechner/pi-coding-agent](https://github.com/MarcusShoke/pi-coding-agent) for skill loading and formatting.

#### Skill File Format

Skills are markdown files with YAML frontmatter:

```markdown
---
name: my-skill
description: Skill description with triggers [trigger1] [trigger2]
---

## Skill Instructions

Your skill content here...
```

- **name**: Skill identifier (required)
- **description**: Description with optional triggers in brackets (required)
- **Triggers**: Words wrapped in `[]` used for matching user input

#### Skill Loading

1. Skills are loaded at startup from `~/.miniclaw/skills/` (configurable)
2. Each `.md` file or `SKILL.md` in subdirectories is loaded
3. Skills are matched based on triggers extracted from description
4. Matched skill prompts are injected into Agent's system prompt

#### Example

```bash
# Create a skill
cat > ~/.miniclaw/skills/git.md << 'EOF'
---
name: git-helper
description: Git operations helper [git] [commit] [push] [pull]
---

## Git Helper

When user asks about git operations, provide helpful commands and explanations.
EOF

# The skill will be loaded on next startup
# Trigger: "help me commit" → matches git-helper skill
```

### Tool Configuration

Each Agent can be configured with a specific set of tools via `tools.allow` and `tools.deny` in the config file.

#### Configuration File

Path: `~/.miniclaw/config.json`

```json
{
  "agents": {
    "list": [
      {
        "id": "main"
        // No tools config → all 12 tools
      },
      {
        "id": "readonly",
        "tools": {
          "allow": ["read_file", "glob", "grep", "ls"]
        }
      },
      {
        "id": "safe",
        "tools": {
          "deny": ["shell", "write_file"]
        }
      }
    ]
  }
}
```

#### Tool Filtering Rules

1. **Default**: No config → all 12 built-in tools
2. **Allow whitelist**: Only specified tools
3. **Deny blacklist**: Prohibit specific tools
4. **Priority**: `deny` takes precedence over `allow`

#### Built-in Tools

| Tool Name | Description |
|-----------|-------------|
| `read_file` | Read file contents |
| `write_file` | Write to file |
| `edit` | Edit file (single change) |
| `multi_edit` | Edit file (multiple changes) |
| `shell` | Execute shell commands |
| `glob` | File pattern matching |
| `grep` | Text search |
| `ls` | List directory contents |
| `web_fetch` | Fetch web content |
| `web_search` | Web search |
| `memory_search` | Semantic search |
| `memory_get` | Read memory files |

## Code Style

- TypeScript strict mode enabled
- Prettier: single quotes, semicolons, 2-space indent, 100 char line width
- ESLint: `@typescript-eslint/recommended` + explicit return types
- Chinese comments used throughout for documentation

## Active Technologies
- TypeScript 5.x / Node.js 18+ + Vitest (测试框架), pi-agent-core (Agent框架)
- SimpleMemoryStorage (内存存储，可选文件持久化)
- @mariozechner/pi-coding-agent (^0.65.2) for skill loading/formatting
- @mariozechner/pi-agent-core (Agent框架), @mariozechner/pi-ai (AI流式处理) for tool injection optimization

## Recent Changes
- 013-optimize-tool-injection: Implemented tool filtering with allow/deny lists, default full tool access for all agents
- 010-pi-skill-integration: Integrated pi-coding-agent Skill API for skill loading, matching, and prompt injection
- 002-improve-test-coverage: Added TypeScript 5.x / Node.js 18+ + Vitest (测试框架), pi-agent-core (Agent框架)
