# Memory System - Implementation Plan

> Generated: 2026-04-14
> Status: Draft
> Based on: clarify.md + Task Phase Priorities

---

## 1. 技术架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Runtime Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ memory_write│  │memory_search│  │ Behavior Rules Engine│  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼──────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Memory Core Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Memory Store│  │ Index Engine│  │  Relevance Scorer   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼──────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                             │
│  ┌─────────────────────┐  ┌─────────────────────────────┐   │
│  │ Short-term Memory   │  │    Long-term Memory         │   │
│  │ (Session-based)     │  │    (Vector Store + MD)      │   │
│  └─────────────────────┘  └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈选型

| 组件 | 技术选择 | 理由 |
|------|----------|------|
| 向量存储 | OpenClaw 内置向量库 | 与现有系统无缝集成 |
| 文档存储 | Markdown (.md) | 人类可读、版本控制友好 |
| 嵌入模型 | 复用 Agent 当前模型 | 无额外依赖、一致性保证 |
| 索引结构 | 内存 + 文件持久化 | 快速检索 + 可靠存储 |
| 相似度算法 | 余弦相似度 | 标准向量检索方案 |

### 1.3 数据流

```
User Message → Importance Check → Memory Entry → Vector Index
                    ↓                                      ↓
              Filter Out?                           Embedding Store
                    ↓                                      ↓
              Discard                               Memory Files (MD)
```

---

## 2. 模块划分

### 2.1 核心模块

| 模块 | 职责 | 依赖 |
|------|------|------|
| `memory-write` | 记忆写入、去重、分类 | memory-store, embedding |
| `memory-search` | 语义检索、相关性排序 | memory-store, vector-index |
| `memory-store` | 存储抽象层，管理短期/长期记忆 | file-system, vector-db |
| `vector-index` | 向量索引管理、相似度计算 | embedding-service |
| `behavior-rules` | 行为规则注入、触发器管理 | memory-search, agent-runtime |
| `auto-write` | 自动写入触发、重要性判断 | memory-write, session-monitor |

### 2.2 接口定义

```typescript
// memory-write 接口
interface MemoryWriteInput {
  content: string;           // 记忆内容
  type: 'short-term' | 'long-term';  // 记忆类型
  metadata?: {
    sessionId?: string;      // 会话ID
    timestamp?: Date;        // 时间戳
    source?: string;         // 来源渠道
    importance?: number;     // 重要性评分 (0-1)
    tags?: string[];         // 标签
  };
}

interface MemoryWriteOutput {
  id: string;                // 记忆ID
  status: 'created' | 'updated' | 'skipped';  // 状态
  reason?: string;           // 跳过原因
}

// memory-search 接口
interface MemorySearchInput {
  query: string;             // 搜索查询
  limit?: number;            // 结果数量限制 (默认 5, 最大 20)
  types?: ('short-term' | 'long-term')[];  // 搜索范围
  timeRange?: {              // 时间范围
    start?: Date;
    end?: Date;
  };
  minScore?: number;         // 最小相关性阈值 (默认 0.5)
}

interface MemorySearchResult {
  id: string;
  content: string;
  score: number;             // 相关性评分
  type: 'short-term' | 'long-term';
  timestamp: Date;
  context?: string;          // 上下文片段
}

// 行为规则接口
interface BehaviorRule {
  id: string;
  trigger: {
    type: 'keyword' | 'intent' | 'schedule';
    pattern: string | RegExp;
  };
  action: {
    type: 'search' | 'write' | 'inject';
    params: Record<string, any>;
  };
  priority: number;         // 执行优先级
}
```

---

## 3. 实现步骤（按 Phase 排序）

### Phase 1: memory_write 工具（P1）

**目标**: 实现基础记忆写入能力

#### 3.1.1 测试用例（TDD）

