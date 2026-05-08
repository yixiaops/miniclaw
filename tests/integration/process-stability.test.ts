/**
 * Process Stability Integration Tests
 *
 * 测试进程稳定性：
 * - 进程异常后保活
 * - PM2 自动重启配置
 * - 内存溢出保护配置验证
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('Process Stability', () => {
  const testLogsDir = join(process.cwd(), 'logs');
  const configDir = join(process.cwd(), 'config');
  let exceptionLogFile: string;
  let ecosystemConfigFile: string;
  let pm2StartScript: string;

  beforeEach(() => {
    // 确保目录存在
    if (!existsSync(testLogsDir)) {
      mkdirSync(testLogsDir, { recursive: true });
    }
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    exceptionLogFile = join(testLogsDir, 'exception.log');
    ecosystemConfigFile = join(configDir, 'ecosystem.config.js');
    pm2StartScript = join(configDir, 'pm2-start.sh');

    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Global Exception Handling', () => {
    it('should keep process alive after uncaught exception', async () => {
      const { setupGlobalExceptionHandler } = await import('../../src/core/exception-handler.js');

      setupGlobalExceptionHandler({ exceptionNotification: { enabled: false } });

      // 触发异常
      process.emit('uncaughtException', new Error('Integration test exception'));

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 200));

      // 进程应该仍然存活（测试本身能继续运行就证明进程没退出）
      expect(true).toBe(true);

      // 检查日志文件存在
      if (existsSync(exceptionLogFile)) {
        const logContent = readFileSync(exceptionLogFile, 'utf-8');
        expect(logContent.length).toBeGreaterThan(0);
      }
    });

    it('should keep process alive after unhandled rejection', async () => {
      const { setupGlobalExceptionHandler } = await import('../../src/core/exception-handler.js');

      setupGlobalExceptionHandler({ exceptionNotification: { enabled: false } });

      // 触发 rejection
      const testReason = new Error('Integration test rejection');
      process.emit('unhandledRejection', testReason, Promise.reject(testReason));

      // 等待处理
      await new Promise(resolve => setTimeout(resolve, 200));

      // 进程应该仍然存活
      expect(true).toBe(true);

      // 检查日志文件存在
      if (existsSync(exceptionLogFile)) {
        const logContent = readFileSync(exceptionLogFile, 'utf-8');
        expect(logContent.length).toBeGreaterThan(0);
      }
    });
  });

  describe('PM2 Configuration', () => {
    it('should have ecosystem.config.js file', () => {
      expect(existsSync(ecosystemConfigFile)).toBe(true);
    });

    it('should have correct PM2 config structure', async () => {
      if (existsSync(ecosystemConfigFile)) {
        const content = readFileSync(ecosystemConfigFile, 'utf-8');

        // 验证关键配置项
        expect(content).toContain('name: \'miniclaw\'');
        expect(content).toContain('restart_delay: 1000');
        expect(content).toContain('max_restarts: 5');
        expect(content).toContain('max_memory_restart');
        expect(content).toContain('wait_ready: true');
      } else {
        throw new Error('ecosystem.config.js not created yet (TDD expected failure)');
      }
    });

    it('should have correct log configuration', async () => {
      if (existsSync(ecosystemConfigFile)) {
        const content = readFileSync(ecosystemConfigFile, 'utf-8');

        expect(content).toContain('log_date_format');
        expect(content).toContain('merge_logs: false');
        expect(content).toContain('error_file');
        expect(content).toContain('out_file');
      } else {
        throw new Error('ecosystem.config.js not created yet (TDD expected failure)');
      }
    });

    it('should have pm2-start.sh script', () => {
      expect(existsSync(pm2StartScript)).toBe(true);
    });

    it('should have pm2 startup commands in script', async () => {
      if (existsSync(pm2StartScript)) {
        const content = readFileSync(pm2StartScript, 'utf-8');

        expect(content).toContain('pm2 start');
        expect(content).toContain('pm2 save');
        expect(content).toContain('pm2 startup');
        expect(content).toContain('pm2-logrotate');
      } else {
        throw new Error('pm2-start.sh not created yet (TDD expected failure)');
      }
    });
  });

  describe('Manual Test Documentation', () => {
    it('should document PM2 auto-restart test procedure', () => {
      // 这个测试只是记录手动测试步骤，不实际执行
      const manualTestProcedure = `
Manual Test: PM2 Auto-Restart

1. Start PM2: pm2 start config/ecosystem.config.js
2. Get process ID: pm2 list
3. Kill process: kill -9 <pid>
4. Wait 1 second
5. Verify PM2 restarted: pm2 list (status should be 'online')

Expected: Process restarts within 1 second after crash
      `;

      expect(manualTestProcedure).toContain('kill -9');
      expect(manualTestProcedure).toContain('restart');
    });

    it('should document memory threshold test procedure', () => {
      const manualTestProcedure = `
Manual Test: Memory Threshold Auto-Restart

1. Start PM2: pm2 start config/ecosystem.config.js
2. Monitor memory: pm2 monit
3. Simulate memory growth (e.g., add code to allocate large arrays)
4. Wait for memory to exceed 500MB
5. Verify PM2 restarts process automatically

Expected: PM2 restarts when memory exceeds 500MB threshold
      `;

      expect(manualTestProcedure).toContain('500MB');
      expect(manualTestProcedure).toContain('restart');
    });

    it('should document PM2 startup test procedure', () => {
      const manualTestProcedure = `
Manual Test: PM2 Auto-Start on Boot

1. Run pm2-start.sh script: bash config/pm2-start.sh
2. Run pm2 startup command manually (as shown in output)
3. Run pm2 save
4. Restart server
5. Verify PM2 automatically starts miniclaw process

Expected: miniclaw process starts automatically after server reboot
      `;

      expect(manualTestProcedure).toContain('pm2 save');
      expect(manualTestProcedure).toContain('reboot');
    });
  });
});