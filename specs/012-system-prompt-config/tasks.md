# Tasks - 系统提示词可配置化

**Feature Branch**: `012-system-prompt-config`
**Created**: 2026-04-10
**Status**: Completed

---

## Phase 1: Setup（项目初始化）

### T001 [P0] [Setup] 添加 yaml 依赖 ✅

**描述**: 添加 YAML 解析库依赖用于 frontmatter 解析

**文件**:
- `package.json`

**验收标准**:
- [x] package.json 中添加 `"yaml": "^2.3.0"`
- [x] 执行 `npm install` 成功

---

### T002 [P0] [Setup] 创建 Prompt 模块目录结构 ✅

**描述**: 创建提示词模块的目录结构

**文件**:
- `src/core/prompt/` 目录

**验收标准**:
- [x] 创建 `src/core/prompt/` 目录

---

## Phase 2: Foundational（基础设施）

### T003 [P0] [Foundation] 定义 Prompt 核心类型 ✅

**描述**: 定义提示词模块的核心类型和接口

**用户故事**: US1 - 外部化系统提示词模板

**文件**:
- `src/core/prompt/types.ts`

**实现内容**:
```typescript
// PromptTemplate 接口
// PromptReference 类型
// PromptLoadOptions 接口
// PromptParseResult 接口
// PromptLoadError 类
// PromptParseError 类
```

**验收标准**:
- [x] 定义 PromptTemplate 接口（name, description, model, tools, content 等）
- [x] 定义 PromptReference 类型（支持直接文本和文件路径）
- [x] 定义 PromptLoadOptions 接口
- [x] 定义 PromptParseResult 接口
- [x] 定义 PromptLoadError 和 PromptParseError 错误类

---

### T004 [P0] [Foundation] 实现 YAML frontmatter 解析器 ✅

**描述**: 实现 YAML frontmatter 解析功能

**用户故事**: US4 - 模板格式参考 pi-coding-agent 风格

**文件**:
- `src/core/prompt/parser.ts`

**实现内容**:
```typescript
// parseFrontmatter(content: string): PromptTemplate
// extractYamlFrontmatter(content: string): { yaml: string, markdown: string } | null
```

**验收标准**:
- [x] 支持解析有效的 YAML frontmatter
- [x] 处理无 frontmatter 的纯 markdown 文件
- [x] 处理格式错误的 frontmatter（返回原始内容）
- [x] 提取 name, description, model, tools 等元数据

---

### T005 [P0] [Foundation] 实现 PromptManager 管理器 ✅

**描述**: 实现提示词管理器，负责加载、解析、缓存模板

**用户故事**: US1 - 外部化系统提示词模板

**文件**:
- `src/core/prompt/manager.ts`

**实现内容**:
```typescript
// class PromptManager
// - loadPrompt(reference: PromptReference, options?: PromptLoadOptions): Promise<PromptParseResult>
// - parseTemplateFile(filePath: string): Promise<PromptParseResult>
// - getCached(key: string): PromptTemplate | undefined
// - clearCache(): void
// - reloadPrompt(reference: PromptReference): Promise<PromptParseResult>
```

**验收标准**:
- [x] loadPrompt 支持直接文本和文件路径两种模式
- [x] 文件路径支持 `file://`, `~/`, `./`, `/` 四种格式
- [x] 实现模板缓存机制
- [x] 文件不存在时使用后备提示词
- [x] 记录详细的加载日志

---

### T006 [P0] [Foundation] 导出 Prompt 模块 ✅

**描述**: 创建模块入口文件，导出所有公共接口

**文件**:
- `src/core/prompt/index.ts`

**验收标准**:
- [x] 导出 PromptManager 类
- [x] 导出所有类型定义
- [x] 导出错误类

---

### T007 [P0] [Foundation] 修改 Agent 创建流程集成 PromptManager ✅

**描述**: 在 Agent 创建时集成 PromptManager，支持从配置加载模板

**用户故事**: US2 - 多模板支持与 Agent 关联

**文件**:
- `src/index.ts` 或 `src/core/gateway/index.ts`

