# 任务清单: 系统提示词按组成部分分类显示

## 元数据

| 属性 | 值 |
|------|-----|
| 版本 | 1.0 |
| 创建日期 | 2026-04-13 |
| 状态 | 待执行 |
| 关联规格 | spec.md |
| 关联计划 | plan.md |

---

## 任务列表

### TASK-001: 新建类型定义文件

| 属性 | 值 |
|------|-----|
| **ID** | TASK-001 |
| **优先级** | P0 |
| **MVP** | ✅ 是 |
| **预估时间** | 10 分钟 |
| **依赖** | 无 |

**描述**:
新建 `src/core/agent/types.ts` 文件，定义 `PromptComponent` 接口。

**实现内容**:
```typescript
/**
 * 系统提示词组成部分
 */
export interface PromptComponent {
  /** 来源类型 */
  type: 'file' | 'skills' | 'default' | 'tools';
  /** 来源标识（文件名、技能数量等） */
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

**验收标准**:
- [ ] 文件 `src/core/agent/types.ts` 已创建
- [ ] `PromptComponent` 接口定义完整，包含所有字段
- [ ] TypeScript 类型检查通过

---

### TASK-002: 扩展 Agent 选项接口

| 属性 | 值 |
|------|-----|
| **ID** | TASK-002 |
| **优先级** | P0 |
| **MVP** | ✅ 是 |
| **预估时间** | 15 分钟 |
| **依赖** | TASK-001 |

**描述**:
修改 `src/core/agent/index.ts`，扩展 `MiniclawAgentOptions` 接口并添加 `promptComponents` 属性。

**实现内容**:
1. 导入 `PromptComponent` 类型
2. 在 `MiniclawAgentOptions` 接口中添加 `promptComponents?: PromptComponent[]` 属性
3. 在 `MiniclawAgent` 类中添加私有属性 `private promptComponents: PromptComponent[] = []`
4. 在构造函数中保存 `promptComponents`

**代码变更位置**:
- L18-35: 类型定义区域，添加导入
- L41-56: `MiniclawAgentOptions` 接口，添加属性
- L274-316: 构造函数，添加属性初始化

**验收标准**:
- [ ] `PromptComponent` 类型已导入
- [ ] `MiniclawAgentOptions` 接口包含 `promptComponents` 属性
- [ ] `MiniclawAgent` 类有 `promptComponents` 私有属性
- [ ] 构造函数正确初始化 `promptComponents`
- [ ] TypeScript 类型检查通过

---

### TASK-003: 实现提示词组成部分打印方法

| 属性 | 值 |
|------|-----|
| **ID** | TASK-003 |
| **优先级** | P0 |
| **MVP** | ✅ 是 |
| **预估时间** | 30 分钟 |
| **依赖** | TASK-002 |

**描述**:
在 `MiniclawAgent` 类中新增 `printPromptComponents()` 方法，实现按组成部分打印系统提示词。

**实现逻辑**:
1. 获取完整的 `systemPrompt`
2. 计算总字符数和总 token 数（使用 `estimateTokens` 函数）
3. 如果 `promptComponents` 为空，使用旧逻辑（按章节打印）
4. 如果 `promptComponents` 不为空：
   - 打印标题行：`📋 系统提示词组成 (总计 X 字符, ~Y tokens):`
   - 遍历每个组成部分
   - 打印序号、标签、字符数
   - 打印内容预览（使用 `truncateText` 截断）
   - 如果有技能名称列表，打印技能列表

**验收标准**:
- [ ] `printPromptComponents()` 方法已实现
- [ ] 当 `promptComponents` 为空时，回退到旧的按章节打印逻辑
- [ ] 当 `promptComponents` 不为空时，按组成部分打印
- [ ] 每个组成部分显示：序号、标签、字符数、内容预览
- [ ] 技能组成部分显示技能数量和名称列表
- [ ] TypeScript 类型检查通过

---

### TASK-004: 修改 logSendContext 方法

| 属性 | 值 |
|------|-----|
| **ID** | TASK-004 |
| **优先级** | P0 |
| **MVP** | ✅ 是 |
| **预估时间** | 5 分钟 |
| **依赖** | TASK-003 |

**描述**:
修改 `logSendContext()` 方法，将现有的系统提示词打印逻辑替换为调用 `printPromptComponents()` 方法。

**代码变更位置**:
- L565-579: `logSendContext` 方法中的系统提示词打印部分

**原代码**:
```typescript
// 打印系统提示词（按章节结构化）
const systemPrompt = this.agent.state.systemPrompt;
this.log(`📋 系统提示词 (${systemPrompt.length} 字符, ~${estimateTokens(systemPrompt)} tokens):`);

