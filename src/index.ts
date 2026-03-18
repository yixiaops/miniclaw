/**
 * Miniclaw 主入口
 * 轻量级个人 AI 助手
 */
import 'dotenv/config';
import { MiniclawAgent } from './core/agent/index.js';
import { MiniclawGateway } from './core/gateway/index.js';
import { loadConfig } from './core/config.js';
import { CliChannel } from './channels/cli.js';
import { ApiChannel } from './channels/api.js';
import { FeishuChannel } from './channels/feishu.js';
import { getBuiltinTools } from './tools/index.js';

/**
 * 创建 Agent 的工厂函数
 */
function createAgentFactory() {
  return (sessionKey: string, config: ReturnType<typeof loadConfig>) => {
    console.log(`[Gateway] 创建新 Agent: ${sessionKey}`);
    const agent = new MiniclawAgent(config);

    // 注册内置工具
    const tools = getBuiltinTools();
    tools.forEach((tool: any) => agent.registerTool(tool as any));

    return agent;
  };
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

  // 创建 Gateway
  const gateway = new MiniclawGateway(config, {
    createAgentFn: createAgentFactory()
  });

  console.log(`已加载 ${getBuiltinTools().length} 个工具`);

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