# Quickstart: Tool Injection Optimization

**Feature**: 013-optimize-tool-injection
**Date**: 2026-04-10

## Overview

本功能允许通过配置控制每个 Agent 可使用的工具集。默认情况下，所有 Agent 拥有全部内置工具。

## Quick Setup

### 1. 默认行为（无需配置）

不做任何配置时，所有 Agent 拥有全部 12 个内置工具：

```json
{
  "agents": {
    "list": [
      { "id": "main" }
    ]
  }
}
```

### 2. 白名单模式（allow）

限制 Agent 只能使用特定工具：

```json
{
  "agents": {
    "list": [
      {
        "id": "readonly",
        "tools": {
          "allow": ["read_file", "glob", "grep", "ls"]
        }
      }
    ]
  }
}
```

### 3. 黑名单模式（deny）

禁止 Agent 使用特定工具：

```json
{
  "agents": {
    "list": [
      {
        "id": "safe",
        "tools": {
          "deny": ["shell", "write_file"]
        }
      }
    ]
  }
}
```

### 4. 混合模式（allow + deny）

同时使用 allow 和 deny 时，deny 优先：

```json
{
  "agents": {
    "list": [
      {
        "id": "restricted",
        "tools": {
          "allow": ["read_file", "shell"],
          "deny": ["shell"]
        }
      }
    ]
  }
}
```

**结果**: Agent 只有 `read_file` 工具（shell 被 deny 禁止）

### 5. 无工具模式

配置空 allow 列表使 Agent 无任何工具：

```json
{
  "agents": {
    "list": [
      {
        "id": "chat-only",
        "tools": {
          "allow": []
        }
      }
    ]
  }
}
```

## Built-in Tools Reference

| 工具名 | 功能 |
|--------|------|
| `read_file` | 读取文件内容 |
| `write_file` | 写入文件 |
| `edit` | 编辑文件（单处修改） |
| `multi_edit` | 编辑文件（多处修改） |
| `shell` | 执行 shell 命令 |
| `glob` | 文件模式匹配搜索 |
| `grep` | 文本搜索 |
| `ls` | 列出目录内容 |
| `web_fetch` | 获取网页内容 |
| `web_search` | 网络搜索 |
| `memory_search` | 语义搜索 |
| `memory_get` | 读取记忆文件 |

## Configuration File

配置文件路径：`~/.miniclaw/config.json`

完整示例：

```json
{
  "agents": {
    "defaults": {
      "model": "qwen-plus",
      "maxConcurrent": 50
    },
    "list": [
      {
        "id": "main",
        "name": "Main Agent"
      },
      {
        "id": "etf",
        "name": "ETF Analyst",
        "tools": {
          "allow": ["read_file", "glob", "grep", "web_search", "web_fetch"]
        }
      },
      {
        "id": "policy",
        "name": "Policy Reviewer",
        "tools": {
          "deny": ["shell", "write_file"]
        }
      }
    ]
  }
}
```

## Error Handling

- **不存在的工具名**: 记录警告日志，忽略该配置项
- **配置格式错误**: 记录警告日志，使用默认行为（全部工具）

## Testing

验证 Agent 的工具配置：

```bash
# 启动 CLI 并检查日志
npm run start:cli

# 日志输出示例：
# [Agent:main] 注册了 12 个工具
# [Agent:readonly] 注册了 4 个工具: read_file, glob, grep, ls
# [Agent:safe] 注册了 10 个工具 (禁止: shell, write_file)
```