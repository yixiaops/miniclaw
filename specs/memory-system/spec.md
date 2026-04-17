# Feature Specification: Memory System Enhancement

**Feature Branch**: `memory-system`
**Created**: 2026-04-14
**Status**: Draft
**Input**: 补齐记忆能力，让记忆系统发挥实际效果

## 背景

miniclaw 现有记忆系统框架但未发挥作用：
- 有 `memory_search/memory_get` 工具（关键词搜索） ✓
- 有 `~/.miniclaw/memory` 目录但**内容为空** ✗
- 有 `~/.miniclaw/sessions/*.json` 对话历史 ✓
- 缺失：**自动写入机制**、**行为规则注入**、**双层记忆结构** ✗

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent 自动记录重要对话（Priority: P1）

作为 AI Agent，我希望会话结束时自动写入记忆，这样下次会话能记住之前讨论的内容。

**Why P1**: 这是让记忆系统"活起来"的关键 - 没有写入就没有内容可搜索。

**Independent Test**: 可通过模拟会话结束场景，验证记忆文件被正确写入。

**Acceptance Scenarios**:

1. **Given** Agent 与用户讨论了重要决策，**When** 会话结束（heartbeat 结束或用户离开），**Then** 自动写入今日日记（`memory/YYYY-MM-DD.md`）
2. **Given** Agent 发现新的用户偏好或铁律，**When** 会话结束，**Then** 自动更新长期记忆（`MEMORY.md`）
3. **Given** 对话内容不值得记录（如简单问答），**When** 会话结束，**Then** 不写入（避免噪音）

---

### User Story 2 - Agent 使用 memory_write 工具主动记录（Priority: P1）

作为 AI Agent，我希望有 `memory_write` 工具可以主动记录重要事项，而不仅依赖自动机制。

**Why P1**: 工具是写入的基础设施，TDD 必须先实现工具。

**Independent Test**: 可通过调用 `memory_write` 工具，验证文件被正确写入。

**Acceptance Scenarios**:

1. **Given** Agent 调用 `memory_write` with `type=daily`，**When** 工具执行，**Then** 内容追加到 `memory/YYYY-MM-DD.md`
2. **Given** Agent 调用 `memory_write` with `type=longterm` + `section="用户偏好"`，**When** 工具执行，**Then** 内容更新到 `MEMORY.md` 对应章节
3. **Given** 相同内容已存在，**When** 再次写入，**Then** 检测去重，避免重复记录

---

### User Story 3 - Agent 搜索记忆文件（Priority: P2）

作为 AI Agent，我希望 `memory_search` 能搜索 MEMORY.md + daily notes，这样能同时检索长期和短期记忆。

**Why P2**: 搜索增强建立在写入工具完成后。

**Independent Test**: 可通过写入测试数据，调用 `memory_search`，验证搜索结果包含 MEMORY.md 和 daily notes。

**Acceptance Scenarios**:

1. **Given** MEMORY.md 包含 "用户偏好: 命令透明"，**When** Agent 搜索 "命令透明"，**Then** 返回 MEMORY.md 匹配片段
2. **Given** daily note 包含 "讨论了 ETF 方案"，**When** Agent 搜索 "ETF"，**Then** 返回日记文件匹配片段
3. **Given** 搜索参数 `corpus=memory`，**When** 执行搜索，**Then** 只搜索记忆文件（不搜索 sessions）

---

### User Story 4 - 双层记忆结构自动维护（Priority: P2）

作为用户，我希望有双层记忆结构：MEMORY.md（长期精炼）+ daily notes（短期日记），这样重要信息被保留，细节被归档。

**Why P2**: 结构是记忆系统的骨架，在写入工具完成后实现。

**Independent Test**: 可通过验证目录结构和文件命名规范。

**Acceptance Scenarios**:

1. **Given** Agent 启动，**When** 检查记忆目录，**Then** 存在 `MEMORY.md` 和 `memory/YYYY-MM-DD.md`（当日）
2. **Given** 长期记忆有多个章节（用户偏好、铁律、决策），**When** 更新某一章节，**Then** 其他章节保持不变
3. **Given** 日期变更，**When** 新会话开始，**Then** 创建新的 daily note（昨日日记自动归档）

---

### User Story 5 - 行为规则注入（Priority: P3）

