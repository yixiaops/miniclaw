# Clarify Session: Process Stability Guard

**Feature**: 025-process-stability
**Created**: 2026-05-08

## Progress

- [x] Question 1: 日志轮转方案选择
- [ ] Question 2: 异常通知机制
- [ ] Question 3: 日志存储格式
- [ ] Question 4: 内存阈值配置方式
- [ ] Question 5: 开机自启备选方案

## Question 1: 日志轮转方案选择

**Question**: 日志轮转方案应该使用哪种实现？

**Options**:
- A. 自定义实现（在 PM2 配置中设置日志轮转参数）
- B. 使用 PM2 内置日志轮转模块 `pm2 install pm2-logrotate`

**User Answer**: **B**

**Rationale**: 使用 PM2 生态原生方案，减少外部依赖，配置简单且与 PM2 监控集成良好

**Recorded**: 2026-05-08

---

## Question 2: 异常通知机制

**Question**: 异常兜底捕获后是否需要主动通知？

**User Answer**: **C（推荐方案）** — 记录日志 + 飞书通知（config.json 中 `exceptionNotification.enabled` 开关控制）

**Rationale**: 灵活性高，生产环境开启、开发环境关闭

---

## Question 3: 日志存储格式

**Question**: 异常日志使用什么格式？

**User Answer**: **A（推荐方案）** — JSON 格式，包含 timestamp、type、message、stack、source 字段，便于程序化解析和检索

**Rationale**: 结构化日志便于后续分析和告警集成

---

## Question 4: 内存阈值配置方式

**Question**: PM2 的 max_memory_restart 阈值如何配置？

**User Answer**: **B（推荐方案）** — 在 ecosystem.config.js 中硬编码 500MB，同时在 config.json 中提供覆盖选项

**Rationale**: 默认值开箱即用，同时支持灵活调整

---

## Question 5: 开机自启备选方案

**Question**: 当 PM2 不可用时的备选方案？

**User Answer**: **A（推荐方案）** — 只提供手动启动脚本 `npm run start:feishu`，PM2 不可用时手动启动

**Rationale**: PM2 崩溃概率极低，手动启动足够应对偶发故障