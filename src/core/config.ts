/**
 * 配置模块
 * 管理应用配置，支持环境变量加载
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

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
 * 应用配置
 */
export interface Config {
  /** 百炼配置 */
  bailian: BailianConfig;
  /** 服务器配置 */
  server: ServerConfig;
  /** 飞书配置（可选） */
  feishu?: FeishuConfig;
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