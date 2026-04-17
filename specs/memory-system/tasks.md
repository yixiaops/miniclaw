# Memory System - Task Breakdown

> Generated: 2026-04-14
> Based on: plan.md
> Total Estimated: ~84h

---

## Overview

| Phase | Priority | Estimated | Dependencies |
|-------|----------|-----------|--------------|
| Phase 1: memory_write 工具 | P1 | 13h | - |
| Phase 2: 双层记忆结构 | P1 | 16h | Phase 1 |
| Phase 3: memory_search 增强 | P2 | 17h | Phase 2 |
| Phase 4: 行为规则注入 | P3 | 18h | Phase 1 |
| Phase 5: 自动写入机制 | P3 | 20h | Phase 1, 4 |

**Critical Path**: Phase 1 → Phase 2 → Phase 3 → Phase 5 (~66h)  
**Parallel Optimized**: ~50h (Phase 2 & 4 parallel, Phase 3 & 5 partial parallel)

---

## Phase 1: memory_write 工具 (P1, 13h)

### T1.1 实现 MemoryStore 基础类 (🔴 High, 2h)

**Files**: `src/memory/store/interface.ts`, `src/memory/store/file-store.ts`, `tests/unit/store.test.ts`

**验收标准**: IMemoryStore 接口完整，write/read/delete 可用，覆盖率 > 80%

---

### T1.2 实现 EmbeddingService 集成 (🔴 High, 1h, 依赖 T1.1)

**Files**: `src/memory/embedding/interface.ts`, `src/memory/embedding/agent-embedding.ts`

**验收标准**: embed/embedBatch 可用，缓存命中率 > 90%

---

### T1.3 实现语义相似度计算 (🔴 High, 2h, 依赖 T1.2)

**Files**: `src/memory/vector/similarity.ts`, `src/memory/vector/index.ts`

**验收标准**: 余弦相似度准确，100条检索 < 100ms

---

### T1.4 实现去重逻辑 (🔴 High, 2h, 依赖 T1.3)

**Files**: `src/memory/write/deduplication.ts`

**验收标准**: 相似度 ≥ 0.95 标记重复，去重检查 < 50ms

---

### T1.5 实现敏感信息检测 (🔴 High, 1h, 依赖 T1.1)

**Files**: `src/memory/write/sensitive-detector.ts`

**验收标准**: 检测密码/密钥/Token，误报率 < 5%

---

### T1.6 实现 memory_write 工具接口 (🔴 High, 2h, 依赖 T1.4, T1.5)

**Files**: `src/memory/tools/write.ts`, `src/memory/tools/index.ts`

**验收标准**: 返回 created/updated/skipped 状态

---

### T1.7 编写单元测试 (🟡 Medium, 2h, 依赖 T1.6)

**Files**: `tests/unit/`, `tests/integration/write.test.ts`

**验收标准**: 覆盖率 > 90%，无 P0/P1 bug

---

### T1.8 文档编写 (⚪ None, 1h, 依赖 T1.7)

**Files**: `docs/api/memory-write.md`, `README.md`

---

## Phase 2: 双层记忆结构 (P1, 16h, 依赖 Phase 1)

### T2.1 设计双层存储结构 (🟡 Medium, 2h)

**Files**: `docs/architecture/dual-layer.md`, `src/memory/types.ts`

---

### T2.2 实现短期记忆管理 (🔴 High, 3h)

**Files**: `src/memory/store/short-term.ts`, `src/memory/store/session-manager.ts`

**验收标准**: Session 隔离，TTL 过期清理

---

### T2.3 实现长期记忆持久化 (🔴 High, 3h)

**Files**: `src/memory/store/long-term.ts`, `src/memory/store/persistence.ts`

**验收标准**: 跨 Session 持久化，服务重启后数据恢复

---

### T2.4 实现记忆晋升机制 (🔴 High, 2h)

**Files**: `src/memory/promotion/promoter.ts`, `src/memory/tools/promote.ts`

**验收标准**: 重要性 > 阈值自动晋升

---

### T2.5 实现 TTL 过期清理 (🟡 Medium, 1h)

**Files**: `src/memory/store/ttl-manager.ts`, `src/memory/store/cleanup-job.ts`

**验收标准**: 默认 24h TTL，定时清理运行正常

---

### T2.6 更新 memory_search 双层检索 (🔴 High, 2h)

**Files**: `src/memory/tools/search.ts`

**验收标准**: 支持 types 过滤，双层合并检索

---

### T2.7 编写集成测试 (🟡 Medium, 2h)

**Files**: `tests/integration/dual-layer.test.ts`

