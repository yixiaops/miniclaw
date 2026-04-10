# Data Model - 系统提示词可配置化

## 1. 核心类型定义

### 1.1 PromptTemplate 接口

```typescript
/**
 * 系统提示词模板
 *
 * 表示一个完整的提示词模板，包含元数据和内容。
 */
export interface PromptTemplate {
  /** 模板名称 */
  name: string;

  /** 模板描述 */
  description?: string;

  /** 推荐使用的模型 */
  model?: string;

  /** 可用工具列表（未来扩展） */
  tools?: string[];

  /** 模板标签（用于分类） */
  tags?: string[];

  /** 模板版本 */
  version?: string;

  /** 模板作者 */
  author?: string;

  /** 提示词内容 */
  content: string;

  /** 模板文件路径（如果是从文件加载） */
  filePath?: string;

  /** 加载时间戳 */
  loadedAt?: number;
}
```

### 1.2 PromptReference 类型

```typescript
/**
 * 提示词引用
 *
 * 用于配置文件中的 systemPrompt 字段，支持两种模式：
 * 1. 直接文本内容（向后兼容）
 * 2. 文件路径引用
 */
export type PromptReference = string; // 直接文本或文件路径

/**
 * 检查是否为文件路径引用
 */
export function isFilePathReference(ref: PromptReference): boolean {
  return ref.startsWith('file://') ||
         ref.startsWith('./') ||
         ref.startsWith('~/') ||
         ref.startsWith('/');
}
```

### 1.3 PromptLoadOptions 接口

```typescript
/**
 * 模板加载选项
 */
export interface PromptLoadOptions {
  /** 是否缓存解析结果 */
  cache?: boolean;

  /** 后备提示词（加载失败时使用） */
  fallback?: string;

  /** 是否记录详细日志 */
  verbose?: boolean;

  /** 基础目录（用于解析相对路径） */
  baseDir?: string;
}
```

### 1.4 PromptParseResult 接口

```typescript
/**
 * 模板解析结果
 */
export interface PromptParseResult {
  /** 是否成功 */
  success: boolean;

  /** 解析后的模板 */
  template?: PromptTemplate;

  /** 错误信息 */
  error?: string;

  /** 是否使用了后备值 */
  usedFallback?: boolean;
}
```

## 2. PromptManager 类设计

### 2.1 类定义

```typescript
/**
 * 提示词管理器
 *
 * 负责模板的加载、解析、缓存和查询。
 */
export class PromptManager {
  /** 模板缓存 */
  private cache: Map<string, PromptTemplate> = new Map();

  /** 默认模板路径 */
  private readonly defaultPromptPath: string;

  /** 后备提示词 */
  private readonly fallbackPrompt: string;

  /**
   * 创建 PromptManager 实例
   *
   * @param options - 配置选项
   */
  constructor(options?: {
    defaultPromptPath?: string;
    fallbackPrompt?: string;
  });

  /**
   * 加载提示词
   *
   * @param reference - 提示词引用（直接文本或文件路径）
   * @param options - 加载选项
   * @returns 加载结果
   */
  async loadPrompt(
    reference: PromptReference,
    options?: PromptLoadOptions
  ): Promise<PromptParseResult>;

  /**
   * 解析模板文件
   *
   * @param filePath - 文件路径
   * @returns 解析结果
   */
  async parseTemplateFile(filePath: string): Promise<PromptParseResult>;

  /**
   * 解析 YAML frontmatter
   *
   * @param content - 文件内容
   * @returns 模板对象
   */
  parseFrontmatter(content: string): PromptTemplate;

  /**
   * 获取缓存的模板
   *
   * @param key - 缓存键（文件路径）
   * @returns 模板或 undefined
   */
  getCached(key: string): PromptTemplate | undefined;

  /**
   * 清除缓存
   */
  clearCache(): void;

  /**
   * 重新加载模板
   *
   * @param reference - 提示词引用
   * @returns 加载结果
   */
  async reloadPrompt(reference: PromptReference): Promise<PromptParseResult>;
}
```

### 2.2 核心方法实现逻辑

#### loadPrompt()

```
输入: PromptReference, PromptLoadOptions
输出: PromptParseResult

流程:
1. 检查是否为文件路径引用
   - 是 → 调用 parseTemplateFile()
   - 否 → 返回直接文本内容

2. parseTemplateFile()
   a. 检查缓存
   b. 读取文件（UTF-8）
   c. 解析 frontmatter
   d. 缓存结果
   e. 返回模板

3. 错误处理
   - 文件不存在 → 使用 fallback
   - 解析失败 → 返回原始内容 + 警告
   - 编码错误 → 记录错误 + fallback
```

