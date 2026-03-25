/**
 * @fileoverview 技能匹配器
 * 
 * 负责根据用户输入匹配合适的技能
 * 
 * @module core/skill/matcher
 */

import type { Skill, SkillMatchResult } from './types.js';

/**
 * 技能匹配器配置
 */
export interface SkillMatcherConfig {
  /** 是否大小写敏感，默认 false */
  caseSensitive?: boolean;
}

/**
 * 技能匹配器
 * 
 * 支持两种匹配方式：
 * 1. 触发词匹配：用户输入包含触发词
 * 2. 描述匹配：用户输入包含描述中的关键词
 */
export class SkillMatcher {
  private caseSensitive: boolean;

  constructor(config: SkillMatcherConfig = {}) {
    this.caseSensitive = config.caseSensitive ?? false;
  }

  /**
   * 单个技能匹配
   * 
   * @param skill 技能对象
   * @param input 用户输入
   * @returns 匹配结果，不匹配返回 null
   */
  matchSkill(skill: Skill, input: string): SkillMatchResult | null {
    const normalizedInput = this.normalize(input);
    
    // 1. 触发词匹配（优先）
    for (const trigger of skill.triggers) {
      const normalizedTrigger = this.normalize(trigger);
      if (normalizedInput.includes(normalizedTrigger)) {
        return {
          skill,
          matchType: 'trigger',
          matchedKeyword: trigger
        };
      }
    }
    
    // 2. 描述匹配（兜底）
    const normalizedDesc = this.normalize(skill.description);
    // 从描述中提取关键词（去除常见词）
    const keywords = this.extractKeywords(normalizedDesc);
    
    for (const keyword of keywords) {
      if (normalizedInput.includes(keyword) && keyword.length >= 2) {
        return {
          skill,
          matchType: 'description',
          matchedKeyword: keyword
        };
      }
    }
    
    return null;
  }

  /**
   * 从多个技能中找到最佳匹配
   * 
   * @param skills 技能列表
   * @param input 用户输入
   * @returns 最佳匹配，无匹配返回 null
   */
  findBestMatch(skills: Skill[], input: string): SkillMatchResult | null {
    const matches: SkillMatchResult[] = [];
    
    for (const skill of skills) {
      const result = this.matchSkill(skill, input);
      if (result) {
        matches.push(result);
      }
    }
    
    if (matches.length === 0) {
      return null;
    }
    
    // 按匹配类型和优先级排序
    // 1. 触发词匹配优先于描述匹配
    // 2. 同类型按优先级排序
    matches.sort((a, b) => {
      // 触发词匹配优先
      if (a.matchType === 'trigger' && b.matchType === 'description') {
        return -1;
      }
      if (a.matchType === 'description' && b.matchType === 'trigger') {
        return 1;
      }
      // 同类型按优先级排序（高优先级在前）
      return b.skill.priority - a.skill.priority;
    });
    
    return matches[0];
  }

  /**
   * 找到所有匹配的技能
   * 
   * @param skills 技能列表
   * @param input 用户输入
   * @returns 所有匹配结果
   */
  findAllMatches(skills: Skill[], input: string): SkillMatchResult[] {
    const matches: SkillMatchResult[] = [];
    
    for (const skill of skills) {
      const result = this.matchSkill(skill, input);
      if (result) {
        matches.push(result);
      }
    }
    
    // 按优先级排序
    matches.sort((a, b) => {
      // 触发词匹配优先
      if (a.matchType === 'trigger' && b.matchType === 'description') {
        return -1;
      }
      if (a.matchType === 'description' && b.matchType === 'trigger') {
        return 1;
      }
      // 同类型按优先级排序
      return b.skill.priority - a.skill.priority;
    });
    
    return matches;
  }

  /**
   * 标准化字符串
   * 
   * 根据配置进行大小写处理，并去除首尾空格
   */
  private normalize(str: string): string {
    const trimmed = str.trim();
    return this.caseSensitive ? trimmed : trimmed.toLowerCase();
  }

  /**
   * 从描述中提取关键词
   * 
   * 过滤常见词，返回有意义的关键词
   */
  private extractKeywords(description: string): string[] {
    // 常见停用词
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'and', 'or', 'but', 'if', 'then', 'else', 'when', 'where',
      '的', '是', '在', '有', '和', '与', '或', '了', '不', '这',
      'that', 'this', 'it', 'as', 'use', 'using', 'used', 'get'
    ]);
    
    // 分词（简单实现：按空格和标点分割）
    const words = description.split(/[\s,.!?;:'"()\[\]{}，。！？；：'"（）【】]+/);
    
    // 过滤停用词和短词
    return words
      .filter(word => word.length >= 2 && !stopWords.has(word.toLowerCase()))
      .filter(word => !/^\d+$/.test(word)); // 过滤纯数字
  }
}

/**
 * 创建默认匹配器
 */
export function createMatcher(config?: SkillMatcherConfig): SkillMatcher {
  return new SkillMatcher(config);
}