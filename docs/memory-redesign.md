# 记忆系统重新设计

## 当前问题分析

### 核心问题
1. **短期记忆重启丢失** → 跨 Session 知识积累失效
2. **功能重叠**：Session 历史已保存完整对话，短期记忆价值不明确
3. **晋升机制被动**：依赖 TTL 清理时才检查晋升，重要信息可能丢失

### 当前架构
```
用户输入
  ↓
AutoMemoryWriter
  ↓
ShortTermMemory (内存，24h TTL)  → 丢失风险
  ↓ (重要性≥0.5 晋升)
LongTermMemory (文件持久化)
```

---

## 新设计方案

### 方案一：双层持久化（推荐）

**核心思想**：短期记忆也持久化，重启后恢复

```
用户输入
  ↓
MemoryManager.write()
  ↓
┌─────────────────────────────────────┐
│  ShortTermMemory (~/memory/short/)  │  ← 新增：短期记忆也持久化
│  - 每个 Session 一个 JSON 文件         │
│  - 重启后恢复                        │
│  - TTL 清理时检查晋升                 │
└─────────────────────────────────────┘
  ↓ (重要性≥0.5 或 多次提及)
┌─────────────────────────────────────┐
│  LongTermMemory (~/memory/MEMORY.md)│  ← 保持不变
│  - 跨 Session 永久记忆                │
│  - 按重要性分类                      │
└─────────────────────────────────────┘
```

**优点**：
- 保留跨 Session 积累能力
- 重启不丢失
- 架构变化小

**缺点**：
- 增加 I/O 操作
- 短期记忆文件可能过多

---

### 方案二：单层记忆 + Session 历史（简化）

**核心思想**：取消短期记忆，直接写入长期记忆

```
用户输入
  ↓
┌─────────────────────────────────────┐
│  Session History (~/sessions/)      │  ← 保持不变
│  - 完整对话记录                      │
│  - 按 Session 隔离                    │
└─────────────────────────────────────┘
  ↓ (后台异步分析)
┌─────────────────────────────────────┐
│  LongTermMemory (~/memory/MEMORY.md)│
│  - 从对话中提取知识点                │
│  - 重要性≥0.5 才写入                 │
│  - 跨 Session 聚合                   │
└─────────────────────────────────────┘
```

**优点**：
- 架构简单
- 无数据丢失风险
- 减少一层存储

**缺点**：
- 失去短期缓冲筛选
- 需要更智能的提取逻辑

---

### 方案三：事件驱动晋升（推荐）

**核心思想**：不依赖 TTL，实时评估晋升

```
用户输入
  ↓
MemoryManager.write()
  ↓
┌─────────────────────────────────────┐
│  实时重要性评估                       │
│  - 关键词匹配（用户偏好、事实等）     │
│  - 多次提及同一主题 → 重要性+0.1     │
│  - 显式声明（"我喜欢"、"记住"）→ 0.8 │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│  重要性≥0.7 → 直接写入长期记忆        │
│  重要性<0.7 → 写入短期记忆（持久化）  │
└─────────────────────────────────────┘
```

**重要性计算规则**：
```typescript
function calculateImportance(content: string, context: Context): number {
  let score = 0.3; // 基础分
  
  // 显式偏好声明
  if (/我喜|我常|我一般|我总是/.test(content)) score += 0.3;
  
  // 事实性陈述
  if (/是|叫|住在|工作在/.test(content)) score += 0.2;
  
  // 多次提及同一主题
  if (context.topicCount > 2) score += 0.1 * context.topicCount;
  
  // 用户显式要求记住
  if (/记住|别忘了|记一下/.test(content)) score += 0.4;
  
  return Math.min(score, 1.0);
}
```

---

## 推荐方案：方案一 + 方案三 结合

### 新架构

```
┌─────────────────────────────────────────────────────────────┐
│                      用户输入                                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              MemoryManager.write()                          │
│              - 实时计算重要性                               │
│              - 检查主题提及次数                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    重要性 ≥ 0.7?
                    /           \
                  是             否
                  ↓               ↓
    ┌──────────────────┐  ┌──────────────────────┐
    │  LongTermMemory  │  │  ShortTermMemory     │
    │  - 直接写入       │  │  - 持久化到 JSON      │
    │  - MEMORY.md     │  │  - short/{sessionId}.json
    │  - 重启恢复       │  │  - 重启恢复           │
    └──────────────────┘  └──────────────────────┘
                                  ↓
                        TTL 清理时检查
                        主题提及≥3 次？
                        /           \
                      是             否
                      ↓               ↓
            ┌──────────────────┐  ┌──────────┐
            │   晋升到长期      │  │  删除     │
            └──────────────────┘  └──────────┘
```

### 文件结构

