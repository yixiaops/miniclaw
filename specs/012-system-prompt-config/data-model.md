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