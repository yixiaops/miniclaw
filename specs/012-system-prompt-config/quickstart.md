# Quickstart - 系统提示词可配置化

## 快速开始

### 1. 创建提示词模板目录

```bash
mkdir -p ~/.miniclaw/prompts
```

### 2. 创建默认模板

创建文件 `~/.miniclaw/prompts/default.md`:

```markdown
---
name: default
description: Miniclaw 默认系统提示词
model: qwen3.5-plus
---

你是 Miniclaw，一个专业、可靠的 AI 助手。

## 核心原则

1. **理解意图**: 先理解用户真正想要什么，再行动
2. **分析任务**: 复杂任务先拆解步骤，不急于执行
3. **确认模糊**: 不确定时先询问，不猜测
4. **逐步执行**: 按步骤依次完成，不跳跃
```

### 3. 配置 Agent 使用模板

编辑 `~/.miniclaw/config.json`:

```json
{
  "agents": {
    "defaults": {
      "model": "qwen3.5-plus"
    },
    "list": [
      {
        "id": "main",
        "name": "影子",
        "systemPrompt": "file://~/.miniclaw/prompts/main.md"
      },
      {
        "id": "etf",
        "name": "ETF 分析师",
        "systemPrompt": "file://~/.miniclaw/prompts/etf.md"
      }
    ]
  }
}
```

### 4. 启动应用

```bash
npm run start
```

查看日志确认模板加载:

```
[main] 初始化 Agent
[main] 模型: qwen3.5-plus
[main] 📋 加载提示词模板: main.md (2350 字符)
[main] 📋 模板信息: name=main-assistant, model=qwen3.5-plus
[main] Agent 初始化完成
```

## 模板文件格式

### 基本结构

```markdown
---
# YAML frontmatter (元数据)
name: template-name
description: 模板描述
model: recommended-model
tools: tool1, tool2
---

# Markdown 内容 (提示词正文)

你是一个助手...
```

### 元数据字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | 模板名称，用于日志和调试 |
| `description` | string | 否 | 模板描述 |
| `model` | string | 否 | 推荐使用的模型 |
| `tools` | string | 否 | 可用工具列表（逗号分隔） |
| `tags` | string | 否 | 标签（逗号分隔） |
| `version` | string | 否 | 模板版本 |
| `author` | string | 否 | 作者 |

### 简化格式

如果不需要元数据，可以只写内容:

```markdown
你是一个助手，负责...
```

系统会自动使用默认元数据。

## 配置方式

### 方式一：文件路径

```json
{
  "systemPrompt": "file://~/.miniclaw/prompts/main.md"
}
```

支持的前缀:
- `file://` - 明确指定为文件路径
- `~/` - 用户目录
- `./` - 相对路径（相对于配置文件）
- `/` - 绝对路径

### 方式二：直接文本（向后兼容）

```json
{
  "systemPrompt": "你是一个助手..."
}
```

保持现有配置格式不变。

## 示例模板

### Main Agent 模板

**文件**: `~/.miniclaw/prompts/main.md`

```markdown
---
name: main-assistant
description: 主助手 - 影子
model: qwen3.5-plus
tags: main, default
---

你是影子，小彭的数字分身，也是团队协调者。

## 工作方式

你拥有专业子代理团队，可以委托专业任务给合适的专家。

**关键规则（必须严格遵守）**：
1. 收到专业领域问题时，检查是否有对应的子代理
2. 使用 sessions_spawn 工具调用子代理，指定 agentId
3. **等待工具返回结果**（不要提前结束）
4. **基于返回结果，整理总结后回复用户**
5. 不要自己回答专业问题，优先委托给专家

可用子代理列表会在工具描述中动态显示。

**注意**：调用子代理后，一定要等待结果返回，然后基于结果生成最终回复。
```

### ETF 分析师模板

**文件**: `~/.miniclaw/prompts/etf.md`

```markdown
---
name: etf-analyst
description: ETF 市场分析专家
model: qwen3.5-plus
tools: web_search, web_fetch
---

你是 ETF 市场分析专家，擅长基金选择和投资策略。

## 分析框架

你会从以下维度进行分析：

1. **宏观经济**: 经济周期、货币政策、利率走势
2. **行业趋势**: 行业景气度、政策导向、技术变革
3. **基金基本面**: 跟踪误差、规模、流动性、费率

## 输出格式

分析报告包含：
- 核心观点（一句话）
- 详细分析（分维度）
- 投资建议（买入/持有/卖出）
- 风险提示

请保持专业、客观，避免过度乐观或悲观。
```

### 政策分析师模板

**文件**: `~/.miniclaw/prompts/policy.md`

```markdown
---
name: policy-analyst
description: 宏观经济政策分析专家
model: qwen3.5-plus
---

你是宏观经济政策分析专家，擅长行业趋势研判。

## 分析框架

你会从以下角度进行分析：

1. **政策导向**: 国家战略、产业政策、监管趋势
2. **市场环境**: 经济数据、市场情绪、资金流向
3. **产业链影响**: 上中下游、竞争格局、供需关系

## 输出格式

分析报告包含：
- 政策要点总结
- 行业影响分析
- 投资机会提示
- 风险因素
```

## 运行时切换（P3）

### API 调用

```typescript
// 获取当前提示词
const currentPrompt = agent.getSystemPrompt();

// 切换到新模板
agent.setSystemPrompt(newPromptContent);

// 切换到文件模板
const template = await promptManager.loadPrompt('file://~/.miniclaw/prompts/new.md');
agent.setSystemPrompt(template.content);
```

### CLI 命令（未来功能）

```bash
# 查看当前提示词
/prompts show

# 列出可用模板
/prompts list

# 切换模板
/prompts switch main

# 重新加载模板
/prompts reload
```

## 故障排除

### 模板加载失败

**现象**: 日志显示 `⚠️ 加载提示词失败，使用默认值`

**检查**:
1. 文件路径是否正确
2. 文件是否存在
3. 文件权限是否可读
4. 文件编码是否为 UTF-8

**解决**:
```bash
# 检查文件
ls -la ~/.miniclaw/prompts/main.md

# 检查编码
file ~/.miniclaw/prompts/main.md

# 检查内容
cat ~/.miniclaw/prompts/main.md
```

### YAML 解析错误

**现象**: 日志显示 `⚠️ 解析 frontmatter 失败，使用原始内容`

**检查**:
1. frontmatter 是否正确包裹在 `---` 之间
2. YAML 语法是否正确（缩进、引号等）

**解决**:
```bash
# 验证 YAML
python -c "import yaml; print(yaml.safe_load(open('main.md').read().split('---')[1]))"
```

### 模板内容过长

**现象**: 日志显示 `⚠️ 模板内容过长 (X 字符)`

**说明**: 警告信息，不影响功能。LLM API 有 token 限制，建议控制模板长度在 4000 字符以内。

## 最佳实践

1. **版本控制**: 将模板文件加入 Git 管理
2. **模块化**: 复杂提示词拆分为多个段落
3. **注释**: 使用 HTML 注释 `<!-- -->` 添加说明
4. **测试**: 修改模板后测试对话效果
5. **备份**: 保留 `default.md` 作为后备模板