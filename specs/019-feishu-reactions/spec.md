# Feature Specification: 飞书消息表情回应

**Feature Branch**: `019-feishu-reactions`
**Created**: 2026-04-17
**Status**: Draft
**Input**: 飞书表情回应功能 - 消息处理时添加和删除表情回应，表示正在处理状态

## Clarification Q&A *(mandatory)*

### Q1: 记忆系统集成状态

**Question**: 用户反馈记忆系统没有生效，是否已集成到主流程？

**Answer**: 记忆系统代码已完整实现（`src/memory/`），Gateway 也已集成（`src/core/gateway/index.ts`），但 **`src/index.ts` 创建 Gateway 时没有传递 `memoryManager`**。需要修复。

**Action**: 在 `src/index.ts` 中创建 MemoryManager 并传递给 Gateway，确保记忆系统生效。

---

### Q2: 记忆配置默认状态

**Question**: 记忆系统默认是否启用？

**Answer**: 默认禁用（`config.memory.enabled = false`），需要用户在 `~/.miniclaw/config.json` 中配置 `memory.enabled: true`。

**Action**: 添加文档说明如何启用记忆系统。

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 处理状态可视化 (Priority: P1)

用户发送消息到飞书机器人后，希望直观看到消息正在被处理的状态，而不是等待无响应的空白时间。

**Why this priority**: 这是核心功能价值，让用户知道系统正在响应他们的消息，提升用户体验和信任感。

**Independent Test**: 可以通过发送一条测试消息，验证是否出现表情回应，独立验证核心功能。

**Acceptance Scenarios**:

1. **Given** 用户发送消息给飞书机器人, **When** 机器人收到消息, **Then** 消息立即出现 SMILE 表情回应
2. **Given** 消息已有表情回应, **When** 处理完成, **Then** 表情回应被移除
3. **Given** 用户发送多条消息, **When** 每条消息被处理, **Then** 每条消息都有独立的表情回应状态

---

### User Story 2 - 错误容错 (Priority: P2)

当表情回应功能出现网络错误或 API 异常时，消息处理流程不应被中断，用户仍能收到正常回复。

**Why this priority**: 系统稳定性保障，表情回应是辅助功能，不应影响核心消息处理。

**Independent Test**: 可以模拟表情回应 API 失败场景，验证消息处理是否正常完成。

**Acceptance Scenarios**:

1. **Given** 飞书 API 网络异常, **When** 尝试添加表情回应, **Then** 失败被记录但消息处理继续
2. **Given** 表情回应添加成功, **When** 删除表情回应失败, **Then** 失败被记录但不抛出异常
3. **Given** token 获取失败, **When** 尝试添加表情回应, **Then** 返回空 reactionId 而不抛出异常

---

### User Story 3 - Token 缓存管理 (Priority: P3)

飞书 API 的 tenant_access_token 需要缓存以减少 API 调用次数和提升性能。

**Why this priority**: 性能优化，减少不必要的认证请求，提升系统响应速度。

**Independent Test**: 可以通过多次调用表情回应方法，验证 token 是否被缓存复用。

**Acceptance Scenarios**:

1. **Given** token 已缓存且未过期, **When** 调用表情回应方法, **Then** 使用缓存 token 不重新获取
2. **Given** token 缓存即将过期, **When** 调用表情回应方法, **Then** 自动刷新 token
3. **Given** 需要清除缓存, **When** 调用 clearTokenCache, **Then** 下次调用重新获取 token

---

### Edge Cases

- 当表情回应 API 返回非 0 错误码时，如何处理？
- 当网络超时导致 API 调用失败时，是否有重试机制？
- 当同一消息多次添加表情回应时，飞书 API 如何响应？
- 当删除的表情回应已被用户手动删除时，API 如何响应？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须在收到飞书消息后，立即给该消息添加 SMILE 表情回应
- **FR-002**: 系统必须在消息处理完成后，删除之前添加的表情回应
- **FR-003**: 表情回应操作失败时，系统必须记录错误日志但不中断消息处理流程
- **FR-004**: 系统必须缓存飞书 tenant_access_token，并在过期前自动刷新
- **FR-005**: 系统必须提供便捷方法添加"正在处理"表情回应（使用 SMILE 表情）
- **FR-006**: 系统必须允许清除 token 缓存以支持手动刷新
- **FR-007** *(新增)*: 系统必须在启动时检查 `config.memory.enabled`，若启用则创建 MemoryManager 并传递给 Gateway
  - **修复位置**: `src/index.ts` 第 157-252 行（main 函数内）
  - **具体实现**:
    ```typescript
    // 1. 添加导入（文件顶部）
    import { MemoryManager } from './memory/manager.js';

    // 2. 在 skillManager 初始化后、Gateway 创建前（约第 193 行后）添加
    let memoryManager: MemoryManager | undefined;

    if (config.memory?.enabled) {
      console.log('\n初始化 MemoryManager...');
      memoryManager = new MemoryManager({
        storageDir: config.memory.dir || './memory-storage',
        defaultTTL: config.memory.defaultTTL || 86400000,
        cleanupInterval: config.memory.cleanupInterval || 3600000,
        promotionThreshold: config.memory.promotionThreshold || 0.5
      });
      await memoryManager.initialize();
      console.log('✓ MemoryManager 已初始化');
    }

    // 3. 修改 Gateway 创建（第 249-252 行）
    const gateway = new MiniclawGateway(config, {
      createAgentFn,
      maxAgents: config.agents?.defaults.maxConcurrent,
      memoryManager  // 传入 memoryManager
    });
    ```
- **FR-008** *(新增)*: 记忆系统集成失败时，系统必须静默降级，不影响消息处理主流程

### Key Entities

- **MessageReaction**: 表情回应实体，包含 messageId、reactionId、emojiType 属性
- **TokenCache**: 认证令牌缓存，包含 token、expireAt 属性
- **FeishuConfig**: 配置实体，包含 appId、appSecret 属性

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 表情回应添加成功率达到 95% 以上（网络正常情况下）
- **SC-002**: 表情回应操作不增加超过 500ms 的消息处理延迟
- **SC-003**: 单元测试覆盖率达到 70% 以上
- **SC-004**: 表情回应失败不影响任何正常消息处理流程（零中断）

## Assumptions

- 飞书机器人已正确配置 App ID 和 App Secret
- 使用飞书内置表情 SMILE 作为处理状态标识
- 表情回应功能通过 HTTP API 实现，不依赖 WebSocket 连接状态
- 处理状态可视化采用添加-删除表情的简单模式，不使用动态更新的卡片
- token 缓存采用内存存储，不持久化到文件
- 记忆系统核心实现已完成（`src/memory/`），本次仅集成到主流程
- 记忆系统默认禁用，需在 `config.json` 中配置 `memory.enabled: true` 启用

## Scope

**包含**:
- 表情回应添加功能
- 表情回应删除功能
- tenant_access_token 获取与缓存
- 错误处理与容错机制
- 记忆系统集成到主流程（修复 `src/index.ts` 缺失问题）
- 记忆系统启用配置文档

**不包含**:
- 其他表情类型的选择（固定使用 SMILE）
- 表情回应的用户自定义配置
- 表情回应的批量操作
- 表情回应状态的持久化存储
- 记忆系统的核心实现（已存在于 `src/memory/`）