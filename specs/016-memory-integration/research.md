# Research: OpenClaw 记忆系统设计参考

> 研究时间: 2026-04-15
> 参考项目: OpenClaw (~/openclaw)

---

## Q1: 记忆上下文注入机制（核心）

### OpenClaw 设计

**插件注册模式**：记忆上下文通过 `buildPromptSection()` 函数注入系统提示词。

#### 关键代码路径

```
记忆注入流程：

extensions/memory-core/index.ts
    │
    │  定义 buildPromptSection()
    │  通过 api.registerMemoryPromptSection() 注册
    │
    ▼
src/memory/prompt-section.ts
    │
    │  管理 module-level singleton _builder
    │  提供 buildMemoryPromptSection() 函数
    │
    ▼
src/agents/system-prompt.ts
    │
    │  调用 buildMemoryPromptSection()
    │  注入记忆部分到系统提示词
    │
    ▼
最终系统提示词包含：
    <memory_context>
    相关记忆内容...
    </memory_context>
```

#### 注入条件

**工具驱动**：记忆内容依赖 `memory_search` 和 `memory_get` 工具可用性。

```typescript
// 如果工具不可用，返回空数组
if (!memory_search || !memory_get) {
  return [];  // 不注入任何记忆
}
```

#### 注入时机

**系统提示词构建时**：在 Agent 初始化或系统提示词重组时注入，不是每次对话。

---

## Q2-Q8: 其他设计决策

### Q2: 记忆写入时机

| 设计点 | OpenClaw 实现 |
|--------|---------------|
| **写入对象** | 用户消息 + Assistant 响应都写入（通过工具调用） |
| **写入方式** | Agent 主动调用 memory_write 工具，不是自动写入 |
| **触发时机** | Agent 决定何时写入（根据对话内容判断重要性） |

**关键差异**：OpenClaw **不自动写入**，Agent 自行决定是否调用 memory_write。

---

### Q3: SimpleMemoryStorage vs 双层记忆

| 存储类型 | OpenClaw 实现 |
|----------|---------------|
| **Session History** | 独立存储，不与记忆系统耦合 |
| **记忆系统** | MEMORY.md + memory/*.md + sessions/*.md |
| **工具检索** | memory_search 工具双层检索 |

**设计**：两套系统并行，Session History 用于对话上下文，记忆系统用于重要信息持久化。

---

### Q4: 默认 importance 分数

**OpenClaw 不使用 importance 分数**。

替代方案：
- `minScore` 阈值（默认 0.35）
- 向量相似度评分
- BM25 FTS 评分

**混合检索权重**：
```
score = vector_weight(0.7) × vector_score 
      + bm25_weight(0.3) × bm25_score
```

---

### Q5: memory_get 工具

| 工具 | 功能 |
|------|------|
| **memory_search** | 搜索记忆，返回匹配结果列表 |
| **memory_get** | 读取特定文件片段（指定 path + from/lines） |

**关系**：
- memory_search 返回搜索结果（path + snippet）
- memory_get 用于读取完整上下文（读取搜索结果周围的更多内容）

**改造建议**：memory_get 继续从文件读取，因为长期记忆持久化在 MEMORY.md。

---

### Q6: 配置默认值

| 配置项 | OpenClaw 默认值 |
|--------|----------------|
| **backend** | `"builtin"`（SQLite vector/FTS） |
| **sources** | `["memory"]`（只搜索 memory/*.md） |
| **sessions** | 需要实验性 flag 开启 |
| **embedding cache** | 默认启用 |

---

### Q7: 性能设计

| 指标 | OpenClaw 实现 |
|------|---------------|
| **Embedding 缓存** | 启用缓存，避免重复计算 |
| **Provider fallback** | openai → gemini → local → voyage → mistral → ollama |
| **降级策略** | FTS-only（向量失败时只用 BM25） |

---

### Q8: 错误处理

| 场景 | OpenClaw 处理 |
|------|---------------|
| **Embedding 失败** | Provider fallback chain |
| **Quota 错误** | 检测并切换到下一个 provider |
| **FTS 失败** | 只用向量检索 |
| **Vector 失败** | 只用 FTS |
| ** Readonly 恢复** | 自动恢复 readonly 状态 |

---

## 关键代码引用

### Q1: 记忆注入

```typescript
// extensions/memory-core/index.ts
api.registerMemoryPromptSection({
  name: 'memory',
  priority: 50,
  build: async (ctx) => {
    const results = await memorySearch(ctx.query);
    return results.map(r => r.snippet);
  }
});

// src/memory/prompt-section.ts
let _builder: MemoryPromptBuilder | null = null;

export function buildMemoryPromptSection(): string[] {
  if (!_builder) return [];
  return _builder.build();
}

// src/agents/system-prompt.ts
const memorySection = buildMemoryPromptSection();
if (memorySection.length > 0) {
  prompt += `\n\n<memory_context>\n${memorySection.join('\n')}\n</memory_context>`;
}
```

---

## 总结：OpenClaw 设计决策答案

| 问题 | OpenClaw 答案 |
|:----:|---------------|
| **Q1** | **C - 可选注入**：通过插件注册，工具驱动（工具可用才注入） |
| **Q2** | **Agent 自主决定**：不自动写入，Agent 调用 memory_write 工具 |
| **Q3** | **B - 保留并行**：Session History + 记忆系统独立 |
| **Q4** | **不使用 importance**：用 minScore 阈值 + 向量/BM25 评分 |
| **Q5** | **A - 不改造**：memory_get 继续从文件读取 |
| **Q6** | **自动检测**：根据 backend 配置启用 |
| **Q7** | **缓存 + fallback**：Embedding 缓存，Provider fallback chain |
| **Q8** | **A - 静默降级**：Fallback chain，FTS-only，不阻断主流程 |

---

## Miniclaw 建议答案（参考 OpenClaw）

| 问题 | 建议答案 | 原因 |
|:----:|----------|------|
| **Q1** | **C** | 参考 OpenClaw，工具驱动注入 |
| **Q2** | **A 或 C** | 简化版可以先写用户消息，后续支持 Agent 自主调用 |
| **Q3** | **B** | 保持两套系统并行，职责清晰 |
| **Q4** | **A (0.3)** | 简化版用固定值，低于晋升阈值 |
| **Q5** | **A** | memory_get 继续从文件读取 |
| **Q6** | **A** | 默认 false，向后兼容 |
| **Q7** | **< 500ms** | 无向量缓存时稍慢 |
| **Q8** | **A** | 静默降级，不阻断主流程 |

---

*生成时间: 2026-04-15*