# Tasks: 双层记忆系统集成

> 版本: 1.0 | 创建时间: 2026-04-15

---

## 任务总览

| Phase | 任务数 | 时间 | TDD |
|-------|:------:|:----:|:---:|
| Phase 1: 基础设施 | 3 | 6h | 3 🔴 |
| Phase 2: Gateway 集成 | 2 | 5h | 2 🔴 |
| Phase 3: 可选注入 | 1 | 1h | 1 🔴 |
| Phase 4: 性能优化 | 2 | 3h | 2 🟡 |
| Phase 5: 文档验收 | 2 | 3h | 1 🔴 |
| **总计** | **10** | **18h** | **9** |

---

## Phase 1: 基础设施（6h）

### T1.1: MemoryManager 统一入口

| 属性 | 值 |
|------|-----|
| **时间** | 2h |
| **依赖** | 无 |
| **TDD** | 🔴 测试先行 |
| **优先级** | P0 |

**文件路径**:
- 新建: `src/memory/manager.ts`
- 新建: `tests/unit/memory/manager.test.ts`

**改动内容**:

```typescript
// src/memory/manager.ts
export interface MemoryManagerConfig {
  storageDir: string;
  defaultTTL?: number;
  cleanupInterval?: number;
  promotionThreshold?: number;
}

export class MemoryManager {
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private promoter: MemoryPromoter;
  private ttlManager: TTLManager;
  
  constructor(config: MemoryManagerConfig);
  async initialize(): Promise<void>;
  async write(content: string, sessionId: string, metadata?: MemoryMetadata): Promise<string>;
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  async cleanup(): Promise<CleanupResult>;
  async persist(): Promise<void>;
  destroy(): void;
}
```

**测试用例**:

```typescript
// tests/unit/memory/manager.test.ts
describe('MemoryManager', () => {
  it('should initialize all components');
  it('should write to short-term memory with default importance 0.3');
  it('should search both layers and merge results');
  it('should cleanup expired memories');
  it('should persist long-term memory to file');
  it('should handle error gracefully (silent)');
});
```

**验收标准**:
- [ ] MemoryManager 类创建
- [ ] initialize() 正常工作
- [ ] write() 写入短期记忆
- [ ] search() 双层检索
- [ ] cleanup() TTL 清理
- [ ] persist() 长期记忆持久化
- [ ] 所有测试通过

---

### T1.2: 扩展 Config 支持 memory 配置

| 属性 | 值 |
|------|-----|
| **时间** | 1h |
| **依赖** | T1.1 |
| **TDD** | 🔴 测试先行 |
| **优先级** | P0 |

**文件路径**:
- 修改: `src/core/config.ts`
- 新建: `tests/unit/core/config-memory.test.ts`

**改动内容**:

```typescript
// src/core/config.ts
export interface MemoryConfig {
  /** 是否启用双层记忆（默认 false） */
  enabled?: boolean;
  /** 存储目录 */
  dir?: string;
  /** 默认 TTL（毫秒） */
  defaultTTL?: number;
  /** 清理间隔（毫秒） */
  cleanupInterval?: number;
  /** 晋升阈值 */
  promotionThreshold?: number;
  /** 默认重要性分数 */
  defaultImportance?: number;
  /** 是否注入记忆上下文到 Agent */
  injectContext?: boolean;
}

export interface Config {
  // ... 现有配置 ...
  memory?: MemoryConfig;
}
```

**测试用例**:

```typescript
// tests/unit/core/config-memory.test.ts
describe('Config.memory', () => {
  it('should parse memory config from JSON');
  it('should default enabled to false');
  it('should default importance to 0.3');
  it('should default injectContext to false');
});
```

**验收标准**:
- [ ] MemoryConfig 接口定义
- [ ] Config 接口扩展
- [ ] 默认值正确（enabled=false, importance=0.3）
- [ ] 配置解析正确
- [ ] 测试通过

---

### T1.3: 实现静默降级错误处理

| 属性 | 值 |
|------|-----|
| **时间** | 3h |
| **依赖** | T1.1, T1.2 |
| **TDD** | 🔴 测试先行 |
| **优先级** | P1 |

**文件路径**:
- 新建: `src/memory/error-handler.ts`
- 新建: `tests/unit/memory/error-handler.test.ts`

**改动内容**:

