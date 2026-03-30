# Feature Specification: Web Search Tool (DuckDuckGo)

**Feature Branch**: `008-web-search-tool`  
**Created**: 2026-03-27  
**Status**: Draft  
**Input**: 需求文档 docs/REQUIREMENTS_V7.md - web_search 工具设计，使用 DuckDuckGo Instant Answer API

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Agent 获取实时信息 (Priority: P1)

作为 AI Agent，我希望能够搜索网页信息，以便为用户提供最新的、实时的答案。

**Why this priority**: 这是核心功能，解决子代理无搜索能力的问题，是整个工具存在的根本价值。

**Independent Test**: 可以通过调用 `web_search` 工具并验证返回结果来完全测试，无需依赖其他功能。

**Acceptance Scenarios**:

1. **Given** 用户询问 "ETF 最新行情", **When** Agent 调用 `web_search` 参数 query="ETF 最新行情", **Then** 返回相关搜索结果，包含标题、摘要和链接
2. **Given** Agent 调用 `web_search` 参数 query="TypeScript generics tutorial" maxResults=3, **When** 结果返回, **Then** 返回恰好 3 条结果
3. **Given** Agent 调用 `web_search` 参数 query="量子计算原理", **When** 结果返回, **Then** 结果包含中文摘要和来源

---

### User Story 2 - Agent 优雅处理搜索错误 (Priority: P2)

作为 AI Agent，我希望搜索错误能够被优雅处理，以便能够适当地告知用户。

**Why this priority**: 错误处理是生产环境稳定性的保障，但优先级低于核心搜索功能。

**Independent Test**: 可以通过模拟网络错误、空查询等场景独立测试错误处理逻辑。

**Acceptance Scenarios**:

1. **Given** DuckDuckGo API 不可用, **When** Agent 调用 `web_search`, **Then** 返回适当的错误信息而非崩溃
2. **Given** 查询参数 query 为空字符串, **When** Agent 调用 `web_search`, **Then** 返回错误提示无效输入
3. **Given** 请求被中止（AbortSignal）, **When** Agent 调用 `web_search`, **Then** 正确处理中止信号

---

### User Story 3 - Agent 获取无结果时友好反馈 (Priority: P2)

作为 AI Agent，我希望搜索无结果时能收到清晰的反馈，以便告知用户没有找到相关信息。

**Why this priority**: 用户体验优化，但不是核心功能。

**Independent Test**: 可以通过搜索冷门关键词模拟无结果场景独立测试。

**Acceptance Scenarios**:

1. **Given** 搜索词过于冷门如 "xyzabc123不存在的词汇", **When** Agent 调用 `web_search`, **Then** 返回 "未找到相关结果" 的友好提示
2. **Given** 搜索结果只有摘要无相关主题, **When** Agent 调用 `web_search`, **Then** 至少返回摘要信息

---

### Edge Cases

- 当 DuckDuckGo API 返回格式异常（如缺少必要字段）时如何处理？
- 当 maxResults 设置为 0 或负数时如何处理？
- 当查询字符串包含特殊字符时如何编码？
- 当网络请求超时时如何处理？
- 当 API 返回空对象 {} 时如何处理？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系统必须提供 `web_search` 工具，接受 query 参数（必填，搜索关键词）
- **FR-002**: 工具必须支持可选的 `maxResults` 参数（默认值 5，限制返回结果数量）
- **FR-003**: 工具必须使用 DuckDuckGo Instant Answer API（免费、无需 API Key）
- **FR-004**: 结果必须包含标题(title)、摘要(snippet)、链接(url) 和来源(source，可选)
- **FR-005**: 工具必须正确处理 AbortSignal 以支持请求中止
- **FR-006**: 工具必须返回格式化的文本结果
- **FR-007**: 工具必须正确编码 URL 参数（encodeURIComponent）
- **FR-008**: 工具必须在无结果时返回友好提示

### Non-Functional Requirements

- **NFR-001**: 响应时间应在 5 秒以内
- **NFR-002**: 无外部依赖，仅使用 Node.js 内置 fetch
- **NFR-003**: 工具描述应清晰说明适用场景和限制
- **NFR-004**: 单元测试覆盖率 >= 80%

### Key Entities

```typescript
// 工具参数
interface WebSearchParams {
  query: string;           // 搜索关键词（必填）
  maxResults?: number;     // 最大结果数，默认5
}

// DuckDuckGo API 响应结构
interface DuckDuckGoResponse {
  Abstract?: string;       // 摘要 HTML
  AbstractText?: string;   // 摘要纯文本
  AbstractSource?: string; // 摘要来源
  AbstractURL?: string;    // 摘要链接
  Heading?: string;        // 标题
  RelatedTopics?: Array<{
    Text?: string;         // 主题描述
    FirstURL?: string;     // 链接
  }>;
  Results?: Array<{
    Text?: string;
    FirstURL?: string;
  }>;
}

// 内部结果结构
interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
  source?: string;
}

// 工具返回格式
interface ToolResponse {
  content: Array<{ type: 'text'; text: string }>;
  details?: { query: string; count?: number; error?: boolean };
}
```

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `web_search` 工具可被正常调用并返回有效搜索结果
- **SC-002**: 工具正确遵守 maxResults 参数限制返回结果数量
- **SC-003**: 工具正确处理网络错误、API 错误并返回有意义的信息
- **SC-004**: 工具正确处理空查询参数并返回错误提示
- **SC-005**: 单元测试覆盖率 >= 80%，包含正常流程和边界情况
- **SC-006**: 中文搜索能够返回有效结果
- **SC-007**: 无结果时返回友好提示而非空或错误

## Out of Scope

- 实时股价查询（需要专门的数据源）
- 分页搜索
- 图片/视频搜索
- 搜索结果缓存
- 速率限制（DuckDuckGo 无需 API Key，但有隐式限制）

## Dependencies

- Node.js 内置 fetch API
- @sinclair/typebox（参数验证，项目已有依赖）

## Implementation Notes

- 文件位置：`src/tools/web-search.ts`
- 需要在 `src/tools/index.ts` 中导出
- DuckDuckGo API 端点：`https://api.duckduckgo.com/?q={query}&format=json&no_html=1&skip_disambig=1`
- 无需 API Key，适合轻量级搜索场景