# Development Plan: Web Search Tool (DuckDuckGo)

**Feature Branch**: `008-web-search-tool`  
**Created**: 2026-03-27  
**Status**: Draft  
**Spec**: specs/008-web-search-tool/spec.md

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| HTTP Client | Node.js built-in `fetch` | 无需额外依赖 |
| 参数验证 | @sinclair/typebox | 项目已有依赖 |
| 测试框架 | Vitest | 项目已有配置 |
| Mock | Vitest vi.fn() | 单元测试 mock |

## File Structure

```
miniclaw/
├── src/
│   └── tools/
│       ├── index.ts              # [修改] 添加 webSearchTool 导出
│       └── web-search.ts          # [新建] web_search 工具实现
└── tests/
    └── unit/
        └── tools/
            └── web-search.test.ts # [新建] 单元测试
```

## Implementation Steps

### Step 1: 创建工具定义 (web-search.ts)

**文件**: `src/tools/web-search.ts`

**实现内容**:

1. **TypeBox Schema 定义**
   - `WebSearchParamsSchema`: 参数验证 schema
   - 必填参数: `query` (string)
   - 可选参数: `maxResults` (number, default=5)

2. **接口定义**
   ```typescript
   interface DuckDuckGoResponse {
     Abstract?: string;
     AbstractText?: string;
     AbstractSource?: string;
     AbstractURL?: string;
     Heading?: string;
     RelatedTopics?: Array<{
       Text?: string;
       FirstURL?: string;
     }>;
     Results?: Array<{
       Text?: string;
       FirstURL?: string;
     }>;
   }
   
   interface WebSearchResult {
     title: string;
     snippet: string;
     url: string;
     source?: string;
   }
   ```

3. **工具导出对象**
   ```typescript
   export const webSearchTool = {
     name: 'web_search',
     label: '搜索网页',
     description: '搜索网页信息，返回相关结果（使用 DuckDuckGo）',
     parameters: WebSearchParamsSchema,
     execute: async (toolCallId, params, signal) => {...}
   }
   ```

### Step 2: 实现 execute 函数

**核心逻辑**:

1. **参数验证**
   - 检查 query 非空
   - 处理 maxResults 默认值和边界值 (min=1, max=10)

2. **URL 构建**
   ```typescript
   const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
   ```

3. **请求发送**
   - 使用 fetch API
   - 设置合理超时 (默认 10000ms)
   - 支持 AbortSignal 传递

4. **响应解析**
   - 解析 DuckDuckGo JSON 响应
   - 提取 Abstract 和 RelatedTopics
   - 格式化返回结果

5. **结果格式化**
   - 返回文本格式结果
   - 包含 details 元信息

### Step 3: 错误处理

**场景覆盖**:

| 错误场景 | 处理方式 |
|---------|---------|
| 空查询 | 返回错误提示 "请提供搜索关键词" |
| maxResults <= 0 | 自动修正为 1 |
| maxResults > 10 | 自动修正为 10 |
| 网络错误 | 返回 "搜索请求失败: {error}" |
| 超时 | 返回 "搜索请求超时" |
| API 返回异常 | 返回 "搜索服务暂时不可用" |
| 无结果 | 返回 "未找到与 '{query}' 相关的结果" |
| AbortSignal | 正确传递中止信号 |

### Step 4: 注册工具到 index.ts

**文件**: `src/tools/index.ts`

**修改内容**:
```typescript
import { webSearchTool } from './web-search.js';

export { 
  // ... existing exports
  webSearchTool 
};

export function getBuiltinTools() {
  return [
    // ... existing tools
    webSearchTool
  ];
}
```

### Step 5: 创建单元测试

**文件**: `tests/unit/tools/web-search.test.ts`

## Test Plan

### Test Structure

```
web-search.test.ts
├── tool definition tests
│   ├── 验证工具名称
│   ├── 验证工具描述
│   └── 验证参数 schema
├── execute - 正常流程
│   ├── 返回抽象摘要
│   ├── 返回相关主题
│   └── 遵守 maxResults 限制
├── execute - 参数边界
│   ├── 空查询返回错误
│   ├── maxResults=0 自动修正
│   ├── maxResults>10 自动修正
│   └── maxResults 默认值
├── execute - 错误处理
│   ├── 网络错误处理
│   ├── 超时处理
│   ├── AbortSignal 处理
│   ├── API 返回异常格式
│   └── API 返回空对象
├── execute - 无结果场景
│   ├── 冷门关键词无结果
│   └── 返回友好提示
└── execute - URL 编码
    └── 特殊字符正确编码
```

