# 需求规格: 系统提示词按组成部分分类显示

## 元数据

| 属性 | 值 |
|------|-----|
| 版本 | 1.0 |
| 创建日期 | 2026-04-13 |
| 状态 | 待实现 |
| 优先级 | 中 |
| 关联 | 014-optimize-system-prompt-logging |

---

## 1. 需求分析

### 1.1 背景

当前系统提示词的构建涉及多个来源，但在日志打印时将所有内容混在一起，无法区分来源：

```typescript
// src/core/agent/index.ts 构造函数中
let systemPrompt = options?.systemPrompt || DEFAULT_SYSTEM_PROMPT;

if (this.skillManager) {
  const skillPrompts = this.skillManager.getAllPrompts();
  if (skillPrompts) {
    systemPrompt = `${systemPrompt}\n\n${skillPrompts}`;
  }
}
```

**打印结果（当前）:**
```
📋 系统提示词 (4536 字符, ~1520 tokens):

  [前言] (1024 字符):
    你是 ETF 市场分析专家...
  
  [核心原则] (512 字符):
    ...
  
  ... (章节混在一起，看不出哪些来自提示词文件，哪些来自技能)
```

**期望结果:**
```
📋 系统提示词组成 (总计 4536 字符, ~1520 tokens):

  [1] 提示词文件 etf.md (1024 字符)
    你是 ETF 市场分析专家...
    ...省略 200 字符...
    仅提供投资建议参考。

  [2] 技能数据 (3 个技能, 552 字符)
    <available_skills>
      <skill name="weather">...</skill>
      <skill name="feishu-doc">...</skill>
    </available_skills>

  [3] 默认提示词 (2960 字符)
    ## 核心原则
    1. **理解意图**...
```

### 1.2 目标

1. **来源可追溯**: 明确展示每部分内容来自哪里
2. **结构清晰**: 按来源分类，便于调试和理解
3. **统计信息**: 显示每部分的字符数、技能数量等

---

## 2. 功能设计

### 2.1 提示词组成部分

系统提示词由以下部分组成：

| 组成部分 | 来源 | 说明 |
|---------|------|------|
| 提示词文件 | Agent 配置 `systemPrompt` | 用户自定义的提示词文件 |
| 技能数据 | `skillManager.getAllPrompts()` | 可用技能的元数据 |
| 默认提示词 | `DEFAULT_SYSTEM_PROMPT` | 内置的默认提示词 |
| 工具数据 | (待实现) | 可用工具的元数据 |

### 2.2 数据结构设计

```typescript
/**
 * 系统提示词组成部分
 */
interface PromptComponent {
  /** 来源类型 */
  type: 'file' | 'skills' | 'default' | 'tools';
  /** 来源标识（文件名、技能数量等） */
  label: string;
  /** 内容 */
  content: string;
  /** 字符数 */
  chars: number;
  /** 估算 token 数 */
  tokens: number;
  /** 额外元数据 */
  meta?: {
    fileName?: string;      // 文件名
    skillCount?: number;     // 技能数量
    skillNames?: string[];   // 技能名称列表
  };
}

/**
 * Agent 选项扩展
 */
interface MiniclawAgentOptions {
  // ... 现有选项 ...
  
  /** 提示词组成部分（用于日志显示） */
  promptComponents?: PromptComponent[];
}
```

### 2.3 数据流

```
启动时 (src/index.ts)
    │
    ├─→ PromptManager.loadPrompt() → 提示词文件内容
    │
    ├─→ skillManager.getAllPrompts() → 技能数据
    │
    └─→ 创建 Agent 时传递 promptComponents
            │
            ▼
Agent 构造函数 (src/core/agent/index.ts)
    │
    ├─→ 保存 promptComponents 到实例属性
    │
    └─→ 拼接最终 systemPrompt
            │
            ▼
logSendContext() 
    │
    └─→ 按 promptComponents 分类打印
```

---

## 3. 技术实现

### 3.1 新增类型定义

**文件**: `src/core/agent/types.ts` (新建)

```typescript
/**
 * 系统提示词组成部分
 */
export interface PromptComponent {
  /** 来源类型 */
  type: 'file' | 'skills' | 'default' | 'tools';
  /** 来源标识 */
  label: string;
  /** 内容 */
  content: string;
  /** 额外元数据 */
  meta?: {
    fileName?: string;
    skillCount?: number;
    skillNames?: string[];
    toolCount?: number;
  };
}
```

