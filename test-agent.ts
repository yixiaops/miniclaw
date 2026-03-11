/**
 * 测试 Miniclaw Agent 推理能力
 */
import 'dotenv/config';
import { MiniclawAgent } from './src/core/agent/index.js';
import { loadConfig } from './src/core/config.js';

async function main() {
  console.log('正在加载配置...');
  const config = loadConfig();
  
  console.log('配置信息:');
  console.log(`  - 模型: ${config.bailian.model}`);
  console.log(`  - API 地址: ${config.bailian.baseUrl}`);
  
  console.log('\n正在创建 Agent...');
  const agent = new MiniclawAgent(config);
  
  console.log('\n发送消息: "你好，请用一句话介绍你自己"');
  
  // 订阅事件查看详情 - 打印完整事件
  const unsubscribe = agent.subscribe((event: any) => {
    console.log('\n=== 收到事件 ===');
    console.log('类型:', event.type);
    console.log('完整:', JSON.stringify(event, null, 2));
  });
  
  const response = await agent.chat('你好，请用一句话介绍你自己');
  
  console.log('\n\n=== 最终回复 ===');
  console.log(response.content || '(空)');
  
  unsubscribe();
  console.log('\n测试完成！');
  process.exit(0);
}

main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});