#### parseFrontmatter()

```
输入: string (文件内容)
输出: PromptTemplate

流程:
1. 检查是否以 '---' 开头
   - 否 → 返回 { content: 原始内容 }

2. 提取 frontmatter (第一个 '---' 到第二个 '---')
   - 成功 → 解析 YAML
   - 失败 → 返回 { content: 原始内容 }

3. 提取 markdown 正文
   - 第二个 '---' 之后的内容

4. 返回模板对象
   {
     ...yamlMetadata,
     content: markdownContent
   }
```

## 3. 文件结构

### 3.1 新增目录结构

```
~/.miniclaw/
├── config.json          # 主配置文件（现有）
├── prompts/             # 提示词模板目录（新增）
│   ├── default.md       # 默认模板
│   ├── main.md          # main Agent 模板
│   ├── etf.md           # ETF 分析师模板
│   └── policy.md        # 政策分析师模板
├── memory/              # 记忆存储（现有）
├── sessions/            # 会话数据（现有）
└── skills/              # 技能目录（现有）
```

### 3.2 默认模板文件示例

**文件**: `~/.miniclaw/prompts/default.md`

```markdown
---
name: default
description: Miniclaw 默认系统提示词
model: qwen3.5-plus
version: 1.0.0
---

你是 Miniclaw，一个专业、可靠的 AI 助手。

## 核心原则

1. **理解意图**: 先理解用户真正想要什么，再行动
2. **分析任务**: 复杂任务先拆解步骤，不急于执行
3. **确认模糊**: 不确定时先询问，不猜测
4. **逐步执行**: 按步骤依次完成，不跳跃

## 意图理解

收到指令时，先思考：
- 用户的真实目的是什么？
- 是否有隐含的上下文？
- 指令是否清晰明确？

请用简洁、专业的方式回复用户。行动前多思考，不确定时先确认。
```

## 4. 配置变更

### 4.1 AgentConfig 扩展

```typescript
// 现有定义
interface AgentConfig {
  id: string;
  name?: string;
  model?: string;
  systemPrompt?: string;  // 保持不变
  // ...
}

// 使用方式变更（无需修改类型）
// 直接文本（向后兼容）
{
  "systemPrompt": "你是影子..."
}

// 文件路径（新功能）
{
  "systemPrompt": "file://~/.miniclaw/prompts/main.md"
}

// 相对路径（新功能）
{
  "systemPrompt": "./prompts/main.md"
}
```

### 4.2 环境变量扩展（可选）

```bash
# 默认模板路径
MINICLAW_DEFAULT_PROMPT=~/.miniclaw/prompts/default.md

# 模板搜索目录
MINICLAW_PROMPT_DIRS=~/.miniclaw/prompts:./prompts
```

## 5. 错误处理

### 5.1 错误类型

```typescript
/**
 * 提示词加载错误
 */
export class PromptLoadError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PromptLoadError';
  }
}

/**
 * 模板解析错误
 */
export class PromptParseError extends Error {
  constructor(
    message: string,
    public readonly content: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PromptParseError';
  }
}
```

### 5.2 错误处理策略

| 场景 | 策略 | 日志级别 |
|---|---|---|
| 文件不存在 | 使用 DEFAULT_SYSTEM_PROMPT | warn |
| 文件读取权限错误 | 使用 DEFAULT_SYSTEM_PROMPT | error |
| YAML 解析失败 | 使用原始内容，忽略元数据 | warn |
| 编码错误 (非 UTF-8) | 使用 DEFAULT_SYSTEM_PROMPT | error |
| 模板内容为空 | 使用 DEFAULT_SYSTEM_PROMPT | warn |

## 6. 模块依赖

### 6.1 新增依赖

```json
{
  "dependencies": {
    "yaml": "^2.x.x"  // YAML frontmatter 解析
  }
}
```

### 6.2 模块关系

```
src/core/prompt/
├── index.ts           # 导出 PromptManager, 类型
├── manager.ts         # PromptManager 类实现
├── parser.ts          # frontmatter 解析逻辑
└── types.ts           # 类型定义

src/core/agent/
├── index.ts           # MiniclawAgent (修改)
└── registry.ts        # AgentRegistry (修改)

src/core/config.ts     # 配置类型 (无修改)
```

