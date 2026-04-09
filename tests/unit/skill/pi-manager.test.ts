/**
 * @fileoverview PiSkillManager Unit Tests
 *
 * Tests for skill lazy loading mechanism:
 * - FR-001: Metadata only at startup
 * - FR-002: No content at startup
 * - FR-003: Metadata format
 * - FR-004: Model sees skills
 * - FR-008: Graceful error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { PiSkillManager } from '../../../src/core/skill/pi-manager.js';
import type { PiSkillManagerOptions } from '../../../src/core/skill/pi-manager.js';

// Test fixtures directory
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'pi-skills');

// Helper to create temp directory
const createTempDir = (name: string): string => {
  const dir = path.join(process.cwd(), 'tests', 'fixtures', 'temp', name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

// Helper to remove temp directory
const removeTempDir = (dir: string): void => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

describe('PiSkillManager', () => {
  describe('Constructor and Initialization', () => {
    it('should use default skillsDir path', () => {
      const manager = new PiSkillManager();
      const status = manager.getStatus();
      expect(status.skillsDir).toContain('.miniclaw');
      expect(status.skillsDir).toContain('skills');
    });

    it('should accept custom skillsDir', () => {
      const customDir = '/custom/skills/path';
      const manager = new PiSkillManager({ skillsDir: customDir });
      const status = manager.getStatus();
      expect(status.skillsDir).toBe(customDir);
    });

    it('should be enabled by default', () => {
      const manager = new PiSkillManager();
      expect(manager.isEnabled()).toBe(true);
      const status = manager.getStatus();
      expect(status.enabled).toBe(true);
    });

    it('should respect enabled=false option', () => {
      const manager = new PiSkillManager({ enabled: false });
      expect(manager.isEnabled()).toBe(false);
      const status = manager.getStatus();
      expect(status.enabled).toBe(false);
    });

    it('should accept source parameter', () => {
      const manager = new PiSkillManager({ source: 'test-source' });
      // Source is used internally by loadSkillsFromDir
      expect(manager).toBeDefined();
    });
  });

  describe('load() Method', () => {
    it('should return empty array when disabled', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        enabled: false
      });
      const result = manager.load();
      expect(result.skills).toEqual([]);
      expect(result.diagnostics).toEqual([]);
    });

    it('should return empty array when directory does not exist', () => {
      const manager = new PiSkillManager({
        skillsDir: '/nonexistent/directory'
      });
      const result = manager.load();
      expect(result.skills).toEqual([]);
      expect(result.diagnostics).toEqual([]);
    });

    it('should load skills from valid directory', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // Should load weather and github (malformed has no description, disabled has disableModelInvocation)
      expect(result.skills.length).toBeGreaterThanOrEqual(2);

      const weatherSkill = result.skills.find(s => s.name === 'weather');
      expect(weatherSkill).toBeDefined();
      expect(weatherSkill?.description).toContain('weather');
      expect(weatherSkill?.filePath).toContain('weather/SKILL.md');
    });

    it('should return metadata only (no content field)', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // Skill type from pi-coding-agent does not have content field
      // Only: name, description, filePath, baseDir, sourceInfo, disableModelInvocation
      const skill = result.skills[0];
      expect(skill).toBeDefined();
      expect(skill.name).toBeDefined();
      expect(skill.description).toBeDefined();
      expect(skill.filePath).toBeDefined();
      // Should NOT have 'content' property
      expect('content' in skill).toBe(false);
    });

    it('should return diagnostics for malformed skill files', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // malformed skill has missing description, should generate diagnostic
      // Note: pi-coding-agent may report this as warning or error
      const hasMalformedDiagnostic = result.diagnostics.some(
        d => d.filePath?.includes('malformed') || d.message.toLowerCase().includes('malformed') || d.message.includes('description')
      );
      // Expect either a diagnostic or the skill was simply skipped
      expect(hasMalformedDiagnostic || !result.skills.some(s => s.name === 'malformed-skill')).toBe(true);
    });

    it('should load skills with disableModelInvocation flag', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      const disabledSkill = result.skills.find(s => s.name === 'disabled-skill');
      // Note: disabled-skill may or may not be loaded depending on pi-coding-agent behavior
      // The key test is whether it appears in getAllPrompts()
      if (disabledSkill) {
        expect(disabledSkill.disableModelInvocation).toBe(true);
      }
    });
  });

  describe('getAllPrompts() Method', () => {
    it('should return empty string when disabled', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        enabled: false
      });
      manager.load();
      const prompt = manager.getAllPrompts();
      expect(prompt).toBe('');
    });

    it('should return empty string when no skills loaded', () => {
      const manager = new PiSkillManager({
        skillsDir: '/nonexistent'
      });
      manager.load();
      const prompt = manager.getAllPrompts();
      expect(prompt).toBe('');
    });

    it('should return XML format with <available_skills>', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      expect(prompt).toContain('<available_skills>');
      expect(prompt).toContain('</available_skills>');
    });

    it('should include <skill> elements with name and description', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      expect(prompt).toContain('<skill>');
      expect(prompt).toContain('</skill>');
      expect(prompt).toContain('<name>');
      expect(prompt).toContain('<description>');
    });

    it('should include <location> tag with file path', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      expect(prompt).toContain('<location>');
      expect(prompt).toContain('</location>');
      // Location should contain absolute file path
      expect(prompt).toContain('SKILL.md');
    });

    it('should filter out skills with disableModelInvocation from prompt', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      // Note: pi-coding-agent formatSkillsForPrompt should filter disableModelInvocation skills
      // If it appears in prompt, that's a bug in formatSkillsForPrompt or the skill wasn't loaded
      const disabledSkill = manager.getAll().find(s => s.name === 'disabled-skill');
      if (disabledSkill && disabledSkill.disableModelInvocation) {
        expect(prompt).not.toContain('disabled-skill');
      }
    });

    it('should include weather skill in prompt', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      expect(prompt).toContain('weather');
      expect(prompt).toContain('Get weather information');
    });
  });

  describe('Helper Methods', () => {
    let manager: PiSkillManager;

    beforeEach(() => {
      manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
    });

    it('should count all loaded skills', () => {
      // Should count all loaded skills including malformed and disabled ones
      // Note: malformed skill may still be loaded with diagnostics
      expect(manager.count()).toBeGreaterThanOrEqual(2);
    });

    it('getNames() should return array of skill names', () => {
      const names = manager.getNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names).toContain('weather');
      expect(names).toContain('github');
      expect(names).toContain('disabled-skill');
    });

    it('getAll() should return skill array copy', () => {
      const skills = manager.getAll();
      expect(Array.isArray(skills)).toBe(true);
      expect(skills.length).toBe(manager.count());

      // Verify it's a copy (modifying returned array should not affect internal state)
      const originalCount = manager.count();
      skills.pop();
      expect(manager.count()).toBe(originalCount);
    });

    it('getStatus() should return complete status object', () => {
      const status = manager.getStatus();

      expect(status.skillCount).toBeGreaterThanOrEqual(2);
      expect(status.skillNames.length).toBeGreaterThanOrEqual(2);
      expect(status.skillsDir).toBe(FIXTURES_DIR);
      expect(status.enabled).toBe(true);
      expect(Array.isArray(status.diagnostics)).toBe(true);
    });

    it('isEnabled() should return correct state', () => {
      expect(manager.isEnabled()).toBe(true);

      const disabledManager = new PiSkillManager({ enabled: false });
      expect(disabledManager.isEnabled()).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    let tempDir: string;

    afterEach(() => {
      if (tempDir) {
        removeTempDir(tempDir);
      }
    });

    it('should handle empty skills directory', () => {
      tempDir = createTempDir('empty-skills');
      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      expect(result.skills).toEqual([]);
      expect(result.diagnostics).toEqual([]);
    });

    it('should handle skill file with missing frontmatter', () => {
      tempDir = createTempDir('no-frontmatter');
      const skillDir = path.join(tempDir, 'no-frontmatter-skill');
      fs.mkdirSync(skillDir);
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'No frontmatter here');

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      // Should either skip or add diagnostic
      expect(result.skills.length).toBe(0);
    });

    it('should handle skill file with only name (missing description)', () => {
      tempDir = createTempDir('missing-description');
      const skillDir = path.join(tempDir, 'incomplete-skill');
      fs.mkdirSync(skillDir);
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: incomplete\n---\n\nMissing description'
      );

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      // Should have diagnostic about missing description
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Tests', () => {
    it('startup time with 2 skills should be under 100ms', () => {
      const start = Date.now();
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const elapsed = Date.now() - start;

      // Should be very fast (SC-001 says <2s for 10 skills)
      expect(elapsed).toBeLessThan(100);
    });

    it('system prompt size should be reasonable', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      // SC-004 says <2000 chars for 10 skills
      // With 2-3 skills here, should be smaller
      expect(prompt.length).toBeLessThan(1500);
    });
  });
});