/**
 * @fileoverview 子代理系统模块入口
 * 
 * @module core/subagent
 */

// 类型
export type {
  SubagentStatus,
  SubagentInfo,
  SpawnOptions,
  SubagentResult,
  SubagentManagerConfig,
  SubagentStats,
  SessionsSpawnParams,
  SessionsSpawnResult,
  SubagentsParams,
  SubagentsResult,
  VerificationResult,
  VerificationType,
  VerificationCheck
} from './types.js';

// 核心类
export { SubagentManager, createSubagentManager } from './manager.js';

// 验证器
export {
  SubagentVerifier,
  verifyFileExists,
  verifyContentContains,
  verifyTestsPass
} from './verifier.js';

// 工具
export { 
  createSessionsSpawnTool, 
  createSubagentsTool,
  formatSubagentInfo 
} from './tools.js';