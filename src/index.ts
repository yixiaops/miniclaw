/**
 * Miniclaw 主入口
 * 轻量级个人 AI 助手
 */
import 'dotenv/config';
import { MiniclawAgent } from './core/agent/index.js';
import { AgentRegistry } from './core/agent/registry.js';
import { MiniclawGateway } from './core/gateway/index.js';
import { loadConfig, type Config, type AgentConfig } from './core/config.js';
import { SubagentManager } from './core/subagent/manager.js';
import { createSessionsSpawnTool, createSubagentsTool } from './core/subagent/tools.js';
import { createPiSkillManager, type PiSkillManager } from './core/skill/index.js';
import { CliChannel } from './channels/cli.js';
import { ApiChannel } from './channels/api.js';
import { FeishuChannel } from './channels/feishu.js';
import { getBuiltinTools } from './tools/index.js';

/**
 * 创建 Agent 的工厂函数
 *
 * @param registry - Agent 注册表
 * @param subagentManager - 子代理管理器
 * @param skillManager - 技能管理器（可选）
 */
function createAgentFactory(
  _registry: AgentRegistry,
  subagentManager: SubagentManager,
  skillManager?: PiSkillManager
) {
  return (
    sessionKey: string,
    config: Config,
    agentId: string,
    agentConfig?: AgentConfig,
    isSubagent?: boolean
  ) => {
    console.log(`[Gateway] 创建新 Agent: ${sessionKey} (type: ${agentId}, isSubagent: ${isSubagent || false})`);

    // 创建 Agent
    const agent = new MiniclawAgent(config, {
      systemPrompt: agentConfig?.systemPrompt,
      tools: [], // 先不传工具，后面单独注册
      agentId,
      isSubagent: isSubagent || false,
      thinkingLevel: agentConfig?.thinkingLevel || 'low',  // 默认 low 级别推理
      skillManager  // 传递技能管理器
    });

    // 如果指定了模型，切换模型
    if (agentConfig?.model && agentConfig.model !== config.bailian.model) {
      agent.setModel(agentConfig.model);
    }

    // 注册内置工具
    const builtinTools = getBuiltinTools();
    builtinTools.forEach((tool: any) => agent.registerTool(tool as any));

    // 注册子代理工具
    // 所有 Agent 都可以创建子代理（权限由 SubagentManager 检查）
    agent.registerTool(createSessionsSpawnTool({
      manager: subagentManager,
      currentAgentId: agentId,
      registry: _registry,  // 传入 registry 以动态生成工具描述
      isSubagent: isSubagent || false  // 传入身份信息用于日志
    }) as any);
    agent.registerTool(createSubagentsTool(subagentManager) as any);

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

  // 创建 Agent 工厂函数
  const createAgentFn = createAgentFactory(registry, subagentManager, skillManager);

  // 更新 Registry 的创建函数（使用任意键设置私有属性）
  (registry as any).createAgentFn = createAgentFn;

  // 创建 Gateway
  const gateway = new MiniclawGateway(config, {
    createAgentFn,
    maxAgents: config.agents?.defaults.maxConcurrent
  });

  // 打印工具和 Agent 信息
  console.log(`已加载 ${getBuiltinTools().length} 个内置工具`);
  console.log(`已加载子代理工具: sessions_spawn, subagents`);
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

      // 保持进程运行
      process.on('SIGINT', () => {
        console.log('\n正在关闭...');
        feishu.stop();
        gateway.cleanup();
        subagentManager.destroy();
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