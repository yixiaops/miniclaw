# Feature Specification: 系统提示词可配置化

**Feature Branch**: `012-system-prompt-config`
**Created**: 2026-04-10
**Status**: Draft
**Input**: User description: "优化 miniclaw 系统提示词，支持可配置和自由切换。当前系统提示词硬编码在 DEFAULT_SYSTEM_PROMPT 常量中，需要将其外部化，支持多套模板和运行时切换。参考 pi-coding-agent 中的系统提示词设计风格（如 scout.md 的结构化格式）。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 外部化系统提示词模板 (Priority: P1)

作为开发者，我希望系统提示词以独立的模板文件形式存在，便于查看、编辑和版本管理，而不是硬编码在代码中。

**Why this priority**: 这是整个功能的基础。只有先完成外部化，才能支持后续的多模板管理和运行时切换。没有这个基础，其他功能无法实现。

**Independent Test**: 可以通过检查模板文件是否存在、格式是否正确来独立验证。启动应用后查看日志确认模板加载成功。

**Acceptance Scenarios**:

1. **Given** 系统启动时，**When** 加载默认模板文件，**Then** 模板内容被成功读取并作为默认系统提示词
2. **Given** 模板文件不存在，**When** 系统启动，**Then** 使用代码中硬编码的 DEFAULT_SYSTEM_PROMPT 作为后备方案
3. **Given** 模板文件格式错误（非有效 YAML frontmatter + markdown），**When** 系统启动，**Then** 记录错误日志并使用后备默认值

---

### User Story 2 - 多模板支持与 Agent 关联 (Priority: P2)

作为运维人员，我希望为不同的 Agent（main、etf、policy 等）配置不同的系统提示词模板，每个 Agent 使用适合其角色定位的提示词。

**Why this priority**: 在基础外部化完成后，支持多 Agent 不同提示词是实现业务价值的关键。配置文件已定义各 Agent 的 systemPrompt 字段，需要将其与模板文件关联。

**Independent Test**: 可以通过配置文件指定不同 Agent 使用不同模板，验证每个 Agent 实例使用了正确的系统提示词。

**Acceptance Scenarios**:

1. **Given** 配置文件中 agent.main.systemPrompt 指向模板文件路径，**When** 创建 main Agent 实例，**Then** 该实例使用指定的模板内容作为系统提示词
2. **Given** 配置文件中 agent.systemPrompt 为直接文本内容，**When** 创建 Agent 实例，**Then** 直接使用该文本内容（向后兼容）
3. **Given** 配置文件中未指定 systemPrompt，**When** 创建 Agent 实例，**Then** 使用默认模板（~/.miniclaw/prompts/default.md）

---

### User Story 3 - 运行时切换系统提示词 (Priority: P3)

作为高级用户，我希望在会话过程中动态切换系统提示词，适应不同场景下的对话需求，而无需重启应用。

**Why this priority**: 在模板加载和 Agent 关联完成后，运行时切换是锦上添花的功能，提供更大的灵活性。

**Independent Test**: 可以通过 API 或 CLI 命令在会话中切换提示词，验证后续对话使用了新的系统提示词。

**Acceptance Scenarios**:

1. **Given** Agent 实例正在运行，**When** 调用 setSystemPrompt() 方法，**Then** 后续对话使用新的系统提示词
2. **Given** 已加载多个模板，**When** 通过模板名称切换，**Then** 系统查找并应用指定模板
3. **Given** 切换到一个不存在的模板，**When** 执行切换操作，**Then** 返回错误信息，保持当前提示词不变

---

### User Story 4 - 模板格式参考 pi-coding-agent 风格 (Priority: P2)

作为开发者，我希望系统提示词模板采用类似 pi-coding-agent 中 scout.md 的结构化格式，包含 YAML frontmatter 和 markdown 内容，便于维护和扩展。

**Why this priority**: 结构化的模板格式提高可读性和可维护性，与社区工具保持一致降低学习成本。

**Independent Test**: 可以通过创建符合格式的模板文件，验证系统能正确解析 frontmatter 中的元数据和 markdown 内容。

**Acceptance Scenarios**:

1. **Given** 模板文件包含有效的 YAML frontmatter（name、description、model 等），**When** 加载模板，**Then** 元数据被正确解析并可用于日志和调试
2. **Given** 模板文件只包含 markdown 内容无 frontmatter，**When** 加载模板，**Then** 整个文件内容作为提示词，使用默认元数据
3. **Given** 模板文件包含 tools 字段，**When** 加载模板，**Then** 该字段可用于未来扩展（如限制该模板可使用的工具集）

---

### Edge Cases

