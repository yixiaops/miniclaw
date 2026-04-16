# 需求规格: 双层记忆系统集成到主流程

## 元数据

| 属性 | 值 |
|------|-----|
| 版本 | 1.0 |
| 创建日期 | 2026-04-15 |
| 状态 | 待实现 |
| 优先级 | 高 |
| 关联 | 003-memory-search |

---

## 1. 需求分析

### 1.1 背景

当前 miniclaw 项目存在双层记忆系统的实现，但未集成到主流程：

**已实现（src/memory/）:**
- `ShortTermMemory` - 短期记忆存储，支持 Session 隔离和 TTL 过期
- `LongTermMemory` - 长期记忆持久化，支持文件存储和加载
- `MemoryPromoter` - 短期记忆晋升为长期记忆
- `TTLManager` - TTL 过期清理
- `MemorySearchTool` - 双层合并检索
- `MemoryWriteTool` - 记忆写入（含敏感检测和去重）

**未集成（主流程）:**
- `Gateway (src/core/gateway/index.ts)` - 使用 SimpleMemoryStorage（单层、内存级）
- `Agent (src/core/agent/index.ts)` - 不引用新记忆模块
- `memory_search/memory_get 工具` - 使用旧的 MemorySearchManager
- `src/index.ts` - 未初始化记忆组件

### 1.2 当前架构分析

#### Gateway 当前实现

```typescript
// src/core/gateway/index.ts
export class MiniclawGateway {
  private storage: SimpleMemoryStorage;  // ❌ 单层存储
  
  constructor(config: Config, gatewayConfig: GatewayConfig) {
    // ...
    this.storage = new SimpleMemoryStorage(gatewayConfig.storageDir);
  }
  
  async initialize(): Promise<void> {
    // 从 SimpleMemoryStorage 加载 session 历史
    const sessionKeys = await this.storage.listSessions();
    // ...
  }
  
  async handleMessage(ctx: MessageContext): Promise<Response> {
    // ...
    // 保存对话历史到 SimpleMemoryStorage
    await this.saveSessionHistory(session);
  }
}
```

**问题:**
1. SimpleMemoryStorage 是单层存储，不支持重要性分级
2. 无晋升机制，所有记忆都在内存级
3. 无 TTL 管理，历史无限积累

#### Agent 当前实现

```typescript
// src/core/agent/index.ts
export class MiniclawAgent {
  constructor(config: Config, options?: MiniclawAgentOptions) {
    // ...
    // ❌ 不接收 memoryManager 参数
  }
}
```

**问题:**
1. Agent 无法访问双层记忆系统
2. 无法在系统提示词中注入记忆上下文

#### memory_search 工具当前实现

```typescript
// src/tools/memory-search.ts
export const memorySearchTool = {
  async execute(_toolCallId: string, params: MemorySearchParams) {
    const manager = new MemorySearchManager(storageDir);  // ❌ 使用旧版
    const results = await manager.search(params.query, {...});
    // ...
  }
};
```

**问题:**
1. MemorySearchManager 是基于 SimpleMemoryStorage 的简单搜索
2. 未使用新的 MemorySearchTool（双层检索）

### 1.3 目标

1. **Gateway 集成**: 替换 SimpleMemoryStorage → 双层记忆系统
2. **Agent 集成**: 构造函数接收 memoryManager，可在系统提示词中注入记忆
3. **工具替换**: memory_search 使用 MemorySearchTool
4. **初始化流程**: src/index.ts 初始化并传递记忆组件

---

## 2. 功能设计

### 2.1 核心概念

**MemoryManager（新建）:**
- 统一管理双层记忆系统的入口
- 整合 ShortTermMemory、LongTermMemory、MemoryPromoter、TTLManager
- 提供 write/search/promote/cleanup 等 API

**数据流:**

```
启动时 (src/index.ts)
    │
    ├─→ 创建 SessionManager
    ├─→ 创建 ShortTermMemory(sessionManager)
    ├─→ 创建 LongTermMemory(storageDir)
    ├─→ 创建 EmbeddingService
    ├─→ 创建 MemoryPromoter(shortTerm, longTerm)
    ├─→ 创建 TTLManager(shortTerm, promoter)
    ├─→ 创建 MemoryManager(上述所有组件)
    │
    ├─→ 加载长期记忆：longTerm.load()
    ├─→ 启动 TTL 清理：ttlManager.schedule(interval)
    │
    └─→ 创建 Gateway 时传递 memoryManager
            │
            ▼
Gateway (src/core/gateway/index.ts)
    │
    ├─→ 保存 memoryManager 引用
    ├─→ handleMessage 时：
    │   ├─→ 写入短期记忆：memoryManager.write(content, sessionId)
    │   └─→ 保存到 session history（保留现有逻辑）
    │
    └─→ 创建 Agent 时传递 memoryManager
            │
            ▼
Agent (src/core/agent/index.ts)
    │
    ├─→ 保存 memoryManager 引用
    ├─→ 构建系统提示词时可注入记忆上下文
    │
    └─→ 注册 memory_search 工具（使用 MemorySearchTool）
```

