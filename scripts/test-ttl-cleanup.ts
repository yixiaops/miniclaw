/**
 * @fileoverview 手动触发 TTL 清理测试
 */

import { MemoryManager } from '../src/memory/manager.js';
import { TTLManager } from '../src/memory/store/ttl-manager.js';
import { MemoryPromoter } from '../src/memory/promotion/promoter.js';
import { MemoryCandidatePool } from '../src/memory/store/candidate-pool.js';
import { LongTermMemory } from '../src/memory/store/long-term.js';
import { join } from 'path';
import { homedir } from 'os';

async function main() {
  console.log('=== TTL 清理测试 ===\n');

  const storageDir = join(homedir(), '.miniclaw', 'memory-storage');
  console.log('1. 存储目录:', storageDir);

  // 创建 MemoryManager
  const memoryManager = new MemoryManager({
    storageDir,
    defaultTTL: 60000, // 1 分钟
    cleanupInterval: 30000, // 30 秒
    promotionThreshold: 0.5
  });

  await memoryManager.initialize();
  console.log('2. MemoryManager 已初始化');

  // 写入测试记忆
  console.log('\n3. 写入测试记忆...');
  const id1 = await memoryManager.write('我叫张三，电话是 13812345678', 'test-session', { importance: 0.95 });
  const id2 = await memoryManager.write('你好，今天天气不错', 'test-session', { importance: 0.2 });
  console.log('   写入 id1:', id1, 'importance: 0.95');
  console.log('   写入 id2:', id2, 'importance: 0.2');

  // 检查候选池
  console.log('\n4. 检查候选池...');
  const candidatePool = memoryManager.getCandidatePool();
  const entries = candidatePool.getAll();
  console.log('   候选池条目数:', entries.length);
  for (const e of entries) {
    console.log('   -', e.id.slice(0, 20), 'importance:', e.metadata.importance);
  }

  // 等待 TTL 过期
  console.log('\n5. 等待 TTL 过期 (60秒)...');
  await new Promise(r => setTimeout(r, 65000));

  // 手动触发清理
  console.log('\n6. 手动触发 TTL 清理...');
  const ttlManager = memoryManager.getTTLManager();
  const result = await ttlManager.cleanup();
  console.log('   清理结果:', JSON.stringify(result));

  // 检查长期记忆
  console.log('\n7. 检查长期记忆...');
  const longTermMemory = memoryManager.getLongTermMemory();
  const longTermEntries = await longTermMemory.list();
  console.log('   长期记忆条目数:', longTermEntries.length);
  for (const e of longTermEntries) {
    console.log('   -', e.content.slice(0, 30), 'importance:', e.metadata.importance);
  }

  // 检查文件
  console.log('\n8. 检查持久化文件...');
  const fs = await import('fs/promises');
  try {
    const memoryFile = join(storageDir, 'MEMORY.md');
    const content = await fs.readFile(memoryFile, 'utf-8');
    console.log('   MEMORY.md 内容:', content.slice(0, 200));
  } catch (e) {
    console.log('   MEMORY.md 不存在');
  }

  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);