const sections = parsePromptSections(systemPrompt);
for (const section of sections) {
  this.log(`  [${section.title}] (${section.content.length} 字符):`);
  const truncated = truncateText(section.content);
  this.log(`    ${truncated.replace(/\n/g, '\n    ')}`);
}
```

**替换为**:
```typescript
// 打印系统提示词（按组成部分）
this.printPromptComponents();
```

**验收标准**:
- [ ] `logSendContext()` 方法已修改
- [ ] 旧的系统提示词打印代码已移除
- [ ] 调用 `printPromptComponents()` 方法
- [ ] TypeScript 类型检查通过

---

### TASK-005: 导出 DEFAULT_SYSTEM_PROMPT 常量

| 属性 | 值 |
|------|-----|
| **ID** | TASK-005 |
| **优先级** | P1 |
| **MVP** | ✅ 是 |
| **预估时间** | 2 分钟 |
| **依赖** | 无 |

**描述**:
将 `DEFAULT_SYSTEM_PROMPT` 常量从 `src/core/agent/index.ts` 导出，以便在 `src/index.ts` 中使用。

**代码变更**:
```typescript
// 从
const DEFAULT_SYSTEM_PROMPT = `...`;

// 改为
export const DEFAULT_SYSTEM_PROMPT = `...`;
```

**验收标准**:
- [ ] `DEFAULT_SYSTEM_PROMPT` 已导出
- [ ] TypeScript 类型检查通过

---

### TASK-006: 在 createAgentFactory 中构建 promptComponents

| 属性 | 值 |
|------|-----|
| **ID** | TASK-006 |
| **优先级** | P0 |
| **MVP** | ✅ 是 |
| **预估时间** | 25 分钟 |
| **依赖** | TASK-001, TASK-005 |

**描述**:
修改 `src/index.ts`，在创建 Agent 前构建 `promptComponents` 数组，并传递给 Agent 构造函数。

**实现内容**:
1. 导入 `PromptComponent` 类型
2. 导入 `DEFAULT_SYSTEM_PROMPT` 常量
3. 导入 `path` 模块
4. 在创建 Agent 前，构建 `promptComponents` 数组：
   - 如果有自定义提示词文件，添加 `type: 'file'` 组成部分
   - 如果有技能，添加 `type: 'skills'` 组成部分
   - 如果没有自定义提示词文件，添加 `type: 'default'` 组成部分
5. 将 `promptComponents` 传递给 Agent 构造函数

**构建逻辑**:
```typescript
const promptComponents: PromptComponent[] = [];

// 1. 提示词文件（如果有自定义提示词）
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

