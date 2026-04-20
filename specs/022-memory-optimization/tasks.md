# Tasks: Memory System Optimization

**Branch**: `022-memory-optimization`
**Date**: 2026-04-20
**Status**: Ready for Implementation

---

## Task List (Priority Order)

### T001: 配置文件更新 - 新增 memory 优化配置 (P1)

**描述**：更新 config.ts，新增 session 和 candidatePool 配置项

**文件**：
- `src/core/config.ts`（修改）

**测试**：
- 文件：`tests/unit/core/config.test.ts`（修改）
- 用例：
  1. should have session config with maxFullMessages
  2. should have session config with maxSummaryBatches
  3. should have candidatePool config with maxEntries
  4. should have candidatePool config with evictCount
  5. should have candidatePool config with instantPromoteThreshold

**依赖**：无

---

### T002: MemoryCandidatePool 容量上限 (P1)

**描述**：修改 candidate-pool.ts，新增容量上限和清理机制

**文件**：
- `src/memory/store/candidate-pool.ts`（修改）

**功能**：
1. 新增属性：`maxEntries = 500`
2. 新增属性：`evictCount = 50`
3. 新增属性：`instantPromoteThreshold = 0.5`
4. 新增方法：`evictLowImportance(count: number): void`
5. 修改方法：`write()` - 检查容量，触发清理/晋升

**测试**：
- 文件：`tests/unit/store/candidate-pool.test.ts`（修改）
- 用例：
  1. should have maxEntries property (default 500)
  2. should evict low importance entries when exceeding maxEntries
  3. should keep high importance entries when evicting
  4. should instantly promote when importance >= 0.5
  5. should not evict when below maxEntries
  6. should respect config.maxEntries override

**依赖**：T001

---

### T003: MemoryCandidatePool - evictLowImportance 实现 (P1)

**描述**：实现按 importance 清理低重要性条目

**文件**：
- `src/memory/store/candidate-pool.ts`（修改）

**实现细节**：
```typescript
evictLowImportance(count: number): void {
  // 按 importance 排序（升序）
  const entries = [...this.store.entries()]
    .sort((a, b) => (a[1].metadata?.importance || 0) - (b[1].metadata?.importance || 0));
  
  // 删除最低的 count 条
  for (const [id] of entries.slice(0, count)) {
    this.store.delete(id);
  }
}
```

**测试**：
- 文件：`tests/unit/store/candidate-pool.test.ts`（修改）
- 用例：
  1. should sort entries by importance before evicting
  2. should delete exact count of entries
  3. should handle entries without importance (treat as 0)
  4. should not delete if count > store.size

**依赖**：T002

---

### T004: MemoryCandidatePool - write() 容量检查 (P1)

**描述**：修改 write() 方法，写入前检查容量

**文件**：
- `src/memory/store/candidate-pool.ts`（修改）

**实现细节**：
```typescript
async write(content: string, sessionId: string, options?: WriteOptions): Promise<string> {
  // 检查容量
  if (this.store.size >= this.maxEntries) {
    this.evictLowImportance(this.evictCount);
  }
  
  // 写入
  const id = this.generateId();
  const entry = { content, sessionId, ...options };
  this.store.set(id, entry);
  
  // 即时晋升检查
  if (options?.importance >= this.instantPromoteThreshold) {
    await this.promoter?.promote(id);
  }
  
  return id;
}
```

**测试**：
- 文件：`tests/unit/store/candidate-pool.test.ts`（修改）
- 用例：
  1. should check capacity before write
  2. should trigger eviction when at capacity
  3. should write after eviction
  4. should instantly promote high importance entry

**依赖**：T003

---

### T005: SessionCompressor - 新增压缩器模块 (P2)

**描述**：新增 src/memory/session/compressor.ts

**文件**：
- `src/memory/session/compressor.ts`（新增）
- `src/memory/session/index.ts`（新增）

**功能**：
1. `compress(session: Session): Promise<Session>`
2. `compressBatches(messages: Message[], batchSize: number): Promise<Message[]>`
3. `generateSummary(batch: Message[]): Promise<string>`

**配置参数**：
- `maxFullMessages: 50`
- `maxSummaryBatches: 15`

**测试**：
- 文件：`tests/unit/session/compressor.test.ts`（新增）
- 用例：
  1. should not compress if messages <= maxFullMessages
  2. should compress if messages > maxFullMessages
  3. should keep recent messages intact
  4. should generate summaries for old messages
  5. should delete messages beyond maxSummaryBatches * batchSize

**依赖**：T001

---

### T006: SessionCompressor - compress() 实现 (P2)

**描述**：实现 compress() 方法

**文件**：
- `src/memory/session/compressor.ts`（修改）

