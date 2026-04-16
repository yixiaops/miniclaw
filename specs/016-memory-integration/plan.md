# Plan: 双层记忆系统集成

> 版本: 1.0 | 创建时间: 2026-04-15

---

## 1. 任务分解

### Phase 1: 基础设施（6h）

| 任务ID | 任务 | 时间 | 优先级 | TDD |
|:------:|------|:----:|:------:|:---:|
| T1.1 | 创建 MemoryManager 统一入口 | 2h | P0 | 🔴 |
| T1.2 | 扩展 Config 支持 memory 配置 | 1h | P0 | 🔴 |
| T1.3 | 实现静默降级错误处理 | 3h | P1 | 🔴 |

**T1.1: MemoryManager 统一入口**

```typescript
// src/memory/manager.ts
export class MemoryManager {
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private promoter: MemoryPromoter;
  private ttlManager: TTLManager;
  
  async initialize(): Promise<void>;
  async write(content: string, sessionId: string, metadata?: MemoryMetadata): Promise<string>;
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  async cleanup(): Promise<CleanupResult>;
  async persist(): Promise<void>;
  destroy(): void;
}
```

**测试用例**：
```typescript
// tests/unit/memory/manager.test.ts
describe('MemoryManager', () => {
  it('should initialize all components');
  it('should write to short-term memory');
  it('should search both layers');
  it('should cleanup expired memories');
  it('should persist long-term memory');
});
```

---

### Phase 2: Gateway 集成（5h）

| 任务ID | 任务 | 时间 | 优先级 | TDD |
|:------:|------|:----:|:------:|:---:|
| T2.1 | 创建 AutoMemoryWriter | 2h | P0 | 🔴 |
| T2.2 | Gateway 接收 memoryManager | 3h | P0 | 🔴 |

**T2.1: AutoMemoryWriter**

负责自动写入对话到短期记忆。

```typescript
// src/memory/auto-writer.ts
export class AutoMemoryWriter {
  private memoryManager: MemoryManager;
  private defaultImportance: number = 0.3;
  
  async writeConversation(sessionId: string, userMsg: string, assistantMsg: string): Promise<void>;
}
```

**测试用例**：
```typescript
// tests/unit/memory/auto-writer.test.ts
describe('AutoMemoryWriter', () => {
  it('should write both user and assistant messages');
  it('should use default importance 0.3');
  it('should handle write failure gracefully (silent)');
  it('should not block main flow on error');
});
```

**T2.2: Gateway 改动**

```typescript
// src/core/gateway/index.ts
export class MiniclawGateway {
  private memoryManager?: MemoryManager;
  private autoWriter?: AutoMemoryWriter;
  
  constructor(config: Config, gatewayConfig: GatewayConfig) {
    // 接收 memoryManager（可选）
    this.memoryManager = gatewayConfig.memoryManager;
    if (this.memoryManager) {
      this.autoWriter = new AutoMemoryWriter(this.memoryManager);
    }
  }
  
  async handleMessage(ctx: MessageContext): Promise<Response> {
    // ... 现有逻辑 ...
    
    // 自动写入记忆（静默降级）
    if (this.autoWriter) {
      await this.autoWriter.writeConversation(sessionId, ctx.content, response.content);
    }
  }
}
```

---

### Phase 3: 可选注入（1h）

| 任务ID | 任务 | 时间 | 优先级 | TDD |
|:------:|------|:----:|:------:|:---:|
| T3.1 | Agent 可选注入记忆上下文 | 1h | P1 | 🔴 |

**T3.1: Agent 可选注入**

```typescript
// src/core/agent/index.ts
export class MiniclawAgent {
  private memoryManager?: MemoryManager;
  
  async chat(content: string): Promise<{ content: string }> {
    let systemPrompt = this.basePrompt;
    
    // 可选注入（配置开关）
    if (this.memoryManager && this.config.memory?.injectContext) {
      const memories = await this.memoryManager.search(content, { limit: 3 });
      if (memories.length > 0) {
        systemPrompt += `\n\n<memory_context>\n${memories.map(m => m.entry.content).join('\n')}\n</memory_context>`;
      }
    }
    
    // 调用 LLM
    // ...
  }
}
```

---

### Phase 4: 性能优化（3h）

