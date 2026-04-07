/**
 * @fileoverview 技能系统模块入口
 *
 * 导出技能系统的公共 API
 *
 * @module core/skill
 */

// 类型
export type {
  Skill,
  SkillMetadata,
  SkillFrontmatter,
  SkillMatchResult,
  SkillManagerConfig,
  LoadSkillResult,
  SkillSystemStatus
} from './types.js';

// 核心类（旧版 SkillManager）
export { SkillManager, createSkillManager } from './manager.js';
export { SkillMatcher, createMatcher } from './matcher.js';

// 工具函数
export {
  loadSkill,
  loadAllSkills,
  extractTriggers,
  parseFrontmatter,
  getDefaultSkillsDir
} from './loader.js';

// Pi Skill Manager（基于 pi-coding-agent）
export {
  PiSkillManager,
  createPiSkillManager,
  type PiSkillManagerOptions,
  type PiSkillMatchResult,
  type PiSkillSystemStatus
} from './pi-manager.js';