```typescript
// src/memory/error-handler.ts
export class MemoryErrorHandler {
  /**
   * 静默执行记忆操作
   * 失败时只记录日志，不抛出异常
   */
  async silentExecute<T>(
    operation: () => Promise<T>,
    fallback?: T
  ): Promise<T | undefined>;
  
  /**
   * 记录错误日志
   */
  logError(operation: string, error: Error): void;
}
```

**测试用例**:

```typescript
// tests/unit/memory/error-handler.test.ts
describe('MemoryErrorHandler', () => {
  it('should return result on success');
  it('should return fallback on failure');
  it('should return undefined on failure without fallback');
  it('should not throw exception on failure');
  it('should log error on failure');
});
```

**验收标准**:
- [ ] MemoryErrorHandler 类创建
- [ ] silentExecute 正常工作
- [ ] 失败时不抛异常
- [ ] 错误日志记录
- [ ] 测试通过

---

## Phase 2: Gateway 集成（5h）

### T2.1: AutoMemoryWriter

| 属性 | 值 |
|------|-----|
| **时间** | 3h |
| **依赖** | T1.3 |
| **TDD** | 🔴 测试先行 |
| **优先级** | P0 |

**文件路径**:
- 新建: `src/memory/auto-writer.ts`
- 新建: `tests/unit/memory/auto-writer.test.ts`

**改动内容**:

```typescript
// src/memory/auto-writer.ts
export class AutoMemoryWriter {
  private memoryManager: MemoryManager;
  private errorHandler: MemoryErrorHandler;
  private defaultImportance: number;
  
  constructor(memoryManager: MemoryManager, defaultImportance: number = 0.3);
  
  /**
   * 自动写入对话到短期记忆
   * 静默降级，失败不阻断
   */
  async writeConversation(
    sessionId: string,
    userMsg: string,
    assistantMsg: string
  ): Promise<void>;
}
```

**测试用例**:

```typescript
// tests/unit/memory/auto-writer.test.ts
describe('AutoMemoryWriter', () => {
  it('should write user message with importance 0.3');
  it('should write assistant message with importance 0.3');
  it('should not throw on write failure');
  it('should complete in < 50ms');
  it('should use silentExecute for error handling');
});
```

**验收标准**:
- [ ] AutoMemoryWriter 类创建
- [ ] writeConversation 正常工作
- [ ] 默认 importance 0.3
- [ ] 失败不抛异常
- [ ] 性能 < 50ms
- [ ] 测试通过

---

### T2.2: Gateway 接收 memoryManager

| 属性 | 值 |
|------|-----|
| **时间** | 2h |
| **依赖** | T2.1 |
| **TDD** | 🔴 测试先行 |
| **优先级** | P0 |

**文件路径**:
- 修改: `src/core/gateway/index.ts`
- 修改: `src/index.ts`
- 新建: `tests/integration/gateway-memory.test.ts`

**改动内容**:

```typescript
// src/core/gateway/index.ts
export interface GatewayConfig {
  createAgentFn: CreateAgentFn;
  maxAgents?: number;
  sessionConfig?: Partial<SessionConfig>;
  storageDir?: string;
  memoryManager?: MemoryManager;  // 新增
}

export class MiniclawGateway {
  private memoryManager?: MemoryManager;
  private autoWriter?: AutoMemoryWriter;
  
  constructor(config: Config, gatewayConfig: GatewayConfig) {
    this.memoryManager = gatewayConfig.memoryManager;
    if (this.memoryManager) {
      this.autoWriter = new AutoMemoryWriter(
        this.memoryManager,
        config.memory?.defaultImportance || 0.3
      );
    }
  }
  
  async handleMessage(ctx: MessageContext): Promise<Response> {
    // ... 现有逻辑 ...
    
    // 自动写入记忆（静默降级）
    if (this.autoWriter) {
      await this.autoWriter.writeConversation(
        sessionId,
        ctx.content,
        response.content
      );
    }
    
    return response;
  }
}
```

```typescript
// src/index.ts
async function main() {
  // 初始化记忆系统（如果启用）
  let memoryManager: MemoryManager | undefined;
  
  if (config.memory?.enabled) {
    memoryManager = new MemoryManager({
      storageDir: config.memory.dir || join(process.env.HOME!, '.miniclaw'),
      defaultTTL: config.memory.defaultTTL,
      cleanupInterval: config.memory.cleanupInterval,
      promotionThreshold: config.memory.promotionThreshold
    });
    await memoryManager.initialize();
    console.log('记忆系统已启用');
  }
  
  // 创建 Gateway
  const gateway = new MiniclawGateway(config, {
    createAgentFn,
    memoryManager
  });
}
```

