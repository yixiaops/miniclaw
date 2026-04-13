# Implementation Plan: Tool Injection Optimization

**Branch**: `013-optimize-tool-injection` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-optimize-tool-injection/spec.md`

## Summary

优化 Agent 工具注入策略，采用 OpenClaw 模式：默认给所有 Agent 全部内置工具，支持通过配置 `tools.allow` 和 `tools.deny` 列表控制工具集。deny 优先于 allow（安全优先原则）。

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: @mariozechner/pi-agent-core (Agent框架), @mariozechner/pi-ai (AI流式处理)
**Storage**: N/A (无持久化需求)
**Testing**: Vitest
**Target Platform**: Node.js 服务器
**Project Type**: CLI/API 服务
**Performance Goals**: 工具配置验证 < 50ms
**Constraints**: 无
**Scale/Scope**: 单实例，多 Agent 类型

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

项目未定义 Constitution，跳过此检查。

## Project Structure

### Documentation (this feature)

```text
specs/013-optimize-tool-injection/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── agent/
│   │   ├── index.ts           # MiniclawAgent - 需要修改工具注入逻辑
│   │   └── registry.ts        # AgentRegistry - 需要添加工具过滤方法
│   ├── config.ts              # AgentConfig - 已有 tools 字段定义
│   └── tools/
│       └── index.ts           # getBuiltinTools() - 需要添加过滤函数
└── tools/
    ├── read-file.ts           # 内置工具定义
    ├── write-file.ts
    └── ...                    # 其他工具

tests/
├── unit/
│   ├── tool-filter.test.ts    # 新增：工具过滤测试
│   └── agent-registry.test.ts # 新增/修改：Agent 注册表测试
└── integration/
    └── agent-tools.test.ts    # 新增：Agent 工具集成测试
```

**Structure Decision**: 单项目结构，修改现有核心模块实现工具过滤功能。

## Complexity Tracking

无复杂性违规需要记录。

## Implementation Phases

### Phase 1: 工具过滤函数

**文件**: `src/tools/filter.ts` (新建)

实现工具过滤逻辑：
- `filterToolsByPolicy(tools, policy)` - 根据 allow/deny 列表过滤工具
- `resolveEffectiveToolList(allTools, config)` - 计算最终工具列表

### Phase 2: AgentRegistry 增强

**文件**: `src/core/agent/registry.ts` (修改)

添加方法：
- `getEffectiveTools(agentId)` - 获取 Agent 的有效工具列表
- `resolveToolPolicy(agentId)` - 解析 Agent 的工具策略

### Phase 3: MiniclawAgent 工具注入

**文件**: `src/core/agent/index.ts` (修改)

修改 Agent 创建逻辑：
- 读取 Agent 配置的 tools 字段
- 应用工具过滤策略
- 支持运行时 registerTool/clearTools

### Phase 4: 测试

**文件**: `tests/unit/tool-filter.test.ts`, `tests/integration/agent-tools.test.ts`

测试覆盖：
- 默认全部工具
- allow 列表过滤
- deny 列表过滤
- allow + deny 冲突处理
- 不存在的工具名处理