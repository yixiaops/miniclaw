# Miniclaw 二期需求文档 (v0.2)

> 基于一期 MVP，增强开发体验与代码质量

## 一、二期目标

### 1.1 核心目标
1. **开发体验提升**：VSCode 联调测试能力
2. **功能完善**：优雅关闭应用命令
3. **代码质量**：TypeScript 最佳实践优化
4. **可维护性**：全面增加代码注释

### 1.2 一期回顾
| 功能 | 状态 | 备注 |
|------|------|------|
| Agent 对话系统 | ✅ 完成 | 基于 pi-agent-core |
| CLI 通道 | ✅ 完成 | REPL 模式 |
| API 通道 | ✅ 完成 | HTTP + WebSocket |
| WebChat 通道 | ✅ 完成 | 内嵌 HTML |
| 飞书通道 | ✅ 完成 | 基本消息收发 |
| 文件读写工具 | ✅ 完成 | read-file, write-file |
| Shell 工具 | ✅ 完成 | execSync |
| 网页抓取工具 | ✅ 完成 | fetch |

---

## 二、详细需求

### 2.1 VSCode 联调测试能力

#### 背景
当前项目缺少 VSCode 调试配置，开发时需要手动在终端执行命令，调试效率低。

#### 目标
- 支持 VSCode F5 一键启动调试
- 支持断点调试
- 支持不同启动模式（CLI、API、Web、Feishu）
- 支持 Jest/Vitest 测试调试

#### 实现方案

**1. 创建 `.vscode/launch.json`**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug: CLI 模式",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "program": "${workspaceFolder}/src/index.ts",
      "args": ["cli"],
      "console": "integratedTerminal",
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "name": "Debug: API 模式",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "program": "${workspaceFolder}/src/index.ts",
      "args": ["api"],
      "console": "integratedTerminal",
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "name": "Debug: Web 模式",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "node",
      "runtimeArgs": ["--loader", "ts-node/esm"],
      "program": "${workspaceFolder}/src/index.ts",
      "args": ["web"],
      "console": "integratedTerminal",
      "envFile": "${workspaceFolder}/.env"
    },
    {
      "name": "Debug: Vitest 当前文件",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["vitest", "run", "${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

**2. 创建 `.vscode/tasks.json`**

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "build",
      "type": "npm",
      "script": "build",
      "problemMatcher": ["$tsc"]
    },
    {
      "label": "test",
      "type": "npm",
      "script": "test",
      "problemMatcher": []
    }
  ]
}
```

**3. 添加 ts-node 依赖**（用于直接运行 TS）

```bash
npm install -D ts-node
```

---

### 2.2 关闭应用命令

#### 背景
当前应用关闭依赖 Ctrl+C，没有优雅退出机制，可能导致：
- 会话数据丢失
- 资源未正确释放
- 日志未完整写入

#### 目标
- 支持 `/exit`、`/quit` 命令
- 优雅关闭所有通道
- 保存会话状态（可选）
- 显示退出提示

#### 实现方案

**1. CLI 通道增加命令处理**

```typescript
// src/channels/cli.ts
const COMMANDS = {
  '/exit': '退出应用',
  '/quit': '退出应用',
  '/help': '显示帮助',
  '/reset': '重置对话',
  '/model': '查看/切换模型'
};

// 在 start() 中检测命令
if (input.startsWith('/')) {
  await this.handleCommand(input);
  continue;
}
```

**2. 创建生命周期管理器**

```typescript
// src/core/lifecycle.ts
export class LifecycleManager {
  private channels: Map<string, { stop: () => Promise<void> }> = new Map();
  
  register(name: string, channel: { stop: () => Promise<void> }) {
    this.channels.set(name, channel);
  }
  
  async shutdown() {
    console.log('\n正在关闭...');
    for (const [name, channel] of this.channels) {
      console.log(`  关闭 ${name} 通道...`);
      await channel.stop();
    }
    console.log('再见！');
    process.exit(0);
  }
}
```

---

### 2.3 TypeScript 最佳实践优化

#### 背景
当前项目缺少部分 TypeScript 最佳实践配置，可能影响：
- 类型安全性
- 代码可维护性
- IDE 智能提示

#### 目标
- 启用更严格的类型检查
- 配置 ESLint + Prettier
- 添加路径别名
- 配置构建优化

#### 实现方案

**1. 升级 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    
    // 严格模式
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    
    // 输出配置
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    
    // 路径别名
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@core/*": ["src/core/*"],
      "@tools/*": ["src/tools/*"],
      "@channels/*": ["src/channels/*"]
    },
    
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**2. 添加 ESLint 配置**

```bash
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