**实现内容**:
```typescript
// 创建 PromptManager 实例
// 修改 createAgentFn 函数
// 调用 promptManager.loadPrompt() 解析 systemPrompt
```

**验收标准**:
- [x] 应用启动时创建 PromptManager 实例
- [x] Agent 创建前解析 systemPrompt 配置
- [x] 支持文件路径引用（file://, ~/, ./, /）
- [x] 支持直接文本（向后兼容）
- [x] 记录模板加载日志（名称、路径、字符数）

---

### T008 [P0] [Foundation] 创建默认模板文件 ✅

**描述**: 将 DEFAULT_SYSTEM_PROMPT 提取到模板文件

**用户故事**: US1 - 外部化系统提示词模板

**文件**:
- `~/.miniclaw/prompts/default.md`

**实现内容**:
```markdown
---
name: default
description: Miniclaw 默认系统提示词
model: qwen3.5-plus
version: 1.0.0
---

[从 DEFAULT_SYSTEM_PROMPT 迁移的内容]
```

**验收标准**:
- [x] 创建 `~/.miniclaw/prompts/` 目录
- [x] 创建 default.md 模板文件
- [x] 包含有效的 YAML frontmatter
- [x] 内容与 DEFAULT_SYSTEM_PROMPT 一致

---

### T009 [P0] [Foundation] 创建 main Agent 模板文件 ✅

**描述**: 为 main Agent 创建专用提示词模板

**用户故事**: US2 - 多模板支持与 Agent 关联

**文件**:
- `~/.miniclaw/prompts/main.md`

**验收标准**:
- [x] 基于 config.json 中 main Agent 的 systemPrompt
- [x] 添加 YAML frontmatter（name, description, model）
- [x] 格式符合 pi-coding-agent 风格

---

### T010 [P0] [Foundation] 创建 etf Agent 模板文件 ✅

**描述**: 为 etf Agent 创建专用提示词模板

**用户故事**: US2 - 多模板支持与 Agent 关联

**文件**:
- `~/.miniclaw/prompts/etf.md`

**验收标准**:
- [x] 基于 config.json 中 etf Agent 的 systemPrompt
- [x] 添加 YAML frontmatter
- [x] 包含 ETF 分析师角色定义

---

### T011 [P0] [Foundation] 创建 policy Agent 模板文件 ✅

**描述**: 为 policy Agent 创建专用提示词模板

**用户故事**: US2 - 多模板支持与 Agent 关联

**文件**:
- `~/.miniclaw/prompts/policy.md`

**验收标准**:
- [x] 基于 config.json 中 policy Agent 的 systemPrompt
- [x] 添加 YAML frontmatter
- [x] 包含政策分析师角色定义

---

### T012 [P0] [Foundation] 更新配置文件使用模板路径 ✅

**描述**: 更新 config.json 中的 systemPrompt 配置为文件路径引用

**用户故事**: US2 - 多模板支持与 Agent 关联

**文件**:
- `~/.miniclaw/config.json`

**实现内容**:
```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "systemPrompt": "file://~/.miniclaw/prompts/main.md"
      }
    ]
  }
}
```

**验收标准**:
- [x] main Agent 使用 file:// 引用
- [x] etf Agent 使用 file:// 引用
- [x] policy Agent 使用 file:// 引用
- [x] 保持其他配置不变

---

## Phase 3: User Story 1 - 外部化系统提示词模板 [P1]

### T013 [P1] [US1] 编写 PromptManager 单元测试

**描述**: 编写 PromptManager 核心功能的单元测试

**用户故事**: US1 - 外部化系统提示词模板

**文件**:
- `tests/unit/prompt/manager.test.ts`

**测试用例**:
- [ ] loadPrompt() 加载直接文本
- [ ] loadPrompt() 加载文件路径
- [ ] loadPrompt() 文件不存在时使用后备值
- [ ] getCached() 缓存命中
- [ ] clearCache() 清除缓存
- [ ] reloadPrompt() 重新加载

---

### T014 [P1] [US1] 编写 frontmatter 解析单元测试

**描述**: 编写 YAML frontmatter 解析的单元测试

