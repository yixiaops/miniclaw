# Research: 定时任务与动态配置加载

**Feature**: 026-scheduler-hot-reload  
**Date**: 2026-05-15  
**Status**: Complete

## 1. 定时调度技术选型

### Decision: 采用 node-cron 库

**Rationale**:
- node-cron 是 Node.js 社区最成熟的 cron 调度库
- 完全支持 cron 表达式，可精确表达周期性任务（如 `0 9 * * 1` 表示每周一9点）
- 支持 timezone 配置，适合多时区用户场景
- 轻量级，无复杂依赖

**Alternatives Considered**:

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| node-cron | 成熟稳定，cron 表达式完整 | 需额外依赖 | ✅ 采用 |
| node-schedule | 更灵活的调度规则 | 依赖更多，API 复杂 | ❌ 过度设计 |
| setTimeout/setInterval | 无依赖 | 不支持 cron，重启丢失 | ❌ 不满足需求 |
| Agenda (MongoDB) | 功能丰富 | 需要 MongoDB | ❌ 违反 JSON 文件存储假设 |

**Implementation Pattern**:
```typescript
import cron from 'node-cron';

// 创建周期性任务
const task = cron.schedule('0 9 * * 1', () => {
  executeTask(taskId);
}, { scheduled: true, timezone: 'Asia/Shanghai' });

// 停止任务
task.stop();
```

---

## 2. 配置文件监听技术选型

### Decision: 采用 chokidar 库

**Rationale**:
- chokidar 是 Node.js 最可靠的文件监听库
- 跨平台支持（Linux/macOS/Windows）
- 解决了 fs.watch 的已知问题（重复触发、macOS 不稳定）
- 支持递归监听目录

**Alternatives Considered**:

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| chokidar | 跨平台可靠，递归监听 | 需额外依赖 | ✅ 采用 |
| fs.watch | 无依赖 | macOS 不稳定，重复触发 | ❌ 生产环境不可靠 |
| fs.watchFile | 无依赖 | 性能差，轮询方式 | ❌ 高延迟 |

**Implementation Pattern**:
```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch(configDir, {
  ignored: /(^|[\/\\])\../, // 忽略隐藏文件
  persistent: true,
  awaitWriteFinish: {
    stabilityThreshold: 2000, // 2秒稳定后触发
    pollInterval: 100
  }
});

watcher.on('add', (path) => handleConfigAdd(path));
watcher.on('change', (path) => handleConfigChange(path));
watcher.on('unlink', (path) => handleConfigDelete(path));
```

---

## 3. 时间表达式解析策略

### Decision: 依赖 LLM 自然语言理解

**Rationale**:
- Miniclaw 已集成 LLM（百炼 API），可利用现有能力
- 时间表达式理解属于 LLM 强项
- 避免引入额外 NLP 库（如 chrono-node），保持依赖简洁
- 规格明确假设：不使用外部 NLP 库

**Alternatives Considered**:

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| LLM 解析 | 无额外依赖，理解能力强 | 响应略慢 | ✅ 采用 |
| chrono-node | 专业时间解析库 | 新依赖，中文支持有限 | ❌ 违反假设 |
| 正则匹配 | 快速 | 无法处理复杂表达式 | ❌ 不灵活 |

**Implementation Pattern**:
在 Soul 文件中添加时间解析提示，让 LLM 在理解用户意图时同时解析时间：

```markdown
## 定时任务处理规则

当用户提到"提醒"、"定时"、"每天"、"每周"、"几点"等关键词时：
1. 判断用户是否想创建定时任务
2. 解析时间表达式，输出标准格式：
   - 一次性任务：ISO 时间戳（如 2026-05-16T09:00:00）
   - 周期性任务：cron 表达式（如 0 9 * * 1 表示每周一9点）
3. 在回复中确认任务内容和时间
```

---

## 4. 消息持久化与离线推送

### Decision: 新增 PendingMessageStore 模块

**Rationale**:
- 需存储未送达的提醒消息，等待用户上线后推送
- 遵循项目 JSON 文件存储模式
- 与现有 SimpleMemoryStorage 模式一致

**Implementation Pattern**:
```typescript
// src/scheduler/pending-store.ts
interface PendingMessage {
  taskId: string;
  userId: string;
  channel: 'cli' | 'api' | 'web' | 'feishu';
  content: string;
  createdAt: Date;
  retryCount: number;
}

// 存储路径: ~/.miniclaw/pending-messages.json
```

