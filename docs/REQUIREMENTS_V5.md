# Miniclaw 五期需求文档 (v0.5)

> 记忆自动同步 + 技能系统 + 基础能力增强

## 一、背景

### 1.1 当前状态 (2026-03-23)

**已完成模块：**

| 模块 | 状态 | 说明 |
|------|------|------|
| Gateway | ✅ | 统一消息入口 |
| Router | ✅ | 消息路由 |
| SessionManager | ✅ | Session 管理 |
| AgentRegistry | ✅ | Agent 实例管理 |
| SimpleMemoryStorage | ✅ | 对话历史持久化 |
| MemorySearchManager | ✅ | 记忆搜索 |
| Channels | ✅ | CLI/API/Web/Feishu 通道 |
| Tools | ✅ | 文件/Shell/网络/记忆工具 |

**待解决问题：**

| 问题 | 影响 | 原因 |
|------|------|------|
| 短期记忆不会转长期记忆 | 用户需要手动整理知识库 | 没有自动同步机制 |
| 缺少技能系统 | 无法扩展专业能力 | 没有插件/技能架构 |
| 基础能力不足 | 功能受限 | 工具数量少 |

---

## 二、核心需求

### 2.1 记忆自动同步（P1）

**目标：** 用户无感的情况下，将短期记忆自动转化为长期记忆。

#### 设计方案

```
对话产生 → 发射事件 → 累积增量 → 达到阈值 → 提取摘要 → 写入 memory/*.md
```

#### 核心组件

| 组件 | 功能 |
|------|------|
| `SessionUpdateEmitter` | 事件发射/监听 |
| `MemorySyncManager` | 增量累积、阈值触发 |
| `MemoryExtractor` | 提取关键信息 |

#### 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `deltaBytes` | 50KB | 累积字节触发阈值 |
| `deltaMessages` | 20 | 累积消息数触发阈值 |
| `debounceMs` | 5000ms | 防抖间隔 |

#### 存储格式

```
~/.miniclaw/memory/
├── MEMORY.md           # 手动维护的主知识库
└── sessions/           # 自动同步的对话记忆
    └── 2026-03-23.md   # 按日期存储
```

#### 接口设计

```typescript
// 事件发射器
type SessionUpdateListener = (sessionKey: string) => void;

export function onSessionUpdate(listener: SessionUpdateListener): () => void;
export function emitSessionUpdate(sessionKey: string): void;

// 同步管理器
interface SyncConfig {
  deltaBytes: number;      // 51200
  deltaMessages: number;   // 20
  debounceMs: number;      // 5000
  enabled: boolean;
}

class MemorySyncManager {
  constructor(config: SyncConfig);
  startWatching(): void;
  stopWatching(): void;
}

// 信息提取器
interface ExtractedInfo {
  topic: string;
  content: string;
  importance: number;  // 1-5
  timestamp: Date;
}

class MemoryExtractor {
  extractFromMessages(messages: Message[]): ExtractedInfo[];
}
```

---

### 2.2 技能系统（P2）

**目标：** 支持可扩展的技能模块，让 miniclaw 具备专业能力。

#### 设计参考

参考 OpenClaw 的技能系统：
- `skills/weather/`: 天气查询
- `skills/github/`: GitHub 操作
- `skills/coding-agent/`: 编码代理
- `skills/skill-creator/`: 技能创建器

#### 技能结构

```
~/.miniclaw/skills/
├── weather/
│   ├── SKILL.md         # 技能描述和触发词
│   ├── index.ts         # 技能实现
│   └── config.json      # 技能配置
│
├── github/
│   ├── SKILL.md
│   ├── index.ts
│   └── config.json
│
└── custom/
    └── my-skill/
        └── SKILL.md
```

#### SKILL.md 格式

```markdown
# Weather Skill

## Description
查询天气和天气预报

## Triggers
- 天气
- 天气预报
- 气温
- 下雨

## Tools
- web_fetch: 获取天气数据

## Config
\`\`\`json
{
  "api": "wttr.in",
  "defaultLocation": "Beijing"
}
\`\`\`
```

#### 技能加载流程

```
启动 → 扫描 skills/ 目录 → 加载 SKILL.md → 注册触发词 → 匹配时执行
```

#### 接口设计

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  tools?: string[];
  execute: (input: string, context: SkillContext) => Promise<string>;
}

class SkillManager {
  loadSkills(dir: string): void;
  matchSkill(input: string): Skill | null;
  executeSkill(skill: Skill, input: string): Promise<string>;
}
```

---

### 2.3 基础能力增强（P2-P3）

#### 对比 OpenClaw，miniclaw 缺少的重要能力：

| 能力 | OpenClaw | Miniclaw | 优先级 | 说明 |
|------|----------|----------|--------|------|
| **web_search** | ✅ | ❌ | P2 | 网页搜索 |
| **sessions_spawn** | ✅ | ❌ | P2 | 子代理 |
| **nodes** | ✅ | ❌ | P2 | 设备控制（手机/电脑） |
| **message** | ✅ | ❌ | P2 | 跨通道消息发送 |
| **cron** | ✅ | ❌ | P2 | 定时任务 |
| **browser** | ✅ | ❌ | P3 | 浏览器控制 |
| **image** | ✅ | ❌ | P3 | 图像处理 |
| **pdf** | ✅ | ❌ | P3 | PDF 处理 |
| **canvas** | ✅ | ❌ | P3 | Canvas 展示 |

#### P2 能力详情

**1. web_search（网页搜索）**

```typescript
interface WebSearchParams {
  query: string;
  count?: number;  // 1-10
  country?: string; // US, CN, etc.
}

