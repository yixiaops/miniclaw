/**
 * 全局异常处理器
 * 捕获 uncaughtException 和 unhandledRejection，记录到日志，保持进程存活
 */
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * 异常通知配置
 */
export interface ExceptionNotificationConfig {
  /** 是否启用通知 */
  enabled: boolean;
  /** 飞书通知目标 */
  feishuTarget?: string;
}

/**
 * 异常处理器配置
 */
export interface ExceptionConfig {
  /** 异常通知配置 */
  exceptionNotification: ExceptionNotificationConfig;
  /** 日志文件路径（可选，默认 logs/exception.log） */
  logFile?: string;
}

/**
 * 异常日志条目
 */
interface ExceptionLogEntry {
  /** 时间戳 (ISO8601) */
  timestamp: string;
  /** 异常类型 */
  type: 'uncaughtException' | 'unhandledRejection';
  /** 异常消息 */
  message: string;
  /** 异常堆栈 */
  stack?: string;
  /** 来源信息 */
  source?: string;
}

/**
 * 确保日志目录存在
 */
function ensureLogsDir(_logFile?: string): void {
  const logsDir = join(process.cwd(), 'logs');
  if (!existsSync(logsDir)) {
    mkdirSync(logsDir, { recursive: true });
  }
}

/**
 * 获取异常来源信息
 */
function getErrorSource(error: Error): string {
  const stack = error.stack || '';
  const lines = stack.split('\n');

  // 查找第一个有文件路径的堆栈行
  for (const line of lines) {
    if (line.includes('at ') && (line.includes('.ts') || line.includes('.js'))) {
      // 提取文件路径和行号
      const match = line.match(/at .* \(?(.+):(\d+):(\d+)\)?/);
      if (match) {
        return `${match[1]}:${match[2]}`;
      }
    }
  }

  return 'unknown';
}

/**
 * 记录异常到日志文件
 */
function logException(entry: ExceptionLogEntry, logFile: string): void {
  ensureLogsDir(logFile);

  const logLine = JSON.stringify(entry);
  appendFileSync(logFile, logLine + '\n', 'utf-8');

  // 同时输出到控制台（方便调试）
  console.error(`[ExceptionHandler] ${entry.type}: ${entry.message}`);
  if (entry.source) {
    console.error(`[ExceptionHandler] Source: ${entry.source}`);
  }
}

/**
 * 发送飞书通知（占位实现）
 */
function sendFeishuNotification(entry: ExceptionLogEntry, feishuTarget?: string): void {
  if (!feishuTarget) {
    console.warn('[ExceptionHandler] 飞书通知目标未配置');
    return;
  }

  // TODO: 实现飞书通知发送逻辑
  // 这里只是占位，实际发送需要调用飞书 API
  console.log(`[ExceptionHandler] 飞书通知已触发 (target: ${feishuTarget})`);
  console.log(`[ExceptionHandler] 通知内容: ${entry.type} - ${entry.message}`);
}

/**
 * 设置全局异常处理器
 *
 * @param config - 异常处理器配置
 */
export function setupGlobalExceptionHandler(config: ExceptionConfig): void {
  const logFile = config.logFile || join(process.cwd(), 'logs', 'exception.log');

  // 处理 uncaughtException
  process.on('uncaughtException', (error: Error) => {
    const entry: ExceptionLogEntry = {
      timestamp: new Date().toISOString(),
      type: 'uncaughtException',
      message: error.message,
      stack: error.stack,
      source: getErrorSource(error)
    };

    logException(entry, logFile);

    // 如果启用通知，发送飞书通知
    if (config.exceptionNotification.enabled) {
      sendFeishuNotification(entry, config.exceptionNotification.feishuTarget);
    }

    // 不调用 process.exit()，保持进程存活
  });

  // 处理 unhandledRejection
  process.on('unhandledRejection', (reason: Error | unknown, _promise: Promise<unknown>) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));

    const entry: ExceptionLogEntry = {
      timestamp: new Date().toISOString(),
      type: 'unhandledRejection',
      message: error.message,
      stack: error.stack,
      source: getErrorSource(error)
    };

    logException(entry, logFile);

    // 如果启用通知，发送飞书通知
    if (config.exceptionNotification.enabled) {
      sendFeishuNotification(entry, config.exceptionNotification.feishuTarget);
    }

    // 不调用 process.exit()，保持进程存活
  });

  console.log('[ExceptionHandler] 全局异常处理器已注册');
}