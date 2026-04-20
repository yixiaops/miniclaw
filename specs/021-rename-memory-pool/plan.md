# Implementation Plan: ShortTermMemory 重命名为 MemoryCandidatePool

**Branch**: `021-rename-memory-pool` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)

## Summary

将 `ShortTermMemory` 类重命名为 `MemoryCandidatePool`，消除命名混淆。
- 74 处引用更新
- 2 个文件重命名
- 所有测试通过

## Technical Context

**Language/Version**: TypeScript 5.x (ES Modules)
**Primary Dependencies**: Vitest (测试)
**Storage**: 无（内存 Map）
**Testing**: Vitest
**Target Platform**: Node.js 服务端
**Project Type**: library
**Performance Goals**: 无变化
**Constraints**: 编译成功，测试通过
**Scale/Scope**: 74 处引用，13 个文件

## Implementation Phases

### Phase 1: 文件重命名（先改文件，再改引用）

**任务**：
1. `src/memory/store/short-term.ts` → `src/memory/store/candidate-pool.ts`
2. `tests/unit/store/short-term.test.ts` → `tests/unit/store/candidate-pool.test.ts`

**验证**：
- 文件移动成功
- Git 跟踪文件重命名

### Phase 2: 源码引用更新（6 个文件）

**顺序**：
1. `src/memory/store/candidate-pool.ts` - 类名、导出、注释
2. `src/memory/manager.ts` - import + 引用
3. `src/memory/store/ttl-manager.ts` - import + 引用
4. `src/memory/promotion/promoter.ts` - import + 引用
5. `src/memory/tools/search.ts` - import + 引用
6. `src/memory/tools/write.ts` - import + 引用

**命名对照**：

| 原命名 | 新命名 |
|--------|--------|
| `ShortTermMemory` | `MemoryCandidatePool` |
| `ShortTermConfig` | `CandidatePoolConfig` |
| `shortTerm` | `candidatePool` |
| `'short-term'` | `'candidate'` |

### Phase 3: 测试引用更新（7 个文件）

**顺序**：
1. `tests/unit/store/candidate-pool.test.ts` - import + 引用
2. `tests/unit/store/ttl-manager.test.ts` - import + 引用
3. `tests/unit/promotion/promoter.test.ts` - import + 引用
4. `tests/unit/memory/manager.test.ts` - import + 引用
5. `tests/unit/memory/store.test.ts` - import + 引用
6. `tests/unit/tools/search.test.ts` - import + 引用
7. `tests/unit/tools/write.test.ts` - import + 引用
8. `tests/integration/dual-layer.test.ts` - import + 引用

### Phase 4: 验证

**任务**：
1. 运行测试：`npm test`
2. 编译检查：`npm run build`
3. Grep 验证：无遗留 `ShortTermMemory`、`short-term` 字样

## Execution Order

```
Phase 1: 文件重命名
  ├─── T1: src/memory/store/short-term.ts → candidate-pool.ts
  └─── T2: tests/unit/store/short-term.test.ts → candidate-pool.test.ts

Phase 2: 源码引用更新
  ├─── T3: candidate-pool.ts（类名、导出、注释）
  ├─── T4: manager.ts（import + 引用）
  ├─── T5: ttl-manager.ts（import + 引用）
  ├─── T6: promoter.ts（import + 引用）
  ├─── T7: search.ts（import + 引用）
  └─── T8: write.ts（import + 引用）

Phase 3: 测试引用更新
  ├─── T9: candidate-pool.test.ts
  ├─── T10: ttl-manager.test.ts
  ├─── T11: promoter.test.ts
  ├─── T12: manager.test.ts
  ├─── T13: store.test.ts
  ├─── T14: search.test.ts
  ├─── T15: write.test.ts
  └─── T16: dual-layer.test.ts

Phase 4: 验证
  ├─── T17: npm test
  ├─── T18: npm run build
  └─── T19: grep 验证
```

## Risk Mitigation

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 遗漏引用 | 编译失败 | Phase 4 grep 验证 |
| 测试失败 | 功能异常 | 每个文件改后运行测试 |
| dist/ 旧文件 | 导入错误 | npm run build 重新编译 |

## Success Criteria

- [x] Phase 1: 文件重命名完成
- [x] Phase 2: 源码引用更新完成
- [x] Phase 3: 测试引用更新完成
- [x] Phase 4: 所有测试通过
- [x] Phase 4: 编译成功
- [x] Phase 4: grep 验证无遗留