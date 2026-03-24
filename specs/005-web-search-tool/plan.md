# Implementation Plan: Web Search Tool

**Feature Branch**: `005-web-search-tool`
**Created**: 2026-03-23

## Clarification Summary

| 决策项 | 选择 |
|--------|------|
| API Key 来源 | 环境变量 `BRAVE_SEARCH_API_KEY` |
| 默认 count | 5 |
| 默认 country | 不指定（全球） |
| API 超时 | 5秒 |
| 无结果时 | 返回空数组 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Miniclaw Agent                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Tools                              │   │
│  │  read_file │ write_file │ shell │ web_fetch │        │   │
│  │  memory_search │ memory_get │ web_search (新增) │     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              WebSearchTool (新增)                     │   │
│  │  - execute(query, count, country)                    │   │
│  │  - 调用 Brave Search API                              │   │
│  │  - 返回 [{title, url, snippet}]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
src/tools/
├── web-search.ts        # web_search 工具 (新增)
└── index.ts             # 工具注册 (修改)

tests/unit/tools/
└── web-search.test.ts   # 单元测试 (新增)
```

---

## Implementation Phases

### Phase 1: Tool Implementation (TDD Red → Green)

**Step 1.1: Write Test (Red)**

创建测试文件，定义预期行为：

```typescript
// tests/unit/tools/web-search.test.ts
describe('web_search tool', () => {
  it('should have correct tool name', () => {});
  it('should return search results', () => {});
  it('should respect count parameter', () => {});
  it('should handle API errors gracefully', () => {});
  it('should return empty array when no results', () => {});
});
```

**Step 1.2: Implement Tool (Green)**

创建工具实现：

```typescript
// src/tools/web-search.ts
export const webSearchTool = {
  name: 'web_search',
  label: '网页搜索',
  description: '搜索网页获取信息',
  parameters: WebSearchParamsSchema,
  execute: async (_toolCallId, params) => {
    // 调用 Brave Search API
    // 返回结果
  }
};
```

**Step 1.3: Register Tool**

修改 `src/tools/index.ts`：

```typescript
import { webSearchTool } from './web-search.js';

export function getBuiltinTools() {
  return [
    // ... existing tools
    webSearchTool,
  ];
}
```

---

## Brave Search API Integration

### API Endpoint

```
GET https://api.search.brave.com/res/v1/web/search
```

### Request Headers

```
Accept: application/json
Accept-Encoding: gzip
X-Subscription-Token: {API_KEY}
```

### Request Parameters

| 参数 | 说明 |
|------|------|
| q | 搜索关键词 |
| count | 结果数量 (1-10) |
| country | 国家代码 |

### Response Format

```json
{
  "web": {
    "results": [
      {
        "title": "Result Title",
        "url": "https://example.com",
        "description": "Snippet text..."
      }
    ]
  }
}
```

---

## Error Handling

| 错误场景 | 处理方式 |
|----------|----------|
| API Key 未配置 | 返回错误提示 |
| API 超时 | 返回错误提示 |
| 网络错误 | 返回错误提示 |
| 无结果 | 返回空数组 |

---

## Time Estimate

| Phase | Duration |
|-------|----------|
| Phase 1: TDD 实现 | 1h |
| **Total** | **1h** |

---

## Next Steps

1. 创建测试文件（Red）
2. 运行测试确认失败
3. 实现工具代码（Green）
4. 运行测试确认通过
5. 注册工具