**测试用例**:

```typescript
// tests/integration/gateway-memory.test.ts
describe('Gateway with MemoryManager', () => {
  it('should accept optional memoryManager');
  it('should auto-write conversation on handleMessage');
  it('should fallback to SimpleMemoryStorage when no memoryManager');
  it('should not block on memory write failure');
  it('should initialize memory system when enabled=true');
  it('should skip memory initialization when enabled=false');
});
```

**验收标准**:
- [ ] Gateway 接收 memoryManager
- [ ] handleMessage 自动写入记忆
- [ ] 向后兼容（无 memoryManager）
- [ ] src/index.ts 初始化记忆系统
- [ ] 集成测试通过

---

## Phase 3: 可选注入（1h）

### T3.1: Agent 可选注入记忆上下文

| 属性 | 值 |
|------|-----|
| **时间** | 1h |
| **依赖** | T1.1（可并行） |
| **TDD** | 🔴 测试先行 |
| **优先级** | P1 |

**文件路径**:
- 修改: `src/core/agent/index.ts`
- 新建: `tests/unit/agent/memory-inject.test.ts`

**改动内容**:

```typescript
// src/core/agent/index.ts
export interface MiniclawAgentOptions {
  systemPrompt?: string;
  tools?: AgentTool[];
  agentId?: string;
  isSubagent?: boolean;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  memoryManager?: MemoryManager;  // 新增
}

export class MiniclawAgent {
  private memoryManager?: MemoryManager;
  
  constructor(config: Config, options?: MiniclawAgentOptions) {
    this.memoryManager = options?.memoryManager;
  }
  
  async chat(content: string): Promise<{ content: string }> {
    let systemPrompt = this.basePrompt;
    
    // 可选注入（配置开关）
    if (this.memoryManager && this.config.memory?.injectContext) {
      try {
        const memories = await this.memoryManager.search(content, { limit: 3 });
        if (memories.length > 0) {
          systemPrompt += `\n\n<memory_context>\n${memories.map(m => m.entry.content).join('\n')}\n</memory_context>`;
        }
      } catch (e) {
        // 静默降级，不阻断
      }
    }
    
    // 调用 LLM
    // ...
  }
}
```

**测试用例**:

```typescript
// tests/unit/agent/memory-inject.test.ts
describe('Agent memory inject', () => {
  it('should inject memory context when injectContext=true');
  it('should not inject when injectContext=false');
  it('should not inject when no memoryManager');
  it('should not block on search failure');
  it('should limit to 3 memories');
});
```

**验收标准**:
- [ ] Agent 接收 memoryManager
- [ ] injectContext 开关工作
- [ ] 注入格式正确
- [ ] 失败不阻断
- [ ] 测试通过

---

## Phase 4: 性能优化（3h）

### T4.1: 写入性能测试

| 属性 | 值 |
|------|-----|
| **时间** | 2h |
| **依赖** | T2.2 |
| **TDD** | 🟡 性能测试 |
| **优先级** | P1 |

**文件路径**:
- 新建: `tests/performance/memory-write-perf.test.ts`

**测试内容**:

```typescript
// tests/performance/memory-write-perf.test.ts
describe('Memory write performance', () => {
  it('should complete write in < 50ms', async () => {
    const start = Date.now();
    await memoryManager.write('test content', 'session-1');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
  
  it('should handle 100 concurrent writes', async () => {
    const promises = Array(100).fill(0).map((_, i) => 
      memoryManager.write(`content ${i}`, 'session-1')
    );
    const start = Date.now();
    await Promise.all(promises);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000); // 平均每条 < 50ms
  });
});
```

**验收标准**:
- [ ] 单次写入 < 50ms
- [ ] 100 并发写入 < 5s
- [ ] 性能测试通过

---

### T4.2: 搜索性能测试

| 属性 | 值 |
|------|-----|
| **时间** | 1h |
| **依赖** | 无（独立） |
| **TDD** | 🟡 性能测试 |
| **优先级** | P1 |

**文件路径**:
- 新建: `tests/performance/memory-search-perf.test.ts`

**测试内容**:

```typescript
// tests/performance/memory-search-perf.test.ts
describe('Memory search performance', () => {
  it('should complete search in < 200ms', async () => {
    // 预先写入 100 条记忆
    for (let i = 0; i < 100; i++) {
      await memoryManager.write(`memory content ${i}`, 'session-1');
    }
    
    const start = Date.now();
    const results = await memoryManager.search('memory');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});
```

