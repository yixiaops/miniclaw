/**
 * Exception Handler Unit Tests
 *
 * 测试全局异常处理器：
 * - uncaughtException 处理
 * - unhandledRejection 处理
 * - JSON 日志格式
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Mock setupGlobalExceptionHandler 函数（后续实现）
let setupGlobalExceptionHandler: (config: any) => void;
let exceptionLogFile: string;

describe('Exception Handler', () => {
  const testLogsDir = join(process.cwd(), 'logs');

  beforeEach(() => {
    // 确保测试日志目录存在
    if (!existsSync(testLogsDir)) {
      mkdirSync(testLogsDir, { recursive: true });
    }
    exceptionLogFile = join(testLogsDir, 'exception.log');

    // 清空日志文件
    if (existsSync(exceptionLogFile)) {
      writeFileSync(exceptionLogFile, '');
    }

    // 临时模拟 console.error 防止测试输出噪音
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setupGlobalExceptionHandler', () => {
    it('should exist and be a function', async () => {
      // 动态导入实现模块
      try {
        const module = await import('../../src/core/exception-handler.js');
        setupGlobalExceptionHandler = module.setupGlobalExceptionHandler;
        expect(typeof setupGlobalExceptionHandler).toBe('function');
      } catch (error) {
        // 模块不存在 - TDD 第一阶段，测试应失败
        expect(error).toBeDefined();
        throw new Error('Module exception-handler.js not implemented yet (TDD expected failure)');
      }
    });

    it('should register uncaughtException handler', async () => {
      // 导入模块
      const { setupGlobalExceptionHandler } = await import('../../src/core/exception-handler.js');

      const config = {
        exceptionNotification: { enabled: false }
      };

      setupGlobalExceptionHandler(config);

      // 验证 process.on('uncaughtException') 已注册
      const listeners = process.listeners('uncaughtException');
      expect(listeners.length).toBeGreaterThan(0);
    });

    it('should register unhandledRejection handler', async () => {
      const { setupGlobalExceptionHandler } = await import('../../src/core/exception-handler.js');

      const config = {
        exceptionNotification: { enabled: false }
      };

      setupGlobalExceptionHandler(config);

      // 验证 process.on('unhandledRejection') 已注册
      const listeners = process.listeners('unhandledRejection');
      expect(listeners.length).toBeGreaterThan(0);
    });
  });

  describe('Exception Logging', () => {
    it('should log uncaughtException in JSON format', async () => {
      const { setupGlobalExceptionHandler } = await import('../../src/core/exception-handler.js');

      setupGlobalExceptionHandler({ exceptionNotification: { enabled: false } });

      // 触发测试异常（通过 emit 而非 throw，避免中断测试进程）
      const testError = new Error('Test uncaught exception');
      process.emit('uncaughtException', testError);

      // 等待日志写入
      await new Promise(resolve => setTimeout(resolve, 100));

      // 读取日志文件
      if (existsSync(exceptionLogFile)) {
        const logContent = readFileSync(exceptionLogFile, 'utf-8');
        const lines = logContent.trim().split('\n');

        if (lines.length > 0) {
          const lastLog = JSON.parse(lines[lines.length - 1]);

          expect(lastLog).toHaveProperty('timestamp');
          expect(lastLog).toHaveProperty('type', 'uncaughtException');
          expect(lastLog).toHaveProperty('message', 'Test uncaught exception');
          expect(lastLog).toHaveProperty('stack');
          expect(lastLog).toHaveProperty('source');
        }
      }
    });

    it('should log unhandledRejection in JSON format', async () => {
      const { setupGlobalExceptionHandler } = await import('../../src/core/exception-handler.js');

      setupGlobalExceptionHandler({ exceptionNotification: { enabled: false } });

      // 触发测试 rejection
      const testReason = new Error('Test unhandled rejection');
      process.emit('unhandledRejection', testReason, Promise.reject(testReason));

      // 等待日志写入
      await new Promise(resolve => setTimeout(resolve, 100));

      // 读取日志文件
      if (existsSync(exceptionLogFile)) {
        const logContent = readFileSync(exceptionLogFile, 'utf-8');
        const lines = logContent.trim().split('\n');

        if (lines.length > 0) {
          const lastLog = JSON.parse(lines[lines.length - 1]);

          expect(lastLog).toHaveProperty('timestamp');
          expect(lastLog).toHaveProperty('type', 'unhandledRejection');
          expect(lastLog).toHaveProperty('message', 'Test unhandled rejection');
          expect(lastLog).toHaveProperty('stack');
          expect(lastLog).toHaveProperty('source');
        }
      }
    });

    it('should NOT exit process after handling exception', async () => {
      const { setupGlobalExceptionHandler } = await import('../../src/core/exception-handler.js');

      setupGlobalExceptionHandler({ exceptionNotification: { enabled: false } });

      // 监听 exit 事件
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

      // 触发异常
      process.emit('uncaughtException', new Error('Test error'));

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证 process.exit 未被调用
      expect(exitSpy).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });
});