```json
// .eslintrc.json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": "off"
  }
}
```

**3. 添加 Prettier 配置**

```bash
npm install -D prettier eslint-config-prettier
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

**4. 更新 package.json scripts**

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "precommit": "npm run lint && npm run typecheck && npm test"
  }
}
```

---

### 2.4 代码注释增强

#### 背景
当前代码注释较少，影响：
- 新开发者理解成本
- IDE 智能提示效果
- 代码可维护性

#### 目标
- 所有公共类/函数有 JSDoc 注释
- 关键逻辑有行内注释
- 导出 API 有使用示例

#### 注释规范

**1. 文件头注释**

```typescript
/**
 * @fileoverview 文件功能简述
 * @module 模块名
 * @author 作者
 * @created 2026-03-11
 */
```

**2. 类注释**

```typescript
/**
 * Agent 类 - 核心对话引擎
 * 
 * @example
 * ```ts
 * const agent = new MiniclawAgent(config);
 * const response = await agent.chat('你好');
 * console.log(response.content);
 * ```
 * 
 * @class
 * @public
 */
export class MiniclawAgent {
  // ...
}
```

**3. 函数注释**

```typescript
/**
 * 发送消息并获取响应
 * 
 * @param input - 用户输入的消息
 * @returns 包含回复内容的 Promise
 * @throws {Error} 当 API 调用失败时抛出
 * 
 * @example
 * ```ts
 * const result = await agent.chat('你好');
 * console.log(result.content);
 * ```
 */
async chat(input: string): Promise<{ content: string }> {
  // ...
}
```

**4. 接口注释**

```typescript
/**
 * 应用配置接口
 * 
 * @interface Config
 * @property {BailianConfig} bailian - 百炼模型配置
 * @property {ServerConfig} server - 服务器配置
 * @property {FeishuConfig} [feishu] - 飞书配置（可选）
 */
export interface Config {
  // ...
}
```

---

## 三、实施计划

### 3.1 任务拆解

| 任务 | 优先级 | 预计工时 | 依赖 |
|------|--------|----------|------|
| VSCode 调试配置 | P0 | 0.5h | 无 |
| 生命周期管理器 | P0 | 1h | 无 |
| CLI 命令处理 | P0 | 0.5h | 生命周期管理器 |
| tsconfig 升级 | P1 | 0.5h | 无 |
| ESLint + Prettier | P1 | 0.5h | 无 |
| 路径别名配置 | P1 | 0.5h | tsconfig 升级 |
| 核心模块注释 | P1 | 2h | 无 |
| 工具模块注释 | P2 | 1h | 无 |
| 通道模块注释 | P2 | 1h | 无 |

### 3.2 开发顺序

```
Day 1:
1. VSCode 调试配置（含 ts-node）
2. 生命周期管理器
3. CLI 命令处理

Day 2:
4. tsconfig 升级
5. ESLint + Prettier
6. 路径别名

Day 3:
7. 核心模块注释
8. 工具模块注释
9. 通道模块注释
```

---

## 四、验收标准

### 4.1 VSCode 调试
- [ ] F5 可启动 CLI 模式调试
- [ ] F5 可启动 API 模式调试
- [ ] 断点可正常命中
- [ ] 变量查看正常

### 4.2 关闭命令
- [ ] `/exit` 可正常退出
- [ ] `/quit` 可正常退出
- [ ] 退出时显示提示信息
- [ ] Ctrl+C 也能优雅退出

### 4.3 代码质量
- [ ] `npm run lint` 无错误
- [ ] `npm run typecheck` 无错误
- [ ] 所有测试通过
- [ ] 覆盖率 ≥ 70%

### 4.4 注释覆盖
- [ ] 所有公共类有 JSDoc
- [ ] 所有公共函数有 JSDoc
- [ ] 关键逻辑有行内注释

---

## 五、风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| ts-node ES Modules 兼容 | 调试失败 | 使用 --loader ts-node/esm |
| 路径别名编译问题 | 导入失败 | 确保 tsc-alias 或正确配置 |
| 严格模式暴露类型问题 | 编译失败 | 逐步修复，允许临时 any |

---

## 六、变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-11 | v0.2.0 | 完成二期：VSCode调试、关闭命令、TS最佳实践、代码注释 |

---

_已完成_