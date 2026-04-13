# 技术方案: 系统提示词按组成部分分类显示

## 元数据

| 属性 | 值 |
|------|-----|
| 版本 | 1.0 |
| 创建日期 | 2026-04-13 |
| 状态 | 待实现 |
| 关联规格 | spec.md |

---

## 1. 实现步骤（按优先级排序）

### 步骤 1: 新建类型定义文件 (优先级: P0)

**文件**: `src/core/agent/types.ts` (新建)

定义 `PromptComponent` 接口和相关类型。

**实现细节**:
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

**预计耗时**: 10 分钟

---

### 步骤 2: 扩展 Agent 选项接口 (优先级: P0)

**文件**: `src/core/agent/index.ts` (修改)

**变更内容**:
1. 导入 `PromptComponent` 类型
2. 扩展 `MiniclawAgentOptions` 接口，添加 `promptComponents` 选项
3. 在类中添加私有属性 `promptComponents: PromptComponent[]`
4. 在构造函数中保存 `promptComponents`

**代码变更位置**:
- L18-35: 类型定义区域，添加导入
- L41-56: `MiniclawAgentOptions` 接口，添加属性
- L274-316: 构造函数，添加属性初始化

**预计耗时**: 15 分钟

---

### 步骤 3: 实现提示词组成部分打印方法 (优先级: P0)

**文件**: `src/core/agent/index.ts` (修改)

**新增方法**: `printPromptComponents()`

**实现逻辑**:
1. 获取完整的 systemPrompt
2. 计算总字符数和总 token 数
3. 如果 `promptComponents` 为空，使用旧逻辑（按章节打印）
4. 如果 `promptComponents` 不为空：
   - 打印标题行：`📋 系统提示词组成 (总计 X 字符, ~Y tokens):`
   - 遍历每个组成部分
   - 打印序号、标签、字符数
   - 打印内容预览（截断）
   - 如果有技能名称列表，打印技能列表

**预计耗时**: 30 分钟

---

### 步骤 4: 修改 logSendContext 方法 (优先级: P0)

**文件**: `src/core/agent/index.ts` (修改)

**变更内容**:
将现有的系统提示词打印逻辑替换为调用 `printPromptComponents()` 方法。

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

**预计耗时**: 5 分钟

---

### 步骤 5: 在 createAgentFactory 中构建 promptComponents (优先级: P0)

**文件**: `src/index.ts` (修改)

**变更内容**:
1. 导入 `PromptComponent` 类型
2. 在创建 Agent 前，构建 `promptComponents` 数组
3. 将 `promptComponents` 传递给 Agent 构造函数

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
  // 注意：需要导入 DEFAULT_SYSTEM_PROMPT
  promptComponents.push({
    type: 'default',
    label: '默认提示词',
    content: DEFAULT_SYSTEM_PROMPT
  });
}
```

**注意事项**:
- `DEFAULT_SYSTEM_PROMPT` 在 `MiniclawAgent` 中定义，需要导出或复制
- `systemPrompt` 变量在当前代码中已存在
- 需要导入 `path` 模块（用于 `path.basename`）

**预计耗时**: 25 分钟

---

### 步骤 6: 导出 DEFAULT_SYSTEM_PROMPT (优先级: P1)

**文件**: `src/core/agent/index.ts` (修改)

**变更内容**:
将 `DEFAULT_SYSTEM_PROMPT` 常量导出，以便在 `src/index.ts` 中使用。

**代码变更**:
```typescript
// 从
const DEFAULT_SYSTEM_PROMPT = `...`;

// 改为
export const DEFAULT_SYSTEM_PROMPT = `...`;
```

**预计耗时**: 2 分钟

---

## 2. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/core/agent/types.ts` | 新建 | 定义 `PromptComponent` 接口 |
| `src/core/agent/index.ts` | 修改 | 新增 `promptComponents` 属性，新增 `printPromptComponents` 方法，修改 `logSendContext`，导出 `DEFAULT_SYSTEM_PROMPT` |
| `src/index.ts` | 修改 | 构建 `promptComponents` 数组，传递给 Agent 构造函数 |

---

## 3. 技术决策说明