### 6.3 调用关系

```
启动流程:
main.ts → loadConfig() → AgentRegistry.constructor
       → AgentRegistry.loadConfigs()
       → (缓存配置)

创建 Agent:
AgentRegistry.getOrCreate()
       → createAgentFn()
       → PromptManager.loadPrompt(agentConfig.systemPrompt)
       → MiniclawAgent.constructor({ systemPrompt: template.content })
```

## 7. 测试数据模型

### 7.1 单元测试用例

```typescript
describe('PromptManager', () => {
  // 基础加载测试
  it('should load direct text prompt', async () => {});
  it('should load file path prompt', async () => {});
  it('should fallback on missing file', async () => {});

  // frontmatter 解析测试
  it('should parse valid frontmatter', async () => {});
  it('should handle missing frontmatter', async () => {});
  it('should handle malformed frontmatter', async () => {});

  // 缓存测试
  it('should cache loaded templates', async () => {});
  it('should clear cache', async () => {});

  // 错误处理测试
  it('should handle encoding errors', async () => {});
  it('should handle permission errors', async () => {});
});
```

### 7.2 集成测试用例

```typescript
describe('Agent with external prompt', () => {
  it('should use file prompt for main agent', async () => {});
  it('should use different prompts for different agents', async () => {});
  it('should fallback to default on missing file', async () => {});
  it('should support runtime prompt switch', async () => {});
});
```

---

## 8. 工具设计补充（2026-04-10 澄清）

基于 Claude Code Tools.json 与 miniclaw 现有工具的差异分析，补充工具设计。

### 8.1 工具命名规范

**决策**：采用 snake_case 命名风格（与 TypeScript 变量命名一致）

```typescript
// 工具命名示例
const TOOL_NAMES = {
  // 文件操作
  read_file: 'read_file',
  write_file: 'write_file',
  glob: 'glob',
  ls: 'ls',
  edit: 'edit',
  multi_edit: 'multi_edit',
  
  // 搜索
  grep: 'grep',
  
  // Shell
  shell: 'shell',
  bash_output: 'bash_output',
  kill_bash: 'kill_bash',
  
  // Web
  web_fetch: 'web_fetch',
  web_search: 'web_search',
  
  // 任务管理
  task: 'task',
  todo_write: 'todo_write',
  
  // 记忆（miniclaw 独有）
  memory_search: 'memory_search',
  memory_get: 'memory_get',
  
  // 其他
  exit_plan_mode: 'exit_plan_mode',
  notebook_edit: 'notebook_edit'
};
```

### 8.2 工具分类与优先级

```typescript
/**
 * 工具优先级定义
 */
enum ToolPriority {
  P0 = 'P0', // 核心必需
  P1 = 'P1', // 重要增强
  P2 = 'P2', // 锦上添花
  P3 = 'P3'  // 可选
}

/**
 * 工具分类
 */
interface ToolCategory {
  name: string;
  tools: ToolDefinition[];
}

interface ToolDefinition {
  name: string;
  priority: ToolPriority;
  status: 'existing' | 'missing' | 'unique';
  description: string;
  paramsSchema: any; // TypeBox schema
  implementation?: string; // 实现文件路径
}
```

### 8.3 工具清单

#### 文件操作工具

| 工具名 | 优先级 | 状态 | 描述 |
|--------|--------|------|------|
| `read_file` | P0 | 现有 | 读取文件内容 |
| `write_file` | P0 | 现有 | 写入文件内容 |
| `glob` | P0 | **缺失** | 文件模式匹配搜索 |
| `ls` | P0 | **缺失** | 列出目录内容 |
| `edit` | P0 | **缺失** | 文件内容编辑 |
| `multi_edit` | P0 | **缺失** | 多处编辑 |

#### 搜索工具

| 工具名 | 优先级 | 状态 | 描述 |
|--------|--------|------|------|
| `grep` | P0 | **缺失** | 内容搜索（基于 ripgrep） |

#### Shell 工具

| 工具名 | 优先级 | 状态 | 描述 |
|--------|--------|------|------|
| `shell` | P0 | 现有 | 执行 Shell 命令 |
| `bash_output` | P2 | **缺失** | 获取后台进程输出 |
| `kill_bash` | P2 | **缺失** | 终止后台进程 |

#### Web 工具

