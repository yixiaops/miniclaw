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

  describe('sorting by match type and priority', () => {
    it('should sort description matches after trigger matches', () => {
      // 创建一个触发词匹配和一个描述匹配的技能
      const triggerSkill: Skill = {
        name: 'trigger-match',
        description: '触发词匹配的技能。触发词：天气',
        triggers: ['天气'],
        content: '',
        path: '',
        priority: 1  // 低优先级
      };
      
      // 这个技能通过描述中的关键词匹配
      const descSkill: Skill = {
        name: 'desc-match',
        description: '这是一个forecast预报相关的技能',
        triggers: [],  // 没有触发词，只能通过描述关键词匹配
        content: '',
        path: '',
        priority: 100  // 高优先级
      };
      
      const results = matcher.findAllMatches([triggerSkill, descSkill], '今天天气怎么样');
      
      // 应该至少有触发词匹配
      expect(results.length).toBeGreaterThanOrEqual(1);
      
      // 触发词匹配应该在第一位
      expect(results[0].matchType).toBe('trigger');
      expect(results[0].skill.name).toBe('trigger-match');
      
      // 如果有描述匹配，应该排在触发词匹配后面
      if (results.length > 1 && results[1].matchType === 'description') {
        expect(results[1].skill.name).toBe('desc-match');
      }
    });

    it('should sort same match type by priority', () => {
      // 创建两个都是触发词匹配的技能，测试优先级排序
      const highPriority: Skill = {
        name: 'high-priority',
        description: '测试技能。触发词：test',
        triggers: ['test'],
        content: '',
        path: '',
        priority: 100
      };
      
      const lowPriority: Skill = {
        name: 'low-priority',
        description: '测试技能。触发词：test',
        triggers: ['test'],
        content: '',
        path: '',
        priority: 1
      };
      
      // 低优先级在前，但排序后高优先级应该排第一
      const results = matcher.findAllMatches([lowPriority, highPriority], 'test');
      
      expect(results[0].skill.name).toBe('high-priority');
      expect(results[0].skill.priority).toBe(100);
      expect(results[1].skill.name).toBe('low-priority');
      expect(results[1].skill.priority).toBe(1);
    });
  });
});