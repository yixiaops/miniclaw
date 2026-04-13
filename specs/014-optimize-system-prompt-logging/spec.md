# 需求规格: 优化系统提示词打印规则

## 元数据

| 属性 | 值 |
|------|-----|
| 版本 | 1.0 |
| 创建日期 | 2026-04-13 |
| 状态 | 待实现 |
| 优先级 | 中 |

---

## 1. 需求分析

### 1.1 背景

当前 `src/core/agent/index.ts` 中的 `logSendContext` 方法在打印系统提示词时存在以下问题:

```typescript
// 当前实现 (第 747-751 行)
const promptPreview = systemPrompt.length > 3000
  ? systemPrompt.substring(0, 3000) + '...'
  : systemPrompt;
this.log(`  ${promptPreview.replace(/\n/g, '\n   ')}`);
```

**问题:**

1. **缺乏结构感**: 直接打印整个提示词，无法看出提示词由哪些部分组成
2. **长内容截断不合理**: 只保留前 3000 字符，丢失后续内容，且无法感知中间被省略的部分
3. **调试困难**: 开发者难以快速定位提示词的某个特定部分

### 1.2 目标

1. **结构化展示**: 按提示词的组成部分区分打印，清晰展示结构
2. **智能截断**: 每部分最多 400 字符，保留开头和结尾，中间用 `...` 代替
3. **可读性**: 保持日志的可读性和信息密度平衡

---

## 2. 功能设计

### 2.1 提示词分段策略

系统提示词通常包含多个部分，通过 Markdown 标题 (`##`) 分隔。设计如下分段策略:

```
输入: 完整系统提示词字符串
      ↓
识别分隔符: Markdown 标题 (## 或 ###)
      ↓
分割: 按标题切分为多个部分
      ↓
处理: 每部分独立截断处理
      ↓
输出: 结构化日志
```

### 2.2 分段规则

1. **标题识别**: 以 `## ` 开头的行作为章节分隔符
2. **章节命名**: 提取标题文本作为章节名称
3. **首段处理**: 第一个 `##` 之前的内容作为 "前言" 或 "主体角色"

示例:
```
你是 Miniclaw，一个专业、可靠的 AI 助手。    ← 前言

## 核心原则                                    ← 章节 1
1. **理解意图**: ...

## 意图理解                                    ← 章节 2
收到指令时，先思考: ...

## 任务处理流程                                ← 章节 3
...
```

### 2.3 截断规则

每部分最多显示 **400 字符**，采用 "两头保留，中间省略" 策略:

```
原文长度 ≤ 400: 全部显示
原文长度 > 400: 显示前 150 + "..." + 显示后 150
```

**计算公式:**
- `headLength = 150`
- `tailLength = 150`
- 如果内容长度 > 400: `截断后 = 内容[0:150] + "...(省略 N 字符)..." + 内容[-150:]`

### 2.4 输出格式

```
📋 系统提示词 (总字符数, ~估算 tokens):

  [前言] (N 字符):
    <内容预览>
  
  [核心原则] (N 字符):
    <内容预览>
  
  [意图理解] (N 字符):
    <内容预览>
  
  ... (更多章节)
```

---

## 3. 技术实现

### 3.1 新增辅助函数

在 `src/core/agent/index.ts` 中新增以下函数:

```typescript
/**
 * 解析系统提示词为章节列表
 * 
 * @param prompt - 完整的系统提示词
 * @returns 章节列表，每项包含标题和内容
 */
function parsePromptSections(prompt: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const lines = prompt.split('\n');
  
  let currentTitle = '前言';
  let currentContent: string[] = [];
  
  for (const line of lines) {
    // 匹配 ## 标题
    const titleMatch = line.match(/^##\s+(.+)$/);
    if (titleMatch) {
      // 保存之前的章节
      if (currentContent.length > 0) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n').trim()
        });
      }
      // 开始新章节
      currentTitle = titleMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  
  // 保存最后一个章节
  if (currentContent.length > 0) {
    sections.push({
      title: currentTitle,
      content: currentContent.join('\n').trim()
    });
  }
  
  return sections;
}

/**
 * 截断文本，保留两头
 * 
 * @param text - 原始文本
 * @param maxLength - 最大显示长度 (默认 400)
 * @returns 截断后的文本
 */
function truncateText(text: string, maxLength: number = 400): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  const headLength = 150;
  const tailLength = 150;
  const omitted = text.length - headLength - tailLength;
  const head = text.substring(0, headLength);
  const tail = text.substring(text.length - tailLength);
  
  return `${head}\n   ... (省略 ${omitted} 字符) ...\n   ${tail}`;
}
```

