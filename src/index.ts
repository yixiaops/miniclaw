/**
 * Miniclaw 主入口
 * 轻量级个人 AI 助手
 */
import 'dotenv/config';
import { MiniclawAgent } from './core/agent/index.js';
import { loadConfig } from './core/config.js';
import { CliChannel } from './channels/cli.js';
import { ApiChannel } from './channels/api.js';
import { FeishuChannel } from './channels/feishu.js';
import { getBuiltinTools } from './tools/index.js';

/**
 * 主函数
 */
async function main() {
  console.log('Miniclaw 启动中...\n');

  // 加载配置
  const config = loadConfig();
  console.log(`模型: ${config.bailian.model}`);
  console.log(`API: ${config.bailian.baseUrl}`);

  // 创建 Agent
  const agent = new MiniclawAgent(config);

  // 注册内置工具
  const tools = getBuiltinTools();
  tools.forEach((tool: any) => agent.registerTool(tool as any));
  console.log(`已加载 ${tools.length} 个工具`);

  // 解析命令行参数
  const args = process.argv.slice(2);
  const mode = args[0] || 'cli';

  console.log(`\n启动模式: ${mode}\n`);

  switch (mode) {
    case 'cli':
      // CLI 模式
      const cli = new CliChannel(agent);
      await cli.start();
      break;

    case 'api':
      // API 模式
      const api = new ApiChannel(agent, config);
      await api.start();
      
      // 保持进程运行
      process.on('SIGINT', async () => {
        console.log('\n正在关闭...');
        await api.stop();
        process.exit(0);
      });
      break;

    case 'feishu':
      // 飞书模式
      if (!config.feishu) {
        console.error('错误: 未配置飞书信息');
        process.exit(1);
      }
      const feishu = new FeishuChannel(agent, config);
      await feishu.start();
      
      // 保持进程运行
      process.on('SIGINT', () => {
        console.log('\n正在关闭...');
        feishu.stop();
        process.exit(0);
      });
      break;

    case 'all':
      // 全部模式
      const apiChannel = new ApiChannel(agent, config);
      await apiChannel.start();
      
      if (config.feishu) {
        const feishuChannel = new FeishuChannel(agent, config);
        await feishuChannel.start();
      }
      
      // 保持进程运行
      process.on('SIGINT', async () => {
        console.log('\n正在关闭...');
        await apiChannel.stop();
        process.exit(0);
      });
      break;

    case 'web':
      // WebChat 模式
      const { WebChannel } = await import('./channels/web.js');
      const webChannel = new WebChannel(agent, config);
      await webChannel.start();
      
      process.on('SIGINT', async () => {
        console.log('\n正在关闭...');
        await webChannel.stop();
        process.exit(0);
      });
      break;

    default:
      console.error(`未知模式: ${mode}`);
      console.log('可用模式: cli, api, feishu, all');
      process.exit(1);
  }
}

main().catch(err => {
  console.error('启动失败:', err);
  process.exit(1);
});