作为系统设计者，我希望 Agent 的系统提示词包含记忆写入规则，这样 Agent 会主动使用记忆系统。

**Why P3**: 行为规则让 Agent "知道"要写记忆，但依赖工具和结构先完成。

**Independent Test**: 可通过检查 Agent 系统提示词是否包含记忆规则。

**Acceptance Scenarios**:

1. **Given** Agent 创建，**When** 加载系统提示词，**Then** 包含"每次会话结束必须写记忆"规则
2. **Given** 规则包含优先级，**When** 多条规则存在，**Then** 高优先级规则优先执行
3. **Given** 用户自定义规则，**When** 加载规则，**Then** 默认规则 + 用户规则合并

---

### Edge Cases

- 磁盘空间不足时如何处理写入？
- 并发写入同一文件如何处理？
- 记忆文件被用户手动修改后如何同步？
- 跨日期会话（凌晨跨越）如何处理 daily note？
- 大量历史 daily notes 如何归档/清理？
- 记忆内容包含敏感信息如何处理？

## Requirements *(mandatory)*

### Functional Requirements

#### 双层记忆结构

- **FR-001**: 系统必须在 `~/.miniclaw/` 下维护 `MEMORY.md`（长期记忆）和 `memory/YYYY-MM-DD.md`（daily notes）
- **FR-002**: `MEMORY.md` 必须按章节组织：用户偏好、铁律、重要决策、教训、项目信息
- **FR-003**: 系统必须自动创建当日 daily note（如果不存在）
- **FR-004**: 系统必须支持读取昨日 daily note（用于回溯）

#### memory_write 工具

- **FR-005**: 系统必须提供 `memory_write` 工具，支持写入记忆
- **FR-006**: `memory_write` 必须支持 `type` 参数：`daily`（日记）、`longterm`（长期记忆）
- **FR-007**: `memory_write` 必须支持 `section` 参数（用于长期记忆章节定位）
- **FR-008**: `memory_write` 必须支持 `content` 参数（写入内容）
- **FR-009**: 系统必须检测重复内容，避免重复写入
- **FR-010**: 写入失败必须返回错误信息（如磁盘不足、权限问题）

#### memory_search 增强

- **FR-011**: `memory_search` 必须搜索 `MEMORY.md` 和 `memory/*.md` 文件
- **FR-012**: `memory_search` 必须支持 `corpus` 参数：`memory`（只搜索记忆）、`sessions`（只搜索会话）、`all`（全部）
- **FR-013**: 搜索结果必须标注来源（MEMORY.md 或 daily note）

#### 行为规则注入

- **FR-014**: 系统必须在 Agent 系统提示词中注入记忆规则
- **FR-015**: 默认规则包括：
  1. 每次会话结束写入 daily note
  2. 发现新铁律写入 MEMORY.md
  3. 记录重要决策
  4. 记录用户偏好
  5. 从 daily note 提炼精华到 MEMORY.md
- **FR-016**: 规则必须可配置（支持自定义规则文件）

### Key Entities

```typescript
// 记忆写入类型
type MemoryWriteType = 'daily' | 'longterm';

// 记忆写入参数
interface MemoryWriteParams {
  type: MemoryWriteType;
  section?: string;  // 长期记忆章节（如 "用户偏好"、"铁律"）
  content: string;
}

// 记忆章节
type MemorySection = '用户偏好' | '铁律' | '重要决策' | '教训' | '项目信息';

// 长期记忆结构
interface LongTermMemory {
  sections: Record<MemorySection, string[]>;
  updatedAt: string;
}

// Daily note 条目
interface DailyNoteEntry {
  type: 'discussion' | 'decision' | 'todo' | 'idea';
  content: string;
  timestamp: string;
}

// 记忆搜索来源扩展
type MemoryCorpus = 'memory' | 'sessions' | 'all';
```

## 成功标准 *(mandatory)*

### Measurable Outcomes

- **SC-001**: `memory_write` 工具正确写入 daily note（单元测试验证）
- **SC-002**: `memory_write` 工具正确更新 MEMORY.md 章节（单元测试验证）
- **SC-003**: `memory_search` 能搜索 MEMORY.md 和 daily notes（单元测试验证）
- **SC-004**: 去重机制正确检测重复内容（单元测试验证）
- **SC-005**: Agent 系统提示词包含记忆规则（集成测试验证）
- **SC-006**: 会话结束时自动写入记忆（集成测试模拟 heartbeat 结束）

