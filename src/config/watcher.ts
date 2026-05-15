/**
 * 配置热加载模块
 *
 * 监听配置文件变化，实时加载新增的子 Agent 配置
 *
 * @module config/watcher
 */

import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { Config, AgentConfig } from '../core/config.js';

/**
 * 配置变更事件类型
 */
export type ConfigChangeEvent = {
  type: 'add' | 'change' | 'unlink';
  path: string;
  config?: Config;
};

/**
 * 配置变更回调
 */
export type ConfigChangeCallback = (event: ConfigChangeEvent) => void;

/**
 * ConfigWatcher 配置选项
 */
export interface ConfigWatcherOptions {
  /** 配置文件路径（默认 ~/.miniclaw/config.json） */
  configPath?: string;
  /** 是否启用监听（默认 true） */
  enabled?: boolean;
  /** 配置变更回调 */
  onChange?: ConfigChangeCallback;
  /** 防抖延迟（毫秒，默认 1000） */
  debounceDelay?: number;
}

/**
 * 配置热加载器
 *
 * 使用 chokidar 监听配置文件变化，触发配置重新加载
 */
export class ConfigWatcher {
  private configPath: string;
  private enabled: boolean;
  private onChange?: ConfigChangeCallback;
  private debounceDelay: number;
  private watcher?: FSWatcher;
  private debounceTimer?: NodeJS.Timeout;
  private lastConfig?: Config;

  /**
   * 创建 ConfigWatcher 实例
   *
   * @param options - 配置选项
   */
  constructor(options: ConfigWatcherOptions = {}) {
    this.configPath = options.configPath || join(homedir(), '.miniclaw', 'config.json');
    this.enabled = options.enabled ?? true;
    this.onChange = options.onChange;
    this.debounceDelay = options.debounceDelay ?? 1000;
  }

  /**
   * 启动监听
   */
  async start(): Promise<void> {
    if (!this.enabled) {
      console.log('[ConfigWatcher] 监听已禁用');
      return;
    }

    // 检查配置文件是否存在
    if (!existsSync(this.configPath)) {
      console.log('[ConfigWatcher] 配置文件不存在，跳过监听');
      return;
    }

    // 加载初始配置
    this.lastConfig = await this.loadConfig();

    // 创建 chokidar watcher
    this.watcher = chokidar.watch(this.configPath, {
      ignoreInitial: true, // 忽略初始扫描事件
      awaitWriteFinish: {
        stabilityThreshold: 500, // 文件写入完成后再触发
        pollInterval: 100,
      },
    });

    // 监听文件变化
    this.watcher.on('change', (path) => {
      this.handleChange(path, 'change');
    });

    this.watcher.on('add', (path) => {
      this.handleChange(path, 'add');
    });

    this.watcher.on('unlink', (path) => {
      this.handleChange(path, 'unlink');
    });

    console.log(`[ConfigWatcher] 已启动监听: ${this.configPath}`);
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }

    console.log('[ConfigWatcher] 已停止监听');
  }

  /**
   * 获取当前配置
   */
  getLastConfig(): Config | undefined {
    return this.lastConfig;
  }

  /**
   * 手动重新加载配置
   */
  async reload(): Promise<Config | undefined> {
    const config = await this.loadConfig();
    if (config) {
      this.lastConfig = config;
    }
    return config;
  }

  /**
   * 处理文件变化事件（带防抖）
   */
  private handleChange(path: string, type: 'add' | 'change' | 'unlink'): void {
    // 清除之前的防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // 设置新的防抖定时器
    this.debounceTimer = setTimeout(async () => {
      await this.processChange(path, type);
      this.debounceTimer = undefined;
    }, this.debounceDelay);
  }

  /**
   * 处理配置文件变化
   */
  private async processChange(path: string, type: 'add' | 'change' | 'unlink'): Promise<void> {
    console.log(`[ConfigWatcher] 检测到配置变化: ${type} ${path}`);

    try {
      const newConfig = type === 'unlink' ? undefined : await this.loadConfig();
      const oldConfig = this.lastConfig;

      if (newConfig) {
        // 检测 Agent 配置变化
        const changes = this.detectChanges(oldConfig, newConfig);

        if (changes.added.length > 0) {
          console.log(`[ConfigWatcher] 新增 Agent: ${changes.added.map(a => a.id).join(', ')}`);
        }
        if (changes.removed.length > 0) {
          console.log(`[ConfigWatcher] 移除 Agent: ${changes.removed.join(', ')}`);
        }
        if (changes.modified.length > 0) {
          console.log(`[ConfigWatcher] 修改 Agent: ${changes.modified.join(', ')}`);
        }

        this.lastConfig = newConfig;
      }

      // 触发回调
      if (this.onChange) {
        this.onChange({
          type,
          path,
          config: newConfig,
        });
      }
    } catch (error) {
      console.error(`[ConfigWatcher] 处理配置变化失败: ${error}`);
    }
  }

  /**
   * 加载配置文件
   */
  private async loadConfig(): Promise<Config | undefined> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      const config = JSON.parse(content) as Config;
      return config;
    } catch (error) {
      console.error(`[ConfigWatcher] 加载配置失败: ${error}`);
      return undefined;
    }
  }

  /**
   * 检测配置变化
   */
  private detectChanges(
    oldConfig?: Config,
    newConfig?: Config
  ): {
    added: AgentConfig[];
    removed: string[];
    modified: string[];
  } {
    const added: AgentConfig[] = [];
    const removed: string[] = [];
    const modified: string[] = [];

    const oldAgents = oldConfig?.agents?.list || [];
    const newAgents = newConfig?.agents?.list || [];

    // 检测新增
    for (const newAgent of newAgents) {
      const oldAgent = oldAgents.find(a => a.id === newAgent.id);
      if (!oldAgent) {
        added.push(newAgent);
      } else if (JSON.stringify(oldAgent) !== JSON.stringify(newAgent)) {
        modified.push(newAgent.id);
      }
    }

    // 检测移除
    for (const oldAgent of oldAgents) {
      const newAgent = newAgents.find(a => a.id === oldAgent.id);
      if (!newAgent) {
        removed.push(oldAgent.id);
      }
    }

    return { added, removed, modified };
  }
}