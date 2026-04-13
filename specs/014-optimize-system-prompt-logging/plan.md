# 实现计划: 优化系统提示词打印规则

## 元数据

| 属性 | 值 |
|------|-----|
| 关联规格 | spec.md |
| 创建日期 | 2026-04-13 |
| 实现优先级 | 中 |

---

## 1. 实现步骤（按优先级排序）

### 步骤 1: 新增辅助函数 (P0)

在 `src/core/agent/index.ts` 中，在 `estimateMessagesTokens` 函数附近（约第 180-230 行区域）添加两个新函数：

**1.1 `parsePromptSections` 函数**
- 位置：建议放在 `estimateMessagesTokens` 函数之后
- 功能：解析系统提示词为章节列表
- 输入：完整系统提示词字符串
- 输出：`Array<{ title: string; content: string }>`

**1.2 `truncateText` 函数**
- 位置：紧随 `parsePromptSections` 之后
- 功能：截断文本，保留两头（前150 + ... + 后150）
- 输入：文本字符串，最大长度（默认400）
- 输出：截断后的文本

### 步骤 2: 修改 `logSendContext` 方法 (P0)

**当前实现（第 1034-1036 行）:**
```typescript
const promptPreview = systemPrompt.length > 3000
  ? systemPrompt.substring(0, 3000) + '...'
  : systemPrompt;
this.log(`  ${promptPreview.replace(/\n/g, '\n   ')}`);
```

**替换为:**
```typescript
const sections = parsePromptSections(systemPrompt);
for (const section of sections) {
  this.log(`\n  [${section.title}] (${section.content.length} 字符):`);
  const truncated = truncateText(section.content);
  this.log(`    ${truncated.replace(/\n/g, '\n    ')}`);
}
```

### 步骤 3: 添加单元测试 (P1)

创建测试文件 `src/core/agent/__tests__/prompt-sections.test.ts`：
- 测试标准多章节提示词解析
- 测试超长章节截断
- 测试无标题提示词
- 测试边界情况（空提示词、仅标题、混合标题级别）

### 步骤 4: 文档更新 (P2)

- 更新相关代码注释
- 如有开发者文档，更新日志输出格式说明

---

## 2. 文件变更清单

| 文件路径 | 变更类型 | 变更说明 |
|----------|----------|----------|
| `src/core/agent/index.ts` | 修改 | 新增 `parsePromptSections`、`truncateText` 函数；修改 `logSendContext` 方法 |
| `src/core/agent/__tests__/prompt-sections.test.ts` | 新增 | 单元测试文件（可选） |

---

## 3. 技术决策说明

### 3.1 分段策略

**决策**: 使用 `## ` 作为章节分隔符

**理由**:
- 符合 Markdown 标准，与大多数提示词格式一致
- `###` 作为子标题归入上一级章节，避免过度碎片化
- 简单的正则匹配 `/^##\s+(.+)$/` 足够可靠

### 3.2 截断阈值

**决策**: 每章节最多 400 字符，前 150 + 后 150

**理由**:
- 400 字符足以展示章节核心内容
- 前后各 150 字符保留上下文连贯性
- 中间省略部分用 `...(省略 N 字符)...` 明确提示

### 3.3 函数位置

**决策**: 将辅助函数放在文件顶部，与 `estimateTokens`、`estimateMessagesTokens` 等工具函数相邻

**理由**:
- 保持代码结构一致性
- 这些都是纯函数，无状态依赖
- 便于单元测试

### 3.4 首段命名

**决策**: 第一个 `##` 之前的内容命名为 "前言"

**理由**:
- 语义清晰，符合中文习惯
- 明确区分结构性内容和非结构性前言

---

## 4. 风险点和边界情况处理

### 4.1 风险点

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 提示词格式不符合预期 | 低 | 中 | 使用保守的分段策略，无标题时整体作为"前言" |
| 截断破坏代码块格式 | 低 | 低 | 当前方案不做代码块感知，后续可优化 |
| 性能开销 | 极低 | 极低 | 字符串操作开销可忽略，仅影响日志输出 |

### 4.2 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 空提示词 (`''`) | 不崩溃，检查长度后跳过或显示 "(空)" |
| 仅包含标题 | 章节内容显示 "(空)" |
| 无 `##` 标题 | 整体作为 "前言" 章节 |
| 标题后紧跟空行 | 正常处理，trim 后内容为空则显示 "(空)" |
| `###` 三级标题 | 不作为章节分隔，归入上一级 `##` 章节内容 |
| 特殊字符（表格、代码块） | 保持原样，不做特殊处理 |

