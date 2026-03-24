# Tasks: Web Search Tool

**Input**: specs/005-web-search-tool/spec.md, plan.md

---

## Phase 1: TDD Implementation

### T001 [P] Write test file

**File**: `tests/unit/tools/web-search.test.ts`

**Test cases**:
- should have correct tool name
- should return search results for valid query
- should respect count parameter
- should handle API errors gracefully
- should return empty array when no results

**Acceptance**:
- [ ] Test file created
- [ ] Tests fail (Red)

---

### T002 Implement web_search tool

**File**: `src/tools/web-search.ts`

**Implementation**:
```typescript
import { Type, type Static } from '@sinclair/typebox';

const WebSearchParamsSchema = Type.Object({
  query: Type.String({ description: '搜索关键词' }),
  count: Type.Optional(Type.Number({ minimum: 1, maximum: 10, description: '结果数量 (1-10)' })),
  country: Type.Optional(Type.String({ description: '国家代码 (US, CN, etc.)' })),
});

type WebSearchParams = Static<typeof WebSearchParamsSchema>;

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export const webSearchTool = {
  name: 'web_search',
  label: '网页搜索',
  description: '搜索网页获取最新信息。返回标题、链接和摘要。',
  parameters: WebSearchParamsSchema,
  
  async execute(_toolCallId: string, params: WebSearchParams) {
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;
    if (!apiKey) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'BRAVE_SEARCH_API_KEY not configured', results: [] }) }],
        details: { error: 'API key not configured' }
      };
    }

    const count = params.count ?? 5;
    const url = new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q', params.query);
    url.searchParams.set('count', String(count));
    if (params.country) {
      url.searchParams.set('country', params.country);
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `API error: ${response.status}`, results: [] }) }],
          details: { error: `API error: ${response.status}` }
        };
      }

      const data = await response.json() as any;
      const results: WebSearchResult[] = (data?.web?.results ?? []).map((r: any) => ({
        title: r.title ?? '',
        url: r.url ?? '',
        snippet: r.description ?? '',
      }));

      return {
        content: [{ type: 'text', text: JSON.stringify({ results }, null, 2) }],
        details: { count: results.length }
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: errorMsg, results: [] }) }],
        details: { error: errorMsg }
      };
    }
  }
};
```

**Acceptance**:
- [ ] Tool file created
- [ ] Tests pass (Green)

---

### T003 Register tool in index

**File**: `src/tools/index.ts`

**Changes**:
```typescript
import { webSearchTool } from './web-search.js';

export { ..., webSearchTool };

export function getBuiltinTools() {
  return [
    // ... existing tools
    webSearchTool,
  ];
}
```

**Acceptance**:
- [ ] Tool exported
- [ ] Tool in getBuiltinTools()

---

## Summary

| Phase | Tasks | Est. Time |
|-------|-------|-----------|
| Phase 1 | T001-T003 | 1h |

---

## Execution Order (TDD)

```
1. T001: Write tests (Red)
2. Run tests → Confirm failure
3. T002: Implement tool (Green)
4. Run tests → Confirm pass
5. T003: Register tool
6. Run full test suite
```