```typescript
describe('memory_write', () => {
  // TC-1.1: 基础写入
  it('should write memory entry successfully', async () => {
    const result = await memory_write({
      content: 'User prefers dark mode in all apps',
      type: 'long-term'
    });
    expect(result.status).toBe('created');
    expect(result.id).toBeDefined();
  });

  // TC-1.2: 去重检测
  it('should skip duplicate content', async () => {
    await memory_write({ content: 'User likes Python', type: 'long-term' });
    const result = await memory_write({ content: 'User likes Python', type: 'long-term' });
    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('duplicate');
  });

  // TC-1.3: 语义去重
  it('should detect semantic duplicates', async () => {
    await memory_write({ content: 'User prefers morning meetings', type: 'long-term' });
    const result = await memory_write({ 
      content: 'User likes meetings in the morning', 
      type: 'long-term' 
    });
    expect(result.status).toBe('skipped');
  });

  // TC-1.4: 元数据存储
  it('should store metadata correctly', async () => {
    const result = await memory_write({
      content: 'Test content',
      type: 'short-term',
      metadata: { sessionId: 'test-123', tags: ['test'] }
    });
    const entry = await memory_get(result.id);
    expect(entry.metadata.sessionId).toBe('test-123');
  });

  // TC-1.5: 敏感信息过滤
  it('should filter sensitive content', async () => {
    const result = await memory_write({
      content: 'My password is secret123',
      type: 'long-term'
    });
    expect(result.status).toBe('skipped');
    expect(result.reason).toContain('sensitive');
  });
});
```

#### 3.1.2 实现步骤

| 步骤 | 任务 | 估计时间 | 依赖 |
|------|------|----------|------|
| 1.1 | 实现 MemoryStore 基础类 | 2h | - |
| 1.2 | 实现 EmbeddingService 集成 | 1h | 1.1 |
| 1.3 | 实现语义相似度计算 | 2h | 1.2 |
| 1.4 | 实现去重逻辑 | 2h | 1.3 |
| 1.5 | 实现敏感信息检测 | 1h | 1.1 |
| 1.6 | 实现 memory_write 工具接口 | 2h | 1.4, 1.5 |
| 1.7 | 编写单元测试并验证 | 2h | 1.6 |
| 1.8 | 文档编写 | 1h | 1.7 |

**总计**: ~13h

---

### Phase 2: 双层记忆结构（P1）

**目标**: 实现短期记忆和长期记忆的分层存储与管理

#### 3.2.1 测试用例（TDD）

```typescript
describe('dual-layer memory', () => {
  // TC-2.1: 短期记忆存储
  it('should store short-term memory in session scope', async () => {
    await memory_write({
      content: 'Current task: review PR #42',
      type: 'short-term',
      metadata: { sessionId: 'session-123' }
    });
    const results = await memory_search({
      query: 'current task',
      types: ['short-term']
    });
    expect(results).toHaveLength(1);
  });

  // TC-2.2: 长期记忆持久化
  it('should persist long-term memory across sessions', async () => {
    await memory_write({
      content: 'User works at Example Corp',
      type: 'long-term'
    });
    // 模拟新会话
    const results = await memory_search({
      query: 'workplace',
      types: ['long-term']
    });
    expect(results[0].content).toContain('Example Corp');
  });

  // TC-2.3: 短期→长期晋升
  it('should promote short-term to long-term based on importance', async () => {
    await memory_write({
      content: 'User birthday: March 15',
      type: 'short-term',
      metadata: { importance: 0.9 }
    });
    // 触发晋升逻辑
    await memory_promote();
    const results = await memory_search({
      query: 'birthday',
      types: ['long-term']
    });
    expect(results).toHaveLength(1);
  });

  // TC-2.4: 会话隔离
  it('should isolate short-term memories by session', async () => {
    await memory_write({
      content: 'Task A',
      type: 'short-term',
      metadata: { sessionId: 'session-1' }
    });
    await memory_write({
      content: 'Task B',
      type: 'short-term',
      metadata: { sessionId: 'session-2' }
    });
    const results = await memory_search({
      query: 'Task',
      types: ['short-term']
    });
    // 应该能搜到两个会话的记忆
    expect(results.length).toBe(2);
  });

  // TC-2.5: 短期记忆过期
  it('should expire short-term memories after TTL', async () => {
    await memory_write({
      content: 'Temporary note',
      type: 'short-term',
      metadata: { timestamp: Date.now() - 25 * 60 * 60 * 1000 } // 25小时前
    });
    const results = await memory_search({ query: 'Temporary note' });
    expect(results).toHaveLength(0);
  });
});
```