### 3.1 数据流设计

```
启动时 (src/index.ts)
    │
    ├─→ PromptManager.loadPrompt() → 提示词文件内容
    │
    ├─→ skillManager.getAllPrompts() → 技能数据
    │
    └─→ 构建 promptComponents 数组
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
    └─→ 调用 printPromptComponents()
            │
            └─→ 按 promptComponents 分类打印
```

### 3.2 类型定义位置

选择在 `src/core/agent/types.ts` 新建文件定义类型，而不是在 `src/index.ts` 或 `src/core/agent/index.ts` 中内联定义，原因：
1. 类型可复用，未来其他模块可能需要
2. 保持代码组织清晰
3. 便于单元测试

### 3.3 兼容性考虑

- 如果 `promptComponents` 为空，回退到旧逻辑（按章节打印）
- 不影响现有 API 和配置格式
- 仅影响日志输出格式，不影响功能行为

### 3.4 默认提示词处理

**问题**: `DEFAULT_SYSTEM_PROMPT` 如何传递？

**方案**: 
1. 如果没有自定义提示词文件，`systemPrompt` 为 `undefined`
2. Agent 构造函数内部会使用 `DEFAULT_SYSTEM_PROMPT` 作为后备
3. 在 `createAgentFactory` 中，需要导入 `DEFAULT_SYSTEM_PROMPT` 来构建 `promptComponents`

**实现**: 导出 `DEFAULT_SYSTEM_PROMPT`，在 `src/index.ts` 中导入使用。

---

## 4. 数据结构定义

### 4.1 PromptComponent 接口

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
    /** 文件名（type 为 'file' 时） */
    fileName?: string;
    /** 技能数量（type 为 'skills' 时） */
    skillCount?: number;
    /** 技能名称列表（type 为 'skills' 时） */
    skillNames?: string[];
    /** 工具数量（type 为 'tools' 时，预留） */
    toolCount?: number;
  };
}
```

### 4.2 MiniclawAgentOptions 扩展

```typescript
export interface MiniclawAgentOptions {
  systemPrompt?: string;
  tools?: AgentTool[];
  agentId?: string;
  isSubagent?: boolean;
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  skillManager?: PiSkillManager;
  /** 提示词组成部分（用于日志显示） */
  promptComponents?: PromptComponent[];  // 新增
}
```

---

## 5. 风险点和边界情况处理

### 5.1 风险点

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `promptComponents` 为空 | 日志格式回退到旧逻辑 | 已处理：`printPromptComponents` 会检测并回退 |
| `DEFAULT_SYSTEM_PROMPT` 未导出 | 编译错误 | 需要导出常量 |
| `path` 模块未导入 | 运行时错误 | 需要导入 `path` |
| 技能管理器未初始化 | 跳过技能部分 | 已处理：检查 `skillManager` 存在性 |

### 5.2 边界情况

#### 5.2.1 无提示词文件

```typescript
// 场景：没有配置自定义提示词文件
// 处理：使用默认提示词
if (!systemPrompt && !agentConfig?.systemPrompt) {
  promptComponents.push({
    type: 'default',
    label: '默认提示词',
    content: DEFAULT_SYSTEM_PROMPT
  });
}
```

**日志输出示例**:
```
📋 系统提示词组成 (总计 2048 字符, ~685 tokens):

  [1] 默认提示词 (2048 字符)
    你是 Miniclaw，一个专业、可靠的 AI 助手...
    ...省略 200 字符...
    仅提供投资建议参考。
```

#### 5.2.2 无技能

```typescript
// 场景：skillManager.count() === 0
// 处理：跳过技能部分，不添加到 promptComponents
if (skillManager && skillManager.count() > 0) {
  // 只有在有技能时才添加
}
```

**日志输出示例**:
```
📋 系统提示词组成 (总计 1024 字符, ~342 tokens):

  [1] 提示词文件 etf.md (1024 字符)
    你是 ETF 市场分析专家...
```

#### 5.2.3 子代理

```typescript
// 场景：isSubagent === true
// 处理：与主代理相同的逻辑，只是 agentId 不同
// 无需特殊处理
```

**日志输出示例**:
```
[Subagent:etf] 📋 系统提示词组成 (总计 512 字符, ~170 tokens):

  [1] 子代理提示词 (512 字符)
    你是子代理，专门处理...
