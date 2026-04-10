/**
 * YAML frontmatter 解析器
 *
 * 解析包含 YAML frontmatter 的 markdown 文件
 */

import * as yaml from 'yaml';
import type {
  PromptTemplate,
  FrontmatterResult,
} from './types.js';

/**
 * 提取 YAML frontmatter
 *
 * @param content - 文件内容
 * @returns frontmatter 结构或 null
 */
export function extractYamlFrontmatter(
  content: string
): FrontmatterResult | null {
  // 检查是否以 --- 开头
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return null;
  }

  // 查找第二个 ---
  const endIndex = content.indexOf('\n---', 4);
  if (endIndex === -1) {
    return null;
  }

  // 提取 YAML 和 markdown 部分
  const yamlContent = content.slice(4, endIndex).trim();
  const markdownContent = content.slice(endIndex + 5).trim();

  try {
    const yamlData = yaml.parse(yamlContent) as Record<string, unknown>;
    return {
      yaml: yamlData || {},
      markdown: markdownContent,
    };
  } catch {
    // YAML 解析失败
    return null;
  }
}

/**
 * 解析 frontmatter 并生成 PromptTemplate
 *
 * @param content - 文件内容
 * @param filePath - 文件路径（可选）
 * @returns 解析后的模板
 */
export function parseFrontmatter(
  content: string,
  filePath?: string
): PromptTemplate {
  const result = extractYamlFrontmatter(content);

  // 无 frontmatter 或解析失败，返回原始内容
  if (!result) {
    return {
      name: 'unnamed',
      content: content.trim(),
      filePath,
      loadedAt: Date.now(),
    };
  }

  // 提取元数据
  const { yaml: yamlData, markdown } = result;

  return {
    name: (yamlData.name as string) || 'unnamed',
    description: yamlData.description as string | undefined,
    model: yamlData.model as string | undefined,
    tools: yamlData.tools as string[] | undefined,
    tags: yamlData.tags as string[] | undefined,
    version: yamlData.version as string | undefined,
    author: yamlData.author as string | undefined,
    content: markdown,
    filePath,
    loadedAt: Date.now(),
  };
}

/**
 * 验证模板元数据
 *
 * @param template - 模板对象
 * @returns 验证结果
 */
export function validateTemplate(template: PromptTemplate): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // name 是必需字段
  if (!template.name || template.name === 'unnamed') {
    errors.push('Template name is required');
  }

  // content 是必需字段
  if (!template.content || template.content.trim().length === 0) {
    errors.push('Template content cannot be empty');
  }

  // tools 字段格式验证
  if (template.tools && !Array.isArray(template.tools)) {
    errors.push('Template tools must be an array');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}