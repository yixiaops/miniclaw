/**
 * YAML frontmatter 解析器测试
 */
import { describe, it, expect } from 'vitest';
import {
  extractYamlFrontmatter,
  parseFrontmatter,
  validateTemplate,
} from '../../../../src/core/prompt/parser';
import type { PromptTemplate } from '../../../../src/core/prompt/types';

describe('extractYamlFrontmatter', () => {
  describe('valid frontmatter', () => {
    it('should extract simple frontmatter', () => {
      const content = `---
name: test-prompt
---
This is the content.`;

      const result = extractYamlFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.yaml).toEqual({ name: 'test-prompt' });
      expect(result?.markdown).toBe('This is the content.');
    });

    it('should extract frontmatter with multiple fields', () => {
      const content = `---
name: advanced-prompt
description: A test prompt
model: gpt-4
tools:
  - read
  - write
tags:
  - test
  - demo
version: 1.0.0
author: test-author
---
# Main Content

This is the markdown body.`;

      const result = extractYamlFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.yaml.name).toBe('advanced-prompt');
      expect(result?.yaml.description).toBe('A test prompt');
      expect(result?.yaml.model).toBe('gpt-4');
      expect(result?.yaml.tools).toEqual(['read', 'write']);
      expect(result?.yaml.tags).toEqual(['test', 'demo']);
      expect(result?.markdown).toContain('# Main Content');
    });

    it('should handle empty frontmatter', () => {
      const content = `---
name: unnamed
---
Content here`;

      const result = extractYamlFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.yaml).toEqual({ name: 'unnamed' });
      expect(result?.markdown).toBe('Content here');
    });
  });

  describe('invalid frontmatter', () => {
    it('should return null for content without frontmatter', () => {
      const content = 'Just plain content without frontmatter';
      const result = extractYamlFrontmatter(content);
      expect(result).toBeNull();
    });

    it('should return null for content not starting with ---', () => {
      const content = `Some text before
---
name: test
---
Content`;
      const result = extractYamlFrontmatter(content);
      expect(result).toBeNull();
    });

    it('should return null for unclosed frontmatter', () => {
      const content = `---
name: test
This has no closing delimiter`;
      const result = extractYamlFrontmatter(content);
      expect(result).toBeNull();
    });

    it('should return null for invalid YAML', () => {
      const content = `---
name: [invalid yaml
---
Content`;
      const result = extractYamlFrontmatter(content);
      expect(result).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle CRLF line endings', () => {
      const content = '---\r\nname: test\r\n---\r\nContent';
      const result = extractYamlFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.yaml.name).toBe('test');
    });

    it('should handle content with --- in markdown', () => {
      const content = `---
name: test
---
Some content

---

More content after horizontal rule`;

      const result = extractYamlFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.yaml.name).toBe('test');
      expect(result?.markdown).toContain('---');
    });

    it('should trim whitespace from content', () => {
      const content = `---
name: test
---

   Content with spaces   

`;
      const result = extractYamlFrontmatter(content);
      expect(result).not.toBeNull();
      expect(result?.markdown).toBe('Content with spaces');
    });
  });
});

describe('parseFrontmatter', () => {
  describe('with valid frontmatter', () => {
    it('should parse complete template', () => {
      const content = `---
name: my-template
description: A template for testing
model: claude-3
tools:
  - read
  - write
tags:
  - test
version: 1.0
author: developer
---
# System Prompt

You are a helpful assistant.`;

      const template = parseFrontmatter(content, '/path/to/template.md');

      expect(template.name).toBe('my-template');
      expect(template.description).toBe('A template for testing');
      expect(template.model).toBe('claude-3');
      expect(template.tools).toEqual(['read', 'write']);
      expect(template.tags).toEqual(['test']);
      expect(template.version).toBe(1); // YAML parses 1.0 as number 1
      expect(template.author).toBe('developer');
      expect(template.content).toContain('You are a helpful assistant.');
      expect(template.filePath).toBe('/path/to/template.md');
      expect(template.loadedAt).toBeDefined();
    });

    it('should parse minimal template', () => {
      const content = `---
name: simple
---
Just content`;

      const template = parseFrontmatter(content);

      expect(template.name).toBe('simple');
      expect(template.content).toBe('Just content');
      expect(template.filePath).toBeUndefined();
    });
  });

  describe('without frontmatter', () => {
    it('should return unnamed template for plain content', () => {
      const content = 'Just plain content without frontmatter';
      const template = parseFrontmatter(content);

      expect(template.name).toBe('unnamed');
      expect(template.content).toBe('Just plain content without frontmatter');
    });

    it('should preserve file path', () => {
      const content = 'Plain content';
      const template = parseFrontmatter(content, '/some/path.md');

      expect(template.filePath).toBe('/some/path.md');
    });
  });

  describe('edge cases', () => {
    it('should default name to unnamed if missing', () => {
      const content = `---
description: No name field
---
Content`;

      const template = parseFrontmatter(content);
      expect(template.name).toBe('unnamed');
    });

    it('should trim content', () => {
      const content = `---
name: test
---

  Content with leading/trailing spaces  

`;
      const template = parseFrontmatter(content);
      expect(template.content).toBe('Content with leading/trailing spaces');
    });
  });
});

describe('validateTemplate', () => {
  describe('valid templates', () => {
    it('should validate a complete template', () => {
      const template: PromptTemplate = {
        name: 'valid-template',
        content: 'This is valid content',
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate template with all optional fields', () => {
      const template: PromptTemplate = {
        name: 'complete-template',
        description: 'Full template',
        model: 'gpt-4',
        tools: ['read', 'write'],
        tags: ['test'],
        version: '1.0',
        author: 'test',
        content: 'Content here',
        filePath: '/path/to/file.md',
        loadedAt: Date.now(),
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid templates', () => {
    it('should fail for missing name', () => {
      const template: PromptTemplate = {
        name: 'unnamed',
        content: 'Valid content',
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template name is required');
    });

    it('should fail for empty name', () => {
      const template: PromptTemplate = {
        name: '',
        content: 'Valid content',
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template name is required');
    });

    it('should fail for empty content', () => {
      const template: PromptTemplate = {
        name: 'test',
        content: '',
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template content cannot be empty');
    });

    it('should fail for whitespace-only content', () => {
      const template: PromptTemplate = {
        name: 'test',
        content: '   \n\t  ',
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template content cannot be empty');
    });

    it('should fail for invalid tools type', () => {
      const template = {
        name: 'test',
        content: 'Valid content',
        tools: 'not-an-array' as unknown as string[],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template tools must be an array');
    });

    it('should collect multiple errors', () => {
      const template = {
        name: 'unnamed',
        content: '',
        tools: 'invalid' as unknown as string[],
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});