# Research: Tool Injection Optimization

**Feature**: 013-optimize-tool-injection
**Date**: 2026-04-10

## Research Summary

### 1. OpenClaw 工具过滤模式

**Decision**: 采用 OpenClaw 的工具过滤模式作为参考实现

**Rationale**:
- OpenClaw 是成熟的生产级项目，工具过滤逻辑经过验证
- 配置方式简单直观（allow/deny 列表）
- deny 优先原则确保安全性

**Alternatives Considered**:
- 自定义复杂权限系统：过于复杂，不必要
- 基于角色的工具分配：超出当前需求

**Key Findings**:

```typescript
// OpenClaw 工具过滤核心逻辑
function makeToolPolicyMatcher(policy: SandboxToolPolicy) {
  const deny = compileGlobPatterns(policy.deny ?? []);
  const allow = compileGlobPatterns(policy.allow ?? []);

  return (name: string) => {
    const normalized = normalizeToolName(name);
    // 1. 先检查 deny（deny 优先）
    if (matchesAnyGlobPattern(normalized, deny)) {
      return false;
    }
    // 2. 如果 allow 为空，允许所有未被 deny 的工具
    if (allow.length === 0) {
      return true;
    }
    // 3. 检查是否在 allow 列表中
    return matchesAnyGlobPattern(normalized, allow);
  };
}
```

### 2. 现有代码结构分析

**Decision**: 在现有架构基础上扩展，不引入新的抽象层

**Rationale**:
- `AgentConfig` 已定义 `tools?: { allow?: string[]; deny?: string[] }`
- `AgentRegistry` 已管理 Agent 配置
- 只需添加工具过滤逻辑并集成到 Agent 创建流程

**Current State**:

| 模块 | 文件 | 现状 |
|------|------|------|
| AgentConfig | `src/core/config.ts` | ✅ 已有 tools 字段定义 |
| AgentRegistry | `src/core/agent/registry.ts` | ❌ 未使用 tools 配置 |
| MiniclawAgent | `src/core/agent/index.ts` | ❌ 直接注入所有工具 |
| getBuiltinTools | `src/tools/index.ts` | ✅ 返回所有内置工具 |

### 3. 工具名称规范化

**Decision**: 使用简单字符串匹配，暂不支持 glob 模式

**Rationale**:
- Miniclaw 工具数量较少（12 个），无需复杂的 glob 匹配
- 简单实现降低维护成本
- 未来可扩展为 glob 模式

**Tool Names**:
```
read_file, write_file, shell, glob, grep, ls, edit, multi_edit,
web_fetch, web_search, memory_search, memory_get
```

### 4. 运行时工具管理

**Decision**: 通过 MiniclawAgent 暴露 registerTool/clearTools 方法

**Rationale**:
- pi-agent-core 框架已支持动态工具管理
- 只需封装现有 API

**Implementation Note**:
```typescript
class MiniclawAgent {
  // 已有方法，需确认可用
  registerTool(tool: AgentTool): void;
  clearTools(): void;
}
```

## Conclusions

1. **配置驱动**：使用 allow/deny 列表控制工具集
2. **deny 优先**：安全优先原则
3. **默认全开放**：无配置时拥有所有工具
4. **简单实现**：字符串精确匹配，暂不支持 glob