### 3.2 修改 logSendContext 方法

将原有单一打印逻辑替换为分段打印:

```typescript
// 打印系统提示词 (替换原有逻辑)
const systemPrompt = this.agent.state.systemPrompt;
this.log(`📋 系统提示词 (${systemPrompt.length} 字符, ~${estimateTokens(systemPrompt)} tokens):`);

const sections = parsePromptSections(systemPrompt);
for (const section of sections) {
  this.log(`\n  [${section.title}] (${section.content.length} 字符):`);
  const truncated = truncateText(section.content);
  this.log(`    ${truncated.replace(/\n/g, '\n    ')}`);
}
```

---

## 4. 边界情况处理

### 4.1 无标题提示词

如果提示词不包含任何 `##` 标题:
- 整体作为一个章节，标题为 "前言"
- 正常应用截断规则

### 4.2 空章节

如果某个章节内容为空或仅包含空白字符:
- 仍然显示章节标题
- 内容显示 "(空)"

### 4.3 嵌套标题

`###` 三级标题不作为章节分隔，归入上一级 `##` 章节内容中。

### 4.4 特殊字符

处理提示词中可能包含的代码块、表格等特殊格式时:
- 保持原样显示
- 截断时考虑代码块的完整性 (可选优化)

---

## 5. 测试用例

### 5.1 基本功能测试

```typescript
// 测试用例 1: 标准多章节提示词
const prompt1 = `你是助手。

## 核心原则
1. 理解意图
2. 分析任务

## 工具使用
- write_file: 写入文件
- read_file: 读取文件
`;
// 期望: 输出 3 个章节 (前言、核心原则、工具使用)

// 测试用例 2: 超长章节截断
const prompt2 = `## 长章节
${'内容'.repeat(200)}
`;
// 期望: 章节内容被截断，显示前 150 + ... + 后 150

// 测试用例 3: 无标题提示词
const prompt3 = `这是没有标题的提示词。
只有一段内容。`;
// 期望: 输出 1 个章节 (前言)
```

### 5.2 边界测试

```typescript
// 测试用例 4: 空提示词
const prompt4 = '';
// 期望: 不崩溃，显示 "(空)" 或跳过

// 测试用例 5: 仅包含标题
const prompt5 = `## 标题1
## 标题2
`;
// 期望: 输出 2 个章节，内容为 "(空)"

// 测试用例 6: 混合标题级别
const prompt6 = `## 主标题
内容
### 子标题
子内容
`;
// 期望: ### 不作为章节分隔，归入主标题内容
```

---

## 6. 影响范围

### 6.1 直接影响

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/core/agent/index.ts` | 修改 | 新增辅助函数，修改 `logSendContext` 方法 |

### 6.2 间接影响

- **日志输出**: 开发者看到的系统提示词日志格式变化
- **调试体验**: 提升提示词调试的可读性
- **性能**: 略微增加字符串处理开销 (可忽略)

---

## 7. 验收标准

- [ ] 系统提示词按章节结构化打印
- [ ] 每章节最多显示 400 字符
- [ ] 超长章节采用 "前 150 + ... + 后 150" 格式
- [ ] 无标题提示词正常处理
- [ ] 空章节不崩溃
- [ ] 日志格式清晰易读

---

## 8. 后续优化 (可选)

1. **代码块感知截断**: 截断时避免截断代码块中间
2. **可配置阈值**: 允许通过配置调整每部分最大字符数
3. **高亮标题**: 使用 ANSI 颜色高亮章节标题