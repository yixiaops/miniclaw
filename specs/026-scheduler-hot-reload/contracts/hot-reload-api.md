# Hot Reload API Contract

**Feature**: 026-scheduler-hot-reload  
**Version**: 1.0  
**Date**: 2026-05-15

## Overview

动态配置加载模块监听 Agent 配置目录，自动检测变更并热重载配置。

---

## ConfigWatcher Interface

### Initialization

```typescript
// src/core/config-watcher/index.ts
interface ConfigWatcherOptions {
  promptsDir: string;      // ~/.miniclaw/prompts/
  configFile: string;      // ~/.miniclaw/config.json
  debounceMs: number;      // 5000ms (5秒内完成加载)
}

class ConfigWatcher {
  constructor(options: ConfigWatcherOptions, agentRegistry: AgentRegistry);
  
  start(): void;           // 启动监听
  stop(): void;            // 停止监听
  reloadAll(): void;       // 手动全量重载
}
```

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| 'config:added' | `{ agentId, path }` | 新配置文件被加载 |
| 'config:modified' | `{ agentId, path }` | 配置文件被修改 |
| 'config:deleted' | `{ agentId, path }` | 配置文件被删除 |
| 'config:error' | `{ path, error }` | 配置加载失败 |

---

## File Watch Contract

### 监听目录

| 目录 | 文件类型 | 处理逻辑 |
|------|----------|----------|
| `~/.miniclaw/prompts/` | `*.md` (YAML frontmatter) | 加载 Agent 配置 |
| `~/.miniclaw/config.json` | JSON | 加载 agents.list 配置 |

### 变更检测规则

| Change Type | Detection | Action |
|-------------|-----------|--------|
| Add | file added | 解析 YAML → 加载到 AgentRegistry |
| Modify | file changed + mtime diff | 重新解析 → 更新 AgentRegistry 缓存 |
| Delete | file removed | 从 AgentRegistry 移除配置 |

### Debounce 规则

- 使用 chokidar 的 `awaitWriteFinish` 选项
- 等待文件写入完成（2秒稳定期）
- 配置解析后立即生效（新 Session）

---

## AgentRegistry Integration

### Interface Extension

```typescript
// 扩展 AgentRegistry 以支持热重载
interface AgentRegistry {
  // 已有方法
  getOrCreate(sessionKey: string, agentId?: string): MiniclawAgent;
  destroy(sessionKey: string): void;
  
  // 新增方法
  loadAgentConfig(agentId: string, config: CachedAgentConfig): void;
  unloadAgentConfig(agentId: string): void;
  reloadAgentConfig(agentId: string): void;
  getLoadedConfigs(): Map<string, CachedAgentConfig>;
}
```

### Configuration Cache

```typescript
// AgentRegistry 内部缓存
private configCache: Map<string, CachedAgentConfig> = new Map();

// 加载新配置
loadAgentConfig(agentId: string, config: CachedAgentConfig): void {
  this.configCache.set(agentId, config);
}

// 重载配置（仅影响新 Session）
reloadAgentConfig(agentId: string): void {
  const path = this.configCache.get(agentId)?.path;
  if (path) {
    const newConfig = parseYAMLConfig(path);
    this.configCache.set(agentId, newConfig);
  }
}

// 删除配置
unloadAgentConfig(agentId: string): void {
  this.configCache.delete(agentId);
}
```

---

## Session Behavior

### 新 Session

```typescript
// 创建新 Session 时使用最新配置
getOrCreate(sessionKey: string, agentId?: string): MiniclawAgent {
  const config = this.configCache.get(agentId || 'main');
  // 使用最新配置创建 Agent
  return new MiniclawAgent(config);
}
```

### 现有 Session

- 现有活跃 Session 继续使用创建时的配置
- Session 结束后，下次创建自动使用新配置
- 不强制中断正在进行的对话

---

## Error Handling

### 配置加载失败

| Error Type | Condition | Action |
|------------|-----------|--------|
| PARSE_ERROR | YAML 解析失败 | 记录错误日志，保留旧配置 |
| INVALID_SCHEMA | frontmatter 缺少必填字段 | 记录错误日志，保留旧配置 |
| FILE_NOT_FOUND | 文件删除时无法重载 | 正常处理（删除配置） |

### 错误日志格式

```typescript
interface ConfigLoadError {
  path: string;
  agentId?: string;
  errorType: 'PARSE_ERROR' | 'INVALID_SCHEMA' | 'FILE_NOT_FOUND';
  message: string;
  timestamp: Date;
}
```

---

## Observability

### 日志输出

```typescript
// 成功加载
console.log(`[ConfigWatcher] Loaded agent config: ${agentId} from ${path}`);

// 加载失败
console.error(`[ConfigWatcher] Failed to load ${path}: ${error.message}`);

// 配置删除
console.log(`[ConfigWatcher] Unloaded agent config: ${agentId}`);
```

### Metrics（可选）

| Metric | Description |
|--------|-------------|
| `config_load_count` | 配置加载次数 |
| `config_load_errors` | 配置加载错误次数 |
| `config_reload_latency_ms` | 重载延迟时间 |

---

## Integration Points

### 与 Lifecycle 集成

```typescript
// src/index.ts
async function main() {
  const configWatcher = new ConfigWatcher({
    promptsDir: config.promptsDir,
    configFile: config.configFile,
    debounceMs: 5000
  }, agentRegistry);
  
  configWatcher.start();
  
  // 监听事件
  configWatcher.on('config:error', (event) => {
    logger.error('Config load error', event);
  });
}
```

### 与 Gateway 集成

- Gateway 在初始化时启动 ConfigWatcher
- ConfigWatcher 与 AgentRegistry 共享配置缓存