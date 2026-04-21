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
npm run precommit              # Run lint + typecheck + test (quality gate)

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
│   Subagent System (src/core/subagent/)                      │
│   sessions_spawn → SubagentManager → Child Agent            │
│          │                                                   │
│          ▼                                                   │
├─────────────────────────────────────────────────────────────┤
│   Memory System (src/memory/)                               │
│   ImportanceEvaluator | SoulLoader | AutoWriter              │
│   CandidatePool → TTLManager → Promoter → LongTermMemory    │
│          │                                                   │
│          ▼                                                   │
├─────────────────────────────────────────────────────────────┤
│   Tools (src/tools/)                                        │
│   read_file | write_file | shell | web_fetch | sessions_spawn│
└─────────────────────────────────────────────────────────────┘
```

### Memory System Architecture (三层结构)

Miniclaw 使用三层记忆架构实现智能记忆管理：

```
┌─────────────────────────────────────────────────────────────┐
│                    Memory System                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: MemoryCandidatePool (候选池)                      │
│  - 临时存储对话记忆                                          │
│  - TTL 过期机制                                              │
│  - importance 值动态评估                                     │
│          │                                                   │
│          ▼ TTL 过期 + importance >= threshold               │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: LongTermMemory (长期记忆)                         │
│  - 持久化重要记忆                                            │
│  - 文件存储 (MEMORY.md + long-term.json)                    │
│          │                                                   │
│          ▼                                                   │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: SimpleMemoryStorage (Session历史)                 │
│  - 对话上下文管理                                            │
│  - 可选文件持久化                                            │
└─────────────────────────────────────────────────────────────┘
```

**Importance 评估流程：**

1. LLM 在回复末尾添加 `[IMPORTANCE:X]` 标记
2. `ImportanceEvaluator.parse()` 解析并剥离标记
3. importance 值存储到 MemoryEntry.metadata.importance
4. TTL 过期时，importance >= 0.5 的记忆晋升到长期记忆

**核心组件：**

| Component | File | Responsibility |
|-----------|------|----------------|
| ImportanceEvaluator | `src/memory/importance/evaluator.ts` | 解析 `[IMPORTANCE:X]` 标记 |
| SoulLoader | `src/soul/loader.ts` | 加载 AI 人格配置，注入 importance 规则 |
| AutoMemoryWriter | `src/memory/auto-writer.ts` | 自动写入对话记忆 |
| TTLManager | `src/memory/store/ttl-manager.ts` | TTL 过期清理 |
| MemoryPromoter | `src/memory/promotion/promoter.ts` | 记忆晋升决策 |

### Message Flow

1. Channel receives user message
2. `Gateway.handleMessage()` coordinates the flow:
   - `Router.route(ctx)` → determines sessionId based on channel/user/group
   - `SessionManager.getOrCreate(sessionId)` → creates/retrieves session
   - `AgentRegistry.getOrCreate(sessionId)` → creates/retrieves agent instance
   - `Agent.chat(content)` → calls LLM and returns response
   - `ImportanceEvaluator.parse(response)` → extracts importance value
   - `AutoMemoryWriter.writeConversation()` → stores memory with importance
3. Response (with importance marker stripped) returned to channel

### Core Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Gateway | `src/core/gateway/index.ts` | Central coordinator, message handling |
| Router | `src/core/gateway/router.ts` | Routes messages to sessions by context |
| SessionManager | `src/core/gateway/session.ts` | Manages session lifecycle |
| AgentRegistry | `src/core/agent/registry.ts` | Manages agent instances per session |
| MiniclawAgent | `src/core/agent/index.ts` | LLM interaction, tool calling |
| SubagentManager | `src/core/subagent/manager.ts` | Spawns and manages child agents |
| PromptManager | `src/core/prompt/manager.ts` | Loads YAML frontmatter prompts |

### Project Structure

```
src/
├── channels/          # Input/output channels (CLI, API, Web, Feishu)
├── core/
│   ├── agent/         # Agent core + registry
│   ├── gateway/       # Gateway + Router + SessionManager
│   ├── memory/        # Session history (SimpleMemoryStorage)
│   ├── prompt/        # YAML frontmatter prompt loader
│   ├── session-key/   # Session key builder/parser
│   ├── skill/         # Skill matching (pi-coding-agent)
│   └── subagent/      # Child agent spawning
├── memory/            # Three-layer memory system
│   ├── importance/    # LLM importance evaluation
│   ├── promotion/     # Memory promotion logic
│   ├── store/         # CandidatePool, TTLManager, LongTerm
│   └── write/         # Deduplication, sensitive detection
├── soul/              # AI personality + importance rules
├── tools/             # Built-in tools + tool filtering
└── index.ts           # Entry point
```

### Subagent System (sessions_spawn)

Miniclaw supports dynamic child agent spawning for specialized tasks:

1. **Agent calls `sessions_spawn`** with `{ task, agentId }` params
2. **SubagentManager** checks permissions (`subagents.allowAgents` in config)
3. **Creates isolated Session** with key `subagent:{agentId}:{uuid}`
4. **Spawns specialized Agent** with its own tools, prompts, skills
5. **Returns result** to parent agent, auto-cleanup

Key mechanisms:
- **Permission control**: `AgentRegistry.canSpawnSubagent(parent, child)`
- **Concurrency limit**: `maxConcurrent` (default 5)
- **Tool isolation**: Child agent's tools from its own config, not inherited
- **Multi-level nesting**: Child can spawn further children

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

# Soul configuration (AI personality + importance rules)
MINICLAW_SOUL_FILE=~/.miniclaw/soul.md  # Soul file path (default: ~/.miniclaw/soul.md)
```

