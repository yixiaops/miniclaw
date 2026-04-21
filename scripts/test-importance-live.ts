/**
 * @fileoverview 实时测试 Importance 功能
 *
 * 验证 LLM 是否正确输出 [IMPORTANCE:X] 标记，以及解析器是否正常工作。
 */

import { ImportanceEvaluator } from '../src/memory/importance/evaluator.js';
import { SoulLoader } from '../src/soul/loader.js';

async function main() {
  console.log('=== Importance 功能实时测试 ===\n');

  // 1. 测试 SoulLoader
  console.log('1. SoulLoader 测试');
  const soulLoader = new SoulLoader({
    filePath: '~/.miniclaw/soul.md',
    enabled: true
  });
  const soulContent = await soulLoader.load();
  console.log('   soul.md 内容长度:', soulContent.length, '字符');
  console.log('   包含 IMPORTANCE 规则:', soulContent.includes('IMPORTANCE'));
  console.log('');

  // 2. 测试 ImportanceEvaluator
  console.log('2. ImportanceEvaluator 测试');
  const evaluator = new ImportanceEvaluator();

  // 测试用例
  const testCases = [
    { input: '好的，已记住您的联系方式。[IMPORTANCE:0.95]', expected: 0.95 },
    { input: '今天天气不错，适合出去走走。[IMPORTANCE:0.2]', expected: 0.2 },
    { input: '这是技术方案，请确认。[IMPORTANCE:0.75]', expected: 0.75 },
    { input: '普通对话，无特殊内容。', expected: null },
    { input: '多重标记测试[IMPORTANCE:0.3]继续[IMPORTANCE:0.8]', expected: 0.8 },
    { input: '超出范围[IMPORTANCE:1.5]', expected: 1.0 },
    { input: '负值测试[IMPORTANCE:-0.2]', expected: 0.0 },
  ];

  let passed = 0;
  for (const tc of testCases) {
    const result = evaluator.parse(tc.input);
    const ok = result.importance === tc.expected;
    passed += ok ? 1 : 0;
    console.log(`   ${ok ? '✓' : '✗'} "${tc.input.slice(0, 30)}..."`);
    console.log(`     期望: ${tc.expected}, 实际: ${result.importance}`);
    console.log(`     剥离后: "${result.strippedContent.slice(0, 30)}..."`);
  }

  console.log(`\n   通过: ${passed}/${testCases.length} 测试用例`);
  console.log('\n=== 测试完成 ===');

  // 3. 显示 DEFAULT_SOUL 内容
  console.log('\n3. DEFAULT_SOUL 内容（fallback）:');
  console.log(soulLoader.getDefault().slice(0, 200) + '...\n');
}

main().catch(console.error);