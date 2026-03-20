# Data Model: Test Coverage

**Feature**: Improve Test Coverage
**Date**: 2026-03-20

## Test Entities

### MockConfig

Standard mock configuration used across all tests.

```typescript
interface MockConfig {
  bailian: {
    apiKey: string;      // 'test-api-key'
    model: string;       // 'qwen-plus'
    baseUrl: string;     // 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  };
  server: {
    port: number;        // 3000
    host: string;        // '0.0.0.0'
  };
}
```

### MockAgent

Mock agent implementation for testing Gateway and Channels.

```typescript
interface MockAgent {
  chat: MockFunction;           // Returns { content: string }
  streamChat: MockGenerator;     // Yields { content?, done: boolean }
  getHistory: MockFunction;      // Returns Message[]
  reset: MockFunction;           // No return
  registerTool: MockFunction;    // No return
  getTools: MockFunction;        // Returns AgentTool[]
  clearTools: MockFunction;      // No return
  subscribe: MockFunction;       // Returns unsubscribe function
  abort: MockFunction;           // No return
  getConfig: MockFunction;       // Returns AgentConfig
  getSystemPrompt: MockFunction; // Returns string
  setSystemPrompt: MockFunction; // No return
  getModelConfig: MockFunction;  // Returns ModelConfig
  setModel: MockFunction;        // No return
}
```

### MockGateway

Mock gateway for channel testing.

```typescript
interface MockGateway {
  handleMessage: MockFunction;        // Returns Response
  streamHandleMessage: MockGenerator; // Yields StreamChatEvent
  getOrCreateAgent: MockFunction;     // Returns { agent, sessionId }
  getStatus: MockFunction;            // Returns GatewayStatus
  destroySession: MockFunction;       // No return
  cleanup: MockFunction;              // No return
  getRouter: MockFunction;            // Returns Router
  getSessionManager: MockFunction;    // Returns SessionManager
  getAgentRegistry: MockFunction;     // Returns AgentRegistry
  getConfig: MockFunction;            // Returns Config
}
```

### MessageContext

Test message contexts for various scenarios.

```typescript
interface TestMessageContexts {
  // CLI context - no user/group ID
  cli: { channel: 'cli'; content: string };

  // Feishu context - with user ID
  feishuUser: { channel: 'feishu'; userId: string; content: string };

  // Feishu group context - with user and group ID
  feishuGroup: {
    channel: 'feishu';
    userId: string;
    groupId: string;
    content: string;
  };

  // API context - with client ID
  api: { channel: 'api'; clientId: string; content: string };
}
```

### StreamChatEvent

Events yielded during streaming.

```typescript
interface StreamChatEvent {
  content?: string;    // Content chunk (optional)
  done: boolean;       // Stream completion flag
  sessionId: string;   // Session identifier
}
```

### Response

Standard response structure.

```typescript
interface Response {
  content: string;     // Response content
  sessionId: string;   // Session identifier
}
```

## Test Scenarios

### Gateway Test Scenarios

| Scenario | Method | Input | Expected Output |
|----------|--------|-------|-----------------|
| Basic message | `handleMessage` | `{ channel: 'cli', content: 'hello' }` | `{ content: '测试响应', sessionId: 'session-cli' }` |
| Stream message | `streamHandleMessage` | `{ channel: 'cli', content: 'hello' }` | Yields chunks + done event |
| Initialize with sessions | `initialize` | Storage has sessions | Sessions restored |
| Initialize empty | `initialize` | Storage empty | No sessions restored |
| Get agent | `getOrCreateAgent` | Any context | `{ agent, sessionId }` |
| Destroy session | `destroySession` | sessionId | Agent and session removed |

### Channel Test Scenarios

| Channel | Scenario | Input | Expected Behavior |
|---------|----------|-------|-------------------|
| CLI | Exit command | `/exit` | Process exits |
| CLI | Reset command | `/reset` | Agent reset called |
| CLI | Help command | `/help` | Help text displayed |
| API | POST /chat | `{ message: 'hello' }` | 200 with response |
| API | GET /status | - | 200 with status |
| Web | Socket connect | - | Connection established |
| Web | Socket message | `{ content: 'hello' }` | Response emitted |
| Feishu | Webhook event | Valid signature | Event processed |

## Validation Rules

- All mock functions return predictable values
- Session IDs follow pattern: `session-{channel}[-{userId}][-{groupId}]`
- Content strings are non-empty for valid responses
- Error cases return appropriate error structures