| 任务ID | 任务 | 时间 | 优先级 | TDD |
|:------:|------|:----:|:------:|:---:|
| T4.1 | 写入性能测试 (< 50ms) | 1.5h | P1 | 🔴 |
| T4.2 | 搜索性能测试 (< 200ms) | 1.5h | P1 | 🔴 |

---

### Phase 5: 文档与验收（3h）

| 任务ID | 任务 | 时间 | 优先级 | TDD |
|:------:|------|:----:|:------:|:---:|
| T5.1 | 更新 README.md | 1h | P2 | - |
| T5.2 | E2E 测试 | 2h | P0 | 🔴 |

---

## 2. 依赖关系

```
T1.1 (MemoryManager) ─┬─→ T2.1 (AutoMemoryWriter)
                      │
                      └─→ T3.1 (Agent注入)
                      
T1.2 (Config) ────────┬─→ T2.2 (Gateway)
                      │
                      └─→ T3.1 (Agent注入)

T1.3 (错误处理) ──────→ T2.1, T2.2

T2.1 (AutoWriter) ───→ T2.2 (Gateway)

T2.2 (Gateway) ──────→ T5.2 (E2E)

T4.1, T4.2 (性能) ───→ T5.2 (E2E)
```

**关键路径**: `T1.1 → T1.3 → T2.1 → T2.2 → T5.2` (~15h)

---

## 3. 预计时间

| Phase | 时间 |
|-------|:----:|
| Phase 1: 基础设施 | 6h |
| Phase 2: Gateway 集成 | 5h |
| Phase 3: 可选注入 | 1h |
| Phase 4: 性能优化 | 3h |
| Phase 5: 文档验收 | 3h |
| **总计** | **18h** |

---

## 4. 测试先行策略（TDD）

### 红色阶段（先写测试）

每个 🔴 任务必须先写测试：

**T1.1 MemoryManager 测试**：
```typescript
describe('MemoryManager', () => {
  it('should initialize with all components');
  it('should write to short-term with default importance 0.3');
  it('should search both layers and merge results');
  it('should cleanup expired memories');
  it('should persist long-term memory to file');
  it('should handle error gracefully (silent)');
});
```

**T2.1 AutoMemoryWriter 测试**：
```typescript
describe('AutoMemoryWriter', () => {
  it('should write user message with importance 0.3');
  it('should write assistant message with importance 0.3');
  it('should not throw on write failure');
  it('should complete in < 50ms');
});
```

**T2.2 Gateway 集成测试**：
```typescript
describe('Gateway with MemoryManager', () => {
  it('should accept optional memoryManager');
  it('should auto-write conversation on handleMessage');
  it('should fallback to SimpleMemoryStorage when no memoryManager');
  it('should not block on memory write failure');
});
```

### 绿色阶段（实现代码）

测试失败后，实现代码使其通过。

### 重构阶段

代码通过后，优化结构和性能。

---

## 5. 文件改动清单

| 文件 | 改动类型 | 任务 |
|------|:--------:|:----:|
| `src/memory/manager.ts` | 新建 | T1.1 |
| `src/memory/auto-writer.ts` | 新建 | T2.1 |
| `src/core/config.ts` | 修改 | T1.2 |
| `src/core/gateway/index.ts` | 修改 | T2.2 |
| `src/core/agent/index.ts` | 修改 | T3.1 |
| `src/index.ts` | 修改 | T2.2 |
| `tests/unit/memory/manager.test.ts` | 新建 | T1.1 |
| `tests/unit/memory/auto-writer.test.ts` | 新建 | T2.1 |
| `tests/integration/gateway-memory.test.ts` | 新建 | T2.2 |
| `tests/integration/e2e-memory.test.ts` | 新建 | T5.2 |
| `README.md` | 修改 | T5.1 |

---

## 6. 验收标准

| 标准 | 说明 |
|------|------|
| ✅ 编译成功 | `npm run build` 无错误 |
| ✅ 测试通过 | 所有新增测试通过 |
| ✅ 向后兼容 | 无 memoryManager 时原有功能正常 |
| ✅ 性能达标 | 写入 < 50ms，搜索 < 200ms |
| ✅ 静默降级 | 记忆失败不阻断对话 |
| ✅ 文档完整 | README 记录使用方法 |

---

*生成时间: 2026-04-15*