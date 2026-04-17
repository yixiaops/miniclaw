# Memory System - Clarification Questions

> Generated: 2026-04-14
> Status: **DECIDED** (基于 OpenClaw 实现方案)

本文档列出记忆系统需求规格中需要澄清的关键问题，并给出基于 OpenClaw 实现方案的决策。

---

## 决策总结（基于 OpenClaw）

| 问题类别 | 关键决策 |
|---------|---------|
| 记忆使用场景 | **会话开始时自动读取** + **按需搜索** |
| 会话结束时机 | **heartbeat 结束** + **用户离开** + **对话暂停** |
| 写入阈值 | **"值得明天还记得"标准** |
| 内容边界 | **敏感信息不记录** + **用户要求不记录** |
| 去重策略 | **语义相似度判断** |
| 搜索触发 | **用户提问时按需**（非自动） |
| 排序规则 | **时间优先 + 相关性混合** |

---

## 1. 记忆使用场景

### 1.1 主动搜索触发条件 ✅ DECIDED

**决策：按需搜索（非自动触发）**

OpenClaw 方案：
- **会话开始时**自动读取：SOUL.md + USER.md + memory/YYYY-MM-DD.md（今天+昨天）
- **主会话**额外读取：MEMORY.md
- **用户提问时**：Agent 按需调用 memory_search

参考代码：AGENTS.md "Every Session" 规则
```
Before doing anything else:
1. Read SOUL.md
2. Read USER.md
3. Read memory/YYYY-MM-DD.md (today + yesterday)
4. If in MAIN SESSION: Also read MEMORY.md
```

### 1.2 搜索结果呈现方式 ✅ DECIDED

**决策：静默集成 + 引用标注**

OpenClaw 方案：
- 搜索结果作为上下文，静默集成到回复
- 回复中标注引用来源：`Source: memory/xxx.md#Lxx`
- 用户可追溯记忆来源

### 1.3 相关性判断机制 ✅ DECIDED

**决策：关键词匹配（V1）→ 语义搜索（V2）**

OpenClaw 方案：
- 当前使用关键词匹配（memory_search/memory_get）
- V2 计划加入 Embeddings + LanceDB 语义搜索

---

## 2. 记忆触发时机

### 2.1 会话结束定义 ✅ DECIDED

**决策：多种时机触发**

OpenClaw 方案（AGENTS.md "会话结束规则（铁律）"）：
```markdown
每次会话结束前（包括对话暂停、heartbeat 结束、用户离开），必须：
1. 写入当日记忆：更新 memory/YYYY-MM-DD.md
2. 更新长期记忆：如果有重要发现/教训，更新 MEMORY.md
```

触发时机：
- ✅ heartbeat 会话结束
- ✅ 用户离开（长时间无响应）
- ✅ 对话暂停
- ✅ 用户发送 /exit（可选）

### 2.2 自动与手动写入边界 ✅ DECIDED

**决策：强制自动 + 支持手动**

OpenClaw 方案：
- **强制自动**：会话结束时必须写（铁律）
- **支持手动**：用户说 "remember this" → 立即写入
- **不提供 /remember 命令**：依赖 Agent 判断

### 2.3 增量写入策略 ✅ DECIDED

**决策：会话结束时批量写入**

OpenClaw 方案：
- 不实时写入每条消息（避免噪音）
- 会话结束时统一处理
- 判断标准："值得明天还记得"

---

## 3. 记忆内容边界

### 3.1 值得写入的内容阈值 ✅ DECIDED

**决策："值得明天还记得"标准**

OpenClaw 方案（AGENTS.md）：
```markdown
判断标准：如果对话中有任何值得"明天还记得"的内容，就必须写下来。

不写 = 忘记 = 失职
```

具体内容类型：
- ✅ 讨论的重要事项
- ✅ 做出的决策
- ✅ 未完成的待办
- ✅ 关键的方案、想法
- ✅ 新发现的铁律/教训
- ✅ 用户偏好

### 3.2 不应写入的内容 ✅ DECIDED

**决策：敏感信息 + 临时内容排除**

OpenClaw 方案：
- ❌ 密码、密钥、Token（敏感信息）
- ❌ "今天天气怎么样"（临时性内容）
- ❌ 用户明确要求不记录
- ❌ 秘密内容（"Skip the secrets unless asked to keep them"）

### 3.3 去重策略 ✅ DECIDED

**决策：语义相似度判断**

方案：
- 检测是否已存在相似内容
- 相似度阈值：0.8（可配置）
- 相同信息的不同表述 → 合并/更新而非重复写入

---

## 4. 记忆检索策略

### 4.1 搜索结果排序 ✅ DECIDED

**决策：时间优先 + 相关性混合**

方案：
- 最近优先（时间权重 0.6）
- 相关性优先（匹配权重 0.4）
- 混合评分排序

### 4.2 结果数量限制 ✅ DECIDED

**决策：默认 10 条，最大 50 条**

方案：
- 默认返回 10 条
- 最大限制 50 条
- 支持分页参数（offset/limit）

### 4.3 上下文补充策略 ✅ DECIDED

**决策：返回匹配行 ± 5 行上下文**

OpenClaw 方案：
- memory_search 返回匹配片段
- memory_get 支持指定行范围
- 默认上下文：前后各 5 行

---

## 5. 补充问题

### 5.1 记忆存储结构 ✅ DECIDED

**决策：按时间线 + 按主题**

OpenClaw 方案：
- Daily notes：按时间线（YYYY-MM-DD.md）
- MEMORY.md：按主题/章节组织

### 5.2 记忆生命周期 ✅ DECIDED

**决策：不自动清理，支持手动归档**

方案：
- 不自动清理历史记忆
- 用户可手动删除/归档
- V2 支持自动归档（超过 30 天的 daily notes）

### 5.3 记忆权限 ✅ DECIDED

**决策：单用户，主会话隔离**

OpenClaw 方案：
- MEMORY.md **只在主会话加载**（安全隔离）
- 群聊/共享上下文 **不加载** MEMORY.md
- Daily notes **所有会话可见**

---

## 决策依据来源

| 决策 | OpenClaw 参考 |
|------|---------------|
| 会话结束时机 | AGENTS.md "会话结束规则（铁律）" |
| 写入阈值 | AGENTS.md "判断标准：值得明天还记得" |
| 会话开始读取 | AGENTS.md "Every Session" |
| 安全隔离 | AGENTS.md "MEMORY.md - ONLY in main session" |
| 记忆结构 | OpenClaw workspace 目录结构 |
| 搜索工具 | OpenClaw memory_search/memory_get 工具定义 |

---

## 下一步行动

1. ✅ 决策已完成
2. → 将决策整合到 `spec.md`（更新需求）
3. → 执行 `/speckit.plan` 生成实现计划
4. → 执行 `/speckit.tasks` 拆分任务

---

*此文档基于 OpenClaw 实现方案完成决策。*