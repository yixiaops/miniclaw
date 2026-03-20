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
```

## Code Style

- TypeScript strict mode enabled
- Prettier: single quotes, semicolons, 2-space indent, 100 char line width
- ESLint: `@typescript-eslint/recommended` + explicit return types
- Chinese comments used throughout for documentation

## Active Technologies
- TypeScript 5.x / Node.js 18+ + Vitest (测试框架), pi-agent-core (Agent框架) (002-improve-test-coverage)
- SimpleMemoryStorage (内存存储，可选文件持久化) (002-improve-test-coverage)

## Recent Changes
- 002-improve-test-coverage: Added TypeScript 5.x / Node.js 18+ + Vitest (测试框架), pi-agent-core (Agent框架)