### Soul System

Soul 系统定义 AI 人格和 importance 评估规则。通过 `SoulLoader` 加载 `soul.md` 文件，注入到 Agent 的系统提示中。

#### Default Soul Content

如果 `soul.md` 文件不存在，使用内置的 `DEFAULT_SOUL`，包含：
- AI 人格定义
- `[IMPORTANCE:X]` 标记规则说明
- 重要性评估标准（0.1-0.9）

#### Soul File Format

```markdown
# Miniclaw Soul

## AI 人格
[自定义 AI 人格描述]

## 核心规则
**每次回复必须在末尾包含 [IMPORTANCE:X] 标记**
X 为 0-1 的数值...

## 其他规则
[其他自定义规则]
```

#### Importance Evaluation

LLM 在每次回复末尾输出 `[IMPORTANCE:X]` 标记：
- `0.7-0.9`: 个人信息（姓名、偏好、联系方式）→ 晋升到长期记忆
- `0.4-0.6`: 一般对话内容 → TTL 过期后删除
- `0.1-0.3`: 简单问候或闲聊 → TTL 过期后删除

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

### Prompt Configuration

Agent system prompts use YAML frontmatter format for metadata:

```markdown
---
name: etf
description: ETF market analyst
model: qwen-plus
tools:
  - web_search
  - web_fetch
---

You are an ETF market analyst, specializing in fund selection...
```

**Metadata fields:**

| Field | Purpose |
|-------|---------|
| `name` | Prompt identifier |
| `description` | Prompt description |
| `model` | Recommended model |
| `tools` | Recommended tool list |

**Reference in config:**

```json
{
  "agents": {
    "list": [
      { "id": "etf", "systemPrompt": "file://~/.miniclaw/prompts/etf.md" }
    ]
  }
}
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
- TypeScript 5.x / Node.js 18+
- Vitest (testing), Express 5.x, Socket.IO
- @mariozechner/pi-agent-core (Agent framework), @mariozechner/pi-ai (streaming)
- @mariozechner/pi-coding-agent (skill loading/formatting)
- @larksuiteoapi/node-sdk (Feishu integration)

## Recent Changes
- 024-llm-importance-evaluation: LLM dynamically evaluates message importance
- 022-memory-optimization: Three-layer memory architecture
- 013-optimize-tool-injection: Tool filtering with allow/deny lists
- 010-pi-skill-integration: Skill API for progressive disclosure
