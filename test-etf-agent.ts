/**
 * ETF Agent 测试脚本
 * 分析沪深300走势
 */
import 'dotenv/config';
import { MiniclawAgent } from './src/core/agent/index.js';
import { loadConfig } from './src/core/config.js';
import { PromptManager } from './src/core/prompt/index.js';
import { getBuiltinTools, filterToolsByPolicy } from './src/tools/index.js';
import { createPiSkillManager } from './src/core/skill/index.js';

async function main() {
  console.log('=== ETF Agent 沪深300分析测试 ===\n');

  // 加载配置
  const config = loadConfig();

  // 加载 ETF Agent 配置
  const etfConfig = config.agents?.list.find(a => a.id === 'etf');
  if (!etfConfig) {
    console.error('ETF Agent 配置不存在');
    process.exit(1);
  }

  console.log(`Agent: ${etfConfig.name || etfConfig.id}`);
  console.log(`Model: ${etfConfig.model || config.bailian.model}\n`);

  // 加载系统提示词
  const promptManager = new PromptManager();
  const promptResult = await promptManager.loadPrompt(etfConfig.systemPrompt || '', { verbose: true });
  const systemPrompt = promptResult.template?.content || '';

  // 初始化技能管理器
  let skillManager;
  if (config.skills?.enabled ?? true) {
    skillManager = createPiSkillManager({
      skillsDir: config.skills?.dir,
      enabled: true
    });
    skillManager.load();
  }

  // 创建 Agent
  const agent = new MiniclawAgent(config, {
    systemPrompt,
    tools: [],
    agentId: 'etf',
    thinkingLevel: etfConfig.thinkingLevel || 'low',
    skillManager
  });

  // 注册工具（根据 etf 配置过滤）
  const builtinTools = getBuiltinTools();
  const { tools: effectiveTools } = filterToolsByPolicy(builtinTools, etfConfig.tools);
  effectiveTools.forEach(tool => agent.registerTool(tool as any));

  console.log(`已注册 ${effectiveTools.length} 个工具: ${effectiveTools.map(t => t.name).join(', ')}\n`);

  // 发送分析请求
  const question = '分析沪深300指数近期走势，给出投资建议';
  console.log(`问题: ${question}\n`);
  console.log('--- 开始分析 ---\n');

  try {
    const response = await agent.chat(question);
    console.log('\n--- 分析结果 ---\n');
    console.log(response.content);
  } catch (error) {
    console.error('分析失败:', error);
  }
}

main().catch(err => {
  console.error('运行失败:', err);
  process.exit(1);
});