// 2. 技能数据（如果有技能）
if (skillManager && skillManager.count() > 0) {
  const skillPrompts = skillManager.getAllPrompts();
  if (skillPrompts) {
    promptComponents.push({
      type: 'skills',
      label: '技能数据',
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
```

**验收标准**:
- [ ] `PromptComponent` 类型已导入
- [ ] `DEFAULT_SYSTEM_PROMPT` 常量已导入
- [ ] `path` 模块已导入
- [ ] `promptComponents` 数组构建逻辑正确
- [ ] `promptComponents` 已传递给 Agent 构造函数
- [ ] TypeScript 类型检查通过

---

### TASK-007: 测试有提示词文件时的日志输出

| 属性 | 值 |
|------|-----|
| **ID** | TASK-007 |
| **优先级** | P2 |
| **MVP** | ❌ 否 |
| **预估时间** | 10 分钟 |
| **依赖** | TASK-001 ~ TASK-006 |

**描述**:
手动测试场景：配置自定义提示词文件，检查日志输出是否正确显示文件名。

**测试步骤**:
1. 配置一个 agent 使用自定义提示词文件
2. 启动 CLI 模式
3. 发送一条消息
4. 检查日志输出是否包含 `提示词文件 xxx.md`

**预期输出**:
```
📋 系统提示词组成 (总计 X 字符, ~Y tokens):

  [1] 提示词文件 etf.md (1024 字符)
    你是 ETF 市场分析专家...
```

**验收标准**:
- [ ] 日志显示提示词文件名
- [ ] 日志显示字符数和 token 数
- [ ] 内容预览正确截断

---

### TASK-008: 测试有技能时的日志输出

| 属性 | 值 |
|------|-----|
| **ID** | TASK-008 |
| **优先级** | P2 |
| **MVP** | ❌ 否 |
| **预估时间** | 10 分钟 |
| **依赖** | TASK-001 ~ TASK-006 |

**描述**:
手动测试场景：加载技能，检查日志输出是否正确显示技能数量和名称。

**测试步骤**:
1. 加载一个或多个技能
2. 启动 CLI 模式
3. 发送一条消息
4. 检查日志输出是否包含技能数量和名称列表

**预期输出**:
```
📋 系统提示词组成 (总计 X 字符, ~Y tokens):

  [1] 提示词文件 xxx.md (N 字符)
    ...

  [2] 技能数据 (3 个技能, 552 字符)
    <available_skills>
    ...
    技能列表: weather, feishu-doc, feishu-wiki
```

**验收标准**:
- [ ] 日志显示技能数量
- [ ] 日志显示技能名称列表
- [ ] 日志显示技能数据的字符数

---

### TASK-009: 测试无提示词文件时的日志输出

| 属性 | 值 |
|------|-----|
| **ID** | TASK-009 |
| **优先级** | P2 |
| **MVP** | ❌ 否 |
| **预估时间** | 5 分钟 |
| **依赖** | TASK-001 ~ TASK-006 |

**描述**:
手动测试场景：不配置自定义提示词文件，检查日志输出是否显示默认提示词。

**测试步骤**:
1. 不配置自定义提示词文件
2. 启动 CLI 模式
3. 发送一条消息
4. 检查日志输出是否包含 `默认提示词`

**预期输出**:
```
📋 系统提示词组成 (总计 2048 字符, ~685 tokens):

  [1] 默认提示词 (2048 字符)
    你是 Miniclaw，一个专业、可靠的 AI 助手...
```

**验收标准**:
- [ ] 日志显示 `默认提示词`
- [ ] 日志显示默认提示词的字符数
- [ ] 内容预览正确截断

---

### TASK-010: 测试子代理场景

| 属性 | 值 |
|------|-----|
| **ID** | TASK-010 |
| **优先级** | P2 |
| **MVP** | ❌ 否 |
| **预估时间** | 10 分钟 |
| **依赖** | TASK-001 ~ TASK-006 |

**描述**:
手动测试场景：创建子代理，检查日志输出是否正常工作。

**测试步骤**:
1. 配置一个子代理
2. 触发子代理创建
3. 检查子代理的日志输出

**预期输出**:
```
[Subagent:xxx] 📋 系统提示词组成 (总计 X 字符, ~Y tokens):

  [1] 子代理提示词 (N 字符)
    ...
```

**验收标准**:
- [ ] 子代理日志正确显示系统提示词组成
- [ ] 子代理标签前缀正确（如 `[Subagent:xxx]`）

---

## 依赖关系图

```
TASK-001 (类型定义)
    │
    ├──────────────────┐
    │                  │
    ▼                  ▼
TASK-002 (扩展接口)   TASK-005 (导出常量)
    │                  │
    ▼                  │
TASK-003 (打印方法)    │
    │                  │
    ▼                  │
TASK-004 (修改日志)    │
    │                  │
    └──────┬───────────┘
           │
           ▼
      TASK-006 (构建组件)
           │
           ├──────────────────────┐
           │                       │
           ▼                       ▼
      TASK-007 (测试-文件)    TASK-008 (测试-技能)
           │                       │
           │                       │
           └───────────┬───────────┘
                       │
                       ▼
                  TASK-009 (测试-默认)
                       │
                       ▼
                  TASK-010 (测试-子代理)
```

---

## 统计信息

| 指标 | 值 |
|------|-----|
| **总任务数** | 10 |
| **MVP 任务数** | 6 |
| **非 MVP 任务数** | 4 |
| **预估总时间** | 122 分钟 (约 2 小时) |
| **MVP 预估时间** | 87 分钟 (约 1.5 小时) |

---

## MVP 范围

MVP 包含以下任务：

| 任务 ID | 描述 | 预估时间 |
|---------|------|----------|
| TASK-001 | 新建类型定义文件 | 10 分钟 |
| TASK-002 | 扩展 Agent 选项接口 | 15 分钟 |
| TASK-003 | 实现提示词组成部分打印方法 | 30 分钟 |
| TASK-004 | 修改 logSendContext 方法 | 5 分钟 |
| TASK-005 | 导出 DEFAULT_SYSTEM_PROMPT 常量 | 2 分钟 |
| TASK-006 | 在 createAgentFactory 中构建 promptComponents | 25 分钟 |

**MVP 目标**: 实现系统提示词按组成部分分类显示的核心功能。

---

## 非 MVP 范围

非 MVP 任务为测试任务，可在核心功能完成后进行：

| 任务 ID | 描述 | 预估时间 |
|---------|------|----------|
| TASK-007 | 测试有提示词文件时的日志输出 | 10 分钟 |
| TASK-008 | 测试有技能时的日志输出 | 10 分钟 |
| TASK-009 | 测试无提示词文件时的日志输出 | 5 分钟 |
| TASK-010 | 测试子代理场景 | 10 分钟 |

---

## 执行顺序建议

1. **第一批**: TASK-001, TASK-005 (可并行)
2. **第二批**: TASK-002 (依赖 TASK-001)
3. **第三批**: TASK-003 (依赖 TASK-002)
4. **第四批**: TASK-004 (依赖 TASK-003)
5. **第五批**: TASK-006 (依赖 TASK-001, TASK-005)
6. **第六批**: TASK-007, TASK-008, TASK-009, TASK-010 (可并行，均为测试任务)

---

## 验收检查清单

### 功能验收

- [ ] 系统提示词按组成部分分类打印
- [ ] 显示每部分的来源（文件名、技能数量等）
- [ ] 显示每部分的字符数
- [ ] 兼容旧逻辑（无 promptComponents 时按章节打印）
- [ ] 子代理场景正常工作

### 代码质量

- [ ] TypeScript 类型检查通过
- [ ] 代码风格符合项目规范
- [ ] 注释清晰完整

### 测试验证

- [ ] 有提示词文件时的日志输出正确
- [ ] 有技能时的日志输出正确
- [ ] 无提示词文件时的日志输出正确
- [ ] 子代理场景日志输出正确