#### 3.2.2 实现步骤

| 步骤 | 任务 | 估计时间 | 依赖 |
|------|------|----------|------|
| 2.1 | 设计双层存储结构 | 2h | Phase 1 |
| 2.2 | 实现短期记忆管理（Session-scoped） | 3h | 2.1 |
| 2.3 | 实现长期记忆持久化 | 3h | 2.1 |
| 2.4 | 实现记忆晋升机制 | 2h | 2.2, 2.3 |
| 2.5 | 实现 TTL 过期清理 | 1h | 2.2 |
| 2.6 | 更新 memory_search 支持双层检索 | 2h | 2.2, 2.3 |
| 2.7 | 编写集成测试 | 2h | 2.6 |
| 2.8 | 文档更新 | 1h | 2.7 |

**总计**: ~16h

---

### Phase 3: memory_search 增强（P2）

**目标**: 增强检索能力，支持混合排序、上下文补充

#### 3.3.1 测试用例（TDD）

```typescript
describe('memory_search enhanced', () => {
  // TC-3.1: 混合排序（相关性 + 时效性）
  it('should rank by combined relevance and recency', async () => {
    await memory_write({ content: 'User likes Python', type: 'long-term' });
    await new Promise(r => setTimeout(r, 100));
    await memory_write({ content: 'User is learning Rust', type: 'long-term' });
    
    const results = await memory_search({ query: 'programming languages' });
    // 较新的记忆应该排在前面（时效性权重）
    expect(results[0].content).toContain('Rust');
  });

  // TC-3.2: 时间范围过滤
  it('should filter by time range', async () => {
    const now = new Date();
    await memory_write({ content: 'Old memory', type: 'long-term' });
    
    const results = await memory_search({
      query: 'memory',
      timeRange: { start: new Date(now.getTime() + 1000) }
    });
    expect(results).toHaveLength(0);
  });

  // TC-3.3: 最小相关性阈值
  it('should respect minimum score threshold', async () => {
    await memory_write({ content: 'User prefers tea', type: 'long-term' });
    
    const results = await memory_search({
      query: 'coffee machines',  // 不相关查询
      minScore: 0.7
    });
    expect(results).toHaveLength(0);
  });

  // TC-3.4: 上下文补充
  it('should include context around matched content', async () => {
    await memory_write({
      content: 'The project uses React for frontend. We chose it for its component model. The backend is Node.js.',
      type: 'long-term'
    });
    
    const results = await memory_search({
      query: 'React',
      includeContext: true,
      contextWindow: 50
    });
    expect(results[0].context).toContain('component model');
  });

  // TC-3.5: 分页支持
  it('should support pagination', async () => {
    for (let i = 0; i < 15; i++) {
      await memory_write({ content: `Memory item ${i}`, type: 'long-term' });
    }
    
    const page1 = await memory_search({ query: 'Memory', limit: 5 });
    const page2 = await memory_search({ query: 'Memory', limit: 5, offset: 5 });
    
    expect(page1).toHaveLength(5);
    expect(page2).toHaveLength(5);
    expect(page1[0].id).not.toBe(page2[0].id);
  });
});
```

#### 3.3.2 实现步骤

| 步骤 | 任务 | 估计时间 | 依赖 |
|------|------|----------|------|
| 3.1 | 实现混合排序算法 | 3h | Phase 2 |
| 3.2 | 实现时间范围过滤 | 2h | Phase 2 |
| 3.3 | 实现相关性阈值过滤 | 1h | Phase 2 |
| 3.4 | 实现上下文提取与补充 | 3h | 3.1 |
| 3.5 | 实现分页机制 | 2h | 3.1 |
| 3.6 | 性能优化（索引优化） | 3h | 3.1-3.5 |
| 3.7 | 编写测试 | 2h | 3.6 |
| 3.8 | 文档更新 | 1h | 3.7 |

**总计**: ~17h

---

### Phase 4: 行为规则注入（P3）

