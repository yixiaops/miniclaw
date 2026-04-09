/**
 * @fileoverview 技能系统模块入口
 *
 * 导出技能系统的公共 API
 *
 * 设计理念（参考 pi-coding-agent 官方）：
 * 1. 启动时：加载 skill 元数据（name + description）
 * 2. 注入元数据：以 <available_skills> 格式注入系统提示词
 * 3. 模型决策：模型看到元数据后，自己决定是否需要加载完整内容
 * 4. 按需加载：模型使用 read 工具读取 SKILL.md
 *
 * @module core/skill
 */

// Pi Skill Manager（基于 pi-coding-agent）
export {
  PiSkillManager,
  createPiSkillManager,
  type PiSkillManagerOptions,
  type PiSkillSystemStatus
} from './pi-manager.js';

// 类型（保留兼容性）
export type {
  Skill,
  SkillMetadata,
  SkillFrontmatter,
  SkillSystemStatus
} from './types.js';

// ============================================================================
// 以下为旧版实现，已废弃，保留供参考
// ============================================================================

// 旧版 SkillManager（已废弃，请使用 PiSkillManager）
// export { SkillManager, createSkillManager } from './manager.js';

// 旧版匹配器（已废弃，模型自己决策）
// export { SkillMatcher, createMatcher } from './matcher.js';

// 旧版加载器（已废弃，pi-coding-agent 内置加载能力）
// export {
//   loadSkill,
//   loadAllSkills,
//   extractTriggers,
//   parseFrontmatter,
//   getDefaultSkillsDir
// } from './loader.js';