# Feature Specification: Process Stability Guard

**Feature Branch**: `025-process-stability`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "解决 miniclaw 进程意外关闭问题，通过代码加固和进程守护两种方案"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 异常捕获进程保活 (Priority: P1)

作为 miniclaw 运维人员，当进程内部发生未捕获异常时，期望进程不退出、继续提供服务，异常信息被记录到日志以便排查。

**Why this priority**: 这是核心稳定性保障，直接影响服务可用性。如果进程因异常退出，后续所有保障措施都无效。

**Independent Test**: 可通过手动触发异常（如 `throw new Error('test')`）验证进程是否保持运行、日志是否记录。

**Acceptance Scenarios**:

1. **Given** miniclaw 进程正常运行，**When** 内部代码抛出未捕获异常，**Then** 进程保持运行状态，异常详情写入日志文件
2. **Given** miniclaw 进程正常运行，**When** Promise rejection 未被处理，**Then** 进程保持运行状态，rejection 详情写入日志文件
3. **Given** 飞书 WebSocket 回调中发生异常，**When** 异常未被回调内部捕获，**Then** 异常被全局兜底捕获，进程保持运行

---

### User Story 2 - 进程崩溃自动重启 (Priority: P2)

作为 miniclaw 运维人员，当进程因不可恢复错误崩溃退出时，期望进程自动重启、快速恢复服务，无需人工干预。

**Why this priority**: 在异常兜底失效的极端情况下（如内存溢出、系统级错误），需要外部守护机制保障服务连续性。

**Independent Test**: 可通过手动终止进程（`kill -9`）验证 PM2 是否自动重启。

**Acceptance Scenarios**:

1. **Given** PM2 正在守护 miniclaw 进程，**When** 进程异常退出，**Then** PM2 在 1 秒内自动重启进程
2. **Given** PM2 正在守护 miniclaw 进程，**When** 进程连续重启超过 5 次，**Then** PM2 暂停重启并记录状态

---

### User Story 3 - 开机自启动服务 (Priority: P3)

作为 miniclaw 运维人员，期望服务器重启后 miniclaw 进程自动启动，无需人工干预。

**Why this priority**: 生产环境运维便利性需求，减少人工介入成本。

**Independent Test**: 可通过重启服务器验证 miniclaw 是否自动启动。

**Acceptance Scenarios**:

1. **Given** PM2 已配置开机自启，**When** 服务器重启完成，**Then** miniclaw 进程自动启动并提供服务

---

### User Story 4 - 内存溢出保护 (Priority: P4)

作为 miniclaw 运维人员，期望进程内存超过阈值时自动重启，防止内存撑爆导致系统不稳定。

**Why this priority**: 防止内存泄漏导致服务器整体不稳定，属于预防性保障。

**Independent Test**: 可通过模拟内存增长验证 PM2 是否在阈值时重启进程。

**Acceptance Scenarios**:

1. **Given** PM2 配置内存阈值 500MB，**When** miniclaw 进程内存占用超过阈值，**Then** PM2 自动重启进程

---

### Edge Cases

- 当异常在 shutdown 阶段发生时如何处理？→ 仍需记录日志，但不应阻止正常关闭流程
- 当同一异常短时间内反复发生时如何处理？→ 记录每次异常，不限制频率，但日志需包含时间戳以便区分
- 当飞书 WebSocket 连接断开导致异常时如何处理？→ 异常被兜底，进程保持运行，飞书 SDK 内部会尝试重连
- 当 PM2 本身不可用时如何处理？→ 需提供备选方案（如 systemd 或手动启动脚本）

## Requirements *(mandatory)*

### Functional Requirements

**代码加固方案**

- **FR-001**: 系统 MUST 在 `main()` 函数启动前注册 `process.on('uncaughtException')` 全局异常处理器
- **FR-002**: 系统 MUST 在 `main()` 函数启动前注册 `process.on('unhandledRejection')` 全局 Promise rejection 处理器
- **FR-003**: 全局异常处理器 MUST 记录异常完整信息（类型、消息、堆栈、时间戳）到日志文件或控制台
- **FR-004**: 全局异常处理器 MUST NOT 导致进程退出，异常处理后进程继续运行
- **FR-005**: 异常日志 MUST 包含区分标识（如 `[UNCAUGHT_EXCEPTION]` 或 `[UNHANDLED_REJECTION]`）以便筛选
- **FR-006**: 飞书 WebSocket 回调中的异常 MUST 能被全局异常处理器捕获

**进程守护方案**

- **FR-007**: 系统 MUST 提供 PM2 ecosystem 配置文件（`ecosystem.config.js`）
- **FR-008**: PM2 配置 MUST 设置 `restart_mode: 'cluster'` 或等效重启策略
- **FR-009**: PM2 配置 MUST 设置 `max_memory_restart` 内存阈值（建议 500MB）
- **FR-010**: PM2 配置 MUST 设置日志轮转（`merge_logs` 和日志文件路径）
- **FR-011**: 系统 MUST 提供 `pm2-start.sh` 启动脚本，包含 `pm2 start` 和 `pm2 save` 命令
- **FR-012**: 启动脚本 MUST 支持开机自启设置（`pm2 startup` 命令生成）
- **FR-013**: PM2 配置 MUST 设置重启延迟（`restart_delay`），避免连续重启过快

### Key Entities

- **异常日志**: 记录未捕获异常的完整信息，包含类型、消息、堆栈、时间戳、异常来源标识
- **PM2 配置**: 进程守护配置，定义应用名称、启动命令、内存阈值、重启策略、日志路径等参数

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 未捕获异常发生后，进程保持运行状态（可通过 `ps aux` 验证进程 PID 不变）
- **SC-002**: 异常日志包含完整的堆栈信息、时间戳和异常类型标识
- **SC-003**: 进程崩溃后，PM2 在 1 秒内完成自动重启（可通过 PM2 日志验证）
- **SC-004**: 服务器重启后，miniclaw 进程自动启动并正常运行（可通过 `pm2 list` 验证状态为 online）
- **SC-005**: 进程内存超过阈值时，PM2 自动触发重启（可通过 PM2 日志验证）
- **SC-006**: 异常日志文件支持长期存储和检索，日志格式统一便于排查

## Assumptions

- 服务器操作系统为 Linux（PM2 和开机自启功能依赖 Linux）
- Node.js 版本 18+（与项目现有要求一致）
- 异常兜底优先于进程守护，两者作为分层保障
- 内存阈值设置为 500MB，可根据实际使用调整
- 日志存储在项目目录下的 `logs/` 子目录
- PM2 通过 npm 全局安装或项目依赖安装

## Constraints

- 不修改现有业务逻辑代码，只在入口文件添加异常处理
- 异常处理逻辑需与现有 shutdown handler 协调，不影响正常关闭流程
- PM2 配置文件需与现有 npm scripts 协调（如 `npm run start:feishu`）

## Clarifications *(from speckit.clarify)*

### Session 2026-05-08

- Q: 日志轮转策略选择哪种方案？ → A: **B: PM2 内置 pm2-logrotate** ✅ 已决定
- Q: 当 PM2 本身不可用时，期望的备选启动方案是什么？ → A: 待澄清
- Q: 内存阈值设置多少 MB 合适？ → A: 待澄清
- Q: 异常日志保留多长时间？ → A: 待澄清
- Q: 进程崩溃时是否需要主动通知？ → A: 待澄清

## Decision Log *(from clarify)*

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | 日志轮转方案选择 | **B: PM2 内置 pm2-logrotate** | 使用 PM2 生态原生方案，减少外部依赖，配置简单且与 PM2 监控集成良好 |