# Implementation Plan: 定时任务与动态配置加载

**Branch**: `026-scheduler-hot-reload` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/026-scheduler-hot-reload/spec.md`

## Summary

为 Miniclaw 添加两个核心功能：
1. **定时任务模块**：支持用户通过自然语言创建、管理定时提醒和周期性任务，任务触发时可发送提醒消息或执行预设指令（如调用子 Agent）
2. **动态配置加载模块**：支持实时监听 Agent 配置目录变更，自动加载/重载/删除 Agent 配置，无需重启服务

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+  
**Primary Dependencies**: @mariozechner/pi-agent-core, @mariozechner/pi-coding-agent, Express 5.x, Socket.IO  
**Storage**: JSON 文件存储（`~/.miniclaw/scheduled-tasks.json`，`~/.miniclaw/config.json`）  
**Testing**: Vitest  
**Target Platform**: Linux server / Node.js runtime  
**Project Type**: web-service (多通道接入：CLI/API/Web/Feishu)  
**Performance Goals**: 定时任务1分钟内准时触发，配置加载5秒内完成  
**Constraints**: 支持100并发任务，任务执行成功率95%以上  
**Scale/Scope**: 个人级 AI 助手框架，约 884 测试用例

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

宪法文件为模板状态，无具体约束条款。基于项目现有规范进行检查：

| 检查项 | 状态 | 说明 |
|--------|------|------|
| ESM 模块规范 | ✅ Pass | 新模块必须使用 `.js` 扩展名导入 |
| TypeScript strict mode | ✅ Pass | 所有新代码必须启用严格模式 |
| 测试先行 (TDD) | ✅ Pass | 遵循项目 Vitest 测试规范 |
| 中文注释 | ✅ Pass | 文档和注释使用中文 |
| ESLint explicit return type | ✅ Pass | 函数必须显式声明返回类型 |

**Gate 状态**: ✅ 全部通过

## Project Structure

### Documentation (this feature)

```text
specs/026-scheduler-hot-reload/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── scheduler-api.md
│   └── hot-reload-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── scheduler/           # 新增：定时任务模块
│   ├── index.ts         # 模块入口，导出 SchedulerManager
│   ├── manager.ts       # SchedulerManager 主类
│   ├── task-store.ts    # 任务持久化存储（JSON 文件）
│   ├── executor.ts      # 任务执行器（处理提醒/指令）
│   ├── dedup.ts         # 智能去重逻辑
│   └── types.ts         # 类型定义
│
├── core/
│   ├── config-watcher/  # 新增：配置监听模块
│   │   ├── index.ts     # ConfigWatcher 主类
│   │   ├── watcher.ts   # fs.watch 封装
│   │   └── loader.ts    # 配置加载器
│   │   └── types.ts     # 类型定义
│   │
│   ├── gateway/         # 已有：需扩展以支持定时任务触发
│   ├── agent/           # 已有：AgentRegistry 需支持热重载
│   └── tools/           # 新增工具：scheduler_create, scheduler_list, scheduler_delete
│
├── tools/               # 新增工具定义
│   ├── scheduler-create.ts
│   ├── scheduler-list.ts
│   ├── scheduler-delete.ts
│   └── scheduler-update.ts
│
└── index.ts             # 入口：集成 SchedulerManager 和 ConfigWatcher

tests/
├── unit/
│   ├── scheduler/       # 定时任务单元测试
│   │   ├── manager.test.ts
│   │   ├── task-store.test.ts
│   │   ├── executor.test.ts
│   │   └── dedup.test.ts
│   │
│   └── config-watcher/  # 配置监听单元测试
│   │   ├── watcher.test.ts
│   │   └── loader.test.ts
│
├── integration/
│   ├── scheduler-flow.test.ts    # 定时任务完整流程测试
│   └── hot-reload-flow.test.ts   # 配置热重载完整流程测试
│
└── e2e/
    └── scheduler-cli.test.ts     # CLI 端到端测试
```

**Structure Decision**: 采用现有单一项目结构，新增 `src/scheduler/` 和 `src/core/config-watcher/` 模块，遵循项目分层架构。

## Complexity Tracking

> 无宪法违规项，此表无需填充。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |

## Phase 0: Research Summary

详见 [research.md](./research.md)

关键技术决策：
- 定时调度：采用 node-cron 库（成熟稳定，支持 cron 表达式）
- 配置监听：采用 chokidar 库（跨平台文件监听，比 fs.watch 更可靠）
- 时间解析：依赖 LLM 自然语言理解，无需外部 NLP 库
- 消息持久化：复用现有 SimpleMemoryStorage 模式，新增 PendingMessageStore

## Phase 1: Design Artifacts

- [data-model.md](./data-model.md) - 数据模型设计
- [contracts/scheduler-api.md](./contracts/scheduler-api.md) - 定时任务 API 契约
- [contracts/hot-reload-api.md](./contracts/hot-reload-api.md) - 热重载 API 契约
- [quickstart.md](./quickstart.md) - 快速开始指南