```

#### 5.2.4 超长内容

```typescript
// 场景：提示词内容超过 400 字符
// 处理：使用 truncateText() 截断显示
const truncated = truncateText(comp.content, 400);
```

**截断函数已存在**: `truncateText(text: string, maxLength: number = 400): string`

#### 5.2.5 提示词文件 + 技能 + 默认提示词组合

**场景分析**:
- 如果有自定义提示词文件，使用文件内容
- 如果没有，使用默认提示词
- 技能数据总是追加（如果存在）

**组合情况**:

| 提示词文件 | 技能 | 默认提示词 | promptComponents |
|-----------|------|-----------|-----------------|
| ✅ | ✅ | ❌ | [file, skills] |
| ✅ | ❌ | ❌ | [file] |
| ❌ | ✅ | ✅ | [default, skills] |
| ❌ | ❌ | ✅ | [default] |

**注意**: 不会同时存在 `file` 和 `default`，因为它们是互斥的。

---

## 6. 测试策略

### 6.1 单元测试

测试文件: `src/core/agent/__tests__/prompt-components.test.ts` (新建)

```typescript
describe('PromptComponent', () => {
  it('should create file type component', () => {
    const comp: PromptComponent = {
      type: 'file',
      label: '提示词文件 etf.md',
      content: '...',
      meta: { fileName: 'etf.md' }
    };
    expect(comp.type).toBe('file');
  });

  it('should create skills type component', () => {
    const comp: PromptComponent = {
      type: 'skills',
      label: '技能数据',
      content: '<available_skills>...</available_skills>',
      meta: { skillCount: 3, skillNames: ['a', 'b', 'c'] }
    };
    expect(comp.type).toBe('skills');
    expect(comp.meta?.skillCount).toBe(3);
  });
});
```

### 6.2 集成测试

手动测试场景:
1. 启动 CLI 模式，检查日志输出格式
2. 配置自定义提示词文件，检查是否显示文件名
3. 加载技能，检查是否显示技能数量和名称
4. 不配置提示词文件，检查是否显示默认提示词

---

## 7. 预估工作量

| 步骤 | 预计耗时 |
|------|----------|
| 步骤 1: 新建类型定义文件 | 10 分钟 |
| 步骤 2: 扩展 Agent 选项接口 | 15 分钟 |
| 步骤 3: 实现打印方法 | 30 分钟 |
| 步骤 4: 修改 logSendContext | 5 分钟 |
| 步骤 5: 构建 promptComponents | 25 分钟 |
| 步骤 6: 导出 DEFAULT_SYSTEM_PROMPT | 2 分钟 |
| **总计** | **约 1.5 小时** |

---

## 8. 依赖关系

```
步骤 1 (类型定义)
    │
    ├─→ 步骤 2 (扩展接口)
    │       │
    │       └─→ 步骤 3 (打印方法)
    │               │
    │               └─→ 步骤 4 (修改 logSendContext)
    │
    └─→ 步骤 5 (构建 promptComponents)
            │
            └─→ 步骤 6 (导出常量)
```

**建议执行顺序**: 1 → 2 → 3 → 4 → 6 → 5

---

## 9. 验收检查清单

- [ ] 新建 `src/core/agent/types.ts`，定义 `PromptComponent` 接口
- [ ] 修改 `MiniclawAgentOptions`，添加 `promptComponents` 属性
- [ ] 在 `MiniclawAgent` 类中添加 `promptComponents` 私有属性
- [ ] 实现 `printPromptComponents()` 方法
- [ ] 修改 `logSendContext()` 方法调用 `printPromptComponents()`
- [ ] 导出 `DEFAULT_SYSTEM_PROMPT` 常量
- [ ] 在 `createAgentFactory` 中构建 `promptComponents` 数组
- [ ] 测试有提示词文件时的日志输出
- [ ] 测试有技能时的日志输出
- [ ] 测试无提示词文件时的日志输出（默认提示词）
- [ ] 测试子代理场景