**目标**: 支持可配置的行为规则，自动触发记忆操作

#### 3.4.1 测试用例（TDD）

```typescript
describe('behavior rules', () => {
  // TC-4.1: 关键词触发搜索
  it('should trigger memory search on keyword', async () => {
    await memory_write({ content: 'User API key: sk-xxx', type: 'long-term' });
    
    const rules: BehaviorRule[] = [{
      id: 'api-key-search',
      trigger: { type: 'keyword', pattern: /api key/i },
      action: { type: 'search', params: { query: 'API key' } },
      priority: 1
    }];
    
    const context = await applyBehaviorRules('What is my API key?', rules);
    expect(context.memories).toBeDefined();
    expect(context.memories[0].content).toContain('sk-xxx');
  });

  // TC-4.2: 意图触发写入
  it('should trigger memory write on intent detected', async () => {
    const rules: BehaviorRule[] = [{
      id: 'preference-write',
      trigger: { type: 'intent', pattern: 'preference_statement' },
      action: { type: 'write', params: { type: 'long-term' } },
      priority: 2
    }];
    
    await applyBehaviorRules('I prefer dark mode', rules);
    const results = await memory_search({ query: 'dark mode' });
    expect(results).toHaveLength(1);
  });

  // TC-4.3: 规则优先级
  it('should respect rule priority order', async () => {
    const executionOrder: string[] = [];
    const rules: BehaviorRule[] = [
      { id: 'low', trigger: { type: 'keyword', pattern: /test/ }, action: { type: 'search', params: {} }, priority: 3 },
      { id: 'high', trigger: { type: 'keyword', pattern: /test/ }, action: { type: 'search', params: {} }, priority: 1 },
    ];
    
    await applyBehaviorRules('test', rules);
    // 高优先级规则先执行
    expect(executionOrder[0]).toBe('high');
  });

  // TC-4.4: 定时触发
  it('should support scheduled triggers', async () => {
    const rules: BehaviorRule[] = [{
      id: 'daily-summary',
      trigger: { type: 'schedule', pattern: '0 0 * * *' },
      action: { type: 'inject', params: { template: 'daily-summary' } },
      priority: 1
    }];
    
    // 验证定时任务已注册
    expect(scheduledJobs.has('daily-summary')).toBe(true);
  });
});
```

#### 3.4.2 实现步骤

| 步骤 | 任务 | 估计时间 | 依赖 |
|------|------|----------|------|
| 4.1 | 设计行为规则 DSL | 2h | - |
| 4.2 | 实现规则解析器 | 3h | 4.1 |
| 4.3 | 实现关键词触发器 | 2h | 4.2 |
| 4.4 | 实现意图触发器（与 LLM 集成） | 4h | 4.2 |
| 4.5 | 实现定时触发器 | 2h | 4.2 |
| 4.6 | 实现规则优先级调度 | 2h | 4.3-4.5 |
| 4.7 | 编写测试 | 2h | 4.6 |
| 4.8 | 文档更新 | 1h | 4.7 |

**总计**: ~18h

---

### Phase 5: 自动写入机制（P3）

**目标**: 实现智能自动写入，减少手动记忆负担

#### 3.5.1 测试用例（TDD）

