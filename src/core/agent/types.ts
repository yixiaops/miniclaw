/**
 * Agent 类型定义
 *
 * 定义 Agent 相关的接口和类型。
 *
 * @module MiniclawAgent/Types
 */

/**
 * 系统提示词组成部分
 *
 * 用于追踪和显示系统提示词的来源，便于调试和理解。
 *
 * @property type - 来源类型
 *   - 'file': 来自提示词文件
 *   - 'skills': 来自技能元数据
 *   - 'default': 默认提示词
 *   - 'tools': 工具元数据（预留）
 * @property label - 来源标识（文件名、技能数量等）
 * @property content - 该部分的内容
 * @property meta - 额外元数据
 */
export interface PromptComponent {
  /** 来源类型 */
  type: 'file' | 'skills' | 'default' | 'tools';
  /** 来源标识（文件名、技能数量等） */
  label: string;
  /** 内容 */
  content: string;
  /** 额外元数据 */
  meta?: {
    /** 文件名（type 为 'file' 时） */
    fileName?: string;
    /** 技能数量（type 为 'skills' 时） */
    skillCount?: number;
    /** 技能名称列表（type 为 'skills' 时） */
    skillNames?: string[];
    /** 工具数量（type 为 'tools' 时，预留） */
    toolCount?: number;
  };
}