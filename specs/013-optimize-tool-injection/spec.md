# Feature Specification: Tool Injection Optimization

**Feature Branch**: `013-optimize-tool-injection`
**Created**: 2026-04-10
**Status**: Draft
**Updated**: 2026-04-10 (简化为配置驱动模式)
**Input**: User description: "学习 openclaw 模式，默认给每个代理所有 tools，也可以通过配置给指定的 tools，并且增加黑名单"

## Clarifications

### Session 2026-04-10

- Q: 工具注入策略采用什么模式？ → A: 学习 OpenClaw 模式，默认给每个代理所有工具，支持通过配置 allow/deny 列表控制工具集

### Reference Analysis: OpenClaw 工具设计

经过对 OpenClaw 项目的分析，确认其 "tools" 与 Miniclaw 的工具是**同一概念**：

**工具对比**:
| Miniclaw 工具 | OpenClaw 工具 | 说明 |
|---------------|---------------|------|
| `read_file` | `read` | 读取文件 |
| `write_file` | `write` | 写入文件 |
| `edit`, `multi_edit` | `edit`, `apply_patch` | 编辑文件 |
| `shell` | `exec` | 执行命令 |
| `glob`, `grep`, `ls` | (exec 内实现) | 文件搜索 |
| `web_fetch`, `web_search` | `web_fetch`, `web_search` | 网络工具 |
| `memory_search`, `memory_get` | `memory_search`, `memory_get` | 内存工具 |

**OpenClaw 设计要点**:
1. **默认全开放**: 所有 agent 默认拥有全部工具，无需配置
2. **allow/deny 列表**: 通过配置限制或允许特定工具
3. **deny 优先**: 黑名单中的工具无法通过 allow 覆盖

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Default Full Tool Access (Priority: P1)

作为系统管理员，我希望所有 agent 默认获得所有内置工具的访问权限，以便无需额外配置即可使用完整功能。

**Why this priority**: 这是默认行为，确保开箱即用的体验。

**Independent Test**: 可以通过创建任意 agent 并验证其拥有全部工具来独立测试。

**Acceptance Scenarios**:

1. **Given** 系统启动创建任意 agent，**When** agent 初始化完成，**Then** agent 注册了所有 12 个内置工具
2. **Given** 用户未配置任何工具策略，**When** agent 创建，**Then** agent 拥有全部工具访问权限

---

### User Story 2 - Tool Allowlist Configuration (Priority: P1)

作为系统管理员，我希望能够通过配置限制 agent 只能使用特定工具，以便控制 agent 的能力范围。

**Why this priority**: 安全性和职责分离的核心需求。

**Independent Test**: 可以通过配置 allow 列表并验证 agent 只拥有指定工具来独立测试。

**Acceptance Scenarios**:

1. **Given** agent 配置中指定了 `tools.allow: ["read_file", "glob", "grep"]`，**When** agent 创建，**Then** agent 只拥有这 3 个工具
2. **Given** agent 配置中指定了空的 `tools.allow: []`，**When** agent 创建，**Then** agent 没有任何工具
3. **Given** agent 配置中指定了不存在的工具名，**When** agent 创建，**Then** 系统记录警告日志并忽略该工具名

---

### User Story 3 - Tool Denylist Configuration (Priority: P1)

作为系统管理员，我希望能够通过配置禁止 agent 使用特定工具（黑名单），以便阻止危险操作。

**Why this priority**: 安全性核心需求，阻止危险工具的使用。

**Independent Test**: 可以通过配置 deny 列表并验证 agent 无法使用被禁止的工具来独立测试。

**Acceptance Scenarios**:

1. **Given** agent 配置中指定了 `tools.deny: ["shell", "write_file"]`，**When** agent 创建，**Then** agent 拥有除 shell 和 write_file 外的所有工具
2. **Given** agent 配置同时指定了 `tools.allow: ["shell"]` 和 `tools.deny: ["shell"]`，**When** agent 创建，**Then** deny 优先，agent 没有 shell 工具

---

### User Story 4 - Runtime Tool Management (Priority: P2)

作为开发者，我希望能够在运行时动态注册或注销工具，以便灵活调整 agent 能力。

**Why this priority**: 扩展功能，提供运行时灵活性。

**Independent Test**: 可以通过在 agent 运行期间调用工具管理方法来验证。

**Acceptance Scenarios**:

1. **Given** agent 正在运行，**When** 调用 registerTool 方法，**Then** 新工具被添加到 agent 的工具列表
2. **Given** agent 拥有某些工具，**When** 调用 clearTools 方法，**Then** 所有工具被移除

---

### Edge Cases

- 当 agent 配置同时指定了 allow 和 deny 列表且存在冲突时，deny 优先（安全优先原则）
- 当 agent 配置指定的工具名称不存在时，系统忽略该配置项并记录警告日志
- 当 allow 列表为空数组 `[]` 时，agent 没有任何工具
- 当 deny 列表为空数组 `[]` 时，无额外限制

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST 默认给所有 agent 注册所有内置工具（12 个）
- **FR-002**: System MUST 支持在 agent 配置中指定 `tools.allow` 列表，限制 agent 只能使用指定工具
- **FR-003**: System MUST 支持在 agent 配置中指定 `tools.deny` 列表，禁止 agent 使用指定工具
- **FR-004**: System MUST 在 allow 和 deny 冲突时优先应用 deny（安全优先）
- **FR-005**: System MUST 记录工具配置错误（如不存在的工具名称）到系统日志
- **FR-006**: Agent MUST 提供运行时工具注册接口（registerTool 方法）
- **FR-007**: Agent MUST 提供运行时工具清除接口（clearTools 方法）

### Key Entities

- **AgentConfig**: agent 配置对象，新增 `tools` 字段：
  ```typescript
  tools?: {
    allow?: string[];  // 白名单，指定允许的工具
    deny?: string[];   // 黑名单，指定禁止的工具
  }
  ```
- **AgentRegistry**: agent 注册表，负责根据配置决定工具注入策略
- **MiniclawAgent**: agent 实例，根据配置初始化工具集

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 默认情况下，agent 启动后拥有全部 12 个内置工具
- **SC-002**: 通过配置 allow 列表，agent 可以精确配置为拥有 0 到 12 个工具的任意子集
- **SC-003**: 通过配置 deny 列表，可以从工具集中排除指定工具
- **SC-004**: 工具配置验证时间不超过 50ms
- **SC-005**: 错误的工具配置被记录到日志但不阻塞 agent 创建
- **SC-006**: 开发者可以在 5 分钟内完成一个 agent 类型的工具配置

## Assumptions

- 工具名称使用字符串标识，与现有工具定义一致（如 "read_file", "write_file", "shell"）
- 配置文件格式为 JSON，与现有 config.json 结构兼容
- 运行时工具管理（registerTool/clearTools）为可选功能