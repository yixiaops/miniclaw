/**
 * @fileoverview 技能加载器
 * 
 * 负责从 SKILL.md 文件加载技能，解析 YAML frontmatter
 * 
 * @module core/skill/loader
 */

import * as fs from 'fs';
import * as pathModule from 'path';
import type { Skill, SkillMetadataLite, SkillMetadata, LoadSkillResult, LoadMetadataResult } from './types.js';

/**
 * YAML frontmatter 解析正则
 * 匹配 --- 开头和结尾的内容
 */
const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/**
 * 从描述中提取触发词
 * 
 * 支持格式：
 * - "触发词：天气、气温、下雨"
 * - "Triggers: weather, temperature"
 * - 或直接使用英文描述中的关键词
 * 
 * @param description 技能描述
 * @returns 触发词数组
 */
export function extractTriggers(description: string): string[] {
  const triggers: string[] = [];
  
  // 中文格式：触发词：天气、气温、下雨
  const cnMatch = description.match(/触发词[：:]\s*([^\n]+)/);
  if (cnMatch) {
    const words = cnMatch[1].split(/[、,，]/).map(w => w.trim()).filter(w => w);
    triggers.push(...words);
  }
  
  // 英文格式：triggers: weather, temperature
  const enMatch = description.match(/triggers?\s*:\s*([^\n]+)/i);
  if (enMatch) {
    const words = enMatch[1].split(/[,，]/).map(w => w.trim()).filter(w => w);
    triggers.push(...words);
  }
  
  // 如果没有明确的触发词，从描述中提取关键词
  if (triggers.length === 0) {
    // 提取引号中的词
    const quotedWords = description.match(/["']([^"']+)["']/g);
    if (quotedWords) {
      triggers.push(...quotedWords.map(w => w.replace(/["']/g, '').trim()));
    }
  }
  
  // 去重
  return [...new Set(triggers)];
}

/**
 * 解析 YAML frontmatter（简单实现，不依赖外部库）
 * 
 * @param content 文件内容
 * @returns 解析结果 { frontmatter, body }
 */
export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(FRONTMATTER_REGEX);
  
  if (!match) {
    // 没有 frontmatter，整个内容都是 body
    return { frontmatter: {}, body: content.trim() };
  }
  
  const yamlContent = match[1];
  const body = match[2].trim();
  const frontmatter: Record<string, unknown> = {};
  
  // 简单 YAML 解析（支持基本键值对和嵌套对象）
  const lines = yamlContent.split('\n');
  let currentObject: Record<string, unknown> | null = null;
  
  for (const line of lines) {
    // 跳过空行和注释
    if (!line.trim() || line.trim().startsWith('#')) {
      continue;
    }
    
    // 嵌套对象（如 metadata:）
    if (line.startsWith('  ') && currentObject !== null) {
      const nestedMatch = line.match(/^\s+(\w+)\s*:\s*(.+)$/);
      if (nestedMatch) {
        const [, key, value] = nestedMatch;
        // 解析数组值
        if (value.startsWith('[') && value.endsWith(']')) {
          const arrayContent = value.slice(1, -1);
          const items = arrayContent.split(',').map(s => s.trim().replace(/["']/g, '')).filter(s => s);
          currentObject[key] = items;
        } else {
          currentObject[key] = parseValue(value);
        }
      }
      continue;
    }
    
    // 顶级键值对
    const match = line.match(/^(\w+)\s*:\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      
      // 检查是否是嵌套对象的开始（值为空或空对象）
      if (value === '' || value === '{}') {
        currentObject = {};
        frontmatter[key] = currentObject;
      } else {
        currentObject = null;
        frontmatter[key] = parseValue(value);
      }
    }
  }
  
  return { frontmatter, body };
}

/**
 * 解析 YAML 值
 */
function parseValue(value: string): unknown {
  const trimmed = value.trim();
  
  // 字符串（引号包裹）
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  
  // 布尔值
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  
  // 数字
  const num = Number(trimmed);
  if (!isNaN(num)) return num;
  
  // 数组
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const arrayContent = trimmed.slice(1, -1);
    return arrayContent.split(',').map(s => s.trim().replace(/["']/g, '')).filter(s => s);
  }
  
  // 默认作为字符串
  return trimmed;
}

/**
 * 加载单个技能的元数据（不加载内容）
 * 
 * 用于渐进式披露：启动时只加载元数据，内容按需加载
 * 
 * @param skillPath SKILL.md 文件路径
 * @returns 加载结果
 */
export async function loadSkillMetadata(skillPath: string): Promise<LoadMetadataResult> {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(skillPath)) {
      return {
        success: false,
        error: `Skill file not found: ${skillPath}`,
        path: skillPath
      };
    }
    
    // 读取文件内容
    const content = await fs.promises.readFile(skillPath, 'utf-8');
    
    // 解析 frontmatter
    const { frontmatter } = parseFrontmatter(content);
    
    // 验证必填字段
    const name = frontmatter.name as string | undefined;
    const description = frontmatter.description as string | undefined;
    
    if (!name) {
      return {
        success: false,
        error: `Missing required field 'name' in ${skillPath}`,
        path: skillPath
      };
    }
    
    if (!description) {
      return {
        success: false,
        error: `Missing required field 'description' in ${skillPath}`,
        path: skillPath
      };
    }
    
    // 提取触发词
    const triggers = extractTriggers(description);
    
    // 构建轻量元数据对象（不含 content）
    const metadata: SkillMetadataLite = {
      name,
      description,
      triggers,
      path: skillPath,
      homepage: frontmatter.homepage as string | undefined,
      metadata: frontmatter.metadata as SkillMetadata | undefined,
      priority: (frontmatter.metadata as SkillMetadata | undefined)?.priority ?? 0
    };
    
    return {
      success: true,
      metadata,
      path: skillPath
    };
    
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to load skill metadata: ${error}`,
      path: skillPath
    };
  }
}

/**
 * 扫描目录并加载所有技能元数据（不加载内容）
 * 
 * 用于渐进式披露：启动时快速加载，内容按需加载
 * 
 * @param skillsDir 技能目录
 * @returns 加载的元数据数组
 */
export async function loadAllSkillMetadatas(skillsDir: string): Promise<SkillMetadataLite[]> {
  const metadatas: SkillMetadataLite[] = []; 
  
  console.log(`[SkillLoader] Loading skill metadatas from: ${skillsDir}`);
  
  // 确保目录存在
  if (!fs.existsSync(skillsDir)) {
    // 创建目录
    console.log(`[SkillLoader] Directory not found, creating: ${skillsDir}`);
    await fs.promises.mkdir(skillsDir, { recursive: true });
    return metadatas;
  }
  
  // 读取目录内容
  const entries = await fs.promises.readdir(skillsDir, { withFileTypes: true });
  console.log(`[SkillLoader] Found ${entries.filter(e => e.isDirectory()).length} skill directories`);
  
  // 遍历子目录
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const skillDir = pathModule.join(skillsDir, entry.name);
    const skillFile = pathModule.join(skillDir, 'SKILL.md');
    
    console.log(`[SkillLoader] Loading metadata: ${entry.name}/SKILL.md`);
    
    // 加载技能元数据
    const result = await loadSkillMetadata(skillFile);
    if (result.success && result.metadata) {
      console.log(`[SkillLoader] ✅ Loaded metadata: ${result.metadata.name} (triggers: ${result.metadata.triggers.join(', ')})`);
      metadatas.push(result.metadata);
    } else {
      console.log(`[SkillLoader] ❌ Failed: ${result.error}`);
    }
  }
  
  return metadatas;
}

/**
 * 加载技能内容（从文件读取 body）
 * 
 * 用于渐进式披露：首次访问时才加载内容
 * 
 * @param skillPath SKILL.md 文件路径
 * @returns 技能内容（Markdown 正文）
 */
export async function loadSkillContent(skillPath: string): Promise<string> {
  const content = await fs.promises.readFile(skillPath, 'utf-8');
  const { body } = parseFrontmatter(content);
  return body;
}

/**
 * 加载单个技能文件
 * 
 * @param skillPath SKILL.md 文件路径
 * @returns 加载结果
 */
export async function loadSkill(skillPath: string): Promise<LoadSkillResult> {
  try {
    // 检查文件是否存在
    if (!fs.existsSync(skillPath)) {
      return {
        success: false,
        error: `Skill file not found: ${skillPath}`,
        path: skillPath
      };
    }
    
    // 读取文件内容
    const content = await fs.promises.readFile(skillPath, 'utf-8');
    
    // 解析 frontmatter
    const { frontmatter, body } = parseFrontmatter(content);
    
    // 验证必填字段
    const name = frontmatter.name as string | undefined;
    const description = frontmatter.description as string | undefined;
    
    if (!name) {
      return {
        success: false,
        error: `Missing required field 'name' in ${skillPath}`,
        path: skillPath
      };
    }
    
    if (!description) {
      return {
        success: false,
        error: `Missing required field 'description' in ${skillPath}`,
        path: skillPath
      };
    }
    
    // 提取触发词
    const triggers = extractTriggers(description);
    
    // 构建技能对象
    const skill: Skill = {
      name,
      description,
      triggers,
      content: body,
      path: skillPath,
      homepage: frontmatter.homepage as string | undefined,
      metadata: frontmatter.metadata as SkillMetadata | undefined,
      priority: (frontmatter.metadata as SkillMetadata | undefined)?.priority ?? 0
    };
    
    return {
      success: true,
      skill,
      path: skillPath
    };
    
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Failed to load skill: ${error}`,
      path: skillPath
    };
  }
}

/**
 * 扫描目录并加载所有技能
 * 
 * @param skillsDir 技能目录
 * @returns 加载的技能数组
 */
export async function loadAllSkills(skillsDir: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  
  console.log(`[SkillLoader] Loading skills from: ${skillsDir}`);
  
  // 确保目录存在
  if (!fs.existsSync(skillsDir)) {
    // 创建目录
    console.log(`[SkillLoader] Directory not found, creating: ${skillsDir}`);
    await fs.promises.mkdir(skillsDir, { recursive: true });
    return skills;
  }
  
  // 读取目录内容
  const entries = await fs.promises.readdir(skillsDir, { withFileTypes: true });
  console.log(`[SkillLoader] Found ${entries.filter(e => e.isDirectory()).length} skill directories`);
  
  // 遍历子目录
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const skillDir = pathModule.join(skillsDir, entry.name);
    const skillFile = pathModule.join(skillDir, 'SKILL.md');
    
    console.log(`[SkillLoader] Loading: ${entry.name}/SKILL.md`);
    
    // 加载技能文件
    const result = await loadSkill(skillFile);
    if (result.success && result.skill) {
      console.log(`[SkillLoader] ✅ Loaded: ${result.skill.name} (triggers: ${result.skill.triggers.join(', ')})`);
      skills.push(result.skill);
    } else {
      console.log(`[SkillLoader] ❌ Failed: ${result.error}`);
    }
  }
  
  return skills;
}

/**
 * 获取默认技能目录
 */
export function getDefaultSkillsDir(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '/root';
  return pathModule.join(homeDir, '.miniclaw', 'skills');
}