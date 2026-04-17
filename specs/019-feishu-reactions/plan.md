# Implementation Plan: 飞书消息表情回应

**Branch**: `019-feishu-reactions` | **Date**: 2026-04-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/019-feishu-reactions/spec.md`

## Summary

实现飞书消息表情回应功能，在消息处理时添加和删除表情回应表示处理状态。同时修复记忆系统集成问题：Gateway 已支持 MemoryManager，但 `src/index.ts` 创建 Gateway 时未传递 memoryManager，导致记忆系统未生效。

**核心任务**:
1. 表情回应功能（已实现）- 需补充测试
2. 记忆系统集成修复 - 在 `src/index.ts` 中创建并传递 MemoryManager

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 18+
**Primary Dependencies**: pi-agent-core, Express 5.x, Socket.IO, 飞书 Open API
**Storage**: 简单内存存储（SimpleMemoryStorage），文件持久化可选
**Testing**: Vitest
**Target Platform**: Linux server
**Project Type**: CLI/API/Web 服务
**Performance Goals**: 表情回应操作延迟 < 500ms，成功率 > 95%
**Constraints**: 表情回应失败不中断消息处理流程
**Scale/Scope**: 个人使用，单实例部署

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **No violations** - 功能简单，无需复杂架构

## Project Structure

### Documentation (this feature)

```text
specs/019-feishu-reactions/
├── spec.md              # Feature specification
├── plan.md              # This file
└── tasks.md             # Implementation tasks (待生成)
```

### Source Code (repository root)

```text
src/
├── channels/
│   ├── feishu.ts              # 飞书通道（已集成表情回应）
│   ├── feishu-reactions.ts    # 表情回应管理器（已实现）
│   ├── feishu-client.ts       # 飞书 API 客户端
│   ├── feishu-websocket.ts    # 飞书 WebSocket
│   └── feishu-dedup.ts        # 消息去重
├── memory/
│   ├── manager.ts             # 记忆管理器（已实现）
│   ├── auto-writer.ts         # 自动记忆写入器
│   └── store/                 # 记忆存储组件
├── core/
│   ├── gateway/
│   │   └── index.ts           # Gateway（已支持 memoryManager）
│   └── config.ts              # 配置加载
└── index.ts                   # 主入口（需修改）

tests/
├── unit/
│   └── channels/
│       └── feishu-reactions.test.ts  # 表情回应测试（待创建）
│   └── memory/
│       └── manager.test.ts            # MemoryManager 测试（已存在）
└── integration/
    └── feishu-channel.test.ts         # 飞书通道集成测试
```

**Structure Decision**: 单项目结构，使用现有 `src/` 和 `tests/` 目录

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Miniclaw                                   │
├─────────────────────────────────────────────────────────────────────┤
│   src/index.ts                                                       │
│   ├── loadConfig()                                                   │
│   ├── createPiSkillManager()                                         │
│   ├── [NEW] create MemoryManager (if config.memory.enabled)          │
│   ├── create AgentRegistry                                           │
│   ├── create SubagentManager                                         │
│   └── create Gateway(memoryManager)  ← 传递 memoryManager           │
├─────────────────────────────────────────────────────────────────────┤
│   Gateway (src/core/gateway/index.ts)                                │
│   ├── Router → SessionManager → AgentRegistry → Agent               │
│   └── [已支持] memoryManager → AutoMemoryWriter                      │
├─────────────────────────────────────────────────────────────────────┤
│   FeishuChannel (src/channels/feishu.ts)                             │
│   ├── FeishuWebSocket → handleMessage                                │
│   ├── FeishuReactions.addProcessingReaction() → SMILE 表情          │
│   ├── Gateway.handleMessage() → 处理消息                             │
│   └── FeishuReactions.deleteReaction() → 移除表情                   │
└─────────────────────────────────────────────────────────────────────┘
```

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `src/index.ts` | **MODIFY** | 添加 MemoryManager 创建和传递 |
| `tests/unit/channels/feishu-reactions.test.ts` | **CREATE** | 表情回应单元测试 |
| `src/core/config.ts` | **VERIFY** | 确认 memory 配置项存在 |