```typescript
describe('auto-write mechanism', () => {
  // TC-5.1: 会话结束自动写入
  it('should auto-write on session end', async () => {
    const session = createSession();
    session.addMessage('user', 'My name is Alice');
    session.addMessage('assistant', 'Nice to meet you, Alice!');
    
    await session.end();
    
    const results = await memory_search({ query: 'name' });
    expect(results.some(r => r.content.includes('Alice'))).toBe(true);
  });

  // TC-5.2: 重要性判断
  it('should evaluate content importance', async () => {
    const importantContent = 'I am allergic to peanuts';
    const trivialContent = 'The weather is nice today';
    
    const importantScore = await evaluateImportance(importantContent);
    const trivialScore = await evaluateImportance(trivialContent);
    
    expect(importantScore).toBeGreaterThan(0.7);
    expect(trivialScore).toBeLessThan(0.3);
  });

  // TC-5.3: 增量写入（阈值触发）
  it('should trigger incremental write on threshold', async () => {
    const session = createSession();
    for (let i = 0; i < 10; i++) {
      session.addMessage('user', `Message ${i}`);
    }
    
    // 达到消息阈值后应触发自动写入
    const writeCount = getAutoWriteCount(session.id);
    expect(writeCount).toBeGreaterThan(0);
  });

  // TC-5.4: 排除临时性内容
  it('should exclude temporary content from auto-write', async () => {
    const session = createSession();
    session.addMessage('user', 'What time is it?');
    session.addMessage('assistant', 'It is 3:00 PM.');
    
    await session.end();
    
    const results = await memory_search({ query: '3:00 PM' });
    expect(results).toHaveLength(0);
  });

  // TC-5.5: 手动命令覆盖
  it('should respect manual /remember command', async () => {
    const session = createSession();
    session.addMessage('user', '/remember I prefer tab indentation');
    
    await processCommands(session);
    
    const results = await memory_search({ query: 'indentation' });
    expect(results).toHaveLength(1);
  });
});
```

#### 3.5.2 实现步骤

| 步骤 | 任务 | 估计时间 | 依赖 |
|------|------|----------|------|
| 5.1 | 实现重要性评估模型 | 4h | Phase 1 |
| 5.2 | 实现会话状态监控 | 3h | Phase 2 |
| 5.3 | 实现阈值触发器 | 2h | 5.2 |
| 5.4 | 实现增量写入策略 | 3h | 5.1, 5.3 |
| 5.5 | 实现临时内容过滤 | 2h | 5.1 |
| 5.6 | 实现手动命令 (`/remember`) | 2h | Phase 1 |
| 5.7 | 编写集成测试 | 3h | 5.4-5.6 |
| 5.8 | 文档更新 | 1h | 5.7 |

**总计**: ~20h

---

## 4. 依赖关系图

```
Phase 1 (memory_write)
    │
    ├──► Phase 2 (双层结构)
    │       │
    │       └──► Phase 3 (search 增强)
    │               │
    │               └──► Phase 4 (行为规则) ──► Phase 5 (自动写入)
    │                       │
    │                       └──► Phase 5 (自动写入)
    │
    └──► Phase 5 (自动写入) [重要性评估依赖 Phase 1]
```

### 关键路径

```
Phase 1 → Phase 2 → Phase 3 → Phase 5 (主路径)
Phase 1 → Phase 4 → Phase 5 (并行路径)
```

### 并行可能性

- Phase 2 和 Phase 4 可以并行开发（都只依赖 Phase 1）
- Phase 3 和 Phase 5 的部分工作可以并行

---

## 5. 时间估算

| Phase | 估计工时 | 优先级 | 并行可能性 |
|-------|----------|--------|------------|
| Phase 1: memory_write | 13h | P1 | 独立 |
| Phase 2: 双层结构 | 16h | P1 | 需 Phase 1 |
| Phase 3: search 增强 | 17h | P2 | 需 Phase 2 |
| Phase 4: 行为规则 | 18h | P3 | 可与 Phase 2 并行 |
| Phase 5: 自动写入 | 20h | P3 | 需 Phase 1, 可与 Phase 3 并行 |

**关键路径总工时**: ~66h (Phase 1 → 2 → 3 → 5)
**并行优化后**: ~50h

---

## 6. 里程碑

| 里程碑 | 交付物 | 完成标准 |
|--------|--------|----------|
| M1 | 基础记忆系统 | Phase 1 完成，可手动写入记忆 |
| M2 | 双层记忆 | Phase 2 完成，支持短期/长期分层 |
| M3 | 智能检索 | Phase 3 完成，搜索体验优化 |
| M4 | 自动化记忆 | Phase 4-5 完成，全自动记忆管理 |

---

## 7. 下一步行动

1. **Review**: 团队评审本计划
2. **Tasks**: 使用 `/speckit.tasks` 生成详细任务清单
3. **Implement**: 开始 Phase 1 实现（TDD 模式）

---

*此文档由 /speckit.plan 生成，需要人工审核和调整。*