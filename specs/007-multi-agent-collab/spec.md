# Feature Specification: Multi-Agent Collaboration System

**Feature Branch**: `007-multi-agent-collab`  
**Created**: 2026-03-25  
**Status**: Draft  
**Input**: User description: "实现多 Agent 协作系统：支持主代理创建子代理并行执行任务，包括 sessions_spawn 工具、subagents 工具、AgentConfig 配置和 SubagentManager 管理器"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Spawn Subagent for Task Execution (Priority: P1)

作为主 Agent 用户，当我需要执行一个专业任务（如 ETF 分析）时，我可以通过 sessions_spawn 工具创建一个子代理来执行该任务，子代理完成后将结果返回给我。

**Why this priority**: 这是多 Agent 协作的核心功能，没有它就无法实现任务分发和并行执行。

**Independent Test**: 可以通过发送 `sessions_spawn({ task: "分析 ETF 市场", agentId: "etf" })` 命令，验证子代理被创建并返回分析结果。

**Acceptance Scenarios**:

1. **Given** 主 Agent 已启动，**When** 调用 sessions_spawn({ task: "分析任务", agentId: "etf" })，**Then** 创建子代理并返回任务 ID
2. **Given** 子代理正在执行任务，**When** 任务完成，**Then** 结果返回给主 Agent
3. **Given** 子代理执行超时，**When** 超时时间到达，**Then** 子代理被终止并返回超时错误

---

### User Story 2 - Configure Multiple Agent Types (Priority: P1)

作为系统管理员，我可以通过配置文件定义多种类型的 Agent（如 ETF 分析师、政策分析师），每个 Agent 有独立的模型配置和系统提示词。

**Why this priority**: 没有多种 Agent 类型配置，就无法实现专业化分工。

**Independent Test**: 可以通过配置文件添加新的 agent 类型，验证 AgentRegistry 能正确加载并创建该类型的实例。

**Acceptance Scenarios**:

1. **Given** 配置文件定义了 etf 和 policy 两种 Agent，**When** 系统启动，**Then** AgentRegistry 加载两种类型
2. **Given** AgentRegistry 已加载配置，**When** 请求创建 agentId="etf" 的子代理，**Then** 使用正确的模型和系统提示词
3. **Given** 配置文件缺少必需字段，**When** 系统启动，**Then** 记录错误日志但不中断启动

---

### User Story 3 - Manage Running Subagents (Priority: P2)

作为主 Agent 用户，我可以通过 subagents 工具查看当前运行的子代理列表、向子代理发送指令、或终止子代理。

**Why this priority**: 任务管理是协作系统的必要功能，但可以在基础 spawn 功能完成后添加。

**Independent Test**: 可以通过 `subagents({ action: "list" })` 查看运行中的子代理，验证列表正确显示。

**Acceptance Scenarios**:

1. **Given** 有 2 个子代理正在运行，**When** 调用 subagents({ action: "list" })，**Then** 返回包含 2 个子代理信息的列表
2. **Given** 子代理正在运行，**When** 调用 subagents({ action: "kill", target: "subagent-id" })，**Then** 子代理被终止
3. **Given** 子代理正在等待输入，**When** 调用 subagents({ action: "steer", target: "subagent-id", message: "继续" })，**Then** 子代理收到消息并继续执行

---

### User Story 4 - Parallel Task Execution (Priority: P2)

作为主 Agent 用户，我可以同时创建多个子代理并行执行不同的任务，并收集所有结果后汇总返回给用户。

**Why this priority**: 并行执行提升效率，是协作系统的进阶功能。

**Independent Test**: 可以同时调用两次 sessions_spawn 创建两个子代理，验证两个任务并行执行并分别返回结果。

**Acceptance Scenarios**:

1. **Given** 用户请求需要多个专业分析，**When** 主 Agent 同时 spawn 多个子代理，**Then** 子代理并行执行
2. **Given** 多个子代理正在执行，**When** 部分完成，**Then** 主 Agent 等待所有完成后再汇总
3. **Given** 某个子代理失败，**When** 其他子代理成功，**Then** 主 Agent 收集成功结果并报告失败