**用户故事**: US4 - 模板格式参考 pi-coding-agent 风格

**文件**:
- `tests/unit/prompt/parser.test.ts`

**测试用例**:
- [ ] 解析有效 frontmatter
- [ ] 解析无 frontmatter 的纯文本
- [ ] 解析格式错误的 frontmatter
- [ ] 提取元数据（name, description, model, tools）
- [ ] 提取 markdown 内容

---

### T015 [P1] [US1] 编写 Agent 集成测试

**描述**: 编写 Agent 与 PromptManager 集成的测试

**用户故事**: US1 - 外部化系统提示词模板

**文件**:
- `tests/integration/prompt/agent-prompt.test.ts`

**测试用例**:
- [ ] Agent 使用文件模板启动
- [ ] Agent 使用直接文本启动
- [ ] 模板加载失败时使用后备值
- [ ] 多 Agent 使用不同模板

---

## Phase 4: User Story 2 - 多模板支持与 Agent 关联 [P2]

### T016 [P2] [US2] 验证多 Agent 不同模板功能

**描述**: 验证 main、etf、policy Agent 可以使用不同的系统提示词模板

**用户故事**: US2 - 多模板支持与 Agent 关联

**文件**:
- `tests/integration/prompt/multi-agent.test.ts`

**验收标准**:
- [ ] main Agent 使用 main.md 模板
- [ ] etf Agent 使用 etf.md 模板
- [ ] policy Agent 使用 policy.md 模板
- [ ] 切换 Agent 后系统提示词正确

---

## Phase 5: User Story 4 - 模板格式规范化 [P2]

### T017 [P2] [US4] 添加模板验证工具

**描述**: 创建模板验证脚本，检查模板格式是否正确

**用户故事**: US4 - 模板格式参考 pi-coding-agent 风格

**文件**:
- `scripts/validate-prompt.ts`

**验收标准**:
- [ ] 验证 YAML frontmatter 格式
- [ ] 验证必需字段（name）
- [ ] 输出验证结果和错误信息

---

## Phase 6: Tool Enhancements - 工具增强

### T018 [P0] [Tool] 实现 glob 工具 ✅

**描述**: 实现文件模式匹配搜索工具

**文件**:
- `src/tools/glob.ts`

**实现内容**:
```typescript
// 使用 fast-glob 或 globby
// 参数: pattern, path
// 返回: 匹配的文件路径数组（按修改时间排序）
```

**验收标准**:
- [x] 支持 glob 模式匹配
- [x] 支持指定搜索目录
- [x] 结果按修改时间排序
- [x] 注册到工具列表

---

### T019 [P0] [Tool] 实现 grep 工具 ✅

**描述**: 实现基于 ripgrep 的内容搜索工具

**文件**:
- `src/tools/grep.ts`

**实现内容**:
```typescript
// 调用 rg 命令或使用 ripgrep npm 包
// 参数: pattern, path, output_mode, -i, -n, glob, head_limit
// 支持 content, files_with_matches, count 三种输出模式
```

**验收标准**:
- [x] 支持正则表达式搜索
- [x] 支持忽略大小写
- [x] 支持显示行号
- [x] 支持文件过滤
- [x] 支持输出模式选择
- [x] 注册到工具列表

---

### T020 [P0] [Tool] 实现 ls 工具 ✅

**描述**: 实现目录列表工具

**文件**:
- `src/tools/ls.ts`

**实现内容**:
```typescript
// 使用 fs.readdir 实现
// 参数: path, ignore
// 返回: 目录内容列表
```

**验收标准**:
- [x] 列出目录内容
- [x] 支持忽略模式
- [x] 显示文件/目录信息
- [x] 注册到工具列表

---

### T021 [P0] [Tool] 实现 edit 工具 ✅

**描述**: 实现文件内容精确替换工具

**文件**:
- `src/tools/edit.ts`

**实现内容**:
```typescript
// 参数: path, old_string, new_string, replace_all
// 流程: 读取文件 → 查找匹配 → 替换 → 写入
// 必须先读取文件才能编辑
```