**Channel Integration**:
- CLI: 立即输出（无离线场景）
- API: 通过 API 端点查询待送达消息
- Web: WebSocket 连接时推送待送达消息
- Feishu: 飞书 API 本身支持离线消息，直接调用即可

---

## 5. 任务去重策略

### Decision: 时间窗口 + 内容摘要匹配

**Rationale**:
- 规格明确：时间相同（误差≤30分钟）+ 内容相似时合并
- 内容摘要：提取任务内容关键词（如"开会"、"周报"）
- 使用字符串相似度算法（如余弦相似度）判断内容相似度

**Implementation Pattern**:
```typescript
// src/scheduler/dedup.ts
function isDuplicateTask(newTask: ScheduledTask, existingTasks: ScheduledTask[]): boolean {
  for (const existing of existingTasks) {
    // 时间差 ≤ 30分钟
    const timeDiff = Math.abs(newTask.executeTime.getTime() - existing.executeTime.getTime());
    if (timeDiff <= 30 * 60 * 1000) {
      // 内容相似度 ≥ 0.7
      const similarity = calculateSimilarity(newTask.summary, existing.summary);
      if (similarity >= 0.7) {
        return true;
      }
    }
  }
  return false;
}
```

---

## 6. Agent 热重载策略

### Decision: 配置缓存 + 版本号比对

**Rationale**:
- 配置文件修改时，比对配置版本号（从 YAML frontmatter 的 version 字段）
- 无版本号时，比对文件修改时间（mtime）
- 新 Session 使用新配置，现有 Session 继续使用旧配置

**Implementation Pattern**:
```typescript
// src/core/config-watcher/loader.ts
interface CachedConfig {
  agentId: string;
  path: string;
  version: string;
  mtime: number;
  config: AgentConfig;
}

function shouldReload(cached: CachedConfig, newPath: string): boolean {
  const newMtime = fs.statSync(newPath).mtimeMs;
  if (newMtime > cached.mtime) {
    // 文件有变更，重新解析 YAML 获取新版本
    const newConfig = parseYAML(newPath);
    return newConfig.version !== cached.version;
  }
  return false;
}
```

---

## 7. 任务执行与子 Agent 调用

### Decision: 集成现有 sessions_spawn 工具

**Rationale**:
- 规格明确：任务动作类型支持"调用子 Agent"
- sessions_spawn 已实现子 Agent 调用逻辑
- 执行器只需调用 sessions_spawn 工具

**Implementation Pattern**:
```typescript
// src/scheduler/executor.ts
async function executeTask(task: ScheduledTask): Promise<void> {
  if (task.actionType === 'reminder') {
    // 发送提醒消息
    await sendMessage(task.userId, task.channel, task.content);
  } else if (task.actionType === 'instruction') {
    // 执行预设指令（如调用子 Agent）
    if (task.actionParams?.agentId) {
      await sessions_spawn({
        task: task.content,
        agentId: task.actionParams.agentId
      });
    }
  }
}
```

---

## 8. 工具设计：自然语言交互入口

### Decision: 新增 4 个工具供 LLM 调用

**Rationale**:
- LLM 需要工具来创建、查询、删除、修改定时任务
- 工具命名遵循项目规范（如 `read_file`, `write_file`）
- 工具参数使用 TypeBox Schema 定义

**Tool List**:

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `scheduler_create` | 创建定时任务 | content, executeTime, taskType, actionType, actionParams |
| `scheduler_list` | 查询用户任务列表 | 无（自动按 userId 过滤） |
| `scheduler_delete` | 删除任务 | taskId |
| `scheduler_update` | 修改任务 | taskId, updates |

---

## Summary

| 技术点 | 决策 | 依赖 |
|--------|------|------|
| 定时调度 | node-cron | 新增 |
| 配置监听 | chokidar | 新增 |
| 时间解析 | LLM 能力 | 无新增 |
| 消息持久化 | JSON 文件存储 | 无新增 |
| 去重策略 | 时间窗口 + 内容相似度 | 无新增 |
| 热重载 | 配置缓存 + mtime 比对 | 无新增 |
| 子 Agent 调用 | sessions_spawn | 无新增 |

**新增依赖**: `node-cron`, `chokidar`