### 3.2 修改 Agent 构造函数

**文件**: `src/core/agent/index.ts`

```typescript
import type { PromptComponent } from './types.js';

export class MiniclawAgent {
  // ... 现有属性 ...
  
  /** 提示词组成部分 */
  private promptComponents: PromptComponent[] = [];
  
  constructor(config: Config, options?: MiniclawAgentOptions) {
    // ... 现有代码 ...
    
    // 保存提示词组成部分
    this.promptComponents = options?.promptComponents || [];
    
    // 构建系统提示词（现有逻辑）
    let systemPrompt = options?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    
    if (this.skillManager) {
      const skillPrompts = this.skillManager.getAllPrompts();
      if (skillPrompts) {
        systemPrompt = `${systemPrompt}\n\n${skillPrompts}`;
      }
    }
    
    // ... 后续代码 ...
  }
}
```

### 3.3 修改 createAgentFactory

**文件**: `src/index.ts`

```typescript
function createAgentFactory(
  _registry: AgentRegistry,
  subagentManager: SubagentManager,
  _promptManager: PromptManager,
  preloadedPrompts: Map<string, string>,
  skillManager?: PiSkillManager
) {
  return (
    sessionKey: string,
    config: Config,
    agentId: string,
    agentConfig?: AgentConfig,
    isSubagent?: boolean
  ) => {
    // ... 现有代码 ...
    
    // 构建提示词组成部分
    const promptComponents: PromptComponent[] = [];
    
    // 1. 提示词文件
    if (systemPrompt && agentConfig?.systemPrompt) {
      promptComponents.push({
        type: 'file',
        label: `提示词文件 ${path.basename(agentConfig.systemPrompt)}`,
        content: systemPrompt,
        meta: {
          fileName: path.basename(agentConfig.systemPrompt)
        }
      });
    }
    
    // 2. 技能数据
    if (skillManager && skillManager.count() > 0) {
      const skillPrompts = skillManager.getAllPrompts();
      if (skillPrompts) {
        promptComponents.push({
          type: 'skills',
          label: `技能数据`,
          content: skillPrompts,
          meta: {
            skillCount: skillManager.count(),
            skillNames: skillManager.getNames()
          }
        });
      }
    }
    
    // 3. 默认提示词（如果没有自定义提示词文件）
    if (!systemPrompt && !agentConfig?.systemPrompt) {
      promptComponents.push({
        type: 'default',
        label: '默认提示词',
        content: DEFAULT_SYSTEM_PROMPT
      });
    }
    
    // 创建 Agent
    const agent = new MiniclawAgent(config, {
      systemPrompt,
      tools: [],
      agentId,
      isSubagent: isSubagent || false,
      thinkingLevel: agentConfig?.thinkingLevel || 'low',
      skillManager,
      promptComponents  // 新增：传递组成部分
    });
    
    // ... 后续代码 ...
  };
}
```

### 3.4 修改 logSendContext

**文件**: `src/core/agent/index.ts`

```typescript
private logSendContext(input: string): void {
  this.logDivider('发送上下文');

  // 打印用户输入
  this.log(`📝 用户输入:`);
  this.log(`  "${input}"`);
  this.log(`   - 输入 Token 估算: ${estimateTokens(input)}`);

  // 打印系统提示词（按组成部分）
  this.printPromptComponents();

  // ... 其他代码 ...
}

/**
 * 打印提示词组成部分
 * @private
 */
private printPromptComponents(): void {
  const systemPrompt = this.agent.state.systemPrompt;
  const totalChars = systemPrompt.length;
  const totalTokens = estimateTokens(systemPrompt);

  if (this.promptComponents.length === 0) {
    // 兼容旧逻辑：没有组成部分信息时，按章节打印
    this.log(`📋 系统提示词 (${totalChars} 字符, ~${totalTokens} tokens):`);
    const sections = parsePromptSections(systemPrompt);
    for (const section of sections) {
      this.log(`  [${section.title}] (${section.content.length} 字符):`);
      const truncated = truncateText(section.content);
      this.log(`    ${truncated.replace(/\n/g, '\n    ')}`);
    }
  } else {
    // 新逻辑：按组成部分打印
    this.log(`📋 系统提示词组成 (总计 ${totalChars} 字符, ~${totalTokens} tokens):`);
    this.log('');

    this.promptComponents.forEach((comp, index) => {
      const chars = comp.content.length;
      const tokens = estimateTokens(comp.content);

      // 构建标签
      let label = comp.label;
      if (comp.meta) {
        if (comp.meta.skillCount !== undefined) {
          label = `${comp.label} (${comp.meta.skillCount} 个技能)`;
        }
      }

      this.log(`  [${index + 1}] ${label} (${chars} 字符)`);
      
      // 打印内容预览
      const truncated = truncateText(comp.content, 400);
      const lines = truncated.split('\n');
      lines.forEach(line => {
        this.log(`      ${line}`);
      });

      // 如果有技能名称列表，打印
      if (comp.meta?.skillNames && comp.meta.skillNames.length > 0) {
        this.log(`      技能列表: ${comp.meta.skillNames.join(', ')}`);
      }

      this.log('');
    });
  }
}
```

