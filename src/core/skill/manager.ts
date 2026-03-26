/**
 * @fileoverview 技能管理器
 * 
 * 管理技能的加载、注册、匹配和检索
 * 
 * @module core/skill/manager
 */

import type { Skill, SkillManagerConfig, SkillMatchResult, SkillSystemStatus } from './types.js';
import { loadAllSkills, getDefaultSkillsDir } from './loader.js';
import { SkillMatcher, createMatcher } from './matcher.js';

/**
 * 技能管理器
 * 
 * 提供技能的加载、注册、匹配和检索功能
 */
export class SkillManager {
  /** 技能存储 */
  private skills: Map<string, Skill> = new Map();
  
  /** 技能目录 */
  private skillsDir: string;
  
  /** 技能匹配器 */
  private matcher: SkillMatcher;
  
  /** 是否已加载 */
  private loaded: boolean = false;

  /**
   * 创建技能管理器
   */
  constructor(config: SkillManagerConfig = {}) {
    this.skillsDir = config.skillsDir ?? getDefaultSkillsDir();
    this.matcher = createMatcher();
    
    // 自动加载
    if (config.autoLoad !== false) {
      this.loadAll().catch(err => {
        console.error('[SkillManager] Failed to load skills:', err);
      });
    }
  }

  /**
   * 加载所有技能
   */
  async loadAll(): Promise<void> {
    const skills = await loadAllSkills(this.skillsDir);
    
    this.skills.clear();
    for (const skill of skills) {
      this.skills.set(skill.name, skill);
    }
    
    this.loaded = true;
    console.log(`[SkillManager] Loaded ${skills.length} skills from ${this.skillsDir}`);
  }

  /**
   * 手动注册技能
   * 
   * @param skill 技能对象
   */
  register(skill: Skill): void {
    this.skills.set(skill.name, skill);
  }

  /**
   * 注销技能
   * 
   * @param name 技能名称
   */
  unregister(name: string): boolean {
    return this.skills.delete(name);
  }

  /**
   * 获取技能
   * 
   * @param name 技能名称
   * @returns 技能对象，不存在返回 undefined
   */
  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  /**
   * 获取所有技能
   */
  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 获取按优先级排序的技能列表
   */
  getSortedByPriority(): Skill[] {
    return this.getAll().sort((a, b) => b.priority - a.priority);
  }

  /**
   * 匹配技能
   * 
   * @param input 用户输入
   * @returns 最佳匹配，无匹配返回 null
   */
  match(input: string): Skill | null {
    const result = this.matcher.findBestMatch(this.getAll(), input);
    return result?.skill ?? null;
  }

  /**
   * 匹配技能（带详细信息）
   * 
   * @param input 用户输入
   * @returns 匹配结果，无匹配返回 null
   */
  matchWithDetails(input: string): SkillMatchResult | null {
    return this.matcher.findBestMatch(this.getAll(), input);
  }

  /**
   * 匹配所有相关技能
   * 
   * @param input 用户输入
   * @returns 所有匹配结果
   */
  matchAll(input: string): SkillMatchResult[] {
    return this.matcher.findAllMatches(this.getAll(), input);
  }

  /**
   * 获取技能的提示词内容
   * 
   * 用于注入到 Agent 的 system prompt 中
   * 
   * @param skillName 技能名称
   * @returns 格式化的技能内容，不存在返回空字符串
   */
  getPrompt(skillName: string): string {
    const skill = this.skills.get(skillName);
    if (!skill) {
      return '';
    }
    
    return `## Active Skill: ${skill.name}

${skill.content}`;
  }

  /**
   * 获取最佳匹配技能的提示词
   * 
   * @param input 用户输入
   * @returns 格式化的技能内容，无匹配返回空字符串
   */
  getBestMatchPrompt(input: string): string {
    const skill = this.match(input);
    if (!skill) {
      return '';
    }
    return this.getPrompt(skill.name);
  }

  /**
   * 获取技能数量
   */
  count(): number {
    return this.skills.size;
  }

  /**
   * 检查是否已加载
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * 获取技能目录
   */
  getSkillsDir(): string {
    return this.skillsDir;
  }

  /**
   * 获取系统状态
   */
  getStatus(): SkillSystemStatus {
    return {
      skillCount: this.skills.size,
      skillNames: Array.from(this.skills.keys()),
      skillsDir: this.skillsDir
    };
  }

  /**
   * 清空所有技能
   */
  clear(): void {
    this.skills.clear();
    this.loaded = false;
  }

  /**
   * 重新加载所有技能
   */
  async reload(): Promise<void> {
    this.clear();
    await this.loadAll();
  }

  /**
   * 检查技能是否存在
   */
  has(name: string): boolean {
    return this.skills.has(name);
  }

  /**
   * 获取技能名称列表
   */
  getNames(): string[] {
    return Array.from(this.skills.keys());
  }
}

/**
 * 创建技能管理器
 */
export function createSkillManager(config?: SkillManagerConfig): SkillManager {
  return new SkillManager(config);
}