**验收标准**:
- [ ] 100 条记忆搜索 < 200ms
- [ ] 性能测试通过

---

## Phase 5: 文档验收（3h）

### T5.1: 更新 README.md

| 属性 | 值 |
|------|-----|
| **时间** | 1h |
| **依赖** | T1-T4 |
| **TDD** | 无 |
| **优先级** | P2 |

**文件路径**:
- 修改: `README.md`

**改动内容**:

新增「记忆系统配置」章节：

```markdown
## 记忆系统配置

miniclaw 支持可选的双层记忆系统。

### 启用记忆系统

在 `config.json` 中添加：

```json
{
  "memory": {
    "enabled": true,
    "dir": "~/.miniclaw",
    "defaultImportance": 0.3,
    "injectContext": false
  }
}
```

### 配置项说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| enabled | false | 是否启用记忆系统 |
| dir | ~/.miniclaw | 存储目录 |
| defaultImportance | 0.3 | 默认重要性分数 |
| injectContext | false | 是否注入记忆上下文 |
```

**验收标准**:
- [ ] README 记忆系统章节完整
- [ ] 配置示例正确
- [ ] 说明清晰

---

### T5.2: E2E 测试

| 属性 | 值 |
|------|-----|
| **时间** | 2h |
| **依赖** | T1-T4 |
| **TDD** | 🔴 测试先行 |
| **优先级** | P0 |

**文件路径**:
- 新建: `tests/integration/e2e-memory.test.ts`

**测试内容**:

```typescript
// tests/integration/e2e-memory.test.ts
describe('E2E: Memory system', () => {
  it('should complete full flow: init → write → search → cleanup → persist', async () => {
    // 1. 初始化
    const manager = new MemoryManager({ storageDir: testDir });
    await manager.initialize();
    
    // 2. 写入对话
    await manager.write('User: 我喜欢深色模式', 'session-1');
    await manager.write('Assistant: 已记录您的偏好', 'session-1');
    
    // 3. 搜索
    const results = await manager.search('深色模式');
    expect(results.length).toBeGreaterThan(0);
    
    // 4. 清理
    await manager.cleanup();
    
    // 5. 持久化
    await manager.persist();
    
    // 6. 验证持久化
    const manager2 = new MemoryManager({ storageDir: testDir });
    await manager2.initialize();
    const results2 = await manager2.search('深色模式');
    expect(results2.length).toBeGreaterThan(0);
    
    manager.destroy();
    manager2.destroy();
  });
  
  it('should work with Gateway integration', async () => {
    // 配置启用记忆
    const config = { memory: { enabled: true } };
    const gateway = new MiniclawGateway(config, { memoryManager });
    
    // 发送消息
    const response = await gateway.handleMessage({
      channel: 'cli',
      content: '你好'
    });
    
    // 验证记忆写入
    const memories = await memoryManager.search('你好');
    expect(memories.length).toBeGreaterThan(0);
  });
});
```

**验收标准**:
- [ ] E2E 完整流程通过
- [ ] Gateway 集成测试通过
- [ ] 持久化验证通过

---

## 任务依赖图

```
Phase 1:
  T1.1 ────────┬──→ T1.2 ───→ T1.3
               │
               └────→ T3.1 (可并行)

Phase 2:
  T1.3 ────────→ T2.1 ───→ T2.2

Phase 3:
  T1.1 ────────→ T3.1

Phase 4:
  T2.2 ────────→ T4.1
  (独立) ───────→ T4.2

Phase 5:
  T1-T4 ────────→ T5.1
  T1-T4 ────────→ T5.2

关键路径: T1.1 → T1.2 → T1.3 → T2.1 → T2.2 → T5.2
```

---

## 执行顺序建议

| 顺序 | 任务 | 状态 |
|:----:|:----:|:----:|
| 1 | T1.1 MemoryManager | ⏸️ |
| 2 | T1.2 Config扩展 | ⏸️ |
| 3 | T1.3 错误处理 | ⏸️ |
| 4 | T2.1 AutoMemoryWriter | ⏸️ |
| 5 | T2.2 Gateway集成 | ⏸️ |
| 6 | T3.1 Agent注入（可并行） | ⏸️ |
| 7 | T4.1 写入性能 | ⏸️ |
| 8 | T4.2 搜索性能 | ⏸️ |
| 9 | T5.1 README文档 | ⏸️ |
| 10 | T5.2 E2E测试 | ⏸️ |

---

*生成时间: 2026-04-15*