---

### Edge Cases

- 当子代理数量超过系统限制时，返回资源不足错误
- 当指定的 agentId 不存在时，返回配置错误
- 当子代理执行时间超过最大限制时，强制终止并返回超时错误
- 当子代理创建失败时，不影响主 Agent 的其他功能
- 当子代理记忆与主 Agent 隔离时，确保不会互相干扰

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 支持 sessions_spawn 工具创建子代理
- **FR-002**: 系统 MUST 支持 agentId 参数指定子代理类型
- **FR-003**: 系统 MUST 支持 task 参数定义子代理任务
- **FR-004**: 系统 MUST 支持 timeout 参数限制子代理执行时间
- **FR-005**: 系统 MUST 支持 mode 参数选择执行模式（run/session）
- **FR-006**: 系统 MUST 支持通过配置文件定义多种 Agent 类型
- **FR-007**: 系统 MUST 为每种 Agent 类型支持独立的模型配置
- **FR-008**: 系统 MUST 为每种 Agent 类型支持独立的系统提示词
- **FR-009**: 系统 MUST 支持子代理记忆隔离（不与主 Agent 共享）
- **FR-010**: 系统 MUST 支持 subagents 工具管理子代理
- **FR-011**: 系统 MUST 支持 subagents list 列出运行中的子代理
- **FR-012**: 系统 MUST 支持 subagents kill 终止子代理
- **FR-013**: 系统 MUST 支持 subagents steer 向子代理发送指令
- **FR-014**: 系统 MUST 在子代理完成后将结果返回给主 Agent
- **FR-015**: 系统 MUST 支持子代理并行执行

### Non-Functional Requirements

- **NFR-001**: 子代理创建响应时间 < 500ms
- **NFR-002**: 支持最多 10 个并行子代理
- **NFR-003**: 子代理资源隔离，内存泄漏不影响主 Agent

### Key Entities

- **AgentConfig**: Agent 类型配置，包含 id、name、model、systemPrompt 等属性
- **Subagent**: 子代理实例，包含 id、agentId、status、task、createdAt、result 等属性
- **SubagentManager**: 子代理管理器，负责创建、查询、终止子代理
- **AgentRegistry**: Agent 注册表（需改造），支持多种 Agent 类型

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用户可以通过 sessions_spawn 在 500ms 内创建子代理
- **SC-002**: 子代理执行任务后，结果正确返回给主 Agent
- **SC-003**: 用户可以通过 subagents list 查看所有运行中的子代理
- **SC-004**: 用户可以通过 subagents kill 在 1 秒内终止子代理
- **SC-005**: 不同类型的子代理使用正确的模型和系统提示词
- **SC-006**: 子代理记忆与主 Agent 完全隔离
- **SC-007**: 系统支持至少 5 个子代理并行执行
- **SC-008**: 配置错误不会导致系统启动失败

## Assumptions

1. 第一版不支持线程绑定（thread binding）
2. 第一版不支持流式返回
3. 第一版仅支持 run 模式（一次性执行，完成后终止）
4. 子代理使用独立的记忆存储，不与主 Agent 共享
5. 子代理数量限制在配置中定义，默认最大 10 个
6. 使用现有的 AgentRegistry 基础架构进行扩展

## Simplification Principles (V1)

为保持第一版简单可控：

| 功能 | 状态 | 说明 |
|------|------|------|
| sessions_spawn | ✅ 支持 | 创建子代理执行任务 |
| subagents list | ✅ 支持 | 列出运行中的子代理 |
| subagents kill | ✅ 支持 | 终止子代理 |
| subagents steer | ❌ 不支持 | V1 简化，不支持运行时干预 |
| 流式返回 | ❌ 不支持 | V1 仅支持一次性结果返回 |
| 线程绑定 | ❌ 不支持 | 子代理不绑定到消息线程 |
| session 模式 | ❌ 不支持 | V1 仅支持 run 模式 |