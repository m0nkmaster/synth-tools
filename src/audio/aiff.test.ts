import { describe, it, expect } from 'vitest';
import { parseAiff } from './aiff';

describe('parseAiff', () => {
  it('throws on invalid FORM header', () => {
    const invalid = new Uint8Array([0, 0, 0, 0]);
    expect(() => parseAiff(invalid)).toThrow('Invalid AIFF/AIFC header');
  });

  it('throws on missing COMM chunk', () => {
    const buf = new Uint8Array(12);
    buf.set([0x46, 0x4f, 0x52, 0x4d], 0); // FORM
    buf.set([0, 0, 0, 4], 4); // size
    buf.set([0x41, 0x49, 0x46, 0x46], 8); // AIFF
    expect(() => parseAiff(buf)).toThrow('Missing COMM chunk');
  });

  it('parses valid AIFF with COMM chunk', () => {
    const buf = new Uint8Array(38);
    buf.set([0x46, 0x4f, 0x52, 0x4d], 0); // FORM
    buf.set([0, 0, 0, 30], 4); // size
    buf.set([0x41, 0x49, 0x46, 0x46], 8); // AIFF
    buf.set([0x43, 0x4f, 0x4d, 0x4d], 12); // COMM
    buf.set([0, 0, 0, 18], 16); // COMM size
    buf.set([0, 1], 20); // channels
    buf.set([0, 0, 0x2c, 0x6a], 22); // numFrames = 11370
    
    const result = parseAiff(buf);
    expect(result.numFrames).toBe(11370);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].id).toBe('COMM');
  });
});