// 使用 Brave Search API
```

**2. sessions_spawn（子代理）**

```typescript
interface SpawnParams {
  task: string;
  agentId?: string;
  timeout?: number;
}

// 创建独立的子代理执行任务
```

**3. nodes（设备控制）**

```typescript
interface NodesParams {
  action: 'status' | 'camera_snap' | 'screen_record' | 'location_get' | 'notify' | 'run';
  nodeId?: string;
  // 根据不同 action 有不同参数
}

// 支持操作：
// - camera_snap: 拍照
// - screen_record: 屏幕录制
// - location_get: 获取位置
// - notify: 发送通知
// - run: 执行命令
```

**4. message（跨通道消息）**

```typescript
interface MessageParams {
  action: 'send';
  target: string;    // 目标用户/群组
  message: string;
  channel?: string;  // feishu/discord/telegram 等
}

// 跨通道发送消息
```

**5. cron（定时任务）**

```typescript
interface CronParams {
  schedule: string;  // cron 表达式
  action: string;
  message?: string;
}

// 定时执行任务或提醒
```

#### P3 能力详情

**6. browser（浏览器控制）**

```typescript
interface BrowserParams {
  action: 'open' | 'click' | 'type' | 'screenshot' | 'close';
  url?: string;
  selector?: string;
  text?: string;
}

// 浏览器自动化操作
```

**7. image（图像处理）**

```typescript
interface ImageParams {
  action: 'describe' | 'generate';
  input: string;
}

// 图像描述或生成
```

**8. canvas（Canvas 展示）**

```typescript
interface CanvasParams {
  action: 'present' | 'hide' | 'navigate';
  url?: string;
  html?: string;
}

// 在 Canvas 中展示内容
```

---

## 三、实施计划

### Phase 1: 记忆自动同步（P1）

| 任务 | 工时 | 状态 |
|------|------|------|
| SessionUpdateEmitter 实现 | 0.5h | ⏳ 待开发 |
| MemorySyncManager 实现 | 1h | ⏳ 待开发 |
| MemoryExtractor 实现 | 1h | ⏳ 待开发 |
| Gateway 集成 | 0.5h | ⏳ 待开发 |
| 测试 | 1h | ⏳ 待开发 |

### Phase 2: 技能系统（P2）

| 任务 | 工时 | 状态 |
|------|------|------|
| SkillManager 实现 | 1.5h | ⏳ 待开发 |
| SKILL.md 解析器 | 0.5h | ⏳ 待开发 |
| 示例技能（weather） | 0.5h | ⏳ 待开发 |
| 测试 | 1h | ⏳ 待开发 |

### Phase 3: 基础能力增强（P2-P3）

| 任务 | 工时 | 优先级 |
|------|------|--------|
| web_search 工具 | 1h | P2 |
| sessions_spawn 工具 | 2h | P2 |
| nodes 工具（设备控制） | 3h | P2 |
| message 工具（跨通道消息） | 1.5h | P2 |
| cron 工具 | 1.5h | P2 |
| browser 工具 | 3h | P3 |
| image 工具 | 2h | P3 |
| canvas 工具 | 2h | P3 |

---

## 四、验收标准

### 4.1 记忆自动同步

- [ ] 对话累积到阈值后自动同步
- [ ] 提取的关键信息写入 memory/sessions/*.md
- [ ] memory_search 可搜索到自动同步的内容
- [ ] 可配置开启/关闭

### 4.2 技能系统

- [ ] 支持 skills/ 目录自动加载
- [ ] 支持 SKILL.md 定义技能
- [ ] 支持触发词匹配
- [ ] 至少提供 1 个示例技能

### 4.3 基础能力

- [ ] web_search 可搜索网页
- [ ] sessions_spawn 可创建子代理
- [ ] nodes 可控制设备（拍照/录屏/位置）
- [ ] message 可跨通道发送消息
- [ ] cron 可创建定时任务

---

## 五、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 技能加载慢 | 启动时间长 | 懒加载 + 缓存 |
| 信息提取不准确 | 长期记忆质量差 | 简单关键词提取 + 后续优化 |
| 子代理资源占用 | 内存/CPU 消耗 | 数量限制 + 超时清理 |

---

## 六、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-23 | v0.5.0 | 五期需求文档：记忆自动同步 + 技能系统 + 基础能力增强 |

---

_待确认后执行_