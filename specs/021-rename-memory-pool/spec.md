# Feature Specification: ShortTermMemory 重命名为 MemoryCandidatePool

**Feature Branch**: `021-rename-memory-pool`
**Created**: 2026-04-20
**Status**: Draft
**Input**: 用户需求：将 ShortTermMemory 类重命名为 MemoryCandidatePool，因为其实际功能是"晋升候选池"，而非"短期记忆"

## 背景

当前命名问题：
- `ShortTermMemory` 类名暗示是"短期记忆"，但实际功能是：
  - 内存缓存，存储等待晋升判断的记忆
  - 不持久化，重启丢失
  - 只在 TTL 清理时判断是否晋升到长期记忆
- 真正的"短期记忆"是 `session.json`（SimpleMemoryStorage），它持久化对话历史

命名修正：
- `ShortTermMemory` → `MemoryCandidatePool`（记忆候选池）
- `short-term.ts` → `candidate-pool.ts`

## User Scenarios & Testing

### User Story 1 - 类名重命名 (Priority: P1)

开发者查看代码时，能准确理解 MemoryCandidatePool 的职责：它是晋升候选池，不是短期记忆存储。

**Why this priority**: 核心命名修正，消除概念混淆

**Independent Test**: 编译成功，所有测试通过

**Acceptance Scenarios**:

1. **Given** 源码中有 ShortTermMemory 类，**When** 重命名后，**Then** 所有引用更新为 MemoryCandidatePool
2. **Given** short-term.ts 文件，**When** 重命名后，**Then** 文件名改为 candidate-pool.ts
3. **Given** 所有测试文件，**When** 运行测试，**Then** 所有测试通过

---

### User Story 2 - 类型标识修正 (Priority: P2)

MemoryEntry.type 字段从 'short-term' 改为 'candidate'。

**Why this priority**: 保持类型标识与类名一致

**Independent Test**: 序列化/反序列化测试通过

**Acceptance Scenarios**:

1. **Given** MemoryEntry.type = 'short-term'，**When** 重命名后，**Then** type = 'candidate'
2. **Given** 长期记忆文件中有 'short-term' 类型，**When** 加载后，**Then** 正确处理旧数据

---

### User Story 3 - 文档注释更新 (Priority: P3)

更新所有 JSDoc 注释，说明 MemoryCandidatePool 的真实用途。

**Why this priority**: 提升代码可读性

**Independent Test**: 文档审查

**Acceptance Scenarios**:

1. **Given** 类注释说明"短期记忆存储"，**When** 更新后，**Then** 说明"晋升候选池"
2. **Given** 方法注释，**When** 更新后，**Then** 准确描述功能

## Edge Cases

- 如何处理已有长期记忆文件中的 'short-term' 类型？（兼容处理）
- dist/ 目录下的编译产物如何处理？（重新编译）
- node_modules 中的引用？（不涉及，只改源码）

## Requirements

### Functional Requirements

- **FR-001**: ShortTermMemory 类名改为 MemoryCandidatePool
- **FR-002**: short-term.ts 文件名改为 candidate-pool.ts
- **FR-003**: 所有引用（74 处）更新为新名称
- **FR-004**: 变量名 shortTerm 改为 candidatePool
- **FR-005**: 类型标识 'short-term' 改为 'candidate'
- **FR-006**: 测试文件 short-term.test.ts 改为 candidate-pool.test.ts
- **FR-007**: 所有测试通过
- **FR-008**: 代码编译成功

### Key Entities

- **MemoryCandidatePool**: 记忆候选池，存储等待晋升判断的记忆（内存 Map，不持久化）
- **MemoryEntry**: 记忆条目，type 字段改为 'candidate'
- **MemoryManager**: 记忆管理器，引用 candidatePool

## Success Criteria

### Measurable Outcomes

- **SC-001**: 所有 74 处引用更新完成
- **SC-002**: 所有测试通过（800+ tests）
- **SC-003**: 编译成功（npm run build）
- **SC-004**: 无遗留的 ShortTermMemory、short-term 字样（grep 验证）

## 涉及文件清单

### 源码文件（6个）

| 文件 | 修改内容 |
|------|----------|
| `src/memory/store/short-term.ts` | 类名、文件名、注释 |
| `src/memory/manager.ts` | 引用更新 |
| `src/memory/store/ttl-manager.ts` | 引用更新 |
| `src/memory/promotion/promoter.ts` | 引用更新 |
| `src/memory/tools/search.ts` | 引用更新 |
| `src/memory/tools/write.ts` | 引用更新 |

### 测试文件（7个）

| 文件 | 修改内容 |
|------|----------|
| `tests/unit/store/short-term.test.ts` | 文件名、引用更新 |
| `tests/unit/store/ttl-manager.test.ts` | 引用更新 |
| `tests/unit/promotion/promoter.test.ts` | 引用更新 |
| `tests/unit/memory/manager.test.ts` | 引用更新 |
| `tests/unit/memory/store.test.ts` | 引用更新 |
| `tests/unit/tools/search.test.ts` | 引用更新 |
| `tests/unit/tools/write.test.ts` | 引用更新 |
| `tests/integration/dual-layer.test.ts` | 引用更新 |

## 命名对照表

| 原命名 | 新命名 |
|--------|--------|
| ShortTermMemory | MemoryCandidatePool |
| short-term.ts | candidate-pool.ts |
| short-term.test.ts | candidate-pool.test.ts |
| shortTerm | candidatePool |
| 'short-term' | 'candidate' |
| ShortTermConfig | CandidatePoolConfig |