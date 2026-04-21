/**
 * @fileoverview 手动触发 TTL 清理测试
 */

import { MemoryManager } from '../src/memory/manager.js';
import { join } from 'path';
import { homedir } from 'os';
import { readdir, readFile } from 'fs/promises';

async function main() {
  console.log('=== TTL 清理测试 ===\n');

  const storageDir = join(homedir(), '.miniclaw', 'memory-storage');
  console.log('1. 存储目录:', storageDir);

  // 检查目录内容
  const files = await readdir(storageDir).catch(() => []);
  console.log('   当前文件:', files.length > 0 ? files : '(空)');

  // 创建 MemoryManager（使用非常短的 TTL）
  const memoryManager = new MemoryManager({
    storageDir,
    defaultTTL: 5000, // 5 秒 TTL
    cleanupInterval: 2000, // 2 秒清理间隔
    promotionThreshold: 0.5
  });

  await memoryManager.initialize();
  console.log('2. MemoryManager 已初始化');

  // 写入测试记忆
  console.log('\n3. 写入测试记忆...');
  const id1 = await memoryManager.write('我叫张三，电话是 13812345678', 'test-session', { importance: 0.95 });
  const id2 = await memoryManager.write('你好，今天天气不错', 'test-session', { importance: 0.2 });
  console.log('   id1:', id1?.slice(0, 20), 'importance: 0.95');
  console.log('   id2:', id2?.slice(0, 20), 'importance: 0.2');

  // 检查状态
  console.log('\n4. 当前状态:');
  const status = memoryManager.getStatus();
  console.log('   候选池条目数:', status.candidatePoolCount);
  console.log('   长期记忆条目数:', status.longTermCount);
  console.log('   平均重要性:', status.avgImportance);

  // 等待 TTL 过期
  console.log('\n5. 等待 TTL 过期 (6秒)...');
  await new Promise(r => setTimeout(r, 6000));

  // 手动触发清理
  console.log('\n6. 手动触发 TTL 清理...');
  const result = await memoryManager.cleanup();
  console.log('   清理结果:', JSON.stringify(result));

  // 检查清理后状态
  console.log('\n7. 清理后状态:');
  const statusAfter = memoryManager.getStatus();
  console.log('   候选池条目数:', statusAfter.candidatePoolCount);
  console.log('   长期记忆条目数:', statusAfter.longTermCount);

  // 持久化
  console.log('\n8. 持久化...');
  await memoryManager.persist();
  console.log('   持久化完成');

  // 检查文件
  console.log('\n9. 检查持久化文件...');
  const filesAfter = await readdir(storageDir).catch(() => []);
  console.log('   文件列表:', filesAfter);

  if (filesAfter.includes('MEMORY.md')) {
    const content = await readFile(join(storageDir, 'MEMORY.md'), 'utf-8');
    console.log('   MEMORY.md 内容:');
    console.log(content.slice(0, 500));
  }

  // 销毁
  memoryManager.destroy();
  console.log('\n=== 测试完成 ===');
}

main().catch(console.error);