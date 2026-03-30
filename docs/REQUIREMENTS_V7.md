# Miniclaw 七期需求文档 (v0.7)

> web_search 工具 + 配置文件加载

## 一、背景

### 1.1 当前状态 (2026-03-27)

**已完成模块：**

| 模块 | 状态 | 说明 |
|------|:----:|------|
| Gateway | ✅ | 统一消息入口 |
| Router | ✅ | 消息路由 |
| SessionManager | ✅ | Session 管理 |
| AgentRegistry | ✅ | Agent 实例管理（多类型） |
| SimpleMemoryStorage | ✅ | 对话历史持久化 |
| MemorySearchManager | ✅ | 记忆搜索 |
| SkillManager | ✅ | 技能系统 |
| SubagentManager | ✅ | 子代理管理 |
| Channels | ✅ | CLI/API/Web/Feishu 通道 |
| Tools | ✅ | 文件/Shell/网络/记忆工具 |
| config.json 加载 | ✅ | Agent 配置文件加载 |

**已配置 Agent 类型：**

| Agent ID | 名称 | 模型 | 说明 |
|----------|------|------|------|
| main | 影子 | qwen3.5-plus | 主代理 |
| etf | ETF 分析师 | qwen-plus | ETF 市场分析 |
| policy | 政策分析师 | qwen-plus | 宏观政策分析 |

### 1.2 待解决问题

| 问题 | 影响 | 原因 |
|------|------|------|
| 子代理无搜索能力 | 无法获取实时信息 | 缺少 web_search 工具 |
| ETF Agent 功能受限 | 无法分析市场行情 | 没有数据来源 |

---

## 二、web_search 工具设计（P1）

### 2.1 技术选型

**方案：DuckDuckGo Instant Answer API**

| 特性 | 说明 |
|------|------|
| 免费额度 | 无限制 |
| API Key | 不需要 |
| 中文支持 | 一般（英文最佳） |
| 响应速度 | 快 |

**对比其他方案：**

| 方案 | 免费额度 | API Key | 推荐度 |
|------|---------|:-------:|:------:|
| **DuckDuckGo** | 无限制 | ❌ | ⭐⭐⭐ |
| SerpAPI | 100次/月 | ✅ | ⭐⭐ |
| Bing Search | 1000次/月 | ✅ | ⭐⭐ |

### 2.2 API 说明

**端点：**
```
GET https://api.duckduckgo.com/?q={query}&format=json&no_html=1&skip_disambig=1
```

**参数：**
| 参数 | 类型 | 说明 |
|------|------|------|
| q | string | 搜索关键词 |
| format | string | 固定 "json" |
| no_html | number | 1（去除HTML） |
| skip_disambig | number | 1（跳过消歧） |

**返回示例：**
```json
{
  "Abstract": "摘要文本",
  "AbstractText": "纯文本摘要",
  "AbstractSource": "Wikipedia",
  "AbstractURL": "https://...",
  "Heading": "标题",
  "RelatedTopics": [
    {
      "Text": "相关主题描述",
      "FirstURL": "https://..."
    }
  ],
  "Results": [
    {
      "Text": "结果文本",
      "FirstURL": "https://..."
    }
  ]
}
```

### 2.3 工具接口设计

**文件位置：** `src/tools/web-search.ts`

**参数定义：**
```typescript
interface WebSearchParams {
  query: string;           // 搜索关键词（必填）
  maxResults?: number;     // 最大结果数，默认5
}

const WebSearchParamsSchema = Type.Object({
  query: Type.String({ description: '搜索关键词' }),
  maxResults: Type.Optional(Type.Number({ 
    description: '最大结果数，默认5',
    default: 5 
  }))
});
```

**返回格式：**
```
搜索结果：{query}

1. {title}
   {snippet}
   链接：{url}

2. {title}
   {snippet}
   链接：{url}

...
```

### 2.4 核心实现

```typescript
// src/tools/web-search.ts

import { Type, type Static } from '@sinclair/typebox';

const WebSearchParamsSchema = Type.Object({
  query: Type.String({ description: '搜索关键词' }),
  maxResults: Type.Optional(Type.Number({ 
    description: '最大结果数，默认5',
    default: 5 
  }))
});

type WebSearchParams = Static<typeof WebSearchParamsSchema>;

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

export const webSearchTool = {
  name: 'web_search',
  label: '网页搜索',
  description: '使用 DuckDuckGo 搜索网页信息。适用于：查询最新资讯、技术文档、概念解释。NOT for: 实时股价、敏感数据。',
  parameters: WebSearchParamsSchema,

  async execute(
    toolCallId: string,
    params: WebSearchParams,
    signal?: AbortSignal
  ) {
    const { query, maxResults = 5 } = params;

    try {
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      
      const response = await fetch(url, { signal });
      const data: DuckDuckGoResponse = await response.json();

      const results: WebSearchResult[] = [];

      // 主摘要
      if (data.AbstractText) {
        results.push({
          title: data.Heading || '摘要',
          snippet: data.AbstractText,
          url: data.AbstractURL || '',
          source: data.AbstractSource
        });
      }

      // 相关主题
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, maxResults - results.length)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || '相关主题',
              snippet: topic.Text,
              url: topic.FirstURL
            });
          }
        }
      }

      // 格式化输出
      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `未找到 "${query}" 的相关结果` }],
          details: { query, count: 0 }
        };
      }

      const output = results.map((r, i) => 
        `${i + 1}. ${r.title}\n   ${r.snippet}\n   链接：${r.url}`
      ).join('\n\n');

      return {
        content: [{ type: 'text', text: `搜索结果：${query}\n\n${output}` }],
        details: { query, count: results.length }
      };

    } catch (err) {
      return {
        content: [{ 
          type: 'text', 
          text: `搜索失败: ${err instanceof Error ? err.message : err}` 
        }],
        details: { query, error: true }
      };
    }
  }
};
```

### 2.5 集成步骤

| 步骤 | 文件 | 操作 |
|:----:|------|------|
| 1 | `src/tools/web-search.ts` | 创建新工具文件 |
| 2 | `src/tools/index.ts` | 导出新工具 |
| 3 | `tests/unit/tools/web-search.test.ts` | 添加单元测试 |
| 4 | - | 编译测试 |

---

## 三、验收标准

### 3.1 功能验收

- [ ] `web_search` 工具可正常调用
- [ ] 返回格式化的搜索结果
- [ ] 支持中文搜索
- [ ] 错误处理完善

### 3.2 测试验收

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 边界情况测试（空结果、网络错误等）

---

## 四、实施计划

| 任务 | 预计时间 | 优先级 |
|------|:--------:|:------:|
| 创建 web-search.ts | 15分钟 | P1 |
| 编写单元测试 | 10分钟 | P1 |
| 集成到工具列表 | 5分钟 | P1 |
| 测试验证 | 10分钟 | P1 |
| **总计** | **40分钟** | - |

---

## 五、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-27 | v0.7.0 | 七期需求文档：web_search 工具设计 |