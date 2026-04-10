# Implementation Plan - 系统提示词可配置化

**Feature Branch**: `012-system-prompt-config`
**Created**: 2026-04-10
**Status**: Planning

## Overview

将硬编码的系统提示词外部化为可配置的模板文件，支持 YAML frontmatter 格式，实现多 Agent 差异化提示词和运行时切换。

## Phase 0: Research ✅

**Status**: Completed
**Output**: [research.md](./research.md)

关键发现：
1. 现有 `DEFAULT_SYSTEM_PROMPT` 位于 `src/core/agent/index.ts`
2. Agent 创建通过 `AgentRegistry.getOrCreate()` 工厂函数
3. 配置已在 `AgentConfig.systemPrompt` 字段支持直接文本
4. 技能注入机制证明运行时提示词拼接可行
5. pi-coding-agent 的模板格式提供良好参考

## Phase 1: Design ✅

**Status**: Completed
**Output**: [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

关键设计决策：
1. 使用 `file://` 前缀区分文件路径和直接文本
2. YAML frontmatter 解析使用 `yaml` 库
3. 启动时加载并缓存，运行时切换仅更新内存
4. 错误处理采用优雅降级策略

## Phase 2: Implementation

### Step 1: 创建 Prompt 模块

**目标**: 建立 `src/core/prompt/` 模块，实现提示词加载和解析

**任务**:
- [ ] 创建 `src/core/prompt/types.ts` - 类型定义
  - `PromptTemplate` 接口
  - `PromptReference` 类型
  - `PromptLoadOptions` 接口
  - `PromptParseResult` 接口
- [ ] 创建 `src/core/prompt/parser.ts` - frontmatter 解析
  - `parseFrontmatter(content: string): PromptTemplate`
  - 支持 YAML 元数据提取
  - 支持 markdown 内容提取
- [ ] 创建 `src/core/prompt/manager.ts` - PromptManager 类
  - `loadPrompt(reference: PromptReference): Promise<PromptParseResult>`
  - `parseTemplateFile(filePath: string): Promise<PromptParseResult>`
  - `getCached(key: string): PromptTemplate | undefined`
  - `clearCache(): void`
  - `reloadPrompt(reference: PromptReference): Promise<PromptParseResult>`
- [ ] 创建 `src/core/prompt/index.ts` - 模块导出
- [ ] 添加 `yaml` 依赖到 package.json

**验证**:
```bash
# 编译通过
npm run build

# 单元测试
npm test -- --grep "PromptManager"
```

**预计时间**: 2-3 小时

---

### Step 2: 修改 Agent 创建流程

**目标**: 在 Agent 创建时集成 PromptManager，支持文件路径解析

**任务**:
- [ ] 修改 `src/index.ts` 或 `src/core/gateway/index.ts`
  - 在应用启动时创建 `PromptManager` 实例
  - 传入 `DEFAULT_SYSTEM_PROMPT` 作为后备
- [ ] 修改 Agent 工厂函数（通常在 `src/index.ts`）
  - 在调用 `MiniclawAgent` 构造函数前解析 `systemPrompt`
  - 如果是文件路径，调用 `promptManager.loadPrompt()`
  - 如果是直接文本，直接使用
- [ ] 添加启动日志
  - 记录模板名称、路径、字符数

**代码示例**:
```typescript
// 创建 PromptManager
const promptManager = new PromptManager({
  defaultPromptPath: join(homedir(), '.miniclaw', 'prompts', 'default.md'),
  fallbackPrompt: DEFAULT_SYSTEM_PROMPT
});

// 创建 Agent 工厂函数
const createAgent: CreateAgentFn = async (sessionKey, config, agentId, agentConfig, isSubagent) => {
  // 解析 systemPrompt
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;

  if (agentConfig?.systemPrompt) {
    const result = await promptManager.loadPrompt(agentConfig.systemPrompt);
    if (result.success && result.template) {
      systemPrompt = result.template.content;
      console.log(`[${agentId}] 📋 加载提示词模板: ${result.template.name || 'unnamed'} (${systemPrompt.length} 字符)`);
    } else {
      console.warn(`[${agentId}] ⚠️ 加载提示词失败: ${result.error}，使用默认值`);
    }
  }

  return new MiniclawAgent(config, {
    systemPrompt,
    agentId,
    isSubagent,
    thinkingLevel: agentConfig?.thinkingLevel
  });
};
```

**验证**:
```bash
# 启动应用，检查日志
npm run start

# 测试文件路径加载
# 修改 config.json 中 systemPrompt 为 file://... 格式
```

**预计时间**: 1-2 小时

---

### Step 3: 创建默认模板文件

**目标**: 将 DEFAULT_SYSTEM_PROMPT 提取到模板文件，为各 Agent 创建初始模板

**任务**:
- [ ] 创建 `~/.miniclaw/prompts/` 目录
- [ ] 创建 `~/.miniclaw/prompts/default.md`
  - 将 `DEFAULT_SYSTEM_PROMPT` 内容迁移
  - 添加 YAML frontmatter
- [ ] 创建 `~/.miniclaw/prompts/main.md`
  - 基于 config.json 中 main Agent 的 systemPrompt
  - 添加元数据
- [ ] 创建 `~/.miniclaw/prompts/etf.md`
  - 基于 config.json 中 etf Agent 的 systemPrompt
- [ ] 创建 `~/.miniclaw/prompts/policy.md`
  - 基于 config.json 中 policy Agent 的 systemPrompt
- [ ] 更新 `config.json`
  - 将 systemPrompt 改为 `file://` 格式

**文件示例**:
```markdown
<!-- ~/.miniclaw/prompts/default.md -->
---
name: default
description: Miniclaw 默认系统提示词
model: qwen3.5-plus
version: 1.0.0
---

你是 Miniclaw，一个专业、可靠的 AI 助手。

## 核心原则

1. **理解意图**: 先理解用户真正想要什么，再行动
...
```

**验证**:
```bash
# 检查文件创建
ls -la ~/.miniclaw/prompts/

# 启动应用，确认加载成功
npm run start
```

**预计时间**: 30 分钟

---

### Step 4: 添加单元测试

**目标**: 确保核心功能有测试覆盖

**任务**:
- [ ] 创建 `tests/unit/prompt/` 目录
- [ ] `parser.test.ts` - frontmatter 解析测试
  - 测试有效 frontmatter 解析
  - 测试无效 frontmatter 处理
  - 测试无 frontmatter 内容
- [ ] `manager.test.ts` - PromptManager 测试
  - 测试直接文本加载
  - 测试文件路径加载
  - 测试缓存机制
  - 测试错误处理（文件不存在、权限错误等）
- [ ] `integration.test.ts` - Agent 集成测试
  - 测试 Agent 使用文件模板
  - 测试多 Agent 不同模板
  - 测试后备机制

**验证**:
```bash
npm test -- --grep "prompt"
```

**预计时间**: 2 小时

---

### Step 5: 文档和清理

**目标**: 更新文档，确保代码质量

**任务**:
- [ ] 更新 `README.md`
  - 添加提示词配置说明
  - 添加模板格式说明
- [ ] 更新 `CLAUDE.md`
  - 添加开发注意事项
- [ ] 添加 JSDoc 注释
  - 所有公共接口
  - 复杂逻辑说明
- [ ] 代码审查
  - 移除 console.log 调试代码
  - 检查错误处理
  - 检查类型安全

**验证**:
```bash
npm run lint
npm run build
```

**预计时间**: 1 小时

---

## Phase 3: Testing & Integration

### 集成测试清单

- [ ] 现有功能回归测试
  - chat() 方法正常工作
  - streamChat() 方法正常工作
  - 工具调用正常工作
  - 多 Agent 正常工作
- [ ] 新功能测试
  - 文件模板加载
  - 直接文本兼容
  - 错误后备
  - 多 Agent 不同模板
- [ ] 边缘情况测试
  - 模板文件不存在
  - 模板文件编码错误
  - 模板文件权限问题
  - 模板内容为空
  - frontmatter 格式错误

### 性能测试

- [ ] 模板加载时间 < 100ms
- [ ] 缓存命中时间 < 1ms
- [ ] 启动时间无明显增加

---

## Phase 4: Future Enhancements (P4)

这些功能不在当前迭代范围，记录以供参考：

### 热重载

```typescript
// API 端点
POST /api/prompts/reload
{
  "template": "main"  // 可选，不指定则重载所有
}

// CLI 命令
/prompts reload
```

### 模板管理 CLI

```bash
/prompts list          # 列出可用模板
/prompts show main     # 显示模板内容
/prompts switch main  # 切换模板
```

### 模板验证工具

```bash
miniclaw validate-prompt ~/.miniclaw/prompts/main.md
```

---

## Rollout Plan

### Stage 1: 内部测试 (Day 1)

1. 完成代码开发和单元测试
2. 在开发环境测试所有场景
3. 修复发现的问题

### Stage 2: 灰度发布 (Day 2)

1. 合并到 main 分支
2. 部署到测试环境
3. 进行集成测试

### Stage 3: 正式发布 (Day 3)

1. 部署到生产环境
2. 监控日志和错误
3. 更新用户文档

---

## Risk Mitigation

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 向后兼容性破坏 | 低 | 高 | 保留直接文本支持，充分测试 |
| 性能下降 | 低 | 中 | 使用缓存，监控加载时间 |
| 模板文件丢失 | 中 | 中 | 使用 DEFAULT_SYSTEM_PROMPT 后备 |
| 用户配置错误 | 中 | 低 | 清晰的错误日志和文档 |

---

## Success Metrics

1. **功能完整性**
   - 所有 P1、P2 需求实现
   - 所有验收场景通过

2. **向后兼容**
   - 现有配置无需修改即可运行
   - 直接文本方式继续工作

3. **代码质量**
   - 单元测试覆盖率 > 80%
   - 无 TypeScript 错误
   - ESLint 无警告

4. **用户体验**
   - 模板加载失败有明确日志
   - 文档清晰易懂
   - 配置示例完整

---

## Dependencies

```json
{
  "yaml": "^2.3.0"
}
```

---

## Timeline

| Phase | Task | Est. Time | Status |
|-------|------|-----------|--------|
| 0 | Research | - | ✅ Done |
| 1 | Design | - | ✅ Done |
| 2.1 | Prompt 模块 | 2-3h | ⏳ Pending |
| 2.2 | Agent 流程修改 | 1-2h | ⏳ Pending |
| 2.3 | 模板文件创建 | 30m | ⏳ Pending |
| 2.4 | 单元测试 | 2h | ⏳ Pending |
| 2.5 | 文档清理 | 1h | ⏳ Pending |
| 3 | 集成测试 | 1h | ⏳ Pending |
| **Total** | - | **8-10h** | - |

---

## Next Steps

1. 切换到 `012-system-prompt-config` 分支
2. 开始 Step 1: 创建 Prompt 模块
3. 完成后进入 Step 2: 修改 Agent 创建流程