# Quick Start: Test Coverage Improvement

**Feature**: Improve Test Coverage
**Date**: 2026-03-20

## Goals

| Metric | Current | Target |
|--------|---------|--------|
| Total Coverage | 72.27% | ≥ 75% |
| Branch Coverage | 59.7% | ≥ 65% |
| Gateway Coverage | 65% | ≥ 70% |

## Quick Commands

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npx vitest run tests/unit/core/gateway/index.test.ts

# Watch mode
npm run test:watch
```

## Key Files

| Component | Source | Test |
|-----------|--------|------|
| Gateway | `src/core/gateway/index.ts` | `tests/unit/core/gateway/index.test.ts` |
| CLI | `src/channels/cli.ts` | `tests/unit/channels/cli.test.ts` |
| API | `src/channels/api.ts` | `tests/unit/channels/api.test.ts` |
| Web | `src/channels/web.ts` | `tests/unit/channels/web.test.ts` |
| Feishu | `src/channels/feishu.ts` | `tests/unit/channels/feishu.test.ts` |

## Test Patterns

### Mock Agent
```typescript
const createMockAgent = (): MiniclawAgent => ({
  chat: vi.fn(async () => ({ content: 'response' })),
  streamChat: vi.fn(async function* () {
    yield { content: 'chunk', done: false };
    yield { done: true };
  }),
  // ... other methods mocked
});
```

### Mock Gateway
```typescript
const mockGateway = {
  handleMessage: vi.fn().mockResolvedValue({ content: 'response' }),
  streamHandleMessage: vi.fn().mockReturnValue(mockGenerator),
  // ... other methods mocked
} as any;
```

## Priority Tasks

1. **Gateway Tests** (P1)
   - Add `initialize()` tests
   - Add `streamHandleMessage()` tests
   - Add getter method tests

2. **Branch Coverage** (P1)
   - Test error handling paths
   - Test edge cases (empty inputs, null values)

3. **Channel Tests** (P2)
   - Add HTTP endpoint tests for API
   - Add WebSocket tests for Web
   - Add webhook tests for Feishu

## Coverage Check

After adding tests, verify:
```bash
npm run test:coverage
```

Expected output should show:
- All files: ≥ 75%
- Branches: ≥ 65%
- Gateway: ≥ 70%