### src/index.ts 修改详情

**位置**: 第 157-252 行（main 函数内）

**修改内容**:
```typescript
// 1. 添加导入（文件顶部）
import { MemoryManager } from './memory/manager.js';

// 2. 在 skillManager 初始化后（约第 193 行后）添加
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

// 4. 在 cleanup 时销毁 MemoryManager
if (memoryManager) {
  memoryManager.destroy();
}
```

## Implementation Order

### Phase 1: 记忆系统集成（核心修复）

**TDD 流程**:
1. ✅ 编写/确认 MemoryManager 测试（`tests/unit/memory/manager.test.ts`）
2. ⬜ 确认 Gateway 已支持 memoryManager（已验证）
3. ⬜ 修改 `src/index.ts` 创建并传递 MemoryManager
4. ⬜ 编写集成测试验证记忆系统生效
5. ⬜ 运行测试验证

### Phase 2: 表情回应功能验证

**TDD 流程**:
1. ⬜ 编写 FeishuReactions 单元测试
   - token 获取与缓存测试
   - addReaction 测试（成功/失败）
   - deleteReaction 测试（成功/失败）
   - addProcessingReaction 测试
   - clearTokenCache 测试
2. ⬜ 确认现有实现符合 FR-001~FR-006
3. ⬜ 运行测试验证覆盖率 > 70%

### Phase 3: 配置文档

1. ⬜ 更新 README 或配置文档说明记忆系统启用方式
2. ⬜ 添加 `memory.enabled: true` 配置示例

## TDD Checklist

### 记忆系统集成测试

```typescript
// tests/integration/memory-integration.test.ts
describe('Memory Integration', () => {
  it('should create MemoryManager when config.memory.enabled is true', async () => {
    // 测试 MemoryManager 被创建并传递给 Gateway
  });

  it('should gracefully degrade when MemoryManager initialization fails', async () => {
    // 测试初始化失败时静默降级
  });

  it('should write conversation to memory after message handling', async () => {
    // 测试对话被写入记忆
  });
});
```

### 表情回应测试

```typescript
// tests/unit/channels/feishu-reactions.test.ts
describe('FeishuReactions', () => {
  describe('getAccessToken', () => {
    it('should cache token and reuse', async () => {});
    it('should refresh token when expired', async () => {});
  });

  describe('addReaction', () => {
    it('should add reaction and return reactionId', async () => {});
    it('should return empty reactionId on API error', async () => {});
    it('should return empty reactionId on network error', async () => {});
  });

  describe('deleteReaction', () => {
    it('should delete reaction successfully', async () => {});
    it('should return false on API error', async () => {});
    it('should return false on network error', async () => {});
  });

  describe('addProcessingReaction', () => {
    it('should add SMILE reaction', async () => {});
  });

  describe('clearTokenCache', () => {
    it('should clear cached token', async () => {});
  });
});
```

## Success Criteria Tracking

| Criteria | Target | Verification Method |
|----------|--------|---------------------|
| SC-001 表情回应成功率 | > 95% | 单元测试 + 生产日志 |
| SC-002 延迟增加 | < 500ms | 性能测试 |
| SC-003 测试覆盖率 | > 70% | `npm run test:coverage` |
| SC-004 零中断 | 0 次中断 | 集成测试 + 错误日志 |

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 飞书 API 网络延迟 | 中 | 中 | 异步处理，不阻塞主流程 |
| Token 缓存过期 | 低 | 低 | 提前 5 分钟刷新 |
| MemoryManager 初始化失败 | 低 | 低 | 静默降级，不影响消息处理 |

## Dependencies

- **已完成**: FeishuReactions 实现（`src/channels/feishu-reactions.ts`）
- **已完成**: MemoryManager 实现（`src/memory/manager.ts`）
- **已完成**: Gateway 支持 memoryManager（`src/core/gateway/index.ts`）
- **已完成**: FeishuChannel 集成表情回应（`src/channels/feishu.ts`）
- **待完成**: `src/index.ts` 传递 memoryManager
- **待完成**: 表情回应单元测试
- **待完成**: 记忆集成测试

## Complexity Tracking

> 无 Constitution 违规，不需要填写