# Feature Specification: LLM Importance Evaluation

**Feature Branch**: `024-llm-importance-evaluation`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "让 LLM 动态评估消息重要性，用于记忆晋升决策"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 动态评估重要性 (Priority: P1)

当用户与 AI 助手进行对话时，系统自动让 LLM 评估该对话消息的重要性，将评估结果存储到记忆条目的 metadata 中。

**Why this priority**: 这是核心功能，直接解决当前所有记忆都不会晋升的根本问题（固定 importance=0.3 < promotionThreshold=0.5）。

**Independent Test**: 可以通过模拟对话并检查记忆条目的 importance 值是否为 LLM 评估值而非固定值来独立测试。

**Acceptance Scenarios**:

1. **Given** 用户发送一条重要消息（如"我叫张三"），**When** LLM 处理并回复消息，**Then** 系统提取 LLM 评估的 importance 值（预期 ≥ 0.5）并存储到记忆条目。
2. **Given** 用户发送一条不重要消息（如"你好"），**When** LLM 处理并回复消息，**Then** 系统提取 LLM 评估的 importance 值（预期 < 0.5）并存储到记忆条目。
3. **Given** LLM 回复不包含 importance 标记，**When** 系统解析回复，**Then** 使用默认 importance 值（0.3）作为 fallback。

---

### User Story 2 - TTL 过期时晋升决策 (Priority: P2)

当候选池记忆 TTL 过期时，系统使用存储的 importance 值判断是否应该晋升到长期记忆。

**Why this priority**: 这是核心功能的下游效果，确保动态评估的 importance 值真正用于晋升决策。

**Independent Test**: 可以通过创建带有不同 importance 值的记忆条目，触发 TTL 清理，检查高 importance 值的条目是否被晋升。

**Acceptance Scenarios**:

1. **Given** 候选池有一条 importance=0.7 的过期记忆，**When** TTL 清理执行，**Then** 该记忆被晋升到长期记忆存储。
2. **Given** 候选池有一条 importance=0.3 的过期记忆，**When** TTL 清理执行，**Then** 该记忆被删除，不晋升。
3. **Given** 候选池有多条过期记忆，**When** TTL 清理执行，**Then** 按各自的 importance 值分别处理（晋升或删除）。

---

### User Story 3 - 用户查看长期记忆 (Priority: P3)

用户可以查看被晋升到长期记忆的对话记录，验证重要信息已被持久保存。

**Why this priority**: 增强功能可见性和用户信任，让用户确认系统工作正常。

**Independent Test**: 可以通过 memory_get 工具或 API 查询长期记忆存储的内容。

**Acceptance Scenarios**:

1. **Given** 用户之前告知个人信息并已晋升，**When** 用户请求查看长期记忆，**Then** 系统返回包含该个人信息的记忆条目。
2. **Given** 长期记忆存储为空，**When** 用户请求查看长期记忆，**Then** 系统返回空列表或提示无记忆。

---

### Edge Cases

- 当 LLM 输出 importance 值超出 0-1 范围时会发生什么？（预期：clamp 到 0-1）
- 当 LLM 输出多个 importance 标记时会发生什么？（预期：取最后一个）
- 当 importance 标记格式不正确（如 [IMPORTANCE:abc]）时会发生什么？（预期：使用默认值）
- 当对话涉及多条消息（用户+助手）时，每条消息如何处理 importance？（预期：统一使用助手回复中的 importance 值）
- 当 TTL 清理在晋升过程中失败时会发生什么？（预期：保持原状态，下次清理时重试）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须让 LLM 在每次回复末尾输出 importance 评分标记 `[IMPORTANCE:X]`，其中 X 为 0-1 的数值。
- **FR-002**: 系统必须从 LLM 回复中解析并提取 importance 值，在返回给用户前剥离该标记。
- **FR-003**: 系统必须将提取的 importance 值传递给 AutoMemoryWriter，写入记忆条目的 metadata。
- **FR-004**: 系统必须在 LLM 未输出 importance 标记或解析失败时使用默认值 0.3 作为 fallback。
- **FR-005**: 系统必须将超出 0-1 范围的 importance 值 clamp 到有效范围（min 0, max 1）。
- **FR-006**: TTLManager 必须使用记忆条目的 importance 值与晋升阈值（默认 0.5）比较，决定是否晋升。
- **FR-007**: 系统必须提供 importance 评估规则说明，注入到 Agent 的系统提示词中。
- **FR-008**: 系统必须支持 soul.md 文件（~/.miniclaw/soul.md），记录 AI 人格信息（是谁、爱好、规则）。
- **FR-009**: 每次聊天时，系统必须将 soul.md 内容注入到 system prompt 最后面。soul.md 必须包含核心规则：「每次回复必须在末尾包含 [IMPORTANCE:X] 标记」。

### Key Entities

- **ImportanceEvaluator**: 新模块，负责解析 LLM 回复中的 importance 标记并提取数值。
- **MemoryEntry.metadata.importance**: 已存在的字段，存储 importance 值（0-1）。
- **AutoMemoryWriter**: 已存在模块，需要修改以接收动态 importance 值。
- **MemoryPromoter**: 已存在模块，使用 importance 值进行晋升判断（无需修改）。
- **TTLManager**: 已存在模块，调用 Promoter 进行晋升（无需修改）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 系统正确解析 95% 以上包含正确格式 importance 标记的 LLM 回复。
- **SC-002**: importance 值在 0.5 以上的记忆条目在 TTL 过期后被成功晋升到长期记忆存储。
- **SC-003**: 用户收到的回复中不包含 importance 标记（标记被正确剥离）。
- **SC-004**: 系统在 LLM 未输出 importance 标记时使用默认值，不中断正常对话流程。
- **SC-005**: 测试覆盖率达到 Lines ≥ 70%, Branches ≥ 60%。

## Assumptions

- LLM 能够理解并遵循 importance 评估规则（通过系统提示词引导）。
- importance 评估标准：
  - 包含个人信息（姓名、偏好、联系方式）→ 高 (0.7-0.9)
  - 重要决策或结论 → 高 (0.6-0.8)
  - 一般对话内容 → 中 (0.4-0.6)
  - 简单问候或闲聊 → 低 (0.1-0.3)
- 默认 importance 值 0.3 低于晋升阈值 0.5，确保未评估的记忆不会被晋升。
- importance 标记格式为 `[IMPORTANCE:X]`，位于回复末尾，X 为小数。