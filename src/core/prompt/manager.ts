/**
 * 提示词管理器
 *
 * 负责模板的加载、解析、缓存和查询
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type {
  PromptTemplate,
  PromptReference,
  PromptLoadOptions,
  PromptParseResult,
} from './types.js';
import { isFilePathReference } from './types.js';
import { parseFrontmatter } from './parser.js';

/**
 * 提示词管理器
 *
 * 负责模板的加载、解析、缓存和查询。
 */
export class PromptManager {
  /** 模板缓存 */
  private cache: Map<string, PromptTemplate> = new Map();

  /** 默认模板路径 */
  private readonly defaultPromptPath: string;

  /** 后备提示词 */
  private readonly fallbackPrompt: string;

  /** 基础目录 */
  private readonly baseDir: string;

  /**
   * 创建 PromptManager 实例
   *
   * @param options - 配置选项
   */
  constructor(options?: {
    defaultPromptPath?: string;
    fallbackPrompt?: string;
    baseDir?: string;
  }) {
    this.defaultPromptPath =
      options?.defaultPromptPath ||
      path.join(os.homedir(), '.miniclaw', 'prompts', 'default.md');
    this.fallbackPrompt =
      options?.fallbackPrompt || 'You are a helpful AI assistant.';
    this.baseDir =
      options?.baseDir || path.join(os.homedir(), '.miniclaw');
  }

  /**
   * 加载提示词
   *
   * @param reference - 提示词引用（直接文本或文件路径）
   * @param options - 加载选项
   * @returns 加载结果
   */
  async loadPrompt(
    reference: PromptReference,
    options?: PromptLoadOptions
  ): Promise<PromptParseResult> {
    const verbose = options?.verbose ?? false;

    // 检查是否为文件路径引用
    if (isFilePathReference(reference)) {
      return this.parseTemplateFile(reference, options);
    }

    // 直接文本内容
    if (verbose) {
      console.log('[PromptManager] Loading direct text prompt');
    }

    return {
      success: true,
      template: {
        name: 'direct',
        content: reference,
        loadedAt: Date.now(),
      },
    };
  }

  /**
   * 解析模板文件
   *
   * @param reference - 文件路径引用
   * @param options - 加载选项
   * @returns 解析结果
   */
  async parseTemplateFile(
    reference: string,
    options?: PromptLoadOptions
  ): Promise<PromptParseResult> {
    const verbose = options?.verbose ?? false;
    const filePath = this.resolveFilePath(reference);

    if (verbose) {
      console.log(`[PromptManager] Loading template from: ${filePath}`);
    }

    // 检查缓存
    if (options?.cache !== false && this.cache.has(filePath)) {
      if (verbose) {
        console.log('[PromptManager] Using cached template');
      }
      return {
        success: true,
        template: this.cache.get(filePath),
      };
    }

    try {
      // 读取文件
      const content = await fs.promises.readFile(filePath, 'utf-8');

      // 解析 frontmatter
      const template = parseFrontmatter(content, filePath);

      // 缓存结果
      if (options?.cache !== false) {
        this.cache.set(filePath, template);
      }

      if (verbose) {
        console.log(
          `[PromptManager] Template loaded: name=${template.name}, chars=${template.content.length}`
        );
      }

      return {
        success: true,
        template,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (verbose) {
        console.error(`[PromptManager] Failed to load template: ${errorMessage}`);
      }

      // 文件不存在，使用后备值
      const fallback = options?.fallback || this.fallbackPrompt;
      return {
        success: false,
        error: errorMessage,
        usedFallback: true,
        template: {
          name: 'fallback',
          content: fallback,
          loadedAt: Date.now(),
        },
      };
    }
  }

  /**
   * 解析文件路径
   *
   * @param reference - 文件路径引用
   * @returns 绝对路径
   */
  private resolveFilePath(reference: string): string {
    // 移除 file:// 前缀
    let filePath = reference.replace(/^file:\/\//, '');

    // 展开 ~
    if (filePath.startsWith('~/')) {
      filePath = path.join(os.homedir(), filePath.slice(2));
    }

    // 相对路径转换为绝对路径
    if (!path.isAbsolute(filePath)) {
      filePath = path.resolve(this.baseDir, filePath);
    }

    return filePath;
  }

  /**
   * 获取缓存的模板
   *
   * @param key - 缓存键（文件路径）
   * @returns 模板或 undefined
   */
  getCached(key: string): PromptTemplate | undefined {
    return this.cache.get(key);
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 重新加载模板
   *
   * @param reference - 提示词引用
   * @param options - 加载选项
   * @returns 加载结果
   */
  async reloadPrompt(
    reference: PromptReference,
    options?: PromptLoadOptions
  ): Promise<PromptParseResult> {
    // 清除缓存
    if (isFilePathReference(reference)) {
      const filePath = this.resolveFilePath(reference);
      this.cache.delete(filePath);
    }

    // 重新加载
    return this.loadPrompt(reference, {
      ...options,
      cache: false,
    });
  }

  /**
   * 获取默认模板路径
   */
  getDefaultPromptPath(): string {
    return this.defaultPromptPath;
  }
}