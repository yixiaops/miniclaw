/**
 * @fileoverview 技能匹配器测试
 */

import { describe, it, expect } from 'vitest';
import { SkillMatcher, createMatcher } from '../../../src/core/skill/matcher.js';
import type { Skill } from '../../../src/core/skill/types.js';

// 测试用的技能
const weatherSkill: Skill = {
  name: 'weather',
  description: '获取天气和天气预报。触发词：天气、气温、下雨',
  triggers: ['天气', '气温', '下雨', 'weather'],
  content: '# Weather Skill',
  path: '/test/weather/SKILL.md',
  priority: 10
};

const githubSkill: Skill = {
  name: 'github',
  description: 'GitHub 操作。触发词：PR、issue、repo',
  triggers: ['PR', 'issue', 'repo', 'github'],
  content: '# GitHub Skill',
  path: '/test/github/SKILL.md',
  priority: 5
};

const fileSkill: Skill = {
  name: 'file',
  description: '文件操作。触发词：文件、读取、写入',
  triggers: ['文件', '读取', '写入', 'file'],
  content: '# File Skill',
  path: '/test/file/SKILL.md',
  priority: 0
};

describe('SkillMatcher', () => {
  const matcher = createMatcher();
  const skills = [weatherSkill, githubSkill, fileSkill];

  describe('matchSkill', () => {
    it('should match by trigger word', () => {
      const result = matcher.matchSkill(weatherSkill, '今天天气怎么样');
      expect(result).not.toBeNull();
      expect(result?.matchType).toBe('trigger');
      expect(result?.matchedKeyword).toBe('天气');
    });

    it('should be case insensitive by default', () => {
      const result = matcher.matchSkill(githubSkill, '帮我看下这个pr');
      expect(result).not.toBeNull();
      expect(result?.matchType).toBe('trigger');
    });

    it('should return null for no match', () => {
      const result = matcher.matchSkill(weatherSkill, '帮我写个代码');
      expect(result).toBeNull();
    });

    it('should match by description keywords', () => {
      const skill: Skill = {
        name: 'test',
        description: 'test skill for weather forecast',
        triggers: [],
        content: '',
        path: '',
        priority: 0
      };
      
      const result = matcher.matchSkill(skill, 'I need a weather forecast');
      // 描述匹配可能返回结果，取决于关键词提取
      // 这里只是测试不会崩溃
      expect(result?.matchType).toBe('description');
    });
  });

  describe('findBestMatch', () => {
    it('should find best match from multiple skills', () => {
      const result = matcher.findBestMatch(skills, '今天天气怎么样');
      expect(result).not.toBeNull();
      expect(result?.skill.name).toBe('weather');
    });

    it('should prefer trigger match over description match', () => {
      const result = matcher.findBestMatch(skills, '查看天气和文件');
      expect(result).not.toBeNull();
      expect(result?.matchType).toBe('trigger');
    });

    it('should return null when no match', () => {
      const result = matcher.findBestMatch(skills, '帮我买个咖啡');
      expect(result).toBeNull();
    });

    it('should consider priority for same match type', () => {
      // 创建两个有相同触发词但不同优先级的技能
      const highPriority: Skill = {
        name: 'high',
        description: 'High priority. 触发词：test',
        triggers: ['test'],
        content: '',
        path: '',
        priority: 100
      };
      
      const lowPriority: Skill = {
        name: 'low',
        description: 'Low priority. 触发词：test',
        triggers: ['test'],
        content: '',
        path: '',
        priority: 1
      };
      
      const result = matcher.findBestMatch([lowPriority, highPriority], 'test');
      expect(result?.skill.name).toBe('high');
    });
  });

  describe('findAllMatches', () => {
    it('should find all matching skills', () => {
      const results = matcher.findAllMatches(skills, '今天天气和文件操作');
      expect(results.length).toBeGreaterThan(0);
      
      const names = results.map(r => r.skill.name);
      expect(names).toContain('weather');
      expect(names).toContain('file');
    });

    it('should return empty array for no matches', () => {
      const results = matcher.findAllMatches(skills, '买个咖啡');
      expect(results).toEqual([]);
    });

    it('should sort by match type and priority', () => {
      const results = matcher.findAllMatches(skills, '天气和repo');
      
      // 触发词匹配应该排在前面
      expect(results[0].matchType).toBe('trigger');
    });
  });

  describe('case sensitivity', () => {
    it('should match case insensitive by default', () => {
      const result = matcher.matchSkill(githubSkill, 'GITHUB操作');
      expect(result).not.toBeNull();
    });

    it('should match case sensitive when configured', () => {
      const caseSensitiveMatcher = createMatcher({ caseSensitive: true });
      const result = caseSensitiveMatcher.matchSkill(githubSkill, 'GITHUB操作');
      // 大写 GITHUB 不匹配小写 github 触发词
      expect(result?.matchType).not.toBe('trigger');
    });
  });

  describe('multiple trigger matches', () => {
    it('should return first matching trigger', () => {
      const result = matcher.matchSkill(weatherSkill, '气温和天气都看看');
      expect(result).not.toBeNull();
      expect(result?.matchType).toBe('trigger');
      // 应该匹配到第一个找到的触发词
      expect(['气温', '天气']).toContain(result?.matchedKeyword);
    });
  });
});