---

## 4. 边界情况处理

### 4.1 无提示词文件

如果没有配置自定义提示词文件，使用默认提示词：

```
📋 系统提示词组成 (总计 2048 字符, ~685 tokens):

  [1] 默认提示词 (2048 字符)
    你是 Miniclaw，一个专业、可靠的 AI 助手...
```

### 4.2 无技能

如果没有加载任何技能，跳过技能部分：

```
📋 系统提示词组成 (总计 1024 字符, ~342 tokens):

  [1] 提示词文件 etf.md (1024 字符)
    你是 ETF 市场分析专家...
```

### 4.3 子代理

子代理可能有自己的提示词，按相同逻辑处理：

```
📋 系统提示词组成 (总计 512 字符, ~170 tokens):

  [1] 子代理提示词 (512 字符)
    你是子代理，专门处理...
```

---

## 5. 测试用例

### 5.1 基本功能测试

```typescript
// 测试用例 1: 提示词文件 + 技能
const agent1 = new MiniclawAgent(config, {
  systemPrompt: '来自文件的内容',
  promptComponents: [
    { type: 'file', label: '提示词文件 etf.md', content: '来自文件的内容' },
    { type: 'skills', label: '技能数据', content: '<available_skills>...', meta: { skillCount: 2 } }
  ]
});
// 期望日志显示两个组成部分

// 测试用例 2: 仅默认提示词
const agent2 = new MiniclawAgent(config, {
  promptComponents: [
    { type: 'default', label: '默认提示词', content: DEFAULT_SYSTEM_PROMPT }
  ]
});
// 期望日志显示默认提示词

// 测试用例 3: 空组成部分（兼容旧逻辑）
const agent3 = new MiniclawAgent(config, {});
// 期望按章节打印
```

### 5.2 边界测试

```typescript
// 测试用例 4: 超长提示词文件
const longContent = 'x'.repeat(10000);
// 期望截断显示

// 测试用例 5: 多技能
const manySkills = {
  type: 'skills',
  label: '技能数据',
  content: '...',
  meta: { skillCount: 10, skillNames: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] }
};
// 期望正确显示技能数量和名称列表
```

---

## 6. 影响范围

### 6.1 直接影响

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/core/agent/types.ts` | 新建 | 定义 PromptComponent 类型 |
| `src/core/agent/index.ts` | 修改 | 新增 promptComponents 属性，修改 logSendContext |
| `src/index.ts` | 修改 | 构建 promptComponents 并传递给 Agent |
| `src/core/agent/index.ts` | 导出 | 导出 PromptComponent 类型 |

### 6.2 间接影响

- **日志输出**: 开发者看到的系统提示词日志格式变化
- **调试体验**: 清晰展示提示词来源

---

## 7. 验收标准

- [ ] 系统提示词按组成部分分类打印
- [ ] 显示每部分的来源（文件名、技能数量等）
- [ ] 显示每部分的字符数
- [ ] 兼容旧逻辑（无 promptComponents 时按章节打印）
- [ ] 子代理场景正常工作

---

## 8. 后续优化

1. **工具数据**: 添加工具元数据作为提示词组成部分
2. **缓存信息**: 显示提示词是否来自缓存
3. **时间戳**: 显示提示词加载时间
4. **ANSI 颜色**: 使用颜色高亮不同来源