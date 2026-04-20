# Tasks: ShortTermMemory 重命名为 MemoryCandidatePool

**Branch**: `021-rename-memory-pool` | **Date**: 2026-04-20

## Overview

将 `ShortTermMemory` 类重命名为 `MemoryCandidatePool`，消除命名混淆。

**Total Tasks**: 19 | **Completed**: 0 | **Remaining**: 19

---

## Phase 1: 文件重命名

> 先改文件，再改引用。使用 git mv 保持 Git 历史。

### Task 1: 重命名源码文件

- **Description**: 将 `src/memory/store/short-term.ts` 重命名为 `src/memory/store/candidate-pool.ts`
- **File**: `src/memory/store/short-term.ts` → `src/memory/store/candidate-pool.ts`
- **Command**: `git mv src/memory/store/short-term.ts src/memory/store/candidate-pool.ts`
- **Status**: [ ] pending

### Task 2: 重命名测试文件

- **Description**: 将 `tests/unit/store/short-term.test.ts` 重命名为 `tests/unit/store/candidate-pool.test.ts`
- **File**: `tests/unit/store/short-term.test.ts` → `tests/unit/store/candidate-pool.test.ts`
- **Command**: `git mv tests/unit/store/short-term.test.ts tests/unit/store/candidate-pool.test.ts`
- **Status**: [ ] pending

---

## Phase 2: 源码引用更新

> 按依赖顺序更新，每个文件更新后立即验证编译。

### Task 3: 更新 candidate-pool.ts

- **Description**: 更新类名、导出、注释
- **File**: `src/memory/store/candidate-pool.ts`
- **Changes**:
  - `ShortTermMemory` → `MemoryCandidatePool`
  - `ShortTermConfig` → `CandidatePoolConfig`
  - `shortTerm` → `candidatePool` (变量名)
  - `'short-term'` → `'candidate'` (字符串)
  - 更新 JSDoc 注释
- **Status**: [ ] pending

### Task 4: 更新 manager.ts

- **Description**: 更新 import 和引用
- **File**: `src/memory/manager.ts`
- **Changes**:
  - import 路径更新: `./store/short-term.js` → `./store/candidate-pool.js`
  - import 名称更新: `ShortTermMemory` → `MemoryCandidatePool`, `ShortTermConfig` → `CandidatePoolConfig`
  - 引用更新: `shortTerm` → `candidatePool`
- **Status**: [ ] pending

### Task 5: 更新 ttl-manager.ts

- **Description**: 更新 import 和引用
- **File**: `src/memory/store/ttl-manager.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 6: 更新 promoter.ts

- **Description**: 更新 import 和引用
- **File**: `src/memory/promotion/promoter.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 7: 更新 search.ts

- **Description**: 更新 import 和引用
- **File**: `src/memory/tools/search.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 8: 更新 write.ts

- **Description**: 更新 import 和引用
- **File**: `src/memory/tools/write.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

---

## Phase 3: 测试引用更新

> 更新测试文件中的 import 和引用，保持测试逻辑不变。

### Task 9: 更新 candidate-pool.test.ts

- **Description**: 更新测试文件的 import 和引用
- **File**: `tests/unit/store/candidate-pool.test.ts`
- **Changes**:
  - import 路径和名称更新
  - 所有引用更新
  - 测试描述字符串更新
- **Status**: [ ] pending

### Task 10: 更新 ttl-manager.test.ts

- **Description**: 更新测试文件的 import 和引用
- **File**: `tests/unit/store/ttl-manager.test.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 11: 更新 promoter.test.ts

- **Description**: 更新测试文件的 import 和引用
- **File**: `tests/unit/promotion/promoter.test.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 12: 更新 manager.test.ts

- **Description**: 更新测试文件的 import 和引用
- **File**: `tests/unit/memory/manager.test.ts`
- **Changes**:
  - import 路径和名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 13: 更新 store.test.ts

- **Description**: 更新测试文件的 import 和引用
- **File**: `tests/unit/memory/store.test.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 14: 更新 search.test.ts

- **Description**: 更新测试文件的 import 和引用
- **File**: `tests/unit/tools/search.test.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 15: 更新 write.test.ts

- **Description**: 更新测试文件的 import 和引用
- **File**: `tests/unit/tools/write.test.ts`
- **Changes**:
  - import 名称更新
  - 引用更新
- **Status**: [ ] pending

### Task 16: 更新 dual-layer.test.ts

- **Description**: 更新集成测试的 import 和引用
- **File**: `tests/integration/dual-layer.test.ts`
- **Changes**:
  - import 路径和名称更新
  - 引用更新
- **Status**: [ ] pending

---

## Phase 4: 验证

> 确保所有更改正确，无遗漏引用。

### Task 17: 运行测试

- **Description**: 运行 `npm test` 确保所有测试通过
- **Command**: `npm test`
- **Expected**: 所有测试通过
- **Status**: [ ] pending

### Task 18: 编译检查

- **Description**: 运行 `npm run build` 确保编译成功
- **Command**: `npm run build`
- **Expected**: 编译成功，无错误
- **Status**: [ ] pending

### Task 19: Grep 验证

- **Description**: 确认无遗留的旧命名
- **Commands**:
  - `grep -r "ShortTermMemory" src/ tests/` (应为空)
  - `grep -r "ShortTermConfig" src/ tests/` (应为空)
  - `grep -r "short-term" src/ tests/` (应为空，除了本任务文件)
- **Expected**: 无匹配结果
- **Status**: [ ] pending

---

## Naming Reference

| 原命名 | 新命名 |
|--------|--------|
| `ShortTermMemory` | `MemoryCandidatePool` |
| `ShortTermConfig` | `CandidatePoolConfig` |
| `shortTerm` | `candidatePool` |
| `'short-term'` | `'candidate'` |

## Progress Tracking

```
Phase 1: [ ][ ] 0/2
Phase 2: [ ][ ][ ][ ][ ][ ] 0/6
Phase 3: [ ][ ][ ][ ][ ][ ][ ][ ] 0/8
Phase 4: [ ][ ][ ] 0/3
```