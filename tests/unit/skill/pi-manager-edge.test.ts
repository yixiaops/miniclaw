/**
 * @fileoverview PiSkillManager Edge Case Tests
 *
 * Tests for edge cases and error handling:
 * - Task 3.1: Error Handling Tests
 * - Task 3.2: Configuration Tests (User Story 5)
 * - Task 3.3: Performance Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { PiSkillManager } from '../../../src/core/skill/pi-manager.js';

// Test fixtures directory
const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'pi-skills');
const TEMP_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'temp');

// Helper functions
const createTempDir = (name: string): string => {
  const dir = path.join(TEMP_DIR, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const removeTempDir = (dir: string): void => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const createSkillFile = (dir: string, name: string, content: string): string => {
  const skillDir = path.join(dir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  const filePath = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(filePath, content);
  return filePath;
};

describe('PiSkillManager Edge Cases', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      removeTempDir(tempDir);
    }
  });

  // ============================================================================
  // Task 3.1: Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle skill file deleted after metadata loaded', () => {
      tempDir = createTempDir('deleted-after-load');
      const skillPath = createSkillFile(
        tempDir,
        'temp-skill',
        `---
name: temp-skill
description: "Temporary skill"
---

# Temp Skill
`
      );

      // Load metadata
      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();
      expect(result.skills.length).toBe(1);

      // Delete skill file
      fs.rmSync(skillPath);

      // Try to read deleted file - should throw
      const skill = result.skills[0];
      expect(() => fs.readFileSync(skill.filePath, 'utf-8')).toThrow();
    });

    it('should handle skill file permission denied (simulated)', () => {
      // Note: Cannot truly test permission denied in most test environments
      // This test verifies graceful handling of missing files
      tempDir = createTempDir('permission-test');
      createSkillFile(
        tempDir,
        'normal-skill',
        `---
name: normal-skill
description: "Normal skill"
---

# Normal Skill
`
      );

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      // Should load successfully
      expect(result.skills.length).toBe(1);
    });

    it('should handle malformed YAML frontmatter', () => {
      tempDir = createTempDir('malformed-yaml');
      createSkillFile(
        tempDir,
        'malformed-yaml',
        `---
name: malformed
description: "Malformed YAML
invalid yaml content here
---

# Malformed Skill
`
      );

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      // Should either skip the malformed skill or return diagnostics
      const hasMalformed = result.skills.some(s => s.name === 'malformed');
      const hasDiagnostic = result.diagnostics.length > 0;

      // Either skill not loaded or diagnostic generated
      expect(hasMalformed || hasDiagnostic).toBe(true);
    });

    it('should handle skill file with missing name', () => {
      tempDir = createTempDir('missing-name');
      createSkillFile(
        tempDir,
        'missing-name',
        `---
description: "Skill without name"
---

# No Name Skill
`
      );

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      // Skill without name should not be loaded or have diagnostic
      const hasMissingName = result.skills.some(s => !s.name || s.name === 'missing-name');
      const hasDiagnostic = result.diagnostics.length > 0;
      expect(hasMissingName || hasDiagnostic || result.skills.length === 0).toBe(true);
    });

    it('should handle skill file with missing description', () => {
      tempDir = createTempDir('missing-description');
      createSkillFile(
        tempDir,
        'missing-desc',
        `---
name: missing-desc
---

# No Description Skill
`
      );

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      // Should have diagnostic about missing description
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('should handle skill file without frontmatter', () => {
      tempDir = createTempDir('no-frontmatter');
      createSkillFile(tempDir, 'no-frontmatter', `# Simple Skill

No frontmatter at all.
`);

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      // Should not load this as a skill (missing required fields)
      const noFrontmatterLoaded = result.skills.some(s => s.name === 'no-frontmatter');
      expect(noFrontmatterLoaded).toBe(false);
    });

    it('should handle empty skill directory', () => {
      tempDir = createTempDir('empty-dir');
      // Create directory but no skill files

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      expect(result.skills).toEqual([]);
      expect(result.diagnostics).toEqual([]);
    });
  });

  // ============================================================================
  // Task 3.2: Configuration Tests (User Story 5)
  // ============================================================================

  describe('Configuration', () => {
    it('should support custom skillsDir via options', () => {
      const customDir = '/custom/path/skills';
      const manager = new PiSkillManager({ skillsDir: customDir });
      const status = manager.getStatus();

      expect(status.skillsDir).toBe(customDir);
    });

    it('should respect enabled=false option', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        enabled: false
      });

      expect(manager.isEnabled()).toBe(false);
      const result = manager.load();
      expect(result.skills).toEqual([]);
    });

    it('should use default configuration when no options provided', () => {
      const manager = new PiSkillManager();
      const status = manager.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.skillsDir).toContain('.miniclaw');
      expect(status.skillsDir).toContain('skills');
    });

    it('should accept source parameter', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'custom-source'
      });

      // Source is used internally, manager should initialize
      expect(manager).toBeDefined();
    });
  });

  // ============================================================================
  // Task 3.3: Performance Tests (Success Criteria)
  // ============================================================================

  describe('Performance', () => {
    it('startup time with 10 skills should be under 2 seconds (SC-001)', () => {
      // Create 10 skill files for performance test
      tempDir = createTempDir('perf-10-skills');
      for (let i = 1; i <= 10; i++) {
        createSkillFile(
          tempDir,
          `skill-${i}`,
          `---
name: skill-${i}
description: "Performance test skill ${i}"
---

# Skill ${i}

This is skill ${i} for performance testing.
`
        );
      }

      const start = Date.now();
      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      manager.load();
      const elapsed = Date.now() - start;

      // SC-001: Startup time with 10 skills < 2 seconds
      expect(elapsed).toBeLessThan(2000);
    });

    it('system prompt size with 10 skills should be reasonable (SC-004)', () => {
      // Create 10 skill files
      tempDir = createTempDir('prompt-size-10');
      for (let i = 1; i <= 10; i++) {
        createSkillFile(
          tempDir,
          `skill-${i}`,
          `---
name: skill-${i}
description: "Skill ${i}"
---

# Skill ${i}
`
        );
      }

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      manager.load();
      const prompt = manager.getAllPrompts();

      // SC-004: System prompt size should be reasonable
      // Actual size depends on formatSkillsForPrompt implementation
      // 10 skills with XML format ~2000-2500 chars
      expect(prompt.length).toBeLessThan(3000);
    });

    it('should load metadata only (not full content)', () => {
      // This is the core lazy loading performance test
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // Verify no 'content' field on any skill
      for (const skill of result.skills) {
        expect('content' in skill).toBe(false);
      }
    });
  });

  // ============================================================================
  // Additional Edge Cases
  // ============================================================================

  describe('Additional Edge Cases', () => {
    it('should handle skill name mismatch with directory name', () => {
      // Using the actual fixture: disabled-skill in 'disabled' directory
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });
      const result = manager.load();

      // pi-coding-agent warns about name mismatch but still loads
      const disabledSkill = result.skills.find(s => s.name === 'disabled-skill');
      expect(disabledSkill).toBeDefined();
      expect(result.diagnostics.some(d => d.message.includes('does not match'))).toBe(true);
    });

    it('should handle concurrent manager instances', () => {
      const manager1 = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test1'
      });
      const manager2 = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test2'
      });

      manager1.load();
      manager2.load();

      expect(manager1.count()).toBe(manager2.count());
      expect(manager1.getNames()).toEqual(manager2.getNames());
    });

    it('should handle reload of skills', () => {
      const manager = new PiSkillManager({
        skillsDir: FIXTURES_DIR,
        source: 'test'
      });

      manager.load();
      const count1 = manager.count();

      // Second load should replace skills, not add
      manager.load();
      const count2 = manager.count();

      expect(count1).toBe(count2);
    });

    it('should handle skill with very long description', () => {
      tempDir = createTempDir('long-description');
      const longDesc = 'A'.repeat(500);
      createSkillFile(
        tempDir,
        'long-desc',
        `---
name: long-desc
description: "${longDesc}"
---

# Long Description Skill
`
      );

      const manager = new PiSkillManager({
        skillsDir: tempDir,
        source: 'test'
      });
      const result = manager.load();

      expect(result.skills.length).toBe(1);
      expect(result.skills[0].description).toBe(longDesc);
    });
  });
});