**实现细节**：
```typescript
async compress(session: Session): Promise<Session> {
  const messages = session.messages;
  
  if (messages.length <= this.maxFullMessages) {
    return session; // 不压缩
  }
  
  // 保留最近 50 条（完整区）
  const fullMessages = messages.slice(-this.maxFullMessages);
  
  // 压缩旧消息（每 10 条压缩成 1 条摘要）
  const oldMessages = messages.slice(0, -this.maxFullMessages);
  const summaries = await this.compressBatches(oldMessages, 10);
  
  // 限制摘要数量（最多 15 条摘要）
  const limitedSummaries = summaries.slice(-this.maxSummaryBatches);
  
  // 重组
  session.messages = [...limitedSummaries, ...fullMessages];
  
  return session;
}
```

**测试**：
- 文件：`tests/unit/session/compressor.test.ts`（修改）
- 用例：
  1. should return unchanged session if messages <= 50
  2. should split messages into summary zone and full zone
  3. should limit summary count to maxSummaryBatches
  4. should preserve recent messages

**依赖**：T005

---

### T007: SessionCompressor - generateSummary() 实现 (P2)

**描述**：实现 AI 摘要生成

**文件**：
- `src/memory/session/compressor.ts`（修改）

**实现细节**：
```typescript
async generateSummary(batch: Message[]): Promise<Message> {
  // 提取消息内容
  const content = batch.map(m => `${m.role}: ${m.content}`).join('\n');
  
  // 调用 AI API 生成摘要
  const summary = await this.aiClient.chat({
    messages: [{
      role: 'user',
      content: `请用一句话总结以下对话内容（保留关键信息）：\n${content}`
    }]
  });
  
  // 返回摘要消息
  return {
    role: 'summary',
    content: summary.content,
    metadata: {
      compressedFrom: batch.length,
      compressedAt: new Date()
    }
  };
}
```

**测试**：
- 文件：`tests/unit/session/compressor.test.ts`（修改）
- 用例：
  1. should call AI API to generate summary
  2. should return summary message with metadata
  3. should handle empty batch
  4. should handle API error gracefully

**依赖**：T006

---

### T008: SimpleMemoryStorage - 压缩触发 (P2)

**描述**：修改 SimpleMemoryStorage，加载时触发压缩

**文件**：
- `src/core/memory/simple.ts`（修改）

**功能**：
1. `load()` 时检查消息条数
2. 超过阈值触发 `SessionCompressor.compress()`
3. 压缩后写回文件

**测试**：
- 文件：`tests/unit/core/memory/simple.test.ts`（修改）
- 用例：
  1. should trigger compression on load if messages > threshold
  2. should write compressed session back to file
  3. should not compress on load if messages <= threshold

**依赖**：T007

---

### T009: TTLManager - 定时压缩触发 (P3)

**描述**：新增定时压缩触发机制

**文件**：
- `src/memory/store/ttl-manager.ts`（修改）

**功能**：
1. 新增 `compressInterval = 3600000`（1小时）
2. 定时触发 Session 压缩（对所有活跃 Session）

**测试**：
- 文件：`tests/unit/store/ttl-manager.test.ts`（修改）
- 用例：
  1. should trigger session compression periodically
  2. should respect compressInterval config

**依赖**：T008

---

### T010: 集成测试 - 完整流程验证 (P3)

**描述**：验证优化后的完整记忆流程

**文件**：
- `tests/integration/memory-optimization.test.ts`（新增）

**测试用例**：
1. should compress session on load when exceeding threshold
2. should evict candidate pool entries when exceeding maxEntries
3. should instantly promote high importance entries
4. should maintain memory limits after long conversation
5. should persist compressed session correctly

**依赖**：T001-T009

---

## Summary

| Task | Priority | Files | Tests | Dependencies |
|------|----------|-------|-------|--------------|
| T001 | P1 | config.ts | config.test.ts | 无 |
| T002 | P1 | candidate-pool.ts | candidate-pool.test.ts | T001 |
| T003 | P1 | candidate-pool.ts | candidate-pool.test.ts | T002 |
| T004 | P1 | candidate-pool.ts | candidate-pool.test.ts | T003 |
| T005 | P2 | compressor.ts (新增) | compressor.test.ts (新增) | T001 |
| T006 | P2 | compressor.ts | compressor.test.ts | T005 |
| T007 | P2 | compressor.ts | compressor.test.ts | T006 |
| T008 | P2 | simple.ts | simple.test.ts | T007 |
| T009 | P3 | ttl-manager.ts | ttl-manager.test.ts | T008 |
| T010 | P3 | integration test | memory-optimization.test.ts | T001-T009 |

**总任务数**：10
**P1（高优先级）**：4 个
**P2（中优先级）**：4 个
**P3（低优先级）**：2 个