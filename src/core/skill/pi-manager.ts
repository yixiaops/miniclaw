/**
 * @fileoverview Pi Skill Manager - 基于 pi-coding-agent Skill API 的技能管理器
 *
 * 使用 @mariozechner/pi-coding-agent 提供的标准 API 加载和格式化技能，
 * 结合现有的 SkillMatcher 实现匹配逻辑。
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
import { SkillMatcher, createMatcher } from './matcher.js';
import type { Skill as LocalSkill, SkillSystemStatus } from './types.js';

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
 * 技能匹配结果（使用 pi Skill 类型）
 */
export interface PiSkillMatchResult {
  /** 匹配到的技能（pi-coding-agent Skill） */
  skill: PiSkill;
  /** 匹配类型 */
  matchType: 'trigger' | 'description';
  /** 匹配到的关键词 */
  matchedKeyword: string;
}

/**
 * 技能系统状态（扩展版）
 */
export interface PiSkillSystemStatus extends SkillSystemStatus {
  /** 是否启用 */
  enabled: boolean;
  /** 加载诊断信息 */
  diagnostics: ResourceDiagnostic[];
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从描述中提取触发词
 *
 * 触发词是方括号包围的单词，如 [git] [commit]
 *
 * @param description - 技能描述
 * @returns 触发词数组
 */
function extractTriggersFromDescription(description: string): string[] {
  const triggers: string[] = [];
  const regex = /\[([^\]]+)\]/g;
  let match;

  while ((match = regex.exec(description)) !== null) {
    triggers.push(match[1]);
  }

  return triggers;
}

/**
 * 将 pi Skill 转换为本地 Skill 格式（用于匹配）
 *
 * @param piSkill - pi-coding-agent Skill
 * @returns 本地 Skill 格式
 */
function convertToLocalSkill(piSkill: PiSkill): LocalSkill {
  const triggers = extractTriggersFromDescription(piSkill.description);

  return {
    name: piSkill.name,
    description: piSkill.description,
    triggers,
    content: '', // 内容通过 formatSkillsForPrompt 获取
    path: piSkill.filePath,
    priority: 0, // 默认优先级
    contentLoaded: false
  };
}

// ============================================================================
// PiSkillManager 类
// ============================================================================

/**
 * Pi Skill Manager
 *
 * 基于 pi-coding-agent Skill API 的技能管理器。
 *
 * ## 功能
 *
 * 1. 使用 loadSkillsFromDir 加载技能
 * 2. 使用 formatSkillsForPrompt 格式化技能为 prompt
 * 3. 使用 SkillMatcher 匹配用户输入
 *
 * ## 使用示例
 *
 * ```typescript
 * const manager = new PiSkillManager({ skillsDir: '~/.miniclaw/skills' });
 * manager.load();
 *
 * // 匹配技能
 * const match = manager.match('帮我提交代码');
 * if (match) {
 *   const prompt = manager.getPrompt(match.skill);
 *   // 注入 prompt 到 Agent
 * }
 * ```
 */
export class PiSkillManager {
  /** 已加载的技能列表（pi Skill） */
  private skills: PiSkill[] = [];

  /** 本地格式技能列表（用于匹配） */
  private localSkills: LocalSkill[] = [];

  /** 技能匹配器 */
  private matcher: SkillMatcher;

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
    this.matcher = createMatcher();

    console.log(`[PiSkillManager] 初始化`);
    console.log(`[PiSkillManager] 技能目录: ${this.skillsDir}`);
    console.log(`[PiSkillManager] 启用状态: ${this.enabled}`);
  }

  /**
   * 加载技能
   *
   * 使用 loadSkillsFromDir 从目录加载技能。
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

    // 转换为本地格式用于匹配
    this.localSkills = result.skills.map(convertToLocalSkill);

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
   * 匹配用户输入到技能
   *
   * 使用 SkillMatcher 从已加载技能中找到最佳匹配。
   *
   * @param input - 用户输入
   * @returns 匹配结果，无匹配返回 null
   */
  match(input: string): PiSkillMatchResult | null {
    if (!this.enabled || this.skills.length === 0) {
      return null;
    }

    // 使用本地格式技能匹配
    const localMatch = this.matcher.findBestMatch(this.localSkills, input);

    if (!localMatch) {
      return null;
    }

    // 找到对应的 pi Skill
    const piSkill = this.skills.find(s => s.name === localMatch.skill.name);

    if (!piSkill) {
      console.warn(`[PiSkillManager] 匹配到本地技能但找不到对应的 pi Skill: ${localMatch.skill.name}`);
      return null;
    }

    console.log(`[PiSkillManager] 🎯 匹配到技能: ${piSkill.name} (${localMatch.matchType})`);
    console.log(`[PiSkillManager] 匹配关键词: ${localMatch.matchedKeyword}`);

    return {
      skill: piSkill,
      matchType: localMatch.matchType,
      matchedKeyword: localMatch.matchedKeyword
    };
  }

  /**
   * 获取技能的 prompt 文本（仅元数据）
   *
   * 使用 formatSkillsForPrompt 格式化单个技能。
   * 注意：这只是元数据格式，用于启动时注入。
   *
   * @param skill - 技能对象
   * @returns 格式化的 prompt 文本
   */
  getPrompt(skill: PiSkill): string {
    // formatSkillsForPrompt 可以处理单个或多个技能
    // 对于单个技能，传入数组即可
    const prompt = formatSkillsForPrompt([skill]);

    console.log(`[PiSkillManager] 📋 生成技能 prompt (${prompt.length} 字符)`);
    return prompt;
  }

  /**
   * 获取技能的完整内容（读取 SKILL.md 文件）
   *
   * 用于匹配到技能后注入完整指令。
   *
   * @param skill - 技能对象
   * @returns 格式化的技能内容
   */
  async getSkillContent(skill: PiSkill): Promise<string> {
    const { readFile } = await import('fs/promises');
    
    try {
      const content = await readFile(skill.filePath, 'utf-8');
      
      // 解析 frontmatter，提取正文
      const match = content.match(/^---\s*\n[\s\S]*?\n---\s*\n([\s\S]*)$/);
      const body = match ? match[1].trim() : content;
      
      const formatted = `## Active Skill: ${skill.name}

${body}`;
      
      console.log(`[PiSkillManager] 📄 读取技能内容: ${skill.name} (${formatted.length} 字符)`);
      return formatted;
    } catch (err) {
      console.warn(`[PiSkillManager] ⚠️ 读取技能内容失败: ${skill.name} - ${err}`);
      return '';
    }
  }

  /**
   * 获取所有技能的 prompt 文本
   *
   * 用于在启动时注入所有技能的提示。
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