### 2.2 MemoryManager 设计

```typescript
/**
 * 记忆管理器配置
 */
interface MemoryManagerConfig {
  /** 存储目录 */
  storageDir: string;
  /** 默认 TTL（毫秒） */
  defaultTTL?: number;
  /** TTL 清理间隔（毫秒） */
  cleanupInterval?: number;
  /** 晋升重要性阈值 */
  promotionThreshold?: number;
}

/**
 * 记忆管理器
 *
 * 统一管理双层记忆系统。
 */
class MemoryManager {
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private promoter: MemoryPromoter;
  private ttlManager: TTLManager;
  private searchTool: MemorySearchTool;
  private writeTool: MemoryWriteTool;
  private sessionManager: SessionManager;
  
  constructor(config: MemoryManagerConfig);
  
  // 初始化
  async initialize(): Promise<void>;
  
  // 写入
  async write(content: string, sessionId: string, metadata?: MemoryMetadata): Promise<string>;
  
  // 搜索
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  
  // 晋升
  async promote(shortId: string): Promise<string | null>;
  async promoteAll(): Promise<string[]>;
  
  // 清理
  async cleanup(): Promise<CleanupResult>;
  
  // 持久化
  async persist(): Promise<void>;
  
  // 状态
  getStatus(): MemoryStatus;
  
  // 销毁
  destroy(): void;
}
```

### 2.3 Gateway 改造

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
  private memoryManager?: MemoryManager;  // 新增
  
  constructor(config: Config, gatewayConfig: GatewayConfig) {
    // ...
    // 接收 memoryManager（可选，兼容旧逻辑）
    this.memoryManager = gatewayConfig.memoryManager;
    
    // 如果没有 memoryManager，使用 SimpleMemoryStorage（向后兼容）
    if (!this.memoryManager) {
      this.storage = new SimpleMemoryStorage(gatewayConfig.storageDir);
    }
  }
  
  async handleMessage(ctx: MessageContext): Promise<Response> {
    // ...
    // 写入短期记忆（如果启用）
    if (this.memoryManager) {
      await this.memoryManager.write(ctx.content, sessionId, {
        source: ctx.channel,
        importance: 0.3  // 默认重要性
      });
    }
    // ...
  }
}
```

### 2.4 Agent 改造

```typescript
// src/core/agent/index.ts

export interface MiniclawAgentOptions {
  // ... 现有选项 ...
  memoryManager?: MemoryManager;  // 新增
}

export class MiniclawAgent {
  private memoryManager?: MemoryManager;  // 新增
  
  constructor(config: Config, options?: MiniclawAgentOptions) {
    // ...
    this.memoryManager = options?.memoryManager;
  }
  
  // 可选：注入记忆上下文到系统提示词
  private buildMemoryContext(): string | undefined {
    if (!this.memoryManager) return undefined;
    
    // 搜索相关记忆
    // ...
  }
}
```

### 2.5 memory_search 工具改造

```typescript
// src/tools/memory-search.ts（改造）

export const memorySearchTool = {
  name: 'memory_search',
  description: `搜索对话历史和知识库...`,
  
  // 使用 MemoryManager 的 search 方法
  async execute(_toolCallId: string, params: MemorySearchParams, context?: { memoryManager?: MemoryManager }) {
    const manager = context?.memoryManager;
    if (!manager) {
      // 兼容：使用旧版 MemorySearchManager
      const oldManager = new MemorySearchManager(storageDir);
      return oldManager.search(params.query, {...});
    }
    
    // 使用双层检索
    const results = await manager.search(params.query, {
      limit: params.maxResults,
      types: params.sources?.map(s => s === 'sessions' ? 'short-term' : 'long-term')
    });
    
    // 转换格式
    return results.map(r => ({
      path: r.entry.type === 'short-term' 
        ? `sessions/${r.entry.metadata.sessionId}.json`
        : 'memory/MEMORY.md',
      snippet: r.entry.content,
      score: r.score
    }));
  }
};
```

---

## 3. 技术实现

### 3.1 新建 MemoryManager

**文件**: `src/memory/manager.ts` (新建)

```typescript
/**
 * @fileoverview 记忆管理器
 *
 * 统一管理双层记忆系统，提供简化 API。
 *
 * @module memory/manager
 */