| 工具名 | 优先级 | 状态 | 描述 |
|--------|--------|------|------|
| `web_fetch` | P1 | 现有 | 抓取网页内容 |
| `web_search` | P1 | 现有 | 网络搜索 |

#### 任务管理工具

| 工具名 | 优先级 | 状态 | 描述 |
|--------|--------|------|------|
| `task` | P1 | **缺失** | 启动子代理 |
| `todo_write` | P1 | **缺失** | 任务列表管理 |

#### 记忆工具（miniclaw 独有）

| 工具名 | 优先级 | 状态 | 描述 |
|--------|--------|------|------|
| `memory_search` | P1 | 现有（独有） | 搜索记忆 |
| `memory_get` | P1 | 现有（独有） | 获取记忆内容 |

#### 其他工具

| 工具名 | 优先级 | 状态 | 描述 |
|--------|--------|------|------|
| `exit_plan_mode` | P3 | **缺失** | 退出计划模式 |
| `notebook_edit` | P3 | **缺失** | Jupyter notebook 编辑 |

### 8.4 缺失工具的 Schema 设计

#### glob 工具

```typescript
const GlobParamsSchema = Type.Object({
  pattern: Type.String({ description: 'glob 模式，如 **/*.ts' }),
  path: Type.Optional(Type.String({ description: '搜索目录，默认当前工作目录' }))
});

const globTool = {
  name: 'glob',
  description: '文件模式匹配搜索，返回匹配的文件路径列表（按修改时间排序）',
  parameters: GlobParamsSchema,
  async execute(params: GlobParams) {
    // 使用 fast-glob 或 globby 库实现
    // 返回文件路径数组
  }
};
```

#### grep 工具

```typescript
const GrepParamsSchema = Type.Object({
  pattern: Type.String({ description: '搜索的正则表达式模式' }),
  path: Type.Optional(Type.String({ description: '搜索路径' })),
  output_mode: Type.Optional(Type.Union([
    Type.Literal('content'),
    Type.Literal('files_with_matches'),
    Type.Literal('count')
  ])),
  '-i': Type.Optional(Type.Boolean({ description: '忽略大小写' })),
  '-n': Type.Optional(Type.Boolean({ description: '显示行号' })),
  glob: Type.Optional(Type.String({ description: '文件过滤模式' })),
  head_limit: Type.Optional(Type.Number({ description: '限制输出数量' }))
});

const grepTool = {
  name: 'grep',
  description: '基于 ripgrep 的内容搜索工具',
  parameters: GrepParamsSchema,
  async execute(params: GrepParams) {
    // 调用 rg 命令或使用 ripgrep npm 包
  }
};
```

#### ls 工具

```typescript
const LSParamsSchema = Type.Object({
  path: Type.String({ description: '目录路径（必须绝对路径）' }),
  ignore: Type.Optional(Type.Array(Type.String(), { description: '忽略模式' }))
});

const lsTool = {
  name: 'ls',
  description: '列出目录内容',
  parameters: LSParamsSchema,
  async execute(params: LSParams) {
    // 使用 fs.readdir 实现
  }
};
```

#### edit 工具

```typescript
const EditParamsSchema = Type.Object({
  path: Type.String({ description: '文件路径' }),
  old_string: Type.String({ description: '要替换的文本（必须唯一匹配）' }),
  new_string: Type.String({ description: '替换后的文本' }),
  replace_all: Type.Optional(Type.Boolean({ description: '替换所有匹配项' }))
});

const editTool = {
  name: 'edit',
  description: '文件内容精确替换（必须先读取文件）',
  parameters: EditParamsSchema,
  async execute(params: EditParams) {
    // 读取文件 → 查找匹配 → 替换 → 写入
  }
};
```

#### multi_edit 工具

```typescript
const MultiEditParamsSchema = Type.Object({
  path: Type.String({ description: '文件路径' }),
  edits: Type.Array(Type.Object({
    old_string: Type.String(),
    new_string: Type.String(),
    replace_all: Type.Optional(Type.Boolean())
  }))
});

const multiEditTool = {
  name: 'multi_edit',
  description: '批量编辑文件多处内容',
  parameters: MultiEditParamsSchema,
  async execute(params: MultiEditParams) {
    // 批量替换，原子操作（全部成功或全部失败）
  }
};
```

#### task 工具

