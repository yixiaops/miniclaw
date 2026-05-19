# Quickstart: 定时任务与动态配置加载

**Feature**: 026-scheduler-hot-reload  
**Date**: 2026-05-15

## 功能概述

### 定时任务模块

用户可通过自然语言创建定时提醒或周期性任务：

```text
用户: 明天早上9点提醒我开会
AI: 已创建定时任务，将在明天9点提醒您开会。

用户: 每周一上午10点生成周报
AI: 已创建周期性任务，每周一10点自动调用 report-generator Agent 生成周报。

用户: 看看我的任务列表
AI: 您有 2 个定时任务：
    1. 明天9点 - 提醒开会
    2. 每周一10点 - 生成周报
```

### 动态配置加载

运维人员可实时添加/修改 Agent 配置，无需重启：

```bash
# 添加新 Agent
echo "---
name: weather-agent
description: 天气查询助手
tools:
  - web_fetch
---
你是天气查询助手..." > ~/.miniclaw/prompts/weather.md

# 系统自动检测并加载（5秒内生效）
# 用户可直接使用新 Agent
```

---

## 快速开始

### 1. 安装依赖

```bash
npm install node-cron chokidar
```

### 2. 启动服务

```bash
npm run build
npm run start:cli
```

### 3. 创建定时任务

在 CLI 中输入：

```text
明天下午3点提醒我提交报告
```

AI 将自动：
1. 识别定时任务意图
2. 解析时间表达式
3. 创建任务并确认

### 4. 查看任务

```text
查看我的定时任务
```

### 5. 取消任务

```text
取消明天的提醒
```

---

## 配置文件

### Soul 配置（时间解析提示）

在 `~/.miniclaw/soul.md` 中添加：

```markdown
## 定时任务处理规则

当用户提到"提醒"、"定时"、"每天"、"每周"、"几点"等关键词时：
1. 判断用户是否想创建定时任务
2. 解析时间表达式，输出标准格式：
   - 一次性任务：ISO 时间戳（如 2026-05-16T15:00:00）
   - 周期性任务：cron 表达式（如 0 15 * * * 表示每天15点）
3. 调用 scheduler_create 工具创建任务
4. 在回复中确认任务内容和执行时间
```

### Agent 配置目录

```bash
~/.miniclaw/
├── prompts/           # Agent 配置目录
│   ├── main.md        # 主 Agent
│   └── etf.md         # ETF 分析 Agent
│
├── config.json        # 全局配置
├── scheduled-tasks.json  # 定时任务存储
└── soul.md            # AI 人格配置
```

---

## API 使用示例

### CLI 渠道

```text
> 提醒我明天9点开会
✓ 已创建任务 #abc123

> 每周五下午5点总结本周工作
✓ 已创建周期性任务，调用 summary-agent

> 任务列表
[1] 明天9点 - 开会 (一次性)
[2] 每周五17点 - 周工作总结 (周期性)

> 取消任务 abc123
✓ 任务已取消
```

### 飞书渠道

飞书用户可通过私聊或群聊创建任务：

```text
@Miniclaw 每天早上8点提醒团队晨会
```

任务创建后，Miniclaw 将在每天8点通过飞书推送提醒。

---

## 开发指南

### 添加新工具

```typescript
// src/tools/scheduler-create.ts
import { Type } from '@sinclair/typebox';

export const schedulerCreateTool = {
  name: 'scheduler_create',
  label: '创建定时任务',
  description: '创建定时提醒或周期性任务',
  parameters: Type.Object({
    content: Type.String({ description: '任务内容' }),
    executeTime: Type.String({ description: '执行时间（ISO 或 cron）' }),
    taskType: Type.String({ enum: ['one-time', 'recurring'] }),
    actionType: Type.String({ enum: ['reminder', 'instruction'] }),
    agentId: Type.Optional(Type.String())
  }),
  
  async execute(toolCallId: string, params: any): Promise<ToolResult> {
    // 实现任务创建逻辑
  }
};
```

### 扩展任务动作类型

```typescript
// src/scheduler/types.ts
interface ActionParams {
  agentId?: string;      // 调用子 Agent
  instruction?: string;  // 执行预设指令
  webhook?: string;      // 调用外部 API（未来扩展）
}
```

---

## 测试验证

### 单元测试

```bash
npm run test tests/unit/scheduler/
```

### 集成测试

```bash
npm run test tests/integration/scheduler-flow.test.ts
```

### 手动测试

1. 创建一次性任务，等待触发时间
2. 创建周期性任务，验证重复执行
3. 添加新 Agent 配置文件，验证热重载

---

## 常见问题

### Q: 任务执行时用户离线怎么办？

A: 消息自动存入待推送队列，用户上线后自动推送。

### Q: 如何避免重复任务？

A: 系统检测时间相近（≤30分钟）+ 内容相似的任务，AI 会询问是否合并。

### Q: 周期性任务何时停止？

A: 默认无限执行，用户需手动取消（如"取消每周一的提醒"）。

### Q: 配置文件修改后何时生效？

A: 5秒内完成加载，新对话立即使用新配置，现有对话继续使用旧配置。