/**
 * @fileoverview 技能管理器测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SkillManager, createSkillManager } from '../../../src/core/skill/manager.js';
import type { Skill } from '../../../src/core/skill/types.js';

// 测试目录
const TEST_SKILLS_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'manager-skills');

// 测试技能
const testSkill: Skill = {
  name: 'test',
  description: '测试技能。触发词：测试',
  triggers: ['测试', 'test'],
  content: '# Test Skill\n\n这是测试内容。',
  path: '/test/SKILL.md',
  priority: 50
};

describe('SkillManager', () => {
  let manager: SkillManager;

  beforeEach(() => {
    // 创建不带自动加载的管理器
    manager = createSkillManager({ 
      skillsDir: TEST_SKILLS_DIR,
      autoLoad: false 
    });
  });

  afterEach(async () => {
    manager.clear();
    // 清理测试目录
    if (fs.existsSync(TEST_SKILLS_DIR)) {
      await fs.promises.rm(TEST_SKILLS_DIR, { recursive: true, force: true });
    }
  });

  describe('register and unregister', () => {
    it('should register a skill', () => {
      manager.register(testSkill);
      expect(manager.has('test')).toBe(true);
      expect(manager.count()).toBe(1);
    });

    it('should unregister a skill', () => {
      manager.register(testSkill);
      const result = manager.unregister('test');
      expect(result).toBe(true);
      expect(manager.has('test')).toBe(false);
    });

    it('should return false when unregistering non-existent skill', () => {
      const result = manager.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('get and getAll', () => {
    it('should get a skill by name', () => {
      manager.register(testSkill);
      const skill = manager.get('test');
      expect(skill).toBeDefined();
      expect(skill?.name).toBe('test');
    });

    it('should return undefined for non-existent skill', () => {
      const skill = manager.get('nonexistent');
      expect(skill).toBeUndefined();
    });

    it('should get all skills', () => {
      manager.register(testSkill);
      manager.register({ ...testSkill, name: 'test2' });
      
      const skills = manager.getAll();
      expect(skills.length).toBe(2);
    });
  });

  describe('match', () => {
    beforeEach(() => {
      manager.register(testSkill);
      manager.register({
        name: 'weather',
        description: '天气技能。触发词：天气',
        triggers: ['天气'],
        content: '# Weather',
        path: '/test/weather/SKILL.md',
        priority: 10
      });
    });

    it('should match skill by input', () => {
      const skill = manager.match('今天天气怎么样');
      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('weather');
    });

    it('should return null for no match', () => {
      const skill = manager.match('买个咖啡');
      expect(skill).toBeNull();
    });

    it('should return match details', () => {
      const result = manager.matchWithDetails('今天天气怎么样');
      expect(result).not.toBeNull();
      expect(result?.matchType).toBe('trigger');
      expect(result?.matchedKeyword).toBe('天气');
    });

    it('should find all matches', () => {
      const results = manager.matchAll('测试和天气');
      expect(results.length).toBe(2);
    });
  });

  describe('getPrompt', () => {
    it('should generate prompt for skill', async () => {
      manager.register(testSkill);
      const prompt = await manager.getPrompt('test');

      expect(prompt).toContain('## Active Skill: test');
      expect(prompt).toContain('# Test Skill');
    });

    it('should return empty string for non-existent skill', async () => {
      const prompt = await manager.getPrompt('nonexistent');
      expect(prompt).toBe('');
    });
  });

  describe('getBestMatchPrompt', () => {
    it('should return prompt for matched skill', async () => {
      manager.register(testSkill);
      const prompt = await manager.getBestMatchPrompt('测试一下');

      expect(prompt).toContain('## Active Skill: test');
    });

    it('should return empty string for no match', async () => {
      manager.register(testSkill);
      const prompt = await manager.getBestMatchPrompt('买个咖啡');
      expect(prompt).toBe('');
    });
  });

  describe('priority', () => {
    it('should sort skills by priority', () => {
      manager.register({ ...testSkill, name: 'low', priority: 1 });
      manager.register({ ...testSkill, name: 'high', priority: 100 });
      manager.register({ ...testSkill, name: 'medium', priority: 50 });
      
      const sorted = manager.getSortedByPriority();
      expect(sorted[0].name).toBe('high');
      expect(sorted[1].name).toBe('medium');
      expect(sorted[2].name).toBe('low');
    });
  });

  describe('status', () => {
    it('should return status', () => {
      manager.register(testSkill);
      const status = manager.getStatus();
      
      expect(status.skillCount).toBe(1);
      expect(status.skillNames).toContain('test');
      expect(status.skillsDir).toBe(TEST_SKILLS_DIR);
    });
  });

  describe('clear', () => {
    it('should clear all skills', () => {
      manager.register(testSkill);
      manager.clear();
      
      expect(manager.count()).toBe(0);
      expect(manager.isLoaded()).toBe(false);
    });
  });

  describe('loadAll', () => {
    it('should load skills from directory', async () => {
      // 创建测试技能文件
      await fs.promises.mkdir(path.join(TEST_SKILLS_DIR, 'test'), { recursive: true });
      await fs.promises.writeFile(
        path.join(TEST_SKILLS_DIR, 'test', 'SKILL.md'),
        `---
name: loaded-skill
description: "Loaded skill. 触发词：loaded"
---
# Loaded Skill
Content here.
`
      );
      
      await manager.loadAll();
      
      expect(manager.isLoaded()).toBe(true);
      expect(manager.has('loaded-skill')).toBe(true);
    });
  });

  describe('reload', () => {
    it('should reload skills', async () => {
      manager.register(testSkill);
      expect(manager.count()).toBe(1);
      
      // 创建目录但不创建技能文件
      await fs.promises.mkdir(TEST_SKILLS_DIR, { recursive: true });
      
      await manager.reload();
      
      // 重新加载后，手动注册的技能会被清空
      expect(manager.isLoaded()).toBe(true);
    });
  });
});