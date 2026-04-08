/**
 * 测试技能匹配功能
 */
import { createPiSkillManager } from './dist/core/skill/pi-manager.js';

const manager = createPiSkillManager({
  skillsDir: '/root/.miniclaw/skills',
  enabled: true
});

// 加载技能
const result = manager.load();
console.log('\n=== 加载结果 ===');
console.log(`技能数量: ${result.skills.length}`);
console.log(`技能名称: ${manager.getNames().join(', ')}`);

// 测试匹配
console.log('\n=== 测试匹配 ===');

const testInputs = [
  '今天北京天气怎么样',
  '测试技能',
  '你好',
  '明天下雨吗'
];

for (const input of testInputs) {
  console.log(`\n输入: "${input}"`);
  const match = manager.match(input);
  
  if (match) {
    console.log(`✅ 匹配成功: ${match.skill.name}`);
    console.log(`   类型: ${match.matchType}`);
    console.log(`   关键词: ${match.matchedKeyword}`);
    
    // 获取 prompt
    const prompt = manager.getPrompt(match.skill);
    console.log(`   Prompt 长度: ${prompt.length} 字符`);
    console.log(`   Prompt 预览: ${prompt.substring(0, 100)}...`);
  } else {
    console.log('❌ 无匹配');
  }
}

console.log('\n=== 测试完成 ===');