import { ShortTermMemory } from './store/short-term.js';
import { LongTermMemory } from './store/long-term.js';
import { SessionManager } from './store/session-manager.js';
import { TTLManager } from './store/ttl-manager.js';
import { MemoryPromoter } from './promotion/promoter.js';
import { MemorySearchTool } from './tools/search.js';
import { MemoryWriteTool } from './tools/write.js';
import { EmbeddingService } from './embedding/index.js';
import { DeduplicationChecker } from './write/deduplication.js';
import { SensitiveDetector } from './write/sensitive-detector.js';
import type { MemoryMetadata, SearchResult, SearchOptions } from './store/interface.js';

/**
 * 记忆管理器配置
 */
export interface MemoryManagerConfig {
  /** 存储目录 */
  storageDir: string;
  /** 默认 TTL（毫秒），默认 24h */
  defaultTTL?: number;
  /** TTL 清理间隔（毫秒），默认 1h */
  cleanupInterval?: number;
  /** 晋升重要性阈值，默认 0.5 */
  promotionThreshold?: number;
}

/**
 * 记忆状态
 */
export interface MemoryStatus {
  /** 短期记忆总数 */
  shortTermCount: number;
  /** 长期记忆总数 */
  longTermCount: number;
  /** 各 Session 记忆数 */
  bySession: Record<string, number>;
  /** 平均重要性 */
  avgImportance: number;
  /** TTL 管理器是否运行 */
  ttlRunning: boolean;
}

/**
 * MemoryManager 类
 *
 * 统一管理双层记忆系统的入口。
 */
export class MemoryManager {
  private sessionManager: SessionManager;
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private promoter: MemoryPromoter;
  private ttlManager: TTLManager;
  private searchTool: MemorySearchTool;
  private writeTool: MemoryWriteTool;
  private embeddingService: EmbeddingService;
  private config: MemoryManagerConfig;

  constructor(config: MemoryManagerConfig) {
    this.config = config;
    
    // 初始化所有组件
    this.sessionManager = new SessionManager();
    this.shortTerm = new ShortTermMemory(this.sessionManager);
    this.longTerm = new LongTermMemory(config.storageDir);
    this.embeddingService = new EmbeddingService();
    
    const dedupChecker = new DeduplicationChecker(this.embeddingService);
    const sensitiveDetector = new SensitiveDetector();
    
    this.writeTool = new MemoryWriteTool(this.shortTerm, dedupChecker, sensitiveDetector);
    this.promoter = new MemoryPromoter(this.shortTerm, this.longTerm);
    this.ttlManager = new TTLManager(this.shortTerm, this.promoter);
    this.searchTool = new MemorySearchTool(this.shortTerm, this.longTerm, this.embeddingService);
    
    // 设置阈值
    if (config.promotionThreshold) {
      this.promoter.setThreshold(config.promotionThreshold);
    }
    
    if (config.defaultTTL) {
      this.ttlManager.setDefaultTTL(config.defaultTTL);
    }
  }

  /**
   * 初始化记忆系统
   *
   * 加载长期记忆，启动 TTL 清理。
   */
  async initialize(): Promise<void> {
    // 加载长期记忆
    await this.longTerm.load();
    
    // 启动 TTL 清理
    const interval = this.config.cleanupInterval || 3600000; // 1h
    this.ttlManager.schedule(interval);
  }

  /**
   * 写入记忆
   */
  async write(content: string, sessionId: string, metadata?: MemoryMetadata): Promise<string> {
    return this.shortTerm.write(content, sessionId, metadata);
  }

  /**
   * 搜索记忆
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return this.searchTool.search({
      query,
      limit: options?.limit,
      types: options?.types
    });
  }

  /**
   * 晋升指定记忆
   */
  async promote(shortId: string): Promise<string | null> {
    return this.promoter.promote(shortId);
  }

  /**
   * 晋升所有符合条件的记忆
   */
  async promoteAll(): Promise<string[]> {
    return this.promoter.promoteAll();
  }

  /**
   * 执行 TTL 清理
   */
  async cleanup(): Promise<{ expired: number; promoted: number; cleaned: number }> {
    return this.ttlManager.cleanup();
  }

