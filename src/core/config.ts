/**
 * 配置模块
 * 管理应用配置，支持环境变量和 config.json 加载
 */
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync } from 'fs';

/**
 * 百炼配置
 */
export interface BailianConfig {
  /** API Key */
  apiKey: string;
  /** 模型名称 */
  model: string;
  /** API 基础 URL */
  baseUrl: string;
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  /** 监听端口 */
  port: number;
  /** 监听地址 */
  host: string;
}

/**
 * 飞书配置
 */
export interface FeishuConfig {
  /** 应用 ID */
  appId: string;
  /** 应用密钥 */
  appSecret: string;
  /** 加密密钥 */
  encryptKey?: string;
  /** 验证令牌 */
  verificationToken?: string;
}

/**
 * Agent 配置
 */
export interface AgentConfig {
  /** Agent 唯一标识 */
  id: string;
  /** 显示名称 */
  name?: string;
  /** 使用的模型（覆盖默认） */
  model?: string;
  /** 系统提示词 */
  systemPrompt?: string;
  /** 工作目录 */
  workspace?: string;
  /** 思维链级别：'off' | 'low' | 'medium' | 'high' */
  thinkingLevel?: 'off' | 'low' | 'medium' | 'high';
  /** 子代理配置 */
  subagents?: {
    /** 允许创建的子代理类型 */
    allowAgents?: string[];
    /** 最大并发子代理数 */
    maxConcurrent?: number;
  };
  /** 工具配置 */
  tools?: {
    /** 允许的工具 */
    allow?: string[];
    /** 禁止的工具 */
    deny?: string[];
  };
}

/**
 * Agents 默认配置
 */
export interface AgentsDefaults {
  /** 默认模型 */
  model: string;
  /** 最大 Agent 数量 */
  maxConcurrent: number;
  /** 子代理默认配置 */
  subagents: {
    maxConcurrent: number;
    defaultTimeout: number;
  };
}

/**
 * Agents 配置
 */
export interface AgentsConfig {
  /** 默认配置 */
  defaults: AgentsDefaults;
  /** Agent 列表 */
  list: AgentConfig[];
}

/**
 * 技能配置
 */
export interface SkillsConfig {
  /** 技能目录路径，默认 ~/.miniclaw/skills */
  dir?: string;
  /** 是否启用技能系统，默认 true */
  enabled?: boolean;
}

/**
 * 应用配置
 */
export interface Config {
  /** 百炼配置 */
  bailian: BailianConfig;
  /** 服务器配置 */
  server: ServerConfig;
  /** 飞书配置（可选） */
  feishu?: FeishuConfig;
  /** Agents 配置（可选） */
  agents?: AgentsConfig;
  /** 技能配置（可选） */
  skills?: SkillsConfig;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Omit<Config, 'bailian'> & { bailian: Omit<BailianConfig, 'apiKey'> } = {
  bailian: {
    model: 'qwen-plus',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
};

/**
 * 从环境变量加载配置
 */
export function loadConfig(): Config {
  const apiKey = process.env.MINICLAW_BAILIAN_API_KEY;
  if (!apiKey) {
    throw new Error('MINICLAW_BAILIAN_API_KEY is required');
  }

  const config: Config = {
    bailian: {
      apiKey,
      model: process.env.MINICLAW_BAILIAN_MODEL || DEFAULT_CONFIG.bailian.model,
      baseUrl: process.env.MINICLAW_BAILIAN_BASE_URL || DEFAULT_CONFIG.bailian.baseUrl
    },
    server: {
      port: parseInt(process.env.MINICLAW_SERVER_PORT || String(DEFAULT_CONFIG.server.port), 10),
      host: process.env.MINICLAW_SERVER_HOST || DEFAULT_CONFIG.server.host
    }
  };

  // 加载飞书配置
  const feishuAppId = process.env.MINICLAW_FEISHU_APP_ID;
  const feishuAppSecret = process.env.MINICLAW_FEISHU_APP_SECRET;

  if (feishuAppId && feishuAppSecret) {
    config.feishu = {
      appId: feishuAppId,
      appSecret: feishuAppSecret,
      encryptKey: process.env.MINICLAW_FEISHU_ENCRYPT_KEY,
      verificationToken: process.env.MINICLAW_FEISHU_VERIFICATION_TOKEN
    };
  }

  // 加载技能配置
  const skillsDir = process.env.MINICLAW_SKILLS_DIR;
  const skillsEnabled = process.env.MINICLAW_SKILLS_ENABLED;

  if (skillsDir || skillsEnabled) {
    config.skills = {
      dir: skillsDir,
      enabled: skillsEnabled ? skillsEnabled === 'true' : true
    };
  }

  // 加载 config.json 中的 agents 和 skills 配置
  const configPath = getConfigPath();
  if (existsSync(configPath)) {
    try {
      const fileContent = readFileSync(configPath, 'utf-8');
      const jsonConfig = JSON.parse(fileContent);

      if (jsonConfig.agents) {
        config.agents = jsonConfig.agents;
        console.log(`[Config] 从 ${configPath} 加载了 ${jsonConfig.agents.list?.length || 0} 个 Agent 配置`);
      }

      if (jsonConfig.skills) {
        config.skills = jsonConfig.skills;
        console.log(`[Config] 从 ${configPath} 加载了技能配置: dir=${jsonConfig.skills.dir || '(默认)'}, enabled=${jsonConfig.skills.enabled ?? true}`);
      }
    } catch (err) {
      console.warn(`[Config] 加载 ${configPath} 失败:`, err instanceof Error ? err.message : err);
    }
  }

  return config;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: string[];
}

/**
 * 验证配置
 */
export function validateConfig(config: Config): ValidationResult {
  const errors: string[] = [];

  // 验证百炼配置
  if (!config.bailian.apiKey) {
    errors.push('bailian.apiKey is required');
  }

  if (!config.bailian.model) {
    errors.push('bailian.model is required');
  }

  if (!config.bailian.baseUrl) {
    errors.push('bailian.baseUrl is required');
  }

  // 验证服务器配置
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('server.port must be between 1 and 65535');
  }

  if (!config.server.host) {
    errors.push('server.host is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
  return process.env.MINICLAW_CONFIG_PATH || join(homedir(), '.miniclaw', 'config.json');
}