- 模板文件编码问题：如果模板文件使用非 UTF-8 编码，系统应如何处理？（建议：强制 UTF-8，解码失败时记录错误并使用后备默认值）
- 模板文件过大：系统提示词是否有长度限制？（建议：记录警告但允许，由 LLM API 限制决定）
- 并发访问：多个 Agent 同时请求加载/切换模板时，是否有竞态条件？（建议：模板加载为一次性操作，切换操作互不影响）
- 热重载：修改模板文件后是否需要重启应用才能生效？（建议：P4 功能，初始版本支持手动重载命令）

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统 MUST 支持从外部文件加载系统提示词模板
- **FR-002**: 模板文件 MUST 支持 YAML frontmatter + markdown 格式
- **FR-003**: 系统 MUST 提供默认模板位置：`~/.miniclaw/prompts/default.md`
- **FR-004**: 配置文件中的 systemPrompt 字段 MUST 支持两种模式：
  - 直接文本内容（向后兼容）
  - 模板文件路径（以 `file://` 或 `./` 开头）
- **FR-005**: 每个 Agent 实例 MUST 独立维护自己的系统提示词，切换互不影响
- **FR-006**: MiniclawAgent 类 MUST 保持现有 setSystemPrompt() 接口不变
- **FR-007**: 系统 MUST 在启动时记录加载的模板信息（名称、路径、字符数）
- **FR-008**: 模板加载失败时 MUST 使用 DEFAULT_SYSTEM_PROMPT 作为后备
- **FR-009**: 模板元数据（name、description、model 等）MUST 可被解析但初始版本不强制使用
- **FR-010**: 系统 SHOULD 提供模板验证工具（可选，P4）

### Key Entities

- **PromptTemplate**: 表示一个系统提示词模板，包含元数据（name、description、model、tools 等）和内容（prompt text）。存储为 markdown 文件，格式参考 pi-coding-agent scout.md。
- **PromptManager**: 管理模板的加载、缓存、查询和切换。提供模板路径解析、内容读取、元数据解析等功能。
- **Agent**: 已有实体，新增对 PromptManager 的引用（可选，或直接在创建时注入提示词内容）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 系统提示词从代码中完全分离，`src/core/agent/index.ts` 中 DEFAULT_SYSTEM_PROMPT 仅作为后备使用
- **SC-002**: 至少 3 个 Agent（main、etf、policy）可以配置使用不同的系统提示词模板
- **SC-003**: 模板文件修改后，通过 API 命令可在 1 秒内完成重新加载
- **SC-004**: 模板加载失败时，应用正常启动且日志中记录明确的错误信息
- **SC-005**: 现有功能（chat、streamChat、工具调用）在模板外部化后保持 100% 兼容

## Technical Design (Optional)

### Data Flow

```
配置文件 (config.json)
       │
       │ systemPrompt: "file://~/.miniclaw/prompts/main.md"
       │            或直接文本
       ▼
PromptManager.loadPrompt(reference)
       │
       ├── 判断是文件路径还是直接文本
       │
       ├── 文件路径 → 读取文件 → 解析 YAML frontmatter
       │
       └── 直接文本 → 直接返回
       ▼
PromptTemplate { name, description, content }
       │
       ▼
MiniclawAgent 构造函数
       │
       └── this.systemPrompt = template.content
```

### Template File Format

```markdown
---
name: main-assistant
description: Main assistant for general tasks
model: qwen3.5-plus
tools: read_file, write_file, shell
---

你是 Miniclaw，一个专业、可靠的 AI 助手。

## 核心原则

1. **理解意图**: 先理解用户真正想要什么，再行动
2. **分析任务**: 复杂任务先拆解步骤，不急于执行
...
```

### File Structure

```
~/.miniclaw/
├── config.json          # 主配置文件
├── prompts/             # 提示词模板目录（新增）
│   ├── default.md       # 默认模板
│   ├── main.md          # main Agent 模板
│   ├── etf.md           # ETF 分析师模板
│   └── policy.md        # 政策分析师模板
└── skills/               # 技能目录（已存在）
```

### Configuration Changes

```json
// config.json - 新增 systemPrompt 支持文件路径
{
  "agents": {
    "list": [
      {
        "id": "main",
        "name": "影子",
        "systemPrompt": "file://~/.miniclaw/prompts/main.md"
      },
      {
        "id": "etf",
        "systemPrompt": "file://~/.miniclaw/prompts/etf.md"
      },
      {
        "id": "policy",
        "systemPrompt": "file://~/.miniclaw/prompts/policy.md"
      }
    ]
  }
}
```

### Implementation Steps

1. **Step 1**: 创建 `src/core/prompt/` 模块
   - `PromptTemplate` 接口定义
   - `PromptManager` 类实现
   - YAML frontmatter 解析逻辑

2. **Step 2**: 修改 Agent 配置加载逻辑
   - `AgentRegistry.createAgent()` 调用 PromptManager
   - 支持文件路径和直接文本两种模式

3. **Step 3**: 创建默认模板文件
   - 将 DEFAULT_SYSTEM_PROMPT 提取到 `~/.miniclaw/prompts/default.md`
   - 为 main、etf、policy 创建初始模板

4. **Step 4**: 添加热重载支持（可选）
   - API 端点：`POST /api/prompts/reload`
   - CLI 命令：`/prompts reload`

5. **Step 5**: 测试和文档
   - 单元测试：模板解析、路径解析、错误处理
   - 集成测试：多 Agent 不同模板
   - 更新 README 和 CLAUDE.md