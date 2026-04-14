/**
 * @fileoverview 敏感信息检测测试
 *
 * 测试敏感内容过滤功能。
 *
 * @module tests/unit/write/sensitive-detector.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SensitiveDetector } from '../../../src/memory/write/sensitive-detector.js';

describe('SensitiveDetector', () => {
  let detector: SensitiveDetector;

  beforeEach(() => {
    detector = new SensitiveDetector();
  });

  describe('detect', () => {
    it('should detect password', () => {
      const content = 'My password is secret123';

      const isSensitive = detector.detect(content);

      expect(isSensitive).toBe(true);
    });

    it('should detect API key', () => {
      const content = 'api_key: sk-xxxxxxxxxxxx';

      const isSensitive = detector.detect(content);

      expect(isSensitive).toBe(true);
    });

    it('should detect token', () => {
      const content = 'Bearer token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

      const isSensitive = detector.detect(content);

      expect(isSensitive).toBe(true);
    });

    it('should detect AWS key', () => {
      const content = 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';

      const isSensitive = detector.detect(content);

      expect(isSensitive).toBe(true);
    });

    it('should detect secret key', () => {
      const content = 'secret_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

      const isSensitive = detector.detect(content);

      expect(isSensitive).toBe(true);
    });

    it('should not detect normal content', () => {
      const content = 'User prefers dark mode';

      const isSensitive = detector.detect(content);

      expect(isSensitive).toBe(false);
    });

    it('should not detect preferences', () => {
      const content = 'I like Python programming';

      const isSensitive = detector.detect(content);

      expect(isSensitive).toBe(false);
    });

    it('should handle empty content', () => {
      const isSensitive = detector.detect('');

      expect(isSensitive).toBe(false);
    });
  });

  describe('getReason', () => {
    it('should return reason for detected sensitive content', () => {
      const content = 'My password is secret123';
      detector.detect(content);

      const reason = detector.getReason();

      expect(reason).toBeDefined();
      expect(reason).toContain('password');
    });

    it('should return empty string for non-sensitive content', () => {
      const content = 'User prefers Python';
      detector.detect(content);

      const reason = detector.getReason();

      expect(reason).toBe('');
    });
  });

  describe('patterns', () => {
    it('should have password pattern', () => {
      expect(detector.getPatterns().length).toBeGreaterThan(0);
    });

    it('should include common sensitive patterns', () => {
      const patterns = detector.getPatterns();
      const patternNames = patterns.map(p => p.name);

      expect(patternNames).toContain('password');
      expect(patternNames).toContain('api-key');
      expect(patternNames).toContain('token');
    });
  });
});