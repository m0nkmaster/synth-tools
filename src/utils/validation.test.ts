/**
 * Tests for validation utilities
 */

import { describe, test, expect } from 'vitest';
import { clamp, validateSoundConfig, validateSoundConfigJSON, BOUNDS } from './validation';

describe('clamp', () => {
  test('clamps value below min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  test('clamps value above max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  test('returns value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
});

describe('validateSoundConfig', () => {
  const validConfig = {
    synthesis: { 
      layers: [{ 
        type: 'oscillator', 
        gain: 1, 
        oscillator: { waveform: 'sine', frequency: 440, detune: 0 } 
      }] 
    },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 },
    effects: {},
    timing: { duration: 1 },
    dynamics: { velocity: 0.8, normalize: true },
    metadata: { name: 'Test', category: 'other', description: '', tags: [] },
  };

  test('accepts valid config', () => {
    const result = validateSoundConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toBeDefined();
  });

  test('rejects missing required fields', () => {
    const result = validateSoundConfig({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('rejects out-of-range envelope values', () => {
    const result = validateSoundConfig({
      ...validConfig,
      envelope: { attack: 100, decay: 100, sustain: 5, release: 100 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('envelope'))).toBe(true);
  });

  test('rejects out-of-range filter values', () => {
    const result = validateSoundConfig({
      ...validConfig,
      filter: { type: 'lowpass', frequency: 50000, q: 200 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.path.includes('filter'))).toBe(true);
  });

  test('rejects invalid enum values', () => {
    const result = validateSoundConfig({
      ...validConfig,
      synthesis: {
        layers: [{
          type: 'invalid-type',
          gain: 1,
        }]
      }
    });
    expect(result.valid).toBe(false);
  });
});

describe('validateSoundConfigJSON', () => {
  test('rejects invalid JSON syntax', () => {
    const result = validateSoundConfigJSON('{ invalid json }');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('accepts valid JSON config', () => {
    const config = {
      synthesis: { 
        layers: [{ 
          type: 'oscillator', 
          gain: 1, 
          oscillator: { waveform: 'sine', frequency: 440, detune: 0 } 
        }] 
      },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 },
      effects: {},
      timing: { duration: 1 },
      dynamics: { velocity: 0.8, normalize: true },
      metadata: { name: 'Test', category: 'other', description: '', tags: [] },
    };
    const result = validateSoundConfigJSON(JSON.stringify(config));
    expect(result.valid).toBe(true);
  });
});

describe('BOUNDS', () => {
  test('exports parameter bounds', () => {
    expect(BOUNDS.envelope.attack.min).toBe(0.001);
    expect(BOUNDS.envelope.attack.max).toBe(5);
    expect(BOUNDS.oscillator.frequency.min).toBe(20);
    expect(BOUNDS.oscillator.frequency.max).toBe(20000);
    expect(BOUNDS.timing.duration.min).toBe(0.1);
    expect(BOUNDS.timing.duration.max).toBe(12);
  });
});