  /**
   * 持久化长期记忆
   */
  async persist(): Promise<void> {
    await this.longTerm.persist();
  }

  /**
   * 获取状态
   */
  getStatus(): MemoryStatus {
    const shortStats = this.shortTerm.getStats();
    const longStats = this.longTerm.getStats();
    
    return {
      shortTermCount: shortStats.total,
      longTermCount: longStats.total,
      bySession: shortStats.bySession,
      avgImportance: longStats.avgImportance,
      ttlRunning: this.ttlManager.isRunning()
    };
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    this.ttlManager.stop();
    this.shortTerm.clear();
    this.longTerm.clear();
  }
}
```

### 3.2 修改 src/index.ts

```typescript
// src/index.ts

import { MemoryManager } from './memory/manager.js';

async function main() {
  // ... 现有初始化代码 ...
  
  // 初始化记忆系统
  console.log('\n初始化记忆系统...');
  const memoryManager = new MemoryManager({
    storageDir: config.memory?.dir || join(process.env.HOME || '', '.miniclaw'),
    defaultTTL: config.memory?.defaultTTL || 24 * 60 * 60 * 1000, // 24h
    cleanupInterval: config.memory?.cleanupInterval || 3600000, // 1h
    promotionThreshold: config.memory?.promotionThreshold || 0.5
  });
  
  await memoryManager.initialize();
  console.log('记忆系统初始化完成');
  
  // 创建 Agent 工厂函数（添加 memoryManager 参数）
  const createAgentFn = createAgentFactory(
    registry, 
    subagentManager, 
    promptManager, 
    preloadedPrompts, 
    skillManager,
    memoryManager  // 新增
  );
  
  // 创建 Gateway
  const gateway = new MiniclawGateway(config, {
    createAgentFn,
    maxAgents: config.agents?.defaults.maxConcurrent,
    memoryManager  // 新增：传递记忆管理器
  });
  
  // ... 后续代码 ...
  
  // 关闭时持久化
  process.on('SIGINT', async () => {
    console.log('\n正在关闭...');
    await memoryManager.persist();
    memoryManager.destroy();
    // ...
  });
}
```

### 3.3 修改 Gateway

**文件**: `src/core/gateway/index.ts`

主要改动：

1. 接收 `memoryManager` 参数
2. `handleMessage` 中写入短期记忆
3. 更新 `GatewayConfig` 接口
4. 保持向后兼容（无 memoryManager 时使用 SimpleMemoryStorage）

### 3.4 修改 Agent

**文件**: `src/core/agent/index.ts`

主要改动：

1. 接收 `memoryManager` 参数
2. 更新 `MiniclawAgentOptions` 接口
3. 可选：在系统提示词中注入记忆上下文

### 3.5 替换 memory_search 工具

**文件**: `src/tools/memory-search.ts`

主要改动：

1. 支持通过 context 接收 memoryManager
2. 使用 MemorySearchTool 的 search 方法
3. 转换结果格式以兼容现有接口
4. 保持向后兼容（无 memoryManager 时使用旧版）

### 3.6 更新工具注册

**文件**: `src/tools/index.ts`

```typescript
// 注册 memory_search 工具时传递 memoryManager
if (memoryManager) {
  agent.registerTool({
    name: 'memory_search',
    // ...
    execute: async (id, params) => {
      return memorySearchTool.execute(id, params, { memoryManager });
    }
  });
}
```

---

## 4. 测试策略

### 4.1 TDD 流程

按照 TDD 模式，测试先行：

1. **编写 MemoryManager 测试** (`tests/unit/memory/manager.test.ts`)
   - 测试初始化流程
   - 测试 write/search/promote
   - 测试 cleanup 和 persist

2. **编写 Gateway 集成测试** (`tests/unit/core/gateway/index.test.ts`)
   - 测试 memoryManager 注入
   - 测试 handleMessage 写入记忆
   - 测试向后兼容（无 memoryManager）

3. **编写 Agent 集成测试** (`tests/unit/core/agent/index.test.ts`)
   - 测试 memoryManager 注入
   - 测试记忆上下文注入（可选）

4. **编写 E2E 测试** (`tests/integration/memory-integration.test.ts`)
   - 测试完整流程：启动 → 写入 → 搜索 → 晋升 → 持久化 → 关闭

### 4.2 测试用例设计

```typescript
// tests/unit/memory/manager.test.ts

