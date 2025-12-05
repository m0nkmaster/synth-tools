import { describe, it, expect } from 'vitest';
import { parseAiff } from './aiff';

describe('pack building', () => {
  it('should parse valid AIFF structure', () => {
    // Create minimal valid AIFF
    const buffer = new ArrayBuffer(54);
    const view = new DataView(buffer);
    
    // FORM chunk
    view.setUint32(0, 0x464F524D); // 'FORM'
    view.setUint32(4, 46); // size
    view.setUint32(8, 0x41494646); // 'AIFF'
    
    // COMM chunk
    view.setUint32(12, 0x434F4D4D); // 'COMM'
    view.setUint32(16, 18); // size
    view.setUint16(20, 1); // channels
    view.setUint32(22, 1000); // numFrames
    view.setUint16(26, 16); // bitDepth
    // Sample rate (44100 as 80-bit float)
    view.setUint16(28, 0x400E);
    view.setUint32(30, 0xAC440000);
    view.setUint32(34, 0);
    view.setUint16(38, 0);
    
    // SSND chunk
    view.setUint32(40, 0x53534E44); // 'SSND'
    view.setUint32(44, 8); // size
    view.setUint32(48, 0); // offset
    view.setUint32(52, 0); // blockSize
    
    const uint8 = new Uint8Array(buffer);
    const result = parseAiff(uint8);
    
    expect(result.numFrames).toBe(1000);
    expect(result.sampleRate).toBeCloseTo(44100, -2);
    expect(result.chunks).toHaveLength(2);
  });

  it('should throw on invalid FORM header', () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setUint32(0, 0x12345678); // Invalid
    
    const uint8 = new Uint8Array(buffer);
    expect(() => parseAiff(uint8)).toThrow();
  });

  it('should throw on non-AIFF type', () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setUint32(0, 0x464F524D); // 'FORM'
    view.setUint32(4, 4);
    view.setUint32(8, 0x12345678); // Not 'AIFF'
    
    const uint8 = new Uint8Array(buffer);
    expect(() => parseAiff(uint8)).toThrow();
  });
});
