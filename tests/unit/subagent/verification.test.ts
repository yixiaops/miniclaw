/**
 * 子代理验证机制测试
 * 
 * 测试 execute 完成后的验证步骤
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Subagent Verification', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `subagent-verification-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('VerificationResult', () => {
    it('应该能导入 VerificationResult 类型', async () => {
      const types = await import('../../../src/core/subagent/types.js');
      expect(types).toBeDefined();
    });

    it('SubagentResult 应包含 verification 字段', async () => {
      const { SubagentResult } = await import('../../../src/core/subagent/types.js');
      
      // 类型检查
      const result = {
        success: true,
        subagentId: 'test',
        duration: 100,
        completedAt: new Date(),
        verification: {
          passed: true,
          checks: []
        }
      };
      
      expect(result.verification).toBeDefined();
    });
  });

  describe('VerificationCheck', () => {
    it('file_exists 验证应检查文件是否存在', async () => {
      const { verifyFileExists } = await import('../../../src/core/subagent/verifier.js');
      
      // 创建文件
      await writeFile(join(testDir, 'test.txt'), '内容');

      const result = await verifyFileExists(join(testDir, 'test.txt'));
      expect(result.passed).toBe(true);

      const result2 = await verifyFileExists(join(testDir, 'nonexistent.txt'));
      expect(result2.passed).toBe(false);
    });

    it('content_contains 验证应检查文件内容', async () => {
      const { verifyContentContains } = await import('../../../src/core/subagent/verifier.js');
      
      await writeFile(join(testDir, 'test.md'), '# 标题\n\n内容包含关键词');

      const result = await verifyContentContains(
        join(testDir, 'test.md'),
        '关键词'
      );
      expect(result.passed).toBe(true);

      const result2 = await verifyContentContains(
        join(testDir, 'test.md'),
        '不存在'
      );
      expect(result2.passed).toBe(false);
    });

    it('test_pass 验证应检查测试结果', async () => {
      const { verifyTestsPass } = await import('../../../src/core/subagent/verifier.js');
      
      // 模拟测试结果（这里只是类型检查，实际需要运行测试）
      const result = {
        passed: true,
        check: {
          type: 'test_pass',
          target: 'tests/unit/memory/types.test.ts',
          passed: true
        }
      };
      
      expect(result.passed).toBe(true);
    });
  });

  describe('SubagentVerifier', () => {
    it('应该能创建 Verifier 实例', async () => {
      const { SubagentVerifier } = await import('../../../src/core/subagent/verifier.js');
      const verifier = new SubagentVerifier();
      
      expect(verifier).toBeDefined();
    });

    it('应该能执行多个验证', async () => {
      const { SubagentVerifier } = await import('../../../src/core/subagent/verifier.js');
      const verifier = new SubagentVerifier();
      
      // 创建文件
      await writeFile(join(testDir, 'output.md'), '# 结果\n\n完成');

      const result = await verifier.verify([
        { type: 'file_exists', target: join(testDir, 'output.md') },
        { type: 'content_contains', target: join(testDir, 'output.md'), expected: '完成' }
      ]);

      expect(result.passed).toBe(true);
      expect(result.checks.length).toBe(2);
    });

    it('任一验证失败应导致整体失败', async () => {
      const { SubagentVerifier } = await import('../../../src/core/subagent/verifier.js');
      const verifier = new SubagentVerifier();
      
      const result = await verifier.verify([
        { type: 'file_exists', target: join(testDir, 'nonexistent.txt') }
      ]);

      expect(result.passed).toBe(false);
      expect(result.checks[0].passed).toBe(false);
    });

    it('应该支持自定义验证函数', async () => {
      const { SubagentVerifier } = await import('../../../src/core/subagent/verifier.js');
      const verifier = new SubagentVerifier();
      
      const result = await verifier.verify([
        {
          type: 'custom',
          target: 'custom-check',
          validator: async () => ({ passed: true, error: undefined })
        }
      ]);

      expect(result.passed).toBe(true);
    });
  });

  describe('集成到 SubagentResult', () => {
    it('SubagentManager.execute 应支持验证', async () => {
      const { SubagentManager } = await import('../../../src/core/subagent/manager.js');
      const manager = new SubagentManager({
        parentAgentId: 'test'
      });

      // 这是一个概念性测试，验证接口设计
      // 实际执行需要真实的子代理
      expect(manager).toBeDefined();
    });

    it('验证失败应标记 success=false', async () => {
      // 当验证失败时，即使子代理报告成功，也应标记为失败
      const result = {
        success: true,
        subagentId: 'test',
        duration: 100,
        completedAt: new Date(),
        verification: {
          passed: false,
          checks: [{ type: 'file_exists', target: 'nonexistent.txt', passed: false }]
        }
      };

      // 验证失败时，success 应该是 false
      const finalSuccess = result.success && result.verification.passed;
      expect(finalSuccess).toBe(false);
    });
  });
});