### 4.3 防御性代码

```typescript
function parsePromptSections(prompt: string): Array<{ title: string; content: string }> {
  // 防御：空输入
  if (!prompt || prompt.trim().length === 0) {
    return [{ title: '前言', content: '(空)' }];
  }
  // ... 正常逻辑
}

function truncateText(text: string, maxLength: number = 400): string {
  // 防御：参数校验
  if (!text || text.length === 0) return '(空)';
  if (maxLength <= 0) return text;
  // ... 正常逻辑
}
```

---

## 5. 实现代码模板

### 5.1 `parsePromptSections` 函数

```typescript
/**
 * 解析系统提示词为章节列表
 *
 * 按 Markdown 二级标题 (##) 切分章节，
 * 第一个 ## 之前的内容作为 "前言"。
 *
 * @param prompt - 完整的系统提示词
 * @returns 章节列表，每项包含标题和内容
 */
function parsePromptSections(prompt: string): Array<{ title: string; content: string }> {
  // 防御：空输入
  if (!prompt || prompt.trim().length === 0) {
    return [{ title: '前言', content: '(空)' }];
  }

  const sections: Array<{ title: string; content: string }> = [];
  const lines = prompt.split('\n');

  let currentTitle = '前言';
  let currentContent: string[] = [];

  for (const line of lines) {
    // 匹配 ## 标题（不匹配 ###）
    const titleMatch = line.match(/^##\s+(.+)$/);
    if (titleMatch) {
      // 保存之前的章节
      const content = currentContent.join('\n').trim();
      sections.push({
        title: currentTitle,
        content: content || '(空)'
      });
      // 开始新章节
      currentTitle = titleMatch[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // 保存最后一个章节
  const lastContent = currentContent.join('\n').trim();
  sections.push({
    title: currentTitle,
    content: lastContent || '(空)'
  });

  return sections;
}
```

### 5.2 `truncateText` 函数

```typescript
/**
 * 截断文本，保留两头
 *
 * 当文本超过最大长度时，保留前后各 150 字符，
 * 中间用省略标记代替。
 *
 * @param text - 原始文本
 * @param maxLength - 最大显示长度 (默认 400)
 * @returns 截断后的文本
 */
function truncateText(text: string, maxLength: number = 400): string {
  // 防御：空输入
  if (!text || text.length === 0) return '(空)';

  // 未超长，直接返回
  if (text.length <= maxLength) {
    return text;
  }

  // 超长，截断处理
  const headLength = 150;
  const tailLength = 150;
  const omitted = text.length - headLength - tailLength;
  const head = text.substring(0, headLength);
  const tail = text.substring(text.length - tailLength);

  return `${head}\n... (省略 ${omitted} 字符) ...\n${tail}`;
}
```

### 5.3 `logSendContext` 方法修改

```typescript
// 打印系统提示词 (替换第 1034-1036 行)
const systemPrompt = this.agent.state.systemPrompt;
this.log(`📋 系统提示词 (${systemPrompt.length} 字符, ~${estimateTokens(systemPrompt)} tokens):`);

const sections = parsePromptSections(systemPrompt);
for (const section of sections) {
  this.log(`  [${section.title}] (${section.content.length} 字符):`);
  const truncated = truncateText(section.content);
  // 缩进处理：保持与原有日志格式一致
  this.log(`    ${truncated.replace(/\n/g, '\n    ')}`);
}
```

---

## 6. 验收检查清单

- [ ] `parsePromptSections` 函数实现并测试通过
- [ ] `truncateText` 函数实现并测试通过
- [ ] `logSendContext` 方法修改完成
- [ ] 标准多章节提示词正确分段显示
- [ ] 超长章节正确截断（前150+...+后150）
- [ ] 无标题提示词作为"前言"处理
- [ ] 空提示词不崩溃，显示"(空)"
- [ ] 日志输出格式清晰易读

---

## 7. 预估工作量

| 任务 | 预估时间 |
|------|----------|
| 新增辅助函数 | 30 分钟 |
| 修改 logSendContext | 15 分钟 |
| 单元测试 | 30 分钟 |
| 集成测试验证 | 15 分钟 |
| **总计** | **1.5 小时** |