```typescript
const TaskParamsSchema = Type.Object({
  subagent_type: Type.String({ description: '子代理类型' }),
  description: Type.String({ description: '任务简短描述（3-5 词）' }),
  prompt: Type.String({ description: '任务详细描述' })
});

const taskTool = {
  name: 'task',
  description: '启动子代理处理复杂任务',
  parameters: TaskParamsSchema,
  async execute(params: TaskParams) {
    // 创建子代理实例 → 执行任务 → 返回结果
  }
};
```

#### todo_write 工具

```typescript
const TodoWriteParamsSchema = Type.Object({
  todos: Type.Array(Type.Object({
    id: Type.String(),
    content: Type.String(),
    status: Type.Union([
      Type.Literal('pending'),
      Type.Literal('in_progress'),
      Type.Literal('completed')
    ])
  }))
});

const todoWriteTool = {
  name: 'todo_write',
  description: '管理任务列表',
  parameters: TodoWriteParamsSchema,
  async execute(params: TodoWriteParams) {
    // 更新任务状态（持久化或内存）
  }
};
```

### 8.5 现有工具增强设计

#### read_file 增强

```typescript
const ReadFileParamsSchema = Type.Object({
  path: Type.String({ description: '文件路径' }),
  // 新增参数
  offset: Type.Optional(Type.Number({ description: '起始行号（1-indexed）' })),
  limit: Type.Optional(Type.Number({ description: '读取行数限制' })),
  encoding: Type.Optional(Type.String({ description: '文件编码，默认 utf-8' }))
});

// 增强 execute 方法支持：
// 1. 图片文件（PNG, JPG, WebP）→ 返回 base64 或视觉内容
// 2. PDF 文件 → 返回提取的文本
// 3. 大文件分页（offset/limit）
```

#### write_file 增强

```typescript
const WriteFileParamsSchema = Type.Object({
  path: Type.String({ description: '文件路径' }),
  content: Type.String({ description: '写入内容' }),
  // 新增参数
  mode: Type.Optional(Type.Union([
    Type.Literal('overwrite'),  // 覆盖写入（新默认）
    Type.Literal('append'),    // 追加写入
    Type.Literal('create')     // 仅创建新文件
  ], { default: 'overwrite' }))
});
```

#### shell 增强

```typescript
const ShellParamsSchema = Type.Object({
  command: Type.String({ description: 'Shell 命令' }),
  // 新增参数
  timeout: Type.Optional(Type.Number({ description: '超时时间（毫秒），最大 600000' })),
  description: Type.Optional(Type.String({ description: '命令描述（5-10 词）' })),
  run_in_background: Type.Optional(Type.Boolean({ description: '后台运行' })),
  cwd: Type.Optional(Type.String({ description: '工作目录' }))
});
```

### 8.6 工具注册与导出

```typescript
// src/tools/index.ts 扩展

import { readFileTool } from './read-file.js';
import { writeFileTool } from './write-file.js';
import { shellTool } from './shell.js';
import { webFetchTool } from './web-fetch.js';
import { webSearchTool } from './web-search.js';
import { memorySearchTool } from './memory-search.js';
import { memoryGetTool } from './memory-get.js';

// 新增工具导入
import { globTool } from './glob.js';
import { grepTool } from './grep.js';
import { lsTool } from './ls.js';
import { editTool } from './edit.js';
import { multiEditTool } from './multi-edit.js';
import { taskTool } from './task.js';
import { todoWriteTool } from './todo-write.js';
import { bashOutputTool } from './bash-output.js';
import { killBashTool } from './kill-bash.js';

export function getBuiltinTools() {
  return [
    // 核心工具 (P0)
    readFileTool,
    writeFileTool,
    shellTool,
    globTool,
    grepTool,
    lsTool,
    editTool,
    multiEditTool,
    
    // 重要工具 (P1)
    webFetchTool,
    webSearchTool,
    taskTool,
    todoWriteTool,
    memorySearchTool,
    memoryGetTool,
    
    // 增强工具 (P2)
    bashOutputTool,
    killBashTool,
    
    // 可选工具 (P3)
    // exitPlanModeTool,
    // notebookEditTool
  ];
}
```

### 8.7 工具依赖

新增 npm 依赖：

```json
{
  "dependencies": {
    "fast-glob": "^3.x",      // glob 实现
    "@npmcli/ripgrep": "^1.x"  // ripgrep npm wrapper（可选）
  }
}
```

或直接使用 `rg` 命令（Claude Code 方式）。