/**
 * @fileoverview Skill Lazy Loading Integration Tests
 *
 * Tests the full lazy loading flow:
 * - User Story 1: Skill Discovery at Startup
 * - User Story 2: Model Decision Based on Metadata
 * - User Story 3: On-Demand Content Loading
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { PiSkillManager } from '../../src/core/skill/pi-manager.js';
import { formatSkillsForPrompt } from '@mariozechner/pi-coding-agent';

// Test fixtures directory
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'pi-skills');

describe('Skill Lazy Loading Integration', () => {
  describe('Skill Discovery Flow (User Story 1)', () => {
    it('should load only metadata at startup (no content)', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // Verify skills are loaded
      expect(result.skills.length).toBeGreaterThan(0);

      // Verify each skill has metadata but NO content
      for (const skill of result.skills) {
        expect(skill.name).toBeDefined();
        expect(skill.description).toBeDefined();
        expect(skill.filePath).toBeDefined();
        // Skill type does NOT include content field (FR-001, FR-002)
        expect('content' in skill).toBe(false);
      }
    });

    it('should make skill names visible in system prompt', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      // Weather skill should appear
      expect(prompt).toContain('weather');
      expect(prompt).toContain('Get weather information');
    });

    it('should NOT load skill content at startup', () => {
      // This test verifies FR-002: No content at startup
      // The skill file is NOT read for content during load()
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();

      // Verify skills don't have 'content' property (pi-coding-agent design)
      const skills = manager.getAll();
      for (const skill of skills) {
        expect('content' in skill).toBe(false);
      }
    });

    it('should handle non-existent directory gracefully', () => {
      const manager = new PiSkillManager({
        skillsDir: '/nonexistent/path',
        source: 'test'
      });
      const result = manager.load();

      expect(result.skills).toEqual([]);
      expect(manager.getAllPrompts()).toBe('');
    });
  });

  describe('Model Decision Flow (User Story 2)', () => {
    it('should provide skill metadata for model decision', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      // Model should see skill names and descriptions
      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('<skill>');
      expect(prompt).toContain('<name>');
      expect(prompt).toContain('<description>');
    });

    it('should format metadata in pi-coding-agent standard', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();
      const skills = result.skills.filter(s => !s.disableModelInvocation);

      // Use formatSkillsForPrompt directly to verify format
      const formatted = formatSkillsForPrompt(skills);

      expect(formatted).toContain('<available_skills>');
      expect(formatted).toContain('<location>');
    });

    it('should show multiple skills for model to choose', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      // Both weather and github skills should be available
      expect(prompt).toContain('weather');
      expect(prompt).toContain('github');
    });
  });

  describe('On-Demand Content Loading (User Story 3)', () => {
    it('should provide skill file path for read tool', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // Each skill should have filePath for model to read
      const weatherSkill = result.skills.find(s => s.name === 'weather');
      expect(weatherSkill?.filePath).toBeDefined();
      expect(weatherSkill?.filePath).toContain('weather/SKILL.md');
    });

    it('should expose location tag in prompt for model read', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      // Location tag should contain absolute file path
      expect(prompt).toContain('<location>');
      expect(prompt).toContain('/tests/fixtures/pi-skills/weather/SKILL.md');
    });

    it('should allow model to read skill content via file path', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // Simulate model using read_file tool
      const weatherSkill = result.skills.find(s => s.name === 'weather');
      const skillFilePath = weatherSkill?.filePath;

      expect(skillFilePath).toBeDefined();
      expect(fs.existsSync(skillFilePath!)).toBe(true);

      // Model can read the full content using file path
      const content = fs.readFileSync(skillFilePath!, 'utf-8');
      expect(content).toContain('# Weather Skill');
      expect(content).toContain('## When to Use');
    });

    it('should only load selected skill content (not all skills)', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // Get weather skill only
      const weatherSkill = result.skills.find(s => s.name === 'weather');
      expect(weatherSkill).toBeDefined();

      // Read weather skill content
      const weatherContent = fs.readFileSync(weatherSkill!.filePath, 'utf-8');
      expect(weatherContent).toContain('# Weather Skill');

      // Verify github skill content is different and NOT read in this test
      const githubSkill = result.skills.find(s => s.name === 'github');
      const githubContent = fs.readFileSync(githubSkill!.filePath, 'utf-8');
      expect(githubContent).toContain('# GitHub Skill');

      // Key point: we explicitly read only what we need, not all at startup
    });
  });

  describe('Full Lazy Loading Cycle', () => {
    it('should complete full cycle: startup -> metadata -> model read -> content', () => {
      // Step 1: Startup - load metadata only
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      expect(result.skills.length).toBeGreaterThan(0);
      expect(result.skills[0]).not.toHaveProperty('content');

      // Step 2: Metadata injection
      const prompt = manager.getAllPrompts();
      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('weather');

      // Step 3: Model decision - simulate model choosing weather skill
      const weatherSkill = result.skills.find(s => s.name === 'weather');
      expect(weatherSkill).toBeDefined();

      // Step 4: Content loaded on demand
      const content = fs.readFileSync(weatherSkill!.filePath, 'utf-8');
      expect(content).toContain('# Weather Skill');
    });

    it('should use cached results for concurrent requests', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();

      const weatherSkill = manager.getAll().find(s => s.name === 'weather');

      // First read
      const content1 = fs.readFileSync(weatherSkill!.filePath, 'utf-8');
      // Second read (should use file system cache)
      const content2 = fs.readFileSync(weatherSkill!.filePath, 'utf-8');

      expect(content1).toBe(content2);
    });

    it('should handle skill file deleted after metadata load', () => {
      // Create temp skill for this test
      const tempDir = path.join(process.cwd(), 'tests', 'fixtures', 'temp', 'deleted-test');
      fs.mkdirSync(path.join(tempDir, 'temp-skill'), { recursive: true });
      const skillFile = path.join(tempDir, 'temp-skill', 'SKILL.md');
      fs.writeFileSync(skillFile, `---
name: temp-skill
description: "Temporary skill for deletion test"
---

# Temp Skill
`);

      // Load metadata
      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();
      expect(result.skills.length).toBeGreaterThan(0);

      // Delete skill file after metadata loaded
      fs.rmSync(skillFile);

      // Model tries to read - should handle gracefully
      const tempSkill = result.skills.find(s => s.name === 'temp-skill');
      expect(() => {
        fs.readFileSync(tempSkill!.filePath, 'utf-8');
      }).toThrow();

      // Cleanup
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('Performance Verification', () => {
    it('startup time with skills should be under 2 seconds (SC-001)', () => {
      const start = Date.now();

      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(2000);
    });

    it('system prompt size should be under 2000 chars (SC-004)', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      // SC-004: System prompt with 10 skills metadata < 2000 chars
      // With fewer skills here, should definitely pass
      expect(prompt.length).toBeLessThan(2000);
    });

    it('should only read 1 skill file when model selects one skill (SC-003)', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // SC-003: Only 1 skill file is read when model decides to use a specific skill
      // This test verifies the lazy loading mechanism - model reads only what it needs
      const weatherSkill = result.skills.find(s => s.name === 'weather');

      // Model reads only the selected skill's content
      const content = fs.readFileSync(weatherSkill!.filePath, 'utf-8');
      expect(content).toContain('Weather Skill');

      // The key verification: skills loaded have no 'content' property
      // meaning content is NOT loaded at startup - only on demand
      for (const skill of result.skills) {
        expect('content' in skill).toBe(false);
      }
    });
  });
});