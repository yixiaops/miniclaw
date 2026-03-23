# Coverage Gaps

**Date**: 2026-03-20
**Current Coverage**: Total 77.37%, Branch 64.41%

## Remaining Branch Coverage Gaps

The branch coverage is at 64.41%, just 0.59% below the 65% target. The main gaps are:

### API Channel (`src/channels/api.ts`) - Branch: 6.66%

**Uncovered Branches** (Lines 48-145):
- POST `/chat` error handling paths
- POST `/v1/chat/completions` streaming vs non-streaming
- Request validation branches
- Error response formatting

**Reason for Low Coverage**: Testing HTTP endpoints requires supertest or similar library. Current tests verify basic functionality but don't exercise all HTTP paths.

**Recommendation**: Install supertest for comprehensive HTTP endpoint testing.

### Web Channel (`src/channels/web.ts`) - Branch: 33.33%

**Uncovered Branches** (Lines 42-74, 167-183):
- HTTP POST `/api/chat` error handling
- WebSocket event handlers (connection, chat, disconnect)
- Streaming response branches

**Reason for Low Coverage**: WebSocket testing requires socket.io-client for testing. Current tests verify basic server lifecycle but not all WebSocket event paths.

**Recommendation**: Add socket.io-client to test WebSocket events.

### Gateway Router (`src/core/gateway/router.ts`) - Branch: 68.42%

**Uncovered Branches** (Lines 193, 202-203, 216):
- Custom routing rule handling
- Edge cases in route context matching

**Recommendation**: Add tests for custom routing rules.

### Core Agent (`src/core/agent/index.ts`) - Branch: 49.45%

**Uncovered Branches** (Lines 768-826, 873-875):
- Tool execution error handling
- Streaming chunk processing edge cases
- Message history edge cases

**Recommendation**: Add tests for tool execution failures and streaming edge cases.

## Coverage Achieved

| Module | Before | After | Improvement |
|--------|--------|-------|-------------|
| Gateway | 65.45% | 100% | +34.55% |
| Feishu | 58.82% | 100% | +41.18% |
| CLI Commands | 88.88% | 100% | +11.12% |
| CLI | 47.5% | 55% | +7.5% |
| API | 40% | 41.53% | +1.53% |
| Web | 59.57% | 61.7% | +2.13% |

## Summary

- **Total Coverage**: 77.37% ✅ (target: 75%+)
- **Branch Coverage**: 64.41% (target: 65%+, gap: 0.59%)
- **Gateway Coverage**: 100% ✅ (target: 70%+)

The primary target (Gateway ≥ 70%) was exceeded. Branch coverage is within 1% of target. The remaining gaps are in HTTP endpoint testing and WebSocket event handling, which would require additional testing libraries (supertest, socket.io-client).