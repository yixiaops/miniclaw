# Research: Coverage Gap Analysis

**Feature**: Improve Test Coverage
**Date**: 2026-03-20

## Coverage Analysis

### Current State

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Total Coverage | 72.27% | 75% | +2.73% |
| Branch Coverage | 59.7% | 65% | +5.3% |
| Gateway Class | 65% | 70% | +5% |

### Identified Coverage Gaps

#### 1. Gateway Class (`src/core/gateway/index.ts`)

**Missing Test Scenarios**:
- `initialize()` method - Session restoration from storage
- `streamHandleMessage()` - Streaming message processing
- `getOrCreateAgent()` - Agent retrieval without chat
- `getRouter()`, `getSessionManager()`, `getAgentRegistry()`, `getConfig()` - Getter methods
- `saveSessionHistory()` - Private method (tested indirectly)
- Error handling branches in `initialize()` - empty messages, failed loads

**Current Test Coverage**:
- `handleMessage()` - Basic scenarios covered
- `getStatus()` - Covered
- `cleanup()` - Covered
- `destroySession()` - Covered

**Decision**: Add tests for `initialize()`, `streamHandleMessage()`, `getOrCreateAgent()`, and getter methods.

#### 2. CLI Channel (`src/channels/cli.ts`) - 48%

**Missing Test Scenarios**:
- Error handling in `processInput()`
- Empty input handling
- Model switching commands (`/model`)
- History commands (`/history`)
- Graceful shutdown scenarios

**Decision**: Add tests for command handling edge cases and error scenarios.

#### 3. API Channel (`src/channels/api.ts`) - 40%

**Missing Test Scenarios**:
- HTTP endpoint testing (POST /chat, GET /status)
- Request validation
- Error response handling
- Streaming responses (SSE)
- CORS handling

**Decision**: Add HTTP endpoint tests using supertest or Vitest's built-in HTTP testing.

#### 4. Web Channel (`src/channels/web.ts`) - 60%

**Missing Test Scenarios**:
- WebSocket connection handling
- Message broadcasting
- Client disconnection handling
- Room/session management

**Decision**: Add WebSocket event tests using socket.io-client for testing.

#### 5. Feishu Channel (`src/channels/feishu.ts`) - 59%

**Missing Test Scenarios**:
- Webhook signature validation
- Event processing
- Message formatting
- Error handling for invalid payloads

**Decision**: Add tests for webhook handling and event processing.

## Test Patterns Analysis

### Existing Patterns

1. **Mock Agent Pattern**:
```typescript
const createMockAgent = (): MiniclawAgent => ({
  chat: vi.fn(async () => ({ content: 'response' })),
  streamChat: vi.fn(async function* () {
    yield { content: 'chunk', done: false };
    yield { done: true };
  }),
  // ... other methods
});
```

2. **Mock Gateway Pattern**:
```typescript
mockGateway = {
  handleMessage: vi.fn().mockResolvedValue({ content: 'response' }),
  streamHandleMessage: vi.fn().mockReturnValue(mockGenerator),
  // ... other methods
} as any;
```

3. **Test Structure**:
- Use `describe` blocks for grouping
- Use `beforeEach`/`afterEach` for setup/cleanup
- Use `vi.clearAllMocks()` in `afterEach`

## Recommendations

### Priority Order

1. **P1 - Gateway Tests**: Add `initialize()`, `streamHandleMessage()`, getter tests
2. **P2 - Branch Coverage**: Focus on error handling branches across all modules
3. **P3 - Channel Tests**: Add endpoint/event tests for API, Web, Feishu channels

### Testing Strategy

1. **Unit Tests**: Test individual methods with mocked dependencies
2. **Integration Tests**: Test message flow through multiple components
3. **Error Path Tests**: Explicitly test error handling branches

### Test Data

- Use consistent mock configs
- Use predictable session IDs
- Mock storage operations for reliability