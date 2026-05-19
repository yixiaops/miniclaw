/**
 * Miniclaw 主入口
 * 轻量级个人 AI 助手
 */
import 'dotenv/config';
import path from 'path';
import { homedir } from 'os';
import { MiniclawAgent, DEFAULT_SYSTEM_PROMPT } from './core/agent/index.js';
import type { PromptComponent } from './core/agent/types.js';
import { AgentRegistry } from './core/agent/registry.js';
import { MiniclawGateway } from './core/gateway/index.js';
import { loadConfig, type Config, type AgentConfig } from './core/config.js';
import { SubagentManager } from './core/subagent/manager.js';
import { createSessionsSpawnTool, createSubagentsTool } from './core/subagent/tools.js';
import { createPiSkillManager, type PiSkillManager } from './core/skill/index.js';
import { PromptManager } from './core/prompt/index.js';
import { MemoryManager } from './memory/manager.js';
import { CliChannel } from './channels/cli.js';
import { ApiChannel } from './channels/api.js';
import { FeishuChannel } from './channels/feishu.js';
import { getBuiltinTools, filterToolsByPolicy, createSchedulerCreateTool, createSchedulerListTool, createSchedulerDeleteTool, createSchedulerUpdateTool } from './tools/index.js';
import { SoulLoader } from './soul/index.js';
import { setupGlobalExceptionHandler } from './core/exception-handler.js';
import { TaskStore } from './scheduler/task-store.js';
import { SchedulerManager } from './scheduler/manager.js';
import { TaskExecutor } from './scheduler/executor.js';
import { PendingMessageStore } from './scheduler/pending-store.js';
import { SessionKeyBuilder, type PeerScope, type ChannelScope } from './core/session-key/index.js';
import { ConfigWatcher, type ConfigChangeEvent } from './config/watcher.js';

/**
 * Shutdown handler 配置
 */
export interface ShutdownHandlerConfig {
  /** 通道实例 */
  channel: { stop: () => Promise<void> | void };
  /** Gateway 实例 */
  gateway: MiniclawGateway;
  /** 子代理管理器 */
  subagentManager: SubagentManager;
  /** 记忆管理器（可选） */
  memoryManager?: MemoryManager;
  /** Scheduler 管理器（可选） */
  schedulerManager?: SchedulerManager;
  /** ConfigWatcher（可选） */
  configWatcher?: ConfigWatcher;
}

/**
 * 创建并返回 shutdown handler 函数
 *
 * 正确的处理顺序：
 * 1. await channel.stop() - 停止接收新消息
 * 2. await gateway.cleanup() - 持久化数据并清理资源
 * 3. subagentManager.destroy() - 销毁子代理
 * 4. schedulerManager.stopAll() - 停止所有调度任务
 * 5. configWatcher.stop() - 停止配置监听
 * 6. memoryManager.destroy() - 销毁记忆管理器
 *
 * @param config - Shutdown handler 配置
 * @returns shutdown handler 函数
 */
export function setupShutdownHandler(config: ShutdownHandlerConfig): () => Promise<void> {
  const { channel, gateway, subagentManager, memoryManager, schedulerManager, configWatcher } = config;

  return async () => {
    console.log('\n正在关闭...');

    // 1. 停止通道
    await channel.stop();

    // 2. 清理 Gateway（包含 persist）
    await gateway.cleanup();

    // 3. 销毁子代理管理器
    subagentManager.destroy();

    // 4. 停止所有调度任务
    if (schedulerManager) {
      schedulerManager.stopAll();
    }

    // 5. 停止配置监听
    if (configWatcher) {
      configWatcher.stop();
    }

    // 6. 销毁记忆管理器（如果存在）
    if (memoryManager) {
      memoryManager.destroy();
    }
  };
}

/**
 * 创建 Agent 的工厂函数
 *
 * @param registry - Agent 注册表
 * @param subagentManager - 子代理管理器
 * @param promptManager - 提示词管理器
 * @param preloadedPrompts - 预加载的提示词映射
 * @param taskStore - 定时任务存储
 * @param skillManager - 技能管理器（可选）
 * @param soulContent - Soul 内容（可选）
 */
