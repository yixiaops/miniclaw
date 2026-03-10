# Miniclaw 需求文档

> 参考_openclaw，打造轻量级个人 AI 助手

## 一、项目定位

### 1.1 核心理念
- **轻量**：最小化依赖，单进程运行
- **可扩展**：插件化架构，按需加载
- **私有化**：本地部署，数据自主可控

### 1.2 目标用户
- 个人开发者
- 小型团队
- 需要本地 AI 助手的场景

### 1.3 与 OpenClaw 的关系
| 维度 | OpenClaw | Miniclaw |
|------|----------|----------|
| 架构 | Gateway + 多 Agent | 单进程 + 插件 |
| 通道 | 20+ 消息平台 | 核心：CLI + WebChat |
| 存储 | 多种后端 | SQLite + 文件 |
| 部署 | 复杂 | 单二进制 |
| 功能 | 全功能 | 精简核心 |

---

## 二、核心功能

### 2.1 Agent 对话系统
- [x] 阿里云百炼模型对接（兼容 OpenAI API）
- [ ] 流式输出
- [ ] 上下文管理
- [ ] System Prompt 配置

### 2.2 MCP (Model Context Protocol) 支持
- [ ] MCP Server 实现
- [ ] 内置 Tools：
  - [ ] 文件读写
  - [ ] Shell 执行
  - [ ] 网页抓取
  - [ ] 代码执行
- [ ] 自定义 Tools 扩展

### 2.3 记忆系统
- [ ] 短期记忆（会话内）
- [ ] 长期记忆（持久化）
- [ ] 向量检索（可选）

### 2.4 对话通道
- [ ] 飞书机器人
  - [ ] 消息接收与回复
  - [ ] 流式输出支持
- [ ] CLI 交互
- [ ] WebChat 界面
- [ ] API 接口（供第三方调用）

---

## 三、技术架构

### 3.1 技术栈
```
语言：TypeScript (Node.js)
框架：pi-mono (@mariozechner/pi-ai, @mariozechner/pi-agent-core)
模型：阿里云百炼 (兼容 OpenAI API)
存储：SQLite + 文件系统
通道：飞书、CLI、Web、API
协议：MCP
```

### 3.2 模块划分
```
miniclaw/
├── src/
│   ├── core/           # 核心引擎
│   │   ├── agent/      # Agent 运行时 (基于 pi-agent-core)
│   │   ├── memory/     # 记忆管理
│   │   └── mcp/        # MCP 协议实现
│   ├── tools/          # 内置工具
│   ├── channels/       # 通道实现
│   │   ├── feishu/     # 飞书机器人
│   │   ├── cli/        # 命令行
│   │   ├── web/        # WebChat
│   │   └── api/        # HTTP API
│   ├── storage/        # 存储层
│   └── index.ts        # 入口
├── tests/              # 测试文件
└── dist/               # 编译输出
```

---

## 四、非功能性需求

### 4.1 性能
- 启动时间 < 1s
- 内存占用 < 100MB（空闲）
- 单次响应延迟 < 500ms（不含模型调用）

### 4.2 可靠性
- 优雅退出
- 会话持久化
- 错误恢复

### 4.3 安全性
- API Key 加密存储
- 本地访问限制
- 执行权限控制

---

## 五、版本规划

### v0.1 - MVP
- 飞书机器人通道
- CLI 交互
- WebChat 界面
- API 接口
- 阿里云百炼模型对接
- 基本对话能力
- 基础 Tools（文件、Shell）

### v0.2 - 记忆系统
- 会话持久化
- 长期记忆
- 上下文压缩

### v0.3 - 扩展能力
- 多模型切换
- 插件系统
- API 接口

### v0.4 - 高级功能
- 向量记忆
- 多 Agent 协作

---

## 六、技术细节

### 6.1 飞书机器人
- 使用飞书开放平台事件订阅接收消息
- 支持文本、卡片消息回复
- 支持流式输出（逐字发送）

### 6.2 CLI 交互
- 命令行 REPL 模式
- 支持流式输出
- 交互式配置

### 6.3 WebChat 界面
- Web 前端界面
- WebSocket 实时通信
- Markdown 渲染

### 6.4 API 接口
- RESTful API
- OpenAI 兼容格式
- 流式响应（SSE）

### 6.5 阿里云百炼
- API 兼容 OpenAI 格式
- 支持多种模型：通义千问等
- 支持 Function Calling

---

## 九、开发规范

### 9.1 TDD 开发模式

本项目严格遵循 **测试驱动开发（Test-Driven Development）** 模式：

1. **Red-Green-Refactor 循环**
   - 🔴 **Red**：先写失败的测试用例
   - 🟢 **Green**：编写最少代码使测试通过
   - 🔵 **Refactor**：重构代码，保持测试通过

2. **测试优先原则**
   - 任何新功能必须先写测试
   - 任何 Bug 修复必须先写复现测试
   - 代码提交前必须通过所有测试

3. **测试覆盖率要求**
   - 核心模块覆盖率 ≥ 80%
   - 工具模块覆盖率 ≥ 70%
   - 通道模块覆盖率 ≥ 60%

4. **测试分类**
   ```
   tests/
   ├── unit/          # 单元测试
   ├── integration/   # 集成测试
   └── e2e/           # 端到端测试
   ```

5. **测试命令**
   ```bash
   npm test              # 运行所有测试
   npm run test:watch    # 监听模式
   npm run test:coverage # 生成覆盖率报告
   ```

### 9.2 代码规范

- 使用 TypeScript 严格模式
- 使用 ES Modules
- 函数和类必须有类型注解
- 公共 API 必须有 JSDoc 注释

---

## 十、参考资料

- OpenClaw 源码：https://github.com/openclaw/openclaw
- MCP 规范：https://modelcontextprotocol.io
- OpenClaw 文档：https://docs.openclaw.ai
- 飞书开放平台：https://open.feishu.cn
- 阿里云百炼：https://bailian.console.aliyun.com

---

## 十一、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-10 | v0.3 | 采用 pi-mono 框架作为核心，TDD 开发模式 |
| 2026-03-10 | v0.2 | 明确技术栈：TypeScript + 阿里云百炼；MVP 包含全部四个通道 |
| 2026-03-09 | v0.1 | 初始版本，框架搭建 |

---

_文档持续迭代中..._