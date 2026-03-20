# Coverage Baseline

**Date**: 2026-03-20
**Test Run**: 192 tests passed, 1 skipped

## Overall Metrics

| Metric | Value | Target | Gap |
|--------|-------|--------|-----|
| Total Statements | 72.13% | 75% | -2.87% |
| Branch Coverage | 59.7% | 65% | -5.3% |
| Function Coverage | 76.39% | - | - |
| Line Coverage | 72.27% | 75% | -2.73% |

## Module Coverage

### Channels Layer

| File | Statements | Branch | Functions | Lines |
|------|------------|--------|-----------|-------|
| api.ts | 39.39% | 3.33% | 68.75% | 40% |
| cli-commands.ts | 88.88% | 92.85% | 85.71% | 88.88% |
| cli.ts | 47.5% | 50% | 50% | 47.5% |
| feishu.ts | 58.82% | 87.5% | 33.33% | 58.82% |
| index.ts | 0% | 0% | 0% | 0% |
| web.ts | 59.57% | 16.66% | 64.7% | 59.57% |

### Core Layer

| File | Statements | Branch | Functions | Lines |
|------|------------|--------|-----------|-------|
| config.ts | 86.95% | 89.28% | 100% | 86.95% |
| lifecycle.ts | 88.88% | 50% | 80% | 88.88% |

### Core/Agent Layer

| File | Statements | Branch | Functions | Lines |
|------|------------|--------|-----------|-------|
| index.ts | 68.91% | 49.45% | 73.52% | 69.27% |
| registry.ts | 94.73% | 81.25% | 88.88% | 94.73% |

### Core/Gateway Layer

| File | Statements | Branch | Functions | Lines |
|------|------------|--------|-----------|-------|
| index.ts | 66.07% | 37.5% | 73.33% | 65.45% |
| router.ts | 82.05% | 68.42% | 100% | 80.55% |
| session.ts | 93.93% | 92.85% | 90.9% | 93.93% |

### Core/Memory Layer

| File | Statements | Branch | Functions | Lines |
|------|------------|--------|-----------|-------|
| simple.ts | 93.75% | 60% | 100% | 93.75% |

### Core/Session-Key Layer

| File | Statements | Branch | Functions | Lines |
|------|------------|--------|-----------|-------|
| index.ts | 91.89% | 87.5% | 100% | 91.89% |

### Tools Layer

| File | Statements | Branch | Functions | Lines |
|------|------------|--------|-----------|-------|
| index.ts | 0% | 100% | 0% | 0% |
| read-file.ts | 80% | 50% | 100% | 80% |
| shell.ts | 100% | 91.66% | 100% | 100% |
| web-fetch.ts | 61.9% | 42.85% | 50% | 65% |
| write-file.ts | 85.71% | 50% | 100% | 85.71% |

## Priority Targets

### P1 - Gateway (src/core/gateway/index.ts)
- Current: 65.45% lines, 37.5% branches
- Target: 70%+ lines
- Uncovered: Lines 232-290, 351-360

### P2 - Branch Coverage
- Current: 59.7%
- Target: 65%+
- Critical gaps: api.ts (3.33%), web.ts (16.66%), gateway/index.ts (37.5%)

### P3 - Total Coverage
- Current: 72.27%
- Target: 75%+
- Key files to improve: api.ts, cli.ts, web.ts