describe('MemoryManager', () => {
  it('should initialize all components', async () => {
    const manager = new MemoryManager({ storageDir: testDir });
    await manager.initialize();
    
    expect(manager.getStatus().ttlRunning).toBe(true);
  });
  
  it('should write and search', async () => {
    const manager = new MemoryManager({ storageDir: testDir });
    await manager.initialize();
    
    await manager.write('User prefers dark mode', 'session-1');
    
    const results = await manager.search('dark mode');
    expect(results.length).toBe(1);
  });
  
  it('should promote important memories', async () => {
    const manager = new MemoryManager({ storageDir: testDir, promotionThreshold: 0.7 });
    await manager.initialize();
    
    const id = await manager.write('Important decision', 'session-1', { importance: 0.8 });
    const promoted = await manager.promote(id);
    
    expect(promoted).toBeDefined();
  });
  
  it('should cleanup expired memories', async () => {
    const manager = new MemoryManager({ storageDir: testDir, defaultTTL: 100 });
    await manager.initialize();
    
    await manager.write('Temporary', 'session-1', { importance: 0.2, ttl: 100 });
    await sleep(150);
    
    const result = await manager.cleanup();
    expect(result.cleaned).toBe(1);
  });
  
  it('should persist and restore', async () => {
    const manager = new MemoryManager({ storageDir: testDir });
    await manager.initialize();
    
    await manager.write('Persistent', 'session-1', { importance: 0.9 });
    await manager.promoteAll();
    await manager.persist();
    
    // 新实例加载
    const manager2 = new MemoryManager({ storageDir: testDir });
    await manager2.initialize();
    
    const results = await manager2.search('Persistent');
    expect(results.length).toBe(1);
  });
});
```

---

## 5. 向后兼容

### 5.1 无 memoryManager 场景

如果不传入 memoryManager，Gateway 和工具应保持原有行为：

```typescript
// Gateway 向后兼容
if (!this.memoryManager) {
  this.storage = new SimpleMemoryStorage(gatewayConfig.storageDir);
}

// 工具向后兼容
if (!context?.memoryManager) {
  const oldManager = new MemorySearchManager(storageDir);
  return oldManager.search(query, options);
}
```

### 5.2 配置扩展

在 Config 中添加可选的 memory 配置：

```typescript
// src/core/config.ts

interface MemoryConfig {
  /** 是否启用双层记忆（默认 false，向后兼容） */
  enabled?: boolean;
  /** 存储目录 */
  dir?: string;
  /** 默认 TTL */
  defaultTTL?: number;
  /** 清理间隔 */
  cleanupInterval?: number;
  /** 晋升阈值 */
  promotionThreshold?: number;
}

interface Config {
  // ... 现有配置 ...
  memory?: MemoryConfig;
}
```

---

## 6. 影响范围

### 6.1 直接影响

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/memory/manager.ts` | 新建 | MemoryManager 统一入口 |
| `src/index.ts` | 修改 | 初始化 MemoryManager，传递给 Gateway |
| `src/core/gateway/index.ts` | 修改 | 接收 memoryManager，写入记忆 |
| `src/core/agent/index.ts` | 修改 | 接收 memoryManager（可选） |
| `src/tools/memory-search.ts` | 修改 | 使用 MemorySearchTool |
| `src/core/config.ts` | 修改 | 添加 MemoryConfig |
| `tests/unit/memory/manager.test.ts` | 新建 | MemoryManager 单元测试 |
| `tests/integration/memory-integration.test.ts` | 新建 | E2E 测试 |

### 6.2 间接影响

- **记忆写入**: 每条消息都会写入短期记忆（重要性可配置）
- **搜索行为**: 使用双层检索，结果来源更丰富
- **持久化**: 长期记忆写入 MEMORY.md 和 long-term.json

---

## 7. 验收标准

- [ ] MemoryManager 类实现并通过单元测试
- [ ] Gateway 正确接收和使用 memoryManager
- [ ] Agent 正确接收 memoryManager（可选功能）
- [ ] memory_search 工具使用双层检索
- [ ] src/index.ts 正确初始化记忆系统
- [ ] 向后兼容：无 memoryManager 时原有功能正常
- [ ] E2E 测试通过：完整流程正常
- [ ] 文档更新：README.md 记录记忆系统使用方法

---

## 8. 后续优化

1. **记忆上下文注入**: Agent 可根据当前对话搜索相关记忆，注入系统提示词
2. **重要性自动评估**: 根据对话内容自动评估重要性分数
3. **语义搜索**: 使用 Embedding 实现语义相似度检索
4. **记忆摘要**: 长期记忆支持摘要压缩
5. **记忆可视化**: 提供记忆状态统计和可视化 API