**验收标准**:
- [x] 支持精确字符串替换
- [x] 支持替换所有匹配项
- [x] old_string 必须唯一匹配
- [x] 注册到工具列表

---

### T022 [P0] [Tool] 实现 multi_edit 工具 ✅

**描述**: 实现批量文件编辑工具

**文件**:
- `src/tools/multi-edit.ts`

**实现内容**:
```typescript
// 参数: path, edits[]
// 原子操作：全部成功或全部失败
```

**验收标准**:
- [x] 支持批量编辑
- [x] 原子操作（事务性）
- [x] edits 之间不能重叠
- [x] 注册到工具列表

---

### T023 [P0] [Tool] 增强 write_file 工具 ✅

**描述**: 为 write_file 工具添加覆盖模式

**文件**:
- `src/tools/write-file.ts`

**实现内容**:
```typescript
// 新增参数: mode ('overwrite' | 'append' | 'create')
// 'overwrite' - 覆盖写入（新默认）
// 'append' - 追加写入
// 'create' - 仅创建新文件
```

**验收标准**:
- [x] 支持 overwrite 模式
- [x] 支持 append 模式
- [x] 支持 create 模式
- [x] 默认模式为 overwrite
- [x] 保持向后兼容

---

### T024 [P1] [Tool] 实现 task 工具

**描述**: 实现子代理启动工具

**文件**:
- `src/tools/task.ts`

**实现内容**:
```typescript
// 参数: subagent_type, description, prompt
// 创建子代理实例 → 执行任务 → 返回结果
```

**验收标准**:
- [ ] 支持启动子代理
- [ ] 支持任务描述
- [ ] 支持详细 prompt
- [ ] 注册到工具列表

---

### T025 [P1] [Tool] 实现 todo_write 工具

**描述**: 实现任务列表管理工具

**文件**:
- `src/tools/todo-write.ts`

**实现内容**:
```typescript
// 参数: todos[]
// 每个 todo: id, content, status (pending | in_progress | completed)
// 更新任务状态
```

**验收标准**:
- [ ] 支持创建任务
- [ ] 支持更新状态
- [ ] 支持 pending/in_progress/completed 状态
- [ ] 注册到工具列表

---

### T026 [P1] [Tool] 增强 read_file 工具

**描述**: 为 read_file 工具添加分页和编码支持

**文件**:
- `src/tools/read-file.ts`

**实现内容**:
```typescript
// 新增参数: offset, limit, encoding
// 支持: 分页读取、编码检测
// 未来扩展: 图片/PDF 支持
```

**验收标准**:
- [ ] 支持 offset 参数（起始行号）
- [ ] 支持 limit 参数（读取行数）
- [ ] 支持 encoding 参数
- [ ] 保持向后兼容

---

### T027 [P1] [Tool] 增强 shell 工具

**描述**: 为 shell 工具添加超时、后台运行等参数

**文件**:
- `src/tools/shell.ts`

**实现内容**:
```typescript
// 新增参数: timeout, description, run_in_background, cwd
// 支持: 超时控制、后台运行、工作目录
```

**验收标准**:
- [ ] 支持 timeout 参数
- [ ] 支持 description 参数
- [ ] 支持 run_in_background 参数
- [ ] 支持 cwd 参数
- [ ] 保持向后兼容

---

### T028 [P2] [Tool] 实现 bash_output 工具

**描述**: 实现获取后台进程输出工具

**文件**:
- `src/tools/bash-output.ts`

**验收标准**:
- [ ] 获取后台进程的标准输出
- [ ] 获取后台进程的标准错误
- [ ] 注册到工具列表

---

### T029 [P2] [Tool] 实现 kill_bash 工具

**描述**: 实现终止后台进程工具

**文件**:
- `src/tools/kill-bash.ts`

**验收标准**:
- [ ] 终止指定后台进程
- [ ] 注册到工具列表

---

### T030 [P0] [Tool] 注册新工具到工具列表 ✅

**描述**: 在工具入口文件中注册所有新工具

**文件**:
- `src/tools/index.ts`

