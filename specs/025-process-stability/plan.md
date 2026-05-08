# Implementation Plan: Process Stability Guard

**Branch**: `025-process-stability` | **Date**: 2026-05-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/025-process-stability/spec.md`

## Summary

解决 miniclaw 进程意外关闭问题，通过代码加固（全局异常捕获）和进程守护（PM2 配置）两种方案实现进程稳定性保障。代码层面在入口文件添加 `uncaughtException`/`unhandledRejection` 全局处理器，进程层面使用 PM2 提供自动重启、内存阈值保护和开机自启功能。

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+ (ESM module)
**Primary Dependencies**: @mariozechner/pi-agent-core, Express 5.x, Socket.IO, @larksuiteoapi/node-sdk
**Storage**: File-based (JSON config, markdown soul, memory files)
**Testing**: Vitest 4.x
**Target Platform**: Linux server
**Project Type**: CLI/API/Web service (多通道 AI 助手)
**Performance Goals**: 进程崩溃后 1 秒内自动重启，异常不影响服务可用性
**Constraints**: 不修改现有业务逻辑，只在入口文件添加异常处理；异常处理与 shutdown handler 协调
**Scale/Scope**: 单用户或小团队个人助手

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **测试优先 (TDD)** | ⚠️ 待验证 | 需要：先写测试 → 实现失败 → 再写代码 |
| **简单性原则** | ✅ PASS | 只在入口文件添加全局处理器，PM2 配置文件独立 |
| **代码质量门禁** | ⚠️ 待验证 | 实现完成后需运行 `npm run precommit` |
| **不修改业务逻辑** | ✅ PASS | 只在 src/index.ts 添加异常处理，不影响现有模块 |
| **与 shutdown handler 协调** | ⚠️ 待验证 | 需确保异常处理不阻止正常关闭流程 |

## Project Structure

### Documentation (this feature)

```text
specs/025-process-stability/
├── spec.md              # 需求规格说明
├── clarify.md           # 澄清问答记录
├── plan.md              # 本文件 (/speckit.plan 输出)
├── research.md          # Phase 0 研究结果
├── data-model.md        # Phase 1 数据模型
├── quickstart.md        # Phase 1 快速指南
├── contracts/           # Phase 1 接口契约
└── tasks.md             # Phase 2 任务列表 (/speckit.tasks 输出)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── exception-handler.ts   # 新增：全局异常处理器
│   └── config.ts              # 修改：添加异常通知配置
├── index.ts                   # 修改：注册全局异常处理器
└── channels/
    └── feishu.ts              # 验证：WebSocket 异常兜底测试

tests/
├── unit/
│   └── exception-handler.test.ts  # 新增：异常处理器测试
└── integration/
    └── process-stability.test.ts  # 新增：进程稳定性集成测试

config/
├── ecosystem.config.js        # 新增：PM2 配置文件
└── pm2-start.sh               # 新增：PM2 启动脚本

logs/                          # 新增：异常日志目录
├── exception.log              # 异常日志文件
└── combined.log               # PM2 合并日志
```

**Structure Decision**: 单项目结构，新增 `src/core/exception-handler.ts` 实现异常处理逻辑，PM2 配置独立于 `config/` 目录。

## Complexity Tracking

> 无 Constitution Check 违规，无需复杂性跟踪。

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Research (待执行)

> 需要研究以下内容：
> 1. Node.js 全局异常处理最佳实践
> 2. PM2 ecosystem 配置参数详解
> 3. pm2-logrotate 配置方法
> 4. 飞书 SDK WebSocket 异常处理机制

**Output**: research.md

## Phase 1: Design (待执行)

> 需要定义：
> 1. 异常日志格式 (JSON 结构)
> 2. PM2 配置参数
> 3. config.json 扩展字段
> 4. 异常处理器接口

**Output**: data-model.md, contracts/, quickstart.md