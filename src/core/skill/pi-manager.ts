/**
 * @fileoverview Pi Skill Manager - 基于 pi-coding-agent Skill API 的技能管理器
 *
 * 使用 @mariozechner/pi-coding-agent 提供的标准 API 加载和格式化技能。
 * 
 * 设计理念（参考 pi-coding-agent 官方）：
 * 1. 启动时：加载 skill 元数据（name + description）
 * 2. 注入元数据：以 <available_skills> 格式注入系统提示词
 * 3. 模型决策：模型看到元数据后，自己决定是否需要加载完整内容
 * 4. 按需加载：模型使用 read 工具读取 SKILL.md
 *
 * @module core/skill/pi-manager
 */

import {
  loadSkillsFromDir,
  formatSkillsForPrompt,
  type Skill as PiSkill,
  type LoadSkillsResult,
  type LoadSkillsFromDirOptions,
  type ResourceDiagnostic
} from '@mariozechner/pi-coding-agent';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * PiSkillManager 配置选项
 */
export interface PiSkillManagerOptions {
  /** 技能目录路径，默认 ~/.miniclaw/skills */
  skillsDir?: string;
  /** 技能来源标识，默认 'miniclaw' */
  source?: string;
  /** 是否启用技能系统，默认 true */
  enabled?: boolean;
}

/**
 * 技能系统状态
 */
export interface PiSkillSystemStatus {
  /** 已加载的技能数量 */
  skillCount: number;
  /** 技能名称列表 */
  skillNames: string[];
  /** 技能目录路径 */
  skillsDir: string;
  /** 是否启用 */
  enabled: boolean;
  /** 加载诊断信息 */
  diagnostics: ResourceDiagnostic[];
}

// ============================================================================
// PiSkillManager 类
// ============================================================================

/**
 * Pi Skill Manager
 *
 * 基于 pi-coding-agent Skill API 的技能管理器。
 *
 * ## 使用示例
 *
 * ```typescript
 * const manager = new PiSkillManager({ skillsDir: '~/.miniclaw/skills' });
 * manager.load();
 * 
 * // 获取所有技能元数据，注入到系统提示词
 * const skillPrompts = manager.getAllPrompts();
 * systemPrompt += '\n\n' + skillPrompts;
 * ```
 */
export class PiSkillManager {
  /** 已加载的技能列表（pi Skill） */
  private skills: PiSkill[] = [];

  /** 技能目录 */
  private skillsDir: string;

  /** 来源标识 */
  private source: string;

  /** 是否启用 */
  private enabled: boolean;

  /** 加载诊断信息 */
  private diagnostics: ResourceDiagnostic[] = [];

  /**
   * 创建 PiSkillManager 实例
   *
   * @param options - 配置选项
   */
  constructor(options: PiSkillManagerOptions = {}) {
    this.skillsDir = options.skillsDir || join(homedir(), '.miniclaw', 'skills');
    this.source = options.source || 'miniclaw';
    this.enabled = options.enabled ?? true;

    console.log(`[PiSkillManager] 初始化`);
    console.log(`[PiSkillManager] 技能目录: ${this.skillsDir}`);
    console.log(`[PiSkillManager] 启用状态: ${this.enabled}`);
  }

  /**
   * 加载技能
   *
   * 使用 loadSkillsFromDir 从目录加载技能元数据。
   *
   * @returns 加载结果
   */
  load(): LoadSkillsResult {
    if (!this.enabled) {
      console.log(`[PiSkillManager] 技能系统已禁用，跳过加载`);
      return { skills: [], diagnostics: [] };
    }

    // 检查目录是否存在
    if (!existsSync(this.skillsDir)) {
      console.warn(`[PiSkillManager] 技能目录不存在: ${this.skillsDir}`);
      return { skills: [], diagnostics: [] };
    }

    console.log(`[PiSkillManager] 开始加载技能...`);

    // 使用 pi-coding-agent API 加载技能
    const options: LoadSkillsFromDirOptions = {
      dir: this.skillsDir,
      source: this.source
    };

    const result = loadSkillsFromDir(options);
    this.skills = result.skills;
    this.diagnostics = result.diagnostics;

    // 记录加载结果
    console.log(`[PiSkillManager] 已加载 ${this.skills.length} 个技能`);

    if (this.skills.length > 0) {
      const names = this.skills.map(s => s.name).join(', ');
      console.log(`[PiSkillManager] 技能列表: ${names}`);
    }

    // 记录诊断信息
    if (result.diagnostics.length > 0) {
      console.warn(`[PiSkillManager] 加载警告: ${result.diagnostics.length} 条`);
      result.diagnostics.forEach(d => {
        console.warn(`[PiSkillManager] - ${d.message}`);
      });
    }

    return result;
  }

  /**
   * 获取所有技能的 prompt 文本（元数据格式）
   *
   * 用于在启动时注入所有技能的元数据到系统提示词。
   * 模型看到元数据后，会自己决定是否需要用 read 工具加载完整内容。
   *
   * @returns 格式化的 prompt 文本
   */
  getAllPrompts(): string {
    if (!this.enabled || this.skills.length === 0) {
      return '';
    }

    // 过滤掉 disableModelInvocation 的技能
    const activeSkills = this.skills.filter(s => !s.disableModelInvocation);

    if (activeSkills.length === 0) {
      return '';
    }

    return formatSkillsForPrompt(activeSkills);
  }

  // ==========================================================================
  // 辅助方法
  // ==========================================================================

  /**
   * 获取已加载技能数量
   *
   * @returns 技能数量
   */
  count(): number {
    return this.skills.length;
  }

  /**
   * 获取所有技能名称
   *
   * @returns 技能名称数组
   */
  getNames(): string[] {
    return this.skills.map(s => s.name);
  }

  /**
   * 获取所有技能
   *
   * @returns 技能数组（pi Skill）
   */
  getAll(): PiSkill[] {
    return [...this.skills];
  }

  /**
   * 获取技能系统状态
   *
   * @returns 状态信息
   */
  getStatus(): PiSkillSystemStatus {
    return {
      skillCount: this.skills.length,
      skillNames: this.getNames(),
      skillsDir: this.skillsDir,
      enabled: this.enabled,
      diagnostics: this.diagnostics
    };
  }

  /**
   * 检查技能系统是否启用
   *
   * @returns 是否启用
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

/**
 * 创建 PiSkillManager 实例
 *
 * @param options - 配置选项
 * @returns PiSkillManager 实例
 */
export function createPiSkillManager(options?: PiSkillManagerOptions): PiSkillManager {
  return new PiSkillManager(options);
}