```
~/.miniclaw/
├── sessions/           # 对话历史（完整聊天记录）
│   ├── session-1.json
│   └── session-2.json
├── memory/
│   ├── short/          # 短期记忆（持久化）
│   │   ├── session-1.json
│   │   └── session-2.json
│   ├── long-term.json  # 长期记忆（机器可读）
│   └── MEMORY.md       # 长期记忆（人类可读）
└── config.json
```

### 短期记忆格式（持久化）

```json
{
  "sessionId": "session-1",
  "entries": [
    {
      "id": "short-1713523200000-abc123",
      "content": "我喜欢用 Python 开发软件",
      "importance": 0.6,
      "topicTags": ["Python", "编程"],
      "mentionCount": 1,
      "createdAt": "2026-04-19T12:00:00Z",
      "expiresAt": "2026-04-20T12:00:00Z"
    }
  ],
  "updatedAt": "2026-04-19T12:00:00Z"
}
```

### 核心代码变更

#### 1. ShortTermMemory 增加持久化

```typescript
export class ShortTermMemory {
  private store: Map<string, MemoryEntry> = new Map();
  private storageDir: string;
  
  async persist(): Promise<void> {
    // 按 Session 分组保存
    const bySession = this.groupBySession();
    for (const [sessionId, entries] of Object.entries(bySession)) {
      const file = path.join(this.storageDir, `${sessionId}.json`);
      await fs.writeFile(file, JSON.stringify({ sessionId, entries }, null, 2));
    }
  }
  
  async load(): Promise<void> {
    // 启动时加载所有短期记忆
    const files = await fs.readdir(this.storageDir);
    for (const file of files) {
      const content = await fs.readFile(path.join(this.storageDir, file));
      const data = JSON.parse(content);
      for (const entry of data.entries) {
        this.store.set(entry.id, entry);
      }
    }
  }
}
```

#### 2. 实时重要性计算

```typescript
export class ImportanceCalculator {
  private topicCounts: Map<string, number> = new Map();
  
  calculate(content: string, sessionId: string): number {
    let score = 0.3;
    
    // 显式偏好
    if (/我喜|我常|我一般|我总是/.test(content)) score += 0.3;
    
    // 事实陈述
    if (/是|叫|住在|工作在/.test(content)) score += 0.2;
    
    // 主题提及次数
    const topics = this.extractTopics(content);
    for (const topic of topics) {
      const key = `${sessionId}:${topic}`;
      const count = this.topicCounts.get(key) || 0;
      this.topicCounts.set(key, count + 1);
      if (count >= 2) score += 0.1;
    }
    
    // 显式记住要求
    if (/记住|别忘了|记一下/.test(content)) score += 0.4;
    
    return Math.min(score, 1.0);
  }
}
```

#### 3. MemoryManager 初始化

```typescript
async initialize(): Promise<void> {
  // 加载长期记忆
  await this.longTerm.load();
  
  // 新增：加载短期记忆
  await this.shortTerm.load();
  
  // 启动 TTL 清理
  this.ttlManager.schedule(interval);
}
```

---

## 实施步骤

1. **修改 ShortTermMemory**：增加 persist() 和 load() 方法
2. **修改 MemoryManager**：初始化时加载短期记忆
3. **增加 ImportanceCalculator**：实时计算重要性
4. **修改 AutoMemoryWriter**：使用新的重要性计算
5. **迁移脚本**：将现有短期记忆格式转换

---

## 记忆流转示例

### 场景：用户说"我喜欢用 Python 开发软件"

```
第 1 次提及：
  重要性 = 0.3 + 0.3 (我喜欢) = 0.6
  → 写入短期记忆 (持久化)
  → short/session-1.json

第 2 次提及（同一 Session）：
  重要性 = 0.3 + 0.3 + 0.1 (第 2 次) = 0.7
  → 晋升到长期记忆
  → MEMORY.md "高重要性" 分类
  → 删除短期记忆

第 3 次提及（不同 Session）：
  重要性 = 0.3 + 0.3 + 0.2 (跨 Session 累积) = 0.8
  → 直接写入长期记忆
```

### 场景：用户说"今天天气不错"

```
重要性 = 0.3 (基础分，无特殊模式)
→ 写入短期记忆
→ 24h 后 TTL 清理
→ 不晋升，直接删除
```

---

## 对比总结

| 特性 | 当前设计 | 新设计 |
|------|---------|--------|
| 短期记忆持久化 | ✗ | ✓ |
| 重启恢复短期记忆 | ✗ | ✓ |
| 实时重要性计算 | ✗ | ✓ |
| 跨 Session 主题追踪 | ✗ | ✓ |
| 显式记住支持 | ✗ | ✓ |
| 架构复杂度 | 中 | 中 |
| 数据丢失风险 | 高 | 低 |
