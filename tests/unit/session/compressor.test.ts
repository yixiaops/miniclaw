import { describe, it, expect } from 'vitest';
import { SessionCompressor } from '../../../src/memory/session/compressor.js';

describe('SessionCompressor', () => {
  it('should not compress if messages <= 50', async () => {
    const compressor = new SessionCompressor();
    const session = { messages: Array(40).fill({ role: 'user', content: 'test' }) };

    const result = await compressor.compress(session);
    expect(result.messages.length).toBe(40);
  });

  it('should compress if messages > 50', async () => {
    const compressor = new SessionCompressor();
    const session = { messages: Array(100).fill({ role: 'user', content: 'test' }) };

    const result = await compressor.compress(session);
    expect(result.messages.length).toBeLessThan(100);
  });
});