### Test Cases

| ID | 场景 | 输入 | 期望输出 | Mock |
|----|------|------|---------|------|
| T1 | 工具名称正确 | - | name='web_search' | - |
| T2 | 工具描述完整 | - | description 存在 | - |
| T3 | 参数 schema 正确 | - | query 必填, maxResults 可选 | - |
| T4 | 空查询返回错误 | query='' | 包含 "请提供搜索关键词" | - |
| T5 | 正常搜索返回结果 | query='test' | content 数组有内容 | Mock fetch |
| T6 | 遵守 maxResults | query='test', maxResults=2 | 最多 2 条结果 | Mock fetch |
| T7 | maxResults=0 自动修正 | query='test', maxResults=0 | 使用默认值 | Mock fetch |
| T8 | maxResults>10 自动修正 | query='test', maxResults=20 | 最多 10 条结果 | Mock fetch |
| T9 | 网络错误处理 | query='test' | 包含 "搜索请求失败" | Mock fetch reject |
| T10 | 超时处理 | query='test', timeout=1 | 包含 "搜索请求超时" | Mock AbortError |
| T11 | 无结果友好提示 | query='test' | 包含 "未找到" | Mock 空响应 |
| T12 | API 异常格式 | query='test' | 返回错误提示 | Mock 无效 JSON |
| T13 | 特殊字符编码 | query='量子计算 原理' | URL 编码正确 | Mock fetch |
| T14 | 中文搜索有效 | query='量子计算' | 返回中文结果 | Mock fetch |

### Coverage Goals

| 类型 | 目标覆盖率 |
|------|----------|
| Statements | >= 80% |
| Branches | >= 75% |
| Functions | >= 90% |
| Lines | >= 80% |

### Mock Strategy

```typescript
// Mock DuckDuckGo API 响应
const mockDDGResponse = {
  Abstract: 'Test abstract',
  AbstractText: 'Test abstract text',
  AbstractSource: 'Wikipedia',
  AbstractURL: 'https://example.com',
  Heading: 'Test Heading',
  RelatedTopics: [
    { Text: 'Topic 1 - Description', FirstURL: 'https://example.com/1' },
    { Text: 'Topic 2 - Description', FirstURL: 'https://example.com/2' }
  ]
};

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(mockDDGResponse)
});
```

## Dependencies Check

| 依赖 | 状态 | 备注 |
|------|------|------|
| Node.js fetch | ✅ 内置 | Node 18+ |
| @sinclair/typebox | ✅ 已有 | 参数验证 |
| Vitest | ✅ 已有 | 测试框架 |

## API Reference

### DuckDuckGo Instant Answer API

**Endpoint**: `https://api.duckduckgo.com/`

**参数**:
| 参数 | 值 | 说明 |
|------|---|------|
| q | {query} | 搜索关键词 (需 URL 编码) |
| format | json | 返回格式 |
| no_html | 1 | 移除 HTML 标签 |
| skip_disambig | 1 | 跳过消歧页 |

**响应字段**:
| 字段 | 说明 |
|------|------|
| Abstract | 摘要内容 (HTML) |
| AbstractText | 摘要内容 (纯文本) |
| AbstractSource | 摘要来源 |
| AbstractURL | 摘要链接 |
| Heading | 标题 |
| RelatedTopics | 相关主题数组 |
| Results | 额外结果数组 |

**限制**:
- 无需 API Key
- 有隐式速率限制
- 适合轻量级搜索场景

## Estimated Effort

| 步骤 | 预计时间 |
|------|---------|
| Step 1: 工具定义 | 15 min |
| Step 2: execute 实现 | 30 min |
| Step 3: 错误处理 | 20 min |
| Step 4: 注册工具 | 5 min |
| Step 5: 单元测试 | 40 min |
| **总计** | **~2 小时** |

## Risks & Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| DuckDuckGo API 不可用 | 高 | 优雅错误处理，返回友好提示 |
| API 响应格式变化 | 中 | 防御性解析，处理缺失字段 |
| 中文搜索结果质量 | 低 | 接受现状，文档说明限制 |
| 速率限制 | 低 | 文档说明，无 API Key 限制 |

## Acceptance Checklist

完成以下检查后方可进入 implement 阶段：

- [ ] plan.md 已创建
- [ ] 文件结构清晰
- [ ] 实现步骤明确
- [ ] 测试用例完整
- [ ] 错误处理覆盖
- [ ] 无外部依赖新增