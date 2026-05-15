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

# Deployment
./start-feishu.sh              # Production Feishu (single instance, clears proxy vars)
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

- TypeScript strict mode enabled with all strict checks (`strict`, `noImplicitAny`, `strictNullChecks`, etc.)
- ESLint: `@typescript-eslint/recommended` + **explicit return types required** (`explicit-function-return-type: warn`)
- Prettier: single quotes, semicolons, 2-space indent, 100 char line width, LF line endings
- Path aliases available: `@/*` → `src/*`, `@core/*` → `src/core/*` (configured in tsconfig.json)
- Chinese comments used throughout for documentation

## Active Technologies
- TypeScript 5.x / Node.js 18+
- Vitest (testing): 884 tests, 71 test files, coverage thresholds 70%/60%
- Express 5.x, Socket.IO
- @mariozechner/pi-agent-core (Agent framework), @mariozechner/pi-ai (streaming)
- @mariozechner/pi-coding-agent (skill loading/formatting)
- @larksuiteoapi/node-sdk (Feishu integration)
- TypeScript 5.x / Node.js 18+ + @mariozechner/pi-agent-core, @mariozechner/pi-coding-agent, Express 5.x, Socket.IO (026-scheduler-hot-reload)
- JSON 文件存储（`~/.miniclaw/scheduled-tasks.json`，`~/.miniclaw/config.json`） (026-scheduler-hot-reload)

## Test Structure
```
tests/
├── unit/           # 71 test files, isolated component tests
├── integration/    # Cross-component tests
├── e2e/            # End-to-end tests
└── fixtures/       # Test fixtures and mocks
```

## Recent Changes
- 026-scheduler-hot-reload: Added TypeScript 5.x / Node.js 18+ + @mariozechner/pi-agent-core, @mariozechner/pi-coding-agent, Express 5.x, Socket.IO
- 026-windows-path-compat: Windows Git Bash 路径兼容 (issue #58)
- 025-process-stability: 进程稳定性加固

<!-- superpowers-zh:begin (do not edit between these markers) -->
# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（20 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 `.claude/skills/` 目录，每个 skill 有独立的 `SKILL.md` 文件。

- **brainstorming**: 在任何创造性工作之前必须使用此技能——创建功能、构建组件、添加功能或修改行为。在实现之前先探索用户意图、需求和设计。
- **chinese-code-review**: 中文代码审查规范——在保持专业严谨的同时，用符合国内团队文化的方式给出有效反馈
- **chinese-commit-conventions**: 中文 Git 提交规范 — 适配国内团队的 commit message 规范和 changelog 自动化
- **chinese-documentation**: 中文技术文档写作规范——排版、术语、结构一步到位，告别机翻味
- **chinese-git-workflow**: 适配国内 Git 平台和团队习惯的工作流规范——Gitee、Coding、极狐 GitLab、CNB 全覆盖
- **dispatching-parallel-agents**: 当面对 2 个以上可以独立进行、无共享状态或顺序依赖的任务时使用
- **executing-plans**: 当你有一份书面实现计划需要在单独的会话中执行，并设有审查检查点时使用
- **finishing-a-development-branch**: 当实现完成、所有测试通过、需要决定如何集成工作时使用——通过提供合并、PR 或清理等结构化选项来引导开发工作的收尾
- **mcp-builder**: MCP 服务器构建方法论 — 系统化构建生产级 MCP 工具，让 AI 助手连接外部能力
- **receiving-code-review**: 收到代码审查反馈后、实施建议之前使用，尤其当反馈不明确或技术上有疑问时——需要技术严谨性和验证，而非敷衍附和或盲目执行
- **requesting-code-review**: 完成任务、实现重要功能或合并前使用，用于验证工作成果是否符合要求
- **subagent-driven-development**: 当在当前会话中执行包含独立任务的实现计划时使用
- **systematic-debugging**: 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
- **test-driven-development**: 在实现任何功能或修复 bug 时使用，在编写实现代码之前
- **using-git-worktrees**: 当需要开始与当前工作区隔离的功能开发或执行实现计划之前使用——创建具有智能目录选择和安全验证的隔离 git 工作树
- **using-superpowers**: 在开始任何对话时使用——确立如何查找和使用技能，要求在任何响应（包括澄清性问题）之前调用 Skill 工具
- **verification-before-completion**: 在宣称工作完成、已修复或测试通过之前使用，在提交或创建 PR 之前——必须运行验证命令并确认输出后才能声称成功；始终用证据支撑断言
- **workflow-runner**: 在 Claude Code / OpenClaw / Cursor 中直接运行 agency-orchestrator YAML 工作流——无需 API key，使用当前会话的 LLM 作为执行引擎。当用户提供 .yaml 工作流文件或要求多角色协作完成任务时触发。
- **writing-plans**: 当你有规格说明或需求用于多步骤任务时使用，在动手写代码之前
- **writing-skills**: 当创建新技能、编辑现有技能或在部署前验证技能是否有效时使用

## 如何使用

当任务匹配某个 skill 时，使用 `Skill` 工具加载对应 skill 并严格遵循其流程。绝不要用 Read 工具读取 SKILL.md 文件。

如果你认为哪怕只有 1% 的可能性某个 skill 适用于你正在做的事情，你必须调用该 skill 检查。
<!-- superpowers-zh:end -->
