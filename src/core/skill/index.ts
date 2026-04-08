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

// 匹配器（仍被 PiSkillManager 使用）
export { SkillMatcher, createMatcher } from './matcher.js';

// Pi Skill Manager（基于 pi-coding-agent，推荐使用）
export {
  PiSkillManager,
  createPiSkillManager,
  type PiSkillManagerOptions,
  type PiSkillMatchResult,
  type PiSkillSystemStatus
} from './pi-manager.js';

// ============================================================================
// 以下为旧版实现，已废弃，保留供参考
// ============================================================================

// 旧版 SkillManager（已废弃，请使用 PiSkillManager）
// export { SkillManager, createSkillManager } from './manager.js';

// 旧版加载器（已废弃，pi-coding-agent 内置加载能力）
// export {
//   loadSkill,
//   loadAllSkills,
//   extractTriggers,
//   parseFrontmatter,
//   getDefaultSkillsDir
// } from './loader.js';