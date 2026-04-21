/**
 * @fileoverview Gateway Importance 集成测试
 *
 * 验证 Gateway 是否正确集成 ImportanceEvaluator 和 SoulLoader。
 */

import { MiniclawGateway, type GatewayConfig, type MessageContext } from '../src/core/gateway/index.js';
import type { Config } from '../src/core/config.js';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';
import { join } from 'path';

async function main() {
  console.log('=== Gateway Importance 集成测试 ===\n');

  // 1. 创建临时测试目录
  const testDir = join(tmpdir(), `gateway-importance-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  console.log('1. 测试目录:', testDir);

  // 2. 创建模拟配置
  const mockConfig: Config = {
    bailian: {
      apiKey: 'test-key',
      model: 'qwen-plus',
    },
    memory: {
      storageDir: testDir,
      defaultTTL: 900000, // 15 分钟
      cleanupInterval: 300000, // 5 分钟
      importanceThreshold: 0.5,
      defaultImportance: 0.3,
    },
  };

  // 3. 创建 Gateway
  const gatewayConfig: GatewayConfig = {
    createAgentFn: async () => {
      // 模拟 Agent，返回带 IMPORTANCE 标记的回复
      return {
        chat: async (msg: string) => {
          // 根据消息内容返回不同的 importance
          if (msg.includes('重要') || msg.includes('姓名') || msg.includes('电话')) {
            return `收到，已记录您的信息。[IMPORTANCE:0.85]`;
          }
          if (msg.includes('你好') || msg.includes('天气')) {
            return `好的，没问题。[IMPORTANCE:0.2]`;
          }
          return `已处理您的请求。[IMPORTANCE:0.5]`;
        },
        streamChat: async () => {},
        addTool: () => {},
        clearTools: () => {},
        getTools: () => [],
      } as any;
    },
  };

  try {
    const gateway = new MiniclawGateway(mockConfig, gatewayConfig);
    console.log('2. Gateway 创建成功');

    // 4. 检查 Gateway 是否有 ImportanceEvaluator 和 SoulLoader
    const evaluator = gateway.getImportanceEvaluator();
    const soulLoader = gateway.getSoulLoader();
    console.log('3. ImportanceEvaluator:', evaluator ? '✓ 已初始化' : '✗ 未初始化');
    console.log('4. SoulLoader:', soulLoader ? '✓ 已初始化' : '✗ 未初始化');

    // 5. 测试消息处理
    const testCases = [
      { msg: '我叫张三，电话是 13812345678', expectedImportance: 0.85 },
      { msg: '你好，今天天气怎么样', expectedImportance: 0.2 },
      { msg: '帮我处理这个任务', expectedImportance: 0.5 },
    ];

    console.log('\n5. 消息处理测试:');
    for (const tc of testCases) {
      const ctx: MessageContext = {
        channel: 'cli',
        content: tc.msg,
        userId: 'test-user',
      };

      try {
        const response = await gateway.handleMessage(ctx);
        // response 应该已经被剥离了 IMPORTANCE 标记
        const hasMarker = response.content.includes('[IMPORTANCE:');
        console.log(`   消息: "${tc.msg.slice(0, 20)}..."`);
        console.log(`   回复: "${response.content.slice(0, 30)}..."`);
        console.log(`   回复包含 IMPORTANCE 标记: ${hasMarker ? '✗ 应被剥离' : '✓ 已剥离'}`);
      } catch (e: any) {
        console.log(`   消息: "${tc.msg.slice(0, 20)}..." - 错误: ${e.message}`);
      }
    }

    // 6. 加载 soul 内容
    const soulContent = await soulLoader.load();
    console.log('\n6. Soul 内容:');
    console.log('   长度:', soulContent.length, '字符');
    console.log('   包含 IMPORTANCE 规则:', soulContent.includes('IMPORTANCE') ? '✓' : '✗');

    console.log('\n=== 测试完成 ===');
  } catch (e: any) {
    console.error('错误:', e.message);
  } finally {
    // 清理测试目录
    await rm(testDir, { recursive: true, force: true });
    console.log('\n7. 测试目录已清理');
  }
}

main().catch(console.error);