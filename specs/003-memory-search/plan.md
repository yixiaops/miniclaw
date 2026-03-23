# Implementation Plan: Memory Search System

**Feature Branch**: `003-memory-search`
**Created**: 2026-03-23
**Status**: Draft

## Overview

实现记忆搜索系统，提供 `memory_search` 和 `memory_get` 两个工具，让 Agent 可以搜索对话历史和知识库文件。

## Clarification Summary

| 决策项 | 选择 |
|--------|------|
| 大小写敏感 | 不敏感 |
| 匹配方式 | 包含匹配（substring） |
| 分数计算 | 简单返回 1.0（所有匹配结果分数相同） |
| 工具注册位置 | Agent 内置工具（类似 read_file） |
| 默认启用 | 是 |
| 目录不存在时 | 自动创建 |
| 知识库目录 | 仅 `~/.miniclaw/memory/` |
| 默认 maxResults | 10 |
| snippet 长度 | 不限制 |
| Session 格式 | 兼容现有 SimpleMemoryStorage |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Miniclaw Agent                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Tools                              │   │
│  │  read_file │ write_file │ shell │ web_fetch │        │   │
│  │  memory_search (新增) │ memory_get (新增) │           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MemorySearchManager (新增)               │   │
│  │  - search(query, options) → SearchResult[]           │   │
│  │  - readFile(path, from, lines) → {text, path}        │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│          ┌──────────────┴──────────────┐                   │
│          │                             │                   │
│  ┌───────┴───────┐            ┌────────┴────────┐         │
│  │SessionSearcher│            │ KnowledgeSearcher│         │
│  │  (对话历史)    │            │  (memory/*.md)  │         │
│  └───────┬───────┘            └─────────────────┘         │
│          │                                                 │
│          │ 复用                                            │
│          ▼                                                 │
│  ┌─────────────────┐                                       │
│  │SimpleMemoryStorage│ (已有)                               │
│  │  load() / listSessions()                                │
│  └─────────────────┘                                       │
│                                                             │
│  存储位置: ~/.miniclaw/                                      │
│  ├── sessions/*.json  (对话历史，已有)                        │
│  └── memory/*.md      (知识库，新增)                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/core/memory/
├── index.ts              # 导出入口 (修改)
├── simple.ts             # SimpleMemoryStorage (已有)
├── search.ts             # MemorySearchManager (新增)
├── session-searcher.ts   # SessionSearcher (新增)
└── knowledge-searcher.ts # KnowledgeSearcher (新增)

src/tools/
├── index.ts              # 工具注册 (修改)
├── memory-search.ts      # memory_search 工具 (新增)
└── memory-get.ts         # memory_get 工具 (新增)

tests/unit/core/memory/
├── search.test.ts        # MemorySearchManager 测试 (新增)
├── session-searcher.test.ts  # SessionSearcher 测试 (新增)
└── knowledge-searcher.test.ts # KnowledgeSearcher 测试 (新增)

tests/unit/tools/
├── memory-search.test.ts # memory_search 工具测试 (新增)
└── memory-get.test.ts    # memory_get 工具测试 (新增)
```

---

## Implementation Phases

### Phase 1: Core Search Infrastructure (P1)

**Goal**: 实现 MemorySearchManager 核心类

**Tasks**:

| ID | Task | File | Est. |
|----|------|------|------|
| T001 | 创建 MemorySearchManager 类 | `src/core/memory/search.ts` | 20min |
| T002 | 定义 SearchResult 接口 | `src/core/memory/search.ts` | 10min |
| T003 | 实现 search() 方法骨架 | `src/core/memory/search.ts` | 15min |
| T004 | 实现 readFile() 方法 | `src/core/memory/search.ts` | 15min |

**Acceptance Criteria**:
- [ ] MemorySearchManager 类可实例化
- [ ] search() 方法返回空数组（占位）
- [ ] readFile() 方法可读取文件内容

---

### Phase 2: Session Search (P1)

**Goal**: 实现对话历史搜索

**Design**: 复用 `SimpleMemoryStorage` 的 `load()` 和 `listSessions()` 方法

**Tasks**:

| ID | Task | File | Est. |
|----|------|------|------|
| T005 | 创建 SessionSearcher 类，注入 SimpleMemoryStorage | `src/core/memory/session-searcher.ts` | 15min |
| T006 | 使用 listSessions() 获取所有 session | `src/core/memory/session-searcher.ts` | 15min |
| T007 | 使用 load() 加载每个 session 的消息 | `src/core/memory/session-searcher.ts` | 15min |
| T008 | 实现 search() 搜索消息内容（大小写不敏感） | `src/core/memory/session-searcher.ts` | 20min |
| T009 | 集成到 MemorySearchManager | `src/core/memory/search.ts` | 15min |

**Acceptance Criteria**:
- [ ] 复用 SimpleMemoryStorage，不重复实现读取逻辑
- [ ] 可搜索 sessions/*.json 中的消息
- [ ] 返回匹配的 snippet 和行号
- [ ] 大小写不敏感

---

### Phase 3: Knowledge Base Search (P1)

**Goal**: 实现知识库文件搜索

**Tasks**:

| ID | Task | File | Est. |
|----|------|------|------|
| T010 | 创建 KnowledgeSearcher 类 | `src/core/memory/knowledge-searcher.ts` | 15min |
| T011 | 实现 loadFiles() 加载所有 .md 文件 | `src/core/memory/knowledge-searcher.ts` | 20min |
| T012 | 实现 search() 搜索文件内容 | `src/core/memory/knowledge-searcher.ts` | 25min |
| T013 | 自动创建 memory 目录（如不存在） | `src/core/memory/knowledge-searcher.ts` | 10min |
| T014 | 集成到 MemorySearchManager | `src/core/memory/search.ts` | 15min |

**Acceptance Criteria**:
- [ ] 可搜索 memory/*.md 文件
- [ ] 目录不存在时自动创建
- [ ] 返回匹配的 snippet 和行号

---

### Phase 4: Tool Registration (P1)

**Goal**: 注册 memory_search 和 memory_get 工具

**Tasks**:

| ID | Task | File | Est. |
|----|------|------|------|
| T015 | 创建 memory_search 工具 | `src/tools/memory-search.ts` | 20min |
| T016 | 创建 memory_get 工具 | `src/tools/memory-get.ts` | 15min |
| T017 | 注册到工具列表 | `src/tools/index.ts` | 10min |
| T018 | 更新 Agent 工具注册 | `src/core/agent/index.ts` | 15min |

**Acceptance Criteria**:
- [ ] Agent 可调用 memory_search 工具
- [ ] Agent 可调用 memory_get 工具
- [ ] 工具描述清晰，Agent 知道如何使用

---

### Phase 5: Testing (P1)

**Goal**: 完成单元测试

**Tasks**:

| ID | Task | File | Est. |
|----|------|------|------|
| T019 | MemorySearchManager 测试 | `tests/unit/core/memory/search.test.ts` | 20min |
| T020 | SessionSearcher 测试 | `tests/unit/core/memory/session-searcher.test.ts` | 20min |
| T021 | KnowledgeSearcher 测试 | `tests/unit/core/memory/knowledge-searcher.test.ts` | 20min |
| T022 | memory_search 工具测试 | `tests/unit/tools/memory-search.test.ts` | 15min |
| T023 | memory_get 工具测试 | `tests/unit/tools/memory-get.test.ts` | 15min |

**Acceptance Criteria**:
- [ ] 所有测试通过
- [ ] 覆盖率 ≥ 80%

---

## Dependencies

### Internal Dependencies

- `SimpleMemoryStorage` (已有): **SessionSearcher 复用此类的 load() 和 listSessions() 方法读取对话历史**
- `Gateway` (已有): 不直接依赖，工具独立

### External Dependencies

- 无新增外部依赖
- 使用 Node.js 内置 `fs` 模块

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Session 文件格式变化 | 高 | 兼容现有格式，版本检查 |
| 大文件内存占用 | 中 | 限制单文件大小，流式读取 |
| 并发读写冲突 | 低 | 只读操作，无风险 |
| 路径遍历攻击 | 中 | 限制在 ~/.miniclaw 目录内 |

---

## Time Estimate

| Phase | Duration |
|-------|----------|
| Phase 1: Core Infrastructure | 1h |
| Phase 2: Session Search | 1.5h |
| Phase 3: Knowledge Search | 1.5h |
| Phase 4: Tool Registration | 1h |
| Phase 5: Testing | 1.5h |
| **Total** | **6.5h** |

---

## Next Steps

1. 确认 plan.md
2. 生成 tasks.md（详细任务清单）
3. 开始实施 Phase 1