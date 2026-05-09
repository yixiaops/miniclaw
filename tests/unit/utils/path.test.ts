/**
 * Path normalization utility tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('normalizePath', () => {
  let normalizePath: (p: string) => string;

  beforeEach(async () => {
    const mod = await import('../../../src/utils/path.js');
    normalizePath = mod.normalizePath;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should pass through Linux paths unchanged', () => {
    // Simulate non-Windows platform
    vi.stubGlobal('process', { ...process, platform: 'linux' });

    expect(normalizePath('/home/user/project')).toBe('/home/user/project');
    expect(normalizePath('/var/log/syslog')).toBe('/var/log/syslog');
    expect(normalizePath('/tmp/test.txt')).toBe('/tmp/test.txt');

    vi.unstubAllGlobals();
  });

  it('should pass through macOS paths unchanged', () => {
    vi.stubGlobal('process', { ...process, platform: 'darwin' });

    expect(normalizePath('/Users/john/Documents')).toBe('/Users/john/Documents');
    expect(normalizePath('/Applications/ClashX Pro.app')).toBe('/Applications/ClashX Pro.app');

    vi.unstubAllGlobals();
  });

  it('should convert Git Bash paths to Windows format on Windows', () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' });

    expect(normalizePath('/c/Users/test')).toBe('C:\\Users\\test');
    expect(normalizePath('/d/Projects/miniclaw')).toBe('D:\\Projects\\miniclaw');
    expect(normalizePath('/c/Users/Admin/Desktop/file.txt')).toBe('C:\\Users\\Admin\\Desktop\\file.txt');
    expect(normalizePath('/e/work/docs/readme.md')).toBe('E:\\work\\docs\\readme.md');

    vi.unstubAllGlobals();
  });

  it('should pass through Windows paths unchanged on Windows', () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' });

    expect(normalizePath('C:\\Users\\test')).toBe('C:\\Users\\test');
    expect(normalizePath('D:\\Projects\\src')).toBe('D:\\Projects\\src');
    expect(normalizePath('relative\\path')).toBe('relative\\path');

    vi.unstubAllGlobals();
  });

  it('should handle edge cases on Windows', () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' });

    // Empty string
    expect(normalizePath('')).toBe('');

    // Root only
    expect(normalizePath('/c/')).toBe('C:\\');

    // Not a Git Bash path (multi-letter prefix)
    expect(normalizePath('/home/user')).toBe('/home/user');

    // UNC paths
    expect(normalizePath('\\\\server\\share')).toBe('\\\\server\\share');

    vi.unstubAllGlobals();
  });

  it('should handle lowercase drive letters', () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' });

    expect(normalizePath('/d/projects/src')).toBe('D:\\projects\\src');
    expect(normalizePath('/a/data/file.csv')).toBe('A:\\data\\file.csv');

    vi.unstubAllGlobals();
  });
});