### Technical Quality Criteria

- **SC-007**: 代码遵循 TypeScript 最佳实践
- **SC-008**: 所有公开函数有 JSDoc 文档
- **SC-009**: 单元测试覆盖率 ≥ 70%
- **SC-010**: 不引入新的外部依赖（使用现有 fs/path）

## 实现计划

### Phase 1: memory_write 工具（P1，1天）

| 任务 | 文件 | 测试 |
|------|------|------|
| 定义 MemoryWriteParams 类型 | `src/core/memory/types.ts` | 类型测试 |
| 实现 MemoryWriter 类 | `src/core/memory/memory-writer.ts` | 单元测试 |
| 实现 memory_write 工具 | `src/tools/memory-write.ts` | 工具测试 |
| 注册工具到 Agent | `src/index.ts` | 集成测试 |

**TDD 流程**：
1. 先写测试：`tests/unit/memory/memory-writer.test.ts`
2. 实现功能
3. 测试通过

### Phase 2: 双层记忆结构（P1，0.5天）

| 任务 | 文件 | 测试 |
|------|------|------|
| 创建目录结构 | `src/core/memory/manager.ts` | 结构测试 |
| 实现 ensureDirs | `src/core/memory/manager.ts` | 单元测试 |
| 实现 getDailyNotePath | `src/core/memory/manager.ts` | 单元测试 |
| 初始化 MEMORY.md | `src/core/memory/manager.ts` | 单元测试 |

### Phase 3: memory_search 增强（P2，0.5天）

| 任务 | 文件 | 测试 |
|------|------|------|
| 增强 KnowledgeSearcher | `src/core/memory/knowledge-searcher.ts` | 搜索测试 |
| 支持 MEMORY.md 搜索 | `src/core/memory/search.ts` | 集成测试 |
| 扩展 corpus 参数 | `src/tools/memory-search.ts` | 工具测试 |

### Phase 4: 行为规则注入（P3，0.5天）

| 任务 | 文件 | 测试 |
|------|------|------|
| 定义记忆规则常量 | `src/core/prompt/memory-rules.ts` | 常量测试 |
| 注入规则到系统提示词 | `src/core/agent/index.ts` | 集成测试 |
| 支持自定义规则 | `src/core/config.ts` | 配置测试 |

### Phase 5: 自动写入机制（P3，1天）

| 任务 | 文件 | 测试 |
|------|------|------|
| 会话结束钩子 | `src/core/lifecycle.ts` | 钩子测试 |
| 判断是否需要写入 | `src/core/memory/auto-writer.ts` | 判断逻辑测试 |
| 自动调用 memory_write | `src/core/gateway/index.ts` | 集成测试 |

## 风险与缓解

| 风险 | 影响 | 缓解方案 |
|------|------|----------|
| 写入过多噪音 | 记忆文件臃肿 | 设置写入阈值，去重检测 |
| 敏感信息泄露 | 安全问题 | 不记录密码、密钥等敏感信息 |
| 并发写入冲突 | 数据损坏 | 使用文件锁或原子写入 |
| 磁盘空间不足 | 写入失败 | 监控磁盘，设置大小限制 |

## 验收标准

### 功能验收

- ✅ memory_write 工具可用
- ✅ MEMORY.md 和 daily notes 结构正确
- ✅ memory_search 能搜索记忆文件
- ✅ Agent 系统提示词包含记忆规则
- ✅ 会话结束时自动写入（可选）

### 质量验收

- ✅ 单元测试覆盖率 ≥ 70%
- ✅ 所有测试通过
- ✅ TypeScript 编译无错误

### 文档验收

- ✅ 所有公开 API 有 JSDoc
- ✅ README 更新记忆系统说明
- ✅ 使用示例文档

## 后续迭代

### V2（可选）
- 语义搜索（Embeddings + 向量数据库）
- 记忆提炼（daily → MEMORY.md 自动提炼）
- 记忆归档（历史 daily notes 自动清理）

### V3（可选）
- 多用户记忆隔离
- 记忆导出/导入
- 记忆可视化（Web UI）