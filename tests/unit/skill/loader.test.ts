/**
 * @fileoverview 技能加载器测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadSkill,
  loadAllSkills,
  extractTriggers,
  parseFrontmatter,
  getDefaultSkillsDir
} from '../../../src/core/skill/loader.js';
import type { Skill } from '../../../src/core/skill/types.js';

// 测试目录
const TEST_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'skills');

// 测试用的 SKILL.md 内容
const WEATHER_SKILL = `---
name: weather
description: "获取天气和天气预报。触发词：天气、气温、下雨、预报"
homepage: https://wttr.in
metadata:
  tools: ["web_fetch"]
  bins: ["curl"]
  priority: 10
---

# Weather Skill

获取当前天气和天气预报。

## When to Use

- "今天天气怎么样？"
- "明天会下雨吗？"

## Commands

\`\`\`bash
curl "wttr.in/Beijing?format=3"
\`\`\`
`;

const GITHUB_SKILL = `---
name: github
description: "GitHub 操作。触发词：PR、issue、repo"
---

# GitHub Skill

GitHub 仓库操作。
`;

const INVALID_SKILL = `---
name: test-skill
---

Missing description field.
`;

const NO_FRONTMATTER = `# Simple Skill

This is a skill without frontmatter.
`;

describe('SkillLoader', () => {
  beforeAll(async () => {
    // 创建测试目录和文件
    await fs.promises.mkdir(path.join(TEST_DIR, 'weather'), { recursive: true });
    await fs.promises.mkdir(path.join(TEST_DIR, 'github'), { recursive: true });
    await fs.promises.mkdir(path.join(TEST_DIR, 'invalid'), { recursive: true });
    await fs.promises.mkdir(path.join(TEST_DIR, 'simple'), { recursive: true });
    
    await fs.promises.writeFile(path.join(TEST_DIR, 'weather', 'SKILL.md'), WEATHER_SKILL);
    await fs.promises.writeFile(path.join(TEST_DIR, 'github', 'SKILL.md'), GITHUB_SKILL);
    await fs.promises.writeFile(path.join(TEST_DIR, 'invalid', 'SKILL.md'), INVALID_SKILL);
    await fs.promises.writeFile(path.join(TEST_DIR, 'simple', 'SKILL.md'), NO_FRONTMATTER);
  });

  afterAll(async () => {
    // 清理测试目录
    await fs.promises.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('extractTriggers', () => {
    it('should extract Chinese triggers', () => {
      const desc = '获取天气和天气预报。触发词：天气、气温、下雨';
      const triggers = extractTriggers(desc);
      expect(triggers).toContain('天气');
      expect(triggers).toContain('气温');
      expect(triggers).toContain('下雨');
    });

    it('should extract English triggers', () => {
      const desc = 'Get weather info. triggers: weather, temperature';
      const triggers = extractTriggers(desc);
      expect(triggers).toContain('weather');
      expect(triggers).toContain('temperature');
    });

    it('should return empty array for no triggers', () => {
      const desc = 'A simple skill description';
      const triggers = extractTriggers(desc);
      expect(triggers).toEqual([]);
    });

    it('should deduplicate triggers', () => {
      const desc = '触发词：天气、天气、气温';
      const triggers = extractTriggers(desc);
      expect(triggers.filter(t => t === '天气')).toHaveLength(1);
    });
  });

  describe('parseFrontmatter', () => {
    it('should parse valid frontmatter', () => {
      const result = parseFrontmatter(WEATHER_SKILL);
      expect(result.frontmatter.name).toBe('weather');
      expect(result.frontmatter.description).toBe('获取天气和天气预报。触发词：天气、气温、下雨、预报');
      expect(result.frontmatter.homepage).toBe('https://wttr.in');
    });

    it('should parse metadata', () => {
      const result = parseFrontmatter(WEATHER_SKILL);
      const metadata = result.frontmatter.metadata as Record<string, unknown>;
      expect(metadata?.tools).toEqual(['web_fetch']);
      expect(metadata?.bins).toEqual(['curl']);
    });

    it('should extract body content', () => {
      const result = parseFrontmatter(WEATHER_SKILL);
      expect(result.body).toContain('# Weather Skill');
      expect(result.body).toContain('## When to Use');
    });

    it('should handle no frontmatter', () => {
      const result = parseFrontmatter(NO_FRONTMATTER);
      expect(result.frontmatter).toEqual({});
      expect(result.body).toContain('Simple Skill');
    });
  });

  describe('loadSkill', () => {
    it('should load a valid skill', async () => {
      const skillPath = path.join(TEST_DIR, 'weather', 'SKILL.md');
      const result = await loadSkill(skillPath);
      
      expect(result.success).toBe(true);
      expect(result.skill).toBeDefined();
      expect(result.skill?.name).toBe('weather');
      expect(result.skill?.triggers).toContain('天气');
      expect(result.skill?.priority).toBe(10);
    });

    it('should fail for missing name field', async () => {
      const skillPath = path.join(TEST_DIR, 'invalid', 'SKILL.md');
      const result = await loadSkill(skillPath);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('description');
    });

    it('should fail for non-existent file', async () => {
      const result = await loadSkill('/nonexistent/SKILL.md');
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('loadAllSkills', () => {
    it('should load all valid skills from directory', async () => {
      const skills = await loadAllSkills(TEST_DIR);
      
      // 应该加载 weather 和 github（invalid 缺少 description）
      expect(skills.length).toBeGreaterThanOrEqual(1);
      
      const weatherSkill = skills.find(s => s.name === 'weather');
      expect(weatherSkill).toBeDefined();
    });

    it('should create directory if not exists', async () => {
      const newDir = path.join(TEST_DIR, 'new-skills');
      const skills = await loadAllSkills(newDir);
      
      expect(skills).toEqual([]);
      expect(fs.existsSync(newDir)).toBe(true);
    });
  });

  describe('getDefaultSkillsDir', () => {
    it('should return default path', () => {
      const dir = getDefaultSkillsDir();
      expect(dir).toContain('.miniclaw');
      expect(dir).toContain('skills');
    });
  });
});