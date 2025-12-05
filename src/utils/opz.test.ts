import { describe, it, expect } from 'vitest';
import { encodePositions, calculateSliceBoundaries } from './opz';

describe('encodePositions', () => {
  it('scales frames by 4096', () => {
    expect(encodePositions([1])[0]).toBe(4096);
  });

  it('clamps to max position', () => {
    const result = encodePositions([999999999]);
    expect(result[0]).toBe(0x7ffffffe);
  });

  it('handles zero', () => {
    expect(encodePositions([0])[0]).toBe(0);
  });
});

describe('calculateSliceBoundaries', () => {
  it('calculates boundaries for single slice', () => {
    const result = calculateSliceBoundaries([1.0], 44100);
    expect(result.start[0]).toBe(0);
    expect(result.end[0]).toBeGreaterThan(0);
    expect(result.end[0]).toBeLessThan(44100);
  });

  it('pads to 24 slices', () => {
    const result = calculateSliceBoundaries([1.0], 44100);
    expect(result.start).toHaveLength(24);
    expect(result.end).toHaveLength(24);
  });

  it('handles multiple slices', () => {
    const result = calculateSliceBoundaries([0.5, 0.5], 44100);
    expect(result.start[0]).toBe(0);
    expect(result.end[0]).toBeGreaterThan(0);
    expect(result.start[1]).toBeGreaterThan(result.end[0]);
    expect(result.end[1]).toBeLessThan(44100);
  });

  it('clamps to total frames', () => {
    const result = calculateSliceBoundaries([2.0], 44100);
    expect(result.end[0]).toBeLessThan(44100);
  });
});
