# Miniclaw 八期需求文档 (v0.8)

> Skill 系统与 Agent 集成

## 一、背景

### 1.1 当前状态 (2026-04-03)

**Skill 系统已完成模块：**

| 模块 | 文件 | 状态 |
|------|------|:----:|
| 类型定义 | `src/core/skill/types.ts` | ✅ |
| 技能加载器 | `src/core/skill/loader.ts` | ✅ |
| 技能匹配器 | `src/core/skill/matcher.ts` | ✅ |
| 技能管理器 | `src/core/skill/manager.ts` | ✅ |
| 单元测试 | `tests/unit/skill/*.test.ts` | ✅ 392 passed |
| 初始化入口 | `src/index.ts` | ✅ 初始化 SkillManager |

### 1.2 核心问题

**SkillManager 已创建但未与 Agent 集成！**

```typescript
// src/index.ts 中创建了 SkillManager
const skillManager = createSkillManager({ autoLoad: true });

// 但 MiniclawAgent 构造函数不接收 skillManager
const agent = new MiniclawAgent(config, {
  systemPrompt: agentConfig?.systemPrompt,
  tools: [],
  agentId,
  isSubagent: false,
  thinkingLevel: 'low'
  // ❌ 缺少 skillManager 参数
});
```

**结果：技能永远不会被触发，即使匹配成功也不生效。**

---

## 二、需求设计

### 2.1 需求 1：Agent 集成 SkillManager

**修改 `MiniclawAgentOptions` 接口：**

```typescript
// src/core/agent/index.ts
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

**在 MiniclawAgent 类中存储并使用：**

```typescript
export class MiniclawAgent {
  private skillManager?: SkillManager;
  
  constructor(config: Config, options: MiniclawAgentOptions = {}) {
    this.skillManager = options.skillManager;
    // ...
  }
}
```

### 2.2 需求 2：在 chat 时自动匹配并注入技能

**修改 chat() 方法：**

```typescript
async chat(userMessage: string): Promise<string> {
  // 1. 尝试匹配技能
  let skillPrompt = '';
  if (this.skillManager) {
    const matchedSkill = this.skillManager.match(userMessage);
    if (matchedSkill) {
      skillPrompt = this.skillManager.getPrompt(matchedSkill.name);
      console.log(`[Agent] 匹配到技能: ${matchedSkill.name}`);
    }
  }
  
  // 2. 构建完整的 system prompt
  let fullSystemPrompt = this.systemPrompt;
  if (skillPrompt) {
    fullSystemPrompt += `\n\n${skillPrompt}`;
  }
  
  // 3. 调用大模型...
}
```

### 2.3 需求 3：传递 SkillManager 到 Agent 工厂

**修改 `createAgentFactory` 函数：**

```typescript
// src/index.ts
function createAgentFactory(
  _registry: AgentRegistry,
  subagentManager: SubagentManager,
  skillManager: SkillManager  // 新增参数
) {
  return (...) => {
    const agent = new MiniclawAgent(config, {
      systemPrompt: agentConfig?.systemPrompt,
      tools: [],
      agentId,
      isSubagent: isSubagent || false,
      thinkingLevel: agentConfig?.thinkingLevel || 'low',
      skillManager  // 传递给 Agent
    });
    // ...
  };
}
```

**更新 main() 函数：**

```typescript
// src/index.ts main() 函数中
const createAgentFn = createAgentFactory(registry, subagentManager, skillManager);
```

### 2.4 需求 4：子代理也继承 SkillManager

子代理创建时也需要传入 skillManager：

```typescript
// src/core/subagent/manager.ts
spawn(options: SpawnOptions) {
  const agent = this.registry.getOrCreate(sessionKey, agentId, {
    isSubagent: true,
    skillManager: this.skillManager  // 子代理也需要
  });
}
```

---

## 三、实施计划

| 步骤 | 文件 | 修改内容 |
|:----:|------|----------|
| 1 | `src/core/agent/index.ts` | 接收 skillManager 参数，在 chat 中匹配注入 |
| 2 | `src/index.ts` | 传递 skillManager 到 Agent 工厂 |
| 3 | `src/core/agent/registry.ts` | createAgent 方法传递 skillManager |
| 4 | `src/core/subagent/manager.ts` | spawn 时传递 skillManager |
| 5 | `tests/` | 更新测试用例 |

---

## 四、验收标准

- [ ] Agent 构造函数接收 skillManager 参数
- [ ] chat() 方法中自动匹配技能
- [ ] 匹配到的技能注入到 system prompt
- [ ] 日志显示匹配到的技能名称
- [ ] 子代理也能使用技能系统
- [ ] 所有测试通过

---

## 五、测试用例

### 测试 1：技能匹配

```typescript
// 创建带技能的 Agent
const skillManager = createSkillManager();
const agent = new MiniclawAgent(config, { skillManager });

// 发送包含触发词的消息
await agent.chat('今天天气怎么样？');

// 预期：日志显示 [Agent] 匹配到技能: weather
// 预期：system prompt 包含 weather 技能内容
```

### 测试 2：无匹配时正常工作

```typescript
await agent.chat('随便聊聊');

// 预期：无技能匹配，正常回复
```

---

## 六、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-04-03 | v0.8.0 | 八期需求文档：Skill 系统与 Agent 集成 |