**验收标准**:
- [x] 导入所有新工具
- [x] 在 getBuiltinTools() 中返回
- [x] 按优先级排序（P0 → P1 → P2）

---

## Phase 7: User Story 3 - 运行时切换 [P3]

### T031 [P3] [US3] 实现 Agent 运行时切换提示词

**描述**: 实现 Agent 的 setSystemPrompt() 方法，支持运行时切换

**用户故事**: US3 - 运行时切换系统提示词

**文件**:
- `src/core/agent/index.ts`

**验收标准**:
- [ ] setSystemPrompt() 方法已存在（保持现有接口）
- [ ] 支持通过模板名称切换
- [ ] 支持通过模板路径切换
- [ ] 切换后后续对话使用新提示词

---

### T032 [P3] [US3] 添加模板热重载 API

**描述**: 添加 CLI 命令或 API 端点支持模板热重载

**用户故事**: US3 - 运行时切换系统提示词

**文件**:
- `src/core/prompt/manager.ts` (扩展)
- `src/cli/commands.ts` 或 `src/api/routes.ts`

**验收标准**:
- [ ] `/prompts reload` 命令
- [ ] 或 `POST /api/prompts/reload` API
- [ ] 清除缓存并重新加载模板

---

## Phase 8: Documentation & Cleanup

### T033 [P1] [Doc] 更新 README 文档

**描述**: 添加提示词配置说明到 README

**文件**:
- `README.md`

**验收标准**:
- [ ] 添加提示词配置章节
- [ ] 说明模板文件位置
- [ ] 说明模板格式（YAML frontmatter）
- [ ] 说明配置文件中的引用方式

---

### T034 [P1] [Doc] 更新 CLAUDE.md 开发指南

**描述**: 添加提示词模块的开发注意事项

**文件**:
- `CLAUDE.md`

**验收标准**:
- [ ] 添加 PromptManager 使用说明
- [ ] 添加模板格式规范
- [ ] 添加错误处理指南

---

### T035 [P1] [Doc] 添加 JSDoc 注释

**描述**: 为所有公共接口添加 JSDoc 注释

**文件**:
- `src/core/prompt/types.ts`
- `src/core/prompt/parser.ts`
- `src/core/prompt/manager.ts`
- `src/tools/*.ts` (新增工具)

**验收标准**:
- [ ] 所有公共接口有 JSDoc
- [ ] 参数和返回值有说明
- [ ] 复杂逻辑有注释

---

### T036 [P1] [QA] 代码质量检查

**描述**: 运行 lint 和 build，确保代码质量

**验收标准**:
- [ ] `npm run lint` 无错误
- [ ] `npm run build` 成功
- [ ] 无 TypeScript 类型错误
- [ ] 移除调试日志

---

## Summary

| Phase | 描述 | 任务数 | 优先级 |
|-------|------|--------|--------|
| Phase 1 | Setup | 2 | P0 |
| Phase 2 | Foundational | 10 | P0 |
| Phase 3 | US1 - 外部化模板 | 3 | P1 |
| Phase 4 | US2 - 多模板支持 | 1 | P2 |
| Phase 5 | US4 - 模板格式 | 1 | P2 |
| Phase 6 | Tool Enhancements | 13 | P0-P2 |
| Phase 7 | US3 - 运行时切换 | 2 | P3 |
| Phase 8 | Documentation | 4 | P1 |
| **Total** | - | **36** | - |

## Execution Order

建议执行顺序（按优先级）：

1. **P0 基础设施**（必须先完成）
   - T001-T012: Setup + Foundational + 模板文件

2. **P0 工具增强**
   - T018-T022: glob, grep, ls, edit, multi_edit
   - T023: write_file 增强
   - T030: 工具注册

3. **P1 测试和文档**
   - T013-T015: 单元测试和集成测试
   - T033-T036: 文档和代码质量

4. **P1 工具增强**
   - T024-T027: task, todo_write, read_file, shell

5. **P2 功能完善**
   - T016-T017: 多模板验证
   - T028-T029: bash_output, kill_bash

6. **P3 可选功能**
   - T031-T032: 运行时切换（未来版本）