function createAgentFactory(
  _registry: AgentRegistry,
  subagentManager: SubagentManager,
  _promptManager: PromptManager,
  preloadedPrompts: Map<string, string>,
  taskStore: TaskStore,
  skillManager?: PiSkillManager,
  soulContent?: string
) {
  return (
    sessionKey: string,
    config: Config,
    agentId: string,
    agentConfig?: AgentConfig,
    isSubagent?: boolean
  ) => {
    console.log(`[Gateway] 创建新 Agent: ${sessionKey} (type: ${agentId}, isSubagent: ${isSubagent || false})`);

    // 解析 sessionKey 获取 userId 和 channel
    const parsedSession = SessionKeyBuilder.parse(sessionKey);
    let userId = 'unknown';
    let channel: 'cli' | 'api' | 'web' | 'feishu' = 'cli';

    if (parsedSession) {
      const scope = parsedSession.scope;
      if (scope.type === 'peer') {
        userId = (scope as PeerScope).peerId;
        channel = (scope as PeerScope).channel as 'cli' | 'api' | 'web' | 'feishu';
      } else if (scope.type === 'channel') {
        channel = (scope as ChannelScope).channel as 'cli' | 'api' | 'web' | 'feishu';
      }
    }

    // 使用预加载的提示词（如果存在）
    let systemPrompt = preloadedPrompts.get(agentId) || DEFAULT_SYSTEM_PROMPT;
    if (preloadedPrompts.get(agentId)) {
      console.log(`[Gateway] 使用预加载的提示词: chars=${systemPrompt.length}`);
    }

    // 注入 Soul 内容到 system prompt
    if (soulContent) {
      systemPrompt = `${systemPrompt}\n\n${soulContent}`;
      console.log(`[Gateway] 已注入 Soul 内容: chars=${soulContent.length}`);
    }

    // 构建提示词组成部分
    const promptComponents: PromptComponent[] = [];

    // 1. 提示词文件（如果有自定义提示词）
    if (preloadedPrompts.get(agentId) && agentConfig?.systemPrompt) {
      promptComponents.push({
        type: 'file',
        label: `提示词文件 ${path.basename(agentConfig.systemPrompt)}`,
        content: preloadedPrompts.get(agentId) || '',
        meta: {
          fileName: path.basename(agentConfig.systemPrompt)
        }
      });
    }

    // 2. Soul 内容（如果有）
    if (soulContent) {
      promptComponents.push({
        type: 'soul',
        label: 'Soul 内容',
        content: soulContent
      });
    }

    // 3. 技能数据（如果有技能）
    if (skillManager && skillManager.count() > 0) {
      const skillPrompts = skillManager.getAllPrompts();
      if (skillPrompts) {
        promptComponents.push({
          type: 'skills',
          label: '技能数据',
          content: skillPrompts,
          meta: {
            skillCount: skillManager.count(),
            skillNames: skillManager.getNames()
          }
        });
      }
    }

    // 4. 默认提示词（如果没有自定义提示词文件）
    if (!preloadedPrompts.get(agentId) && !agentConfig?.systemPrompt) {
      promptComponents.push({
        type: 'default',
        label: '默认提示词',
        content: DEFAULT_SYSTEM_PROMPT
      });
    }

    // 创建 Agent
    const agent = new MiniclawAgent(config, {
      systemPrompt,
      tools: [], // 先不传工具，后面单独注册
      agentId,
      isSubagent: isSubagent || false,
      thinkingLevel: agentConfig?.thinkingLevel || 'low',  // 默认 low 级别推理
      skillManager,  // 传递技能管理器
      promptComponents  // 传递提示词组成部分
    });

    // 如果指定了模型，切换模型
    if (agentConfig?.model && agentConfig.model !== config.bailian.model) {
      agent.setModel(agentConfig.model);
    }

    // 注册内置工具（根据配置过滤）
    const builtinTools = getBuiltinTools();
    const { tools: effectiveTools, stats } = filterToolsByPolicy(builtinTools, agentConfig?.tools);

    // 记录工具过滤结果
    if (stats.unknown.length > 0) {
      console.warn(`[${agentId}] 配置中存在未知的工具名: ${stats.unknown.join(', ')}`);
    }
    console.log(`[${agentId}] 注册工具: ${stats.allowed} 个 (总共 ${stats.total}, 禁止 ${stats.denied})`);

    effectiveTools.forEach((tool: any) => agent.registerTool(tool as any));

    // 注册子代理工具
    // 所有 Agent 都可以创建子代理（权限由 SubagentManager 检查）
    agent.registerTool(createSessionsSpawnTool({
      manager: subagentManager,
      currentAgentId: agentId,
      registry: _registry,  // 传入 registry 以动态生成工具描述
      isSubagent: isSubagent || false  // 传入身份信息用于日志
    }) as any);
    agent.registerTool(createSubagentsTool(subagentManager) as any);

    // 注册 Scheduler 工具
    agent.registerTool(createSchedulerCreateTool(
      taskStore,
      () => userId,
      () => channel
    ) as any);
    agent.registerTool(createSchedulerListTool(
      taskStore,
      () => userId
    ) as any);
    agent.registerTool(createSchedulerDeleteTool(
      taskStore,
      () => userId
    ) as any);
    agent.registerTool(createSchedulerUpdateTool(
      taskStore,
      () => userId
    ) as any);

    return agent;
  };
}

