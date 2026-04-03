# Spec: Skill 系统与 Agent 集成

> 生成时间：2026-04-03
> 需求文档：docs/REQUIREMENTS_V8.md

---

## 一、需求摘要

**问题：** SkillManager 已实现并初始化，但未与 Agent 集成，技能永远不会被触发。

**目标：** 
1. Agent 构造函数接收 skillManager 参数
2. chat() 方法自动匹配技能并注入 system prompt
3. 子代理也能使用技能系统

---

## 二、技术方案设计

### 2.1 数据流

```
用户消息
    │
    ▼
┌─────────────────────────────────────────────┐
│ MiniclawAgent.chat(userMessage)             │
│                                              │
│  1. skillManager.match(userMessage)         │
│     → 匹配到 Skill 或 null                  │
│                                              │
│  2. 如果匹配成功：                           │
│     skillPrompt = skillManager.getPrompt()  │
│     fullPrompt = systemPrompt + skillPrompt │
│                                              │
│  3. 调用 LLM(fullPrompt, userMessage)       │
└─────────────────────────────────────────────┘
```

### 2.2 核心变更

| 变更点 | 说明 |
|--------|------|
| MiniclawAgentOptions | 新增 `skillManager?: SkillManager` |
| MiniclawAgent 构造函数 | 存储 skillManager 到实例属性 |
| MiniclawAgent.chat() | 匹配技能并注入 prompt |
| createAgentFactory | 接收并传递 skillManager |
| SubagentManager.spawn() | 子代理也传递 skillManager |
| AgentRegistry | createAgent 方法传递 skillManager |

---

## 三、接口变更清单

### 3.1 MiniclawAgentOptions

```typescript
// 文件：src/core/agent/index.ts

// 修改前
export interface MiniclawAgentOptions {
  systemPrompt?: string;
  tools?: AgentTool[];
  agentId?: string;
  isSubagent?: boolean;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
}

// 修改后
import type { SkillManager } from '../skill/index.js';

export interface MiniclawAgentOptions {
  systemPrompt?: string;
  tools?: AgentTool[];
  agentId?: string;
  isSubagent?: boolean;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  skillManager?: SkillManager;  // 新增
}
```

### 3.2 MiniclawAgent 类

```typescript
// 文件：src/core/agent/index.ts

export class MiniclawAgent {
  private config: Config;
  private systemPrompt: string;
  private tools: Map<string, AgentTool>;
  private agentId: string;
  private isSubagent: boolean;
  private thinkingLevel: 'off' | 'low' | 'medium' | 'high';
  private skillManager?: SkillManager;  // 新增

  constructor(config: Config, options: MiniclawAgentOptions = {}) {
    // ... 现有代码 ...
    this.skillManager = options.skillManager;  // 新增
  }
}
```

### 3.3 chat() 方法

```typescript
// 文件：src/core/agent/index.ts

async *streamChat(userMessage: string): AsyncGenerator<StreamChatEvent> {
  // 1. 尝试匹配技能（新增）
  let skillPrompt = '';
  if (this.skillManager) {
    const matchedSkill = this.skillManager.match(userMessage);
    if (matchedSkill) {
      skillPrompt = this.skillManager.getPrompt(matchedSkill.name);
      console.log(`[Agent] 匹配到技能: ${matchedSkill.name}`);
    }
  }

  // 2. 构建完整 system prompt（修改）
  let fullSystemPrompt = this.systemPrompt;
  if (skillPrompt) {
    fullSystemPrompt += `\n\n${skillPrompt}`;
  }

  // 3. 调用 LLM（使用 fullSystemPrompt）
  // ... 现有代码 ...
}
```

### 3.4 createAgentFactory

```typescript
// 文件：src/index.ts

// 修改前
function createAgentFactory(
  _registry: AgentRegistry,
  subagentManager: SubagentManager
) { ... }

// 修改后
function createAgentFactory(
  _registry: AgentRegistry,
  subagentManager: SubagentManager,
  skillManager: SkillManager  // 新增
) {
  return (...) => {
    const agent = new MiniclawAgent(config, {
      systemPrompt: agentConfig?.systemPrompt,
      tools: [],
      agentId,
      isSubagent: isSubagent || false,
      thinkingLevel: agentConfig?.thinkingLevel || 'low',
      skillManager  // 传递
    });
    // ...
  };
}
```

### 3.5 main() 函数

```typescript
// 文件：src/index.ts

// 修改前
const createAgentFn = createAgentFactory(registry, subagentManager);

// 修改后
const createAgentFn = createAgentFactory(registry, subagentManager, skillManager);
```

### 3.6 AgentRegistry

```typescript
// 文件：src/core/agent/registry.ts

// 需要修改 createAgent 方法签名，接收 skillManager 参数
```

---

## 四、文件修改列表

| 文件 | 修改类型 | 说明 |
|------|:--------:|------|
| `src/core/agent/index.ts` | 修改 | 接收 skillManager，chat 中匹配注入 |
| `src/index.ts` | 修改 | 传递 skillManager 到工厂函数 |
| `src/core/agent/registry.ts` | 修改 | createAgent 传递 skillManager |
| `src/core/subagent/manager.ts` | 修改 | spawn 时传递 skillManager |
| `tests/unit/agent/index.test.ts` | 新增 | 技能匹配测试 |

---

## 五、验收标准

- [ ] `npm run build` 成功
- [ ] `npm test` 全部通过
- [ ] Agent 构造函数接收 skillManager
- [ ] chat() 匹配技能并注入 prompt
- [ ] 日志显示匹配到的技能名称

---

## 六、风险与对策

| 风险 | 对策 |
|------|------|
| 技能匹配误判 | 只在明确匹配时注入，保持原有行为 |
| 性能影响 | match() 方法已优化，影响可忽略 |
| 子代理未继承 | 确保 spawn 时传递 skillManager |

---

**等待确认后执行实施计划。**