---

### T2.8 文档更新 (⚪ None, 1h)

**Files**: `docs/architecture/dual-layer.md`

---

## Phase 3: memory_search 增强 (P2, 17h, 依赖 Phase 2)

### T3.1 实现混合排序算法 (🔴 High, 3h)

**Files**: `src/memory/search/ranking.ts`, `src/memory/search/scorer.ts`

**验收标准**: 时间权重 0.6 + 相关性权重 0.4

---

### T3.2 实现时间范围过滤 (🔴 High, 2h)

**Files**: `src/memory/search/time-filter.ts`

**验收标准**: 支持 timeRange 参数

---

### T3.3 实现相关性阈值过滤 (🟡 Medium, 1h)

**Files**: `src/memory/search/threshold-filter.ts`

**验收标准**: 默认阈值 0.5

---

### T3.4 实现上下文提取 (🔴 High, 3h)

**Files**: `src/memory/search/context-extractor.ts`

**验收标准**: 前后各 5 行上下文

---

### T3.5 实现分页机制 (🟡 Medium, 2h)

**Files**: `src/memory/search/pagination.ts`

**验收标准**: 默认 limit 5，最大 20

---

### T3.6 性能优化 (🟡 Medium, 3h)

**Files**: `src/memory/vector/optimized-index.ts`

**验收标准**: 10000 条检索 < 200ms

---

### T3.7 编写测试 (🟡 Medium, 2h)

---

### T3.8 文档更新 (⚪ None, 1h)

---

## Phase 4: 行为规则注入 (P3, 18h, 依赖 Phase 1)

### T4.1 设计行为规则 DSL (🟡 Medium, 2h)

**Files**: `docs/design/behavior-rules-dsl.md`

---

### T4.2 实现规则解析器 (🔴 High, 3h)

**Files**: `src/memory/rules/parser.ts`

---

### T4.3 实现关键词触发器 (🔴 High, 2h)

**Files**: `src/memory/rules/triggers/keyword.ts`

---

### T4.4 实现意图触发器 (🔴 High, 4h)

**Files**: `src/memory/rules/triggers/intent.ts`

---

### T4.5 实现定时触发器 (🟡 Medium, 2h)

**Files**: `src/memory/rules/triggers/schedule.ts`

---

### T4.6 实现规则优先级调度 (🔴 High, 2h)

**Files**: `src/memory/rules/engine.ts`

---

### T4.7 编写测试 (🟡 Medium, 2h)

---

### T4.8 文档更新 (⚪ None, 1h)

---

## Phase 5: 自动写入机制 (P3, 20h, 依赖 Phase 1)

### T5.1 实现重要性评估模型 (🔴 High, 4h)

**Files**: `src/memory/evaluation/importance-scorer.ts`

**验收标准**: 准确率 > 80%，评估延迟 < 200ms

---

### T5.2 实现会话状态监控 (🔴 High, 3h)

**Files**: `src/memory/session/monitor.ts`

**验收标准**: 会话状态追踪准确

---

### T5.3 实现阈值触发器 (🟡 Medium, 2h)

**Files**: `src/memory/auto-write/threshold-trigger.ts`

---

### T5.4 实现增量写入策略 (🔴 High, 3h)

**Files**: `src/memory/auto-write/incremental-writer.ts`

---

### T5.5 实现临时内容过滤 (🔴 High, 2h)

**Files**: `src/memory/evaluation/temporary-detector.ts`

**验收标准**: 识别率 > 85%

---

### T5.6 实现手动命令 /remember (🟡 Medium, 2h)

**Files**: `src/memory/commands/remember.ts`

---

### T5.7 编写集成测试 (🔴 High, 3h)

**Files**: `tests/integration/auto-write.test.ts`

---

### T5.8 文档更新 (⚪ None, 1h)

---

## TDD 优先级统计

| 优先级 | 数量 | 说明 |
|--------|------|------|
| 🔴 High | 28 | 核心功能，必须 TDD |
| 🟡 Medium | 11 | 重要功能，需要测试 |
| ⚪ None | 5 | 文档任务，无需测试 |

---

## 并行执行策略

```
Week 1: Phase 1 (独立)
Week 2: Phase 2 + Phase 4 并行
Week 3: Phase 3 + Phase 5 并行
```

---

## 下一步行动

1. ✅ speckit 流程完成（spec.md → clarify.md → plan.md → tasks.md）
2. → 开始 Phase 1 开发（TDD 模式）
3. → 从 T1.1 开始实现 MemoryStore 基础类

---

*此文档由 /speckit.tasks 生成。*