/**
 * 打印 Agent 配置信息
 */
function printAgentInfo(registry: AgentRegistry) {
  const types = registry.getAgentTypes();
  if (types.length === 0) {
    console.log('Agent 类型: 默认 (main)');
    return;
  }

  console.log(`Agent 类型: ${types.join(', ')}`);
  types.forEach(id => {
    const config = registry.getConfig(id);
    if (config) {
      const allowAgents = config.subagents?.allowAgents || [];
      console.log(`  - ${id}: ${config.name || id}${allowAgents.length > 0 ? ` (可创建: ${allowAgents.join(', ')})` : ''}`);
    }
  });
}

/**
 * 主函数
 */
async function main() {
  console.log('Miniclaw 启动中...\n');

  // 加载配置
  const config = loadConfig();
  console.log(`模型: ${config.bailian.model}`);
  console.log(`API: ${config.bailian.baseUrl}`);

  // 设置全局异常处理器（进程稳定性）
  setupGlobalExceptionHandler({
    exceptionNotification: config.exceptionNotification || { enabled: false }
  });

  // 初始化 PiSkillManager
  let skillManager: PiSkillManager | undefined;
  const skillsEnabled = config.skills?.enabled ?? true;

  if (skillsEnabled) {
    console.log('\n初始化 SkillManager...');
    skillManager = createPiSkillManager({
      skillsDir: config.skills?.dir,
      enabled: true
    });

    // 加载技能
    const result = skillManager.load();
    const skillCount = result.skills.length;

    if (skillCount > 0) {
      const names = result.skills.map(s => s.name).join(', ');
      console.log(`已加载 ${skillCount} 个技能: ${names}`);
    } else {
      console.log('未加载任何技能（技能目录可能为空或不存在）');
    }

    // 显示诊断信息
    if (result.diagnostics.length > 0) {
      console.warn(`技能加载警告: ${result.diagnostics.length} 条`);
    }
  } else {
    console.log('\n技能系统已禁用');
  }

  // 初始化 MemoryManager（如果启用）
  let memoryManager: MemoryManager | undefined;
  if (config.memory?.enabled) {
    console.log('\n初始化 MemoryManager...');

    // 展开路径中的 ~
    let storageDir = config.memory.dir || './memory-storage';
    if (storageDir.startsWith('~')) {
      storageDir = path.join(homedir(), storageDir.slice(2));
    }

    memoryManager = new MemoryManager({
      storageDir,
      defaultTTL: config.memory.defaultTTL || 86400000,
      cleanupInterval: config.memory.cleanupInterval || 3600000,
      promotionThreshold: config.memory.promotionThreshold || 0.5
    });
    await memoryManager.initialize();
    console.log(`✓ MemoryManager 已初始化 (storageDir: ${storageDir})`);
  }

  // 初始化 Scheduler 系统
  console.log('\n初始化 Scheduler 系统...');
  const schedulerStorageDir = path.join(homedir(), '.miniclaw');
  const taskStore = new TaskStore(path.join(schedulerStorageDir, 'scheduled-tasks.json'));
  const pendingStore = new PendingMessageStore();

  // 如果没有任务，创建默认的每日 8:00 工作总结任务
  if (taskStore.getAll().length === 0) {
    const { randomUUID } = await import('crypto');
    const now = new Date();
    const defaultTask = {
      taskId: randomUUID(),
      userId: 'ou_cea5164ad6cbd076e3fa075f8af6bef9',
      channel: 'feishu' as const,
      content: '早上好！请生成今日工作总结和计划。回顾最近的开发进展，列出今天的重点任务。',
      summary: '每日工作总结',
      executeTime: '0 8 * * *',
      taskType: 'recurring' as const,
      actionType: 'reminder' as const,
      status: 'pending' as const,
      createdAt: now.toISOString(),
      retryCount: 0,
    };
    taskStore.create(defaultTask);
    console.log('✓ 已创建默认定时任务: 每日 8:00 工作总结');
  }

  const schedulerManager = new SchedulerManager(taskStore);
  console.log(`✓ Scheduler 系统已初始化 (已加载 ${taskStore.getAll().length} 个任务)`);
  console.log(`  - 已调度任务: ${schedulerManager.getScheduledCount()}`);

  // 初始化 ConfigWatcher（配置热加载）
  console.log('\n初始化 ConfigWatcher...');
  const configWatcher = new ConfigWatcher({
    onChange: (event: ConfigChangeEvent) => {
      if (event.config?.agents) {
        // 重新加载 Agent 配置
        registry.loadConfigs(event.config.agents.list, event.config.agents.defaults);
        console.log(`[ConfigWatcher] Agent 配置已重新加载 (${event.config.agents.list.length} 个)`);
      }
    },
  });
  await configWatcher.start();
  console.log(`✓ ConfigWatcher 已初始化`);

  // 初始化 SoulLoader
  console.log('\n初始化 SoulLoader...');
  const soulLoader = new SoulLoader();
  const soulContent = await soulLoader.load();
  console.log(`✓ SoulLoader 已初始化 (chars: ${soulContent.length})`);

  // 创建 AgentRegistry
  const registry = new AgentRegistry(config, () => {
    // 临时空函数，后面会更新
    throw new Error('Agent factory not initialized');
  });

  // 加载 Agent 配置（如果有）
  if (config.agents) {
    registry.loadConfigs(config.agents.list, config.agents.defaults);
    console.log(`已加载 ${config.agents.list.length} 个 Agent 配置`);
  }

  // 创建 SubagentManager
  const subagentConfig = config.agents?.defaults.subagents || {
    maxConcurrent: 5,
    defaultTimeout: 60000
  };
  const subagentManager = new SubagentManager(subagentConfig, registry);

  // 创建 PromptManager
  console.log('\n初始化 PromptManager...');
  const promptManager = new PromptManager();
  console.log(`默认模板路径: ${promptManager.getDefaultPromptPath()}`);

  // 预加载所有 Agent 的 systemPrompt
  const preloadedPrompts: Map<string, string> = new Map();
  if (config.agents?.list) {
    console.log('预加载 Agent 提示词...');
    for (const agentConfig of config.agents.list) {
      if (agentConfig.systemPrompt) {
        console.log(`  加载 ${agentConfig.id} Agent 的提示词...`);
        const result = await promptManager.loadPrompt(agentConfig.systemPrompt, {
          verbose: true
        });
        if (result.success && result.template) {
          preloadedPrompts.set(agentConfig.id, result.template.content);
          console.log(`    ✓ 提示词加载成功: name=${result.template.name}, chars=${result.template.content.length}`);
        } else if (result.usedFallback && result.template) {
          preloadedPrompts.set(agentConfig.id, result.template.content);
          console.log(`    ⚠ 使用后备提示词: chars=${result.template.content.length}`);
        } else {
          console.warn(`    ✗ 提示词加载失败: ${result.error}`);
        }
      }
    }
  }

  // 创建 Agent 工厂函数（传入 soul 内容和 scheduler 系统）
  const createAgentFn = createAgentFactory(registry, subagentManager, promptManager, preloadedPrompts, taskStore, skillManager, soulContent);

  // 更新 Registry 的创建函数（使用任意键设置私有属性）
  (registry as any).createAgentFn = createAgentFn;

  // 创建 Gateway
  const gateway = new MiniclawGateway(config, {
    createAgentFn,
    maxAgents: config.agents?.defaults.maxConcurrent,
    memoryManager
  });

  // 打印工具和 Agent 信息
  console.log(`已加载 ${getBuiltinTools().length} 个内置工具`);
  console.log(`已加载子代理工具: sessions_spawn, subagents`);
  console.log(`已加载定时任务工具: scheduler_create, scheduler_list, scheduler_delete, scheduler_update`);
  printAgentInfo(registry);

  // 解析命令行参数
  const args = process.argv.slice(2);
  const mode = args[0] || 'cli';

  console.log(`\n启动模式: ${mode}\n`);

  switch (mode) {
    case 'cli':
      // CLI 模式
      const cli = new CliChannel(gateway);
      await cli.start();
      break;

    case 'api':
      // API 模式
      const api = new ApiChannel(gateway);
      await api.start();

      // 保持进程运行
      process.on('SIGINT', async () => {
        console.log('\n正在关闭...');
        await api.stop();
        gateway.cleanup();
        subagentManager.destroy();
        schedulerManager.stopAll();
        configWatcher.stop();
        if (memoryManager) memoryManager.destroy();
        process.exit(0);
      });
      break;

    case 'feishu':
      // 飞书模式
      if (!config.feishu) {
        console.error('错误: 未配置飞书信息');
        process.exit(1);
      }
      const feishu = new FeishuChannel(gateway);
      await feishu.start();

      // 设置 TaskExecutor（连接 scheduler 与飞书通道）
      const feishuClient = feishu.getClient();
      const executor = new TaskExecutor(taskStore, pendingStore, {
        sendMessage: async (userId: string, _channel: string, content: string) => {
          try {
            await feishuClient.sendMessage({
              receiveId: userId,
              receiveIdType: 'open_id',
              msgType: 'text',
              content: JSON.stringify({ text: content }),
            });
            return true;
          } catch (e) {
            console.error('[Scheduler] 发送消息失败:', e);
            return false;
          }
        },
        spawnAgent: async (params: { task: string; agentId: string }) => {
          try {
            const result = await subagentManager.spawn({
              agentId: params.agentId,
              task: params.task,
            });
            return { success: true, result };
          } catch (e) {
            console.error('[Scheduler] 子代理执行失败:', e);
            return { success: false };
          }
        },
      });
      schedulerManager.setExecutor(executor);
      console.log('✓ TaskExecutor 已连接');

      // 定时轮询：每分钟检查待执行任务（处理 node-cron 未覆盖的场景）
      const pollingInterval = setInterval(async () => {
        try {
          const dueTasks = taskStore.getTasksToExecute(new Date());
          for (const task of dueTasks) {
            console.log(`[Scheduler] 轮询执行任务: ${task.summary}`);
            await executor.execute(task);
          }
        } catch (e) {
          console.error('[Scheduler] 轮询执行失败:', e);
        }
      }, 60 * 1000);

      // 保持进程运行
      process.on('SIGINT', () => {
        console.log('\n正在关闭...');
        clearInterval(pollingInterval);
        feishu.stop();
        gateway.cleanup();
        subagentManager.destroy();
        schedulerManager.stopAll();
        configWatcher.stop();
        if (memoryManager) memoryManager.destroy();
        process.exit(0);
      });
      break;

    case 'all':
      // 全部模式
      const apiChannel = new ApiChannel(gateway);
      await apiChannel.start();

      if (config.feishu) {
        const feishuChannel = new FeishuChannel(gateway);
        await feishuChannel.start();
      }

      // 保持进程运行
      process.on('SIGINT', async () => {
        console.log('\n正在关闭...');
        await apiChannel.stop();
        gateway.cleanup();
        subagentManager.destroy();
        schedulerManager.stopAll();
        configWatcher.stop();
        if (memoryManager) memoryManager.destroy();
        process.exit(0);
      });
      break;

    case 'web':
      // WebChat 模式
      const { WebChannel } = await import('./channels/web.js');
      const webChannel = new WebChannel(gateway);
      await webChannel.start();

      process.on('SIGINT', async () => {
        console.log('\n正在关闭...');
        await webChannel.stop();
        gateway.cleanup();
        subagentManager.destroy();
        schedulerManager.stopAll();
        configWatcher.stop();
        process.exit(0);
      });
      break;

    default:
      console.error(`未知模式: ${mode}`);
      console.log('可用模式: cli, api, feishu, all, web');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});