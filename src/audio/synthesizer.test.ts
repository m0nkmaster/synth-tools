import { describe, it, expect, test } from 'vitest';
import fc from 'fast-check';
import { synthesizeSound } from './synthesizer';
import type { SoundConfig } from '../types/soundConfig';

describe('synthesizeSound', () => {
  const baseConfig: SoundConfig = {
    synthesis: {
      layers: [{
        type: 'oscillator',
        gain: 1,
        oscillator: { waveform: 'sine', frequency: 440, detune: 0 }
      }]
    },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1, attackCurve: 'exponential', releaseCurve: 'exponential' },
    effects: {},
    spatial: { pan: 0, width: 1 },
    timing: { duration: 0.5 },
    dynamics: { velocity: 0.8, gain: 0, normalize: true },
    metadata: { name: 'Test', category: 'other', description: '', tags: [] }
  };

  it('should synthesize basic oscillator', async () => {
    const buffer = await synthesizeSound(baseConfig);
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.sampleRate).toBe(44100);
    expect(buffer.numberOfChannels).toBe(2);
  });

  it('should synthesize noise', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'noise',
          gain: 0.5,
          noise: { type: 'white' }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should synthesize pink noise', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'noise',
          gain: 0.5,
          noise: { type: 'pink' }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should synthesize FM', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'fm',
          gain: 0.7,
          fm: { carrier: 200, modulator: 400, modulationIndex: 30 }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply filter', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      filter: { type: 'lowpass', frequency: 1000, q: 2 }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply distortion', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      effects: {
        distortion: { type: 'soft', amount: 0.5, mix: 0.5 }
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply reverb', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      effects: {
        reverb: { type: 'room', size: 0.7, decay: 1.5, damping: 0.5, mix: 0.4, predelay: 10 }
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply delay', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      effects: {
        delay: { time: 0.25, feedback: 0.3, mix: 0.5, sync: false, pingPong: false }
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply compressor', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      effects: {
        compressor: { threshold: -20, ratio: 4, attack: 0.003, release: 0.25, knee: 30 }
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle multiple layers', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [
          { type: 'oscillator', gain: 0.5, oscillator: { waveform: 'sine', frequency: 200, detune: 0 } },
          { type: 'noise', gain: 0.3, noise: { type: 'white' } }
        ]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply per-layer envelope', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'oscillator',
          gain: 1,
          oscillator: { waveform: 'sine', frequency: 440, detune: 0 },
          envelope: { attack: 0.001, decay: 0.05, sustain: 0.3, release: 0.1 }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply filter envelope', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      filter: {
        type: 'lowpass',
        frequency: 500,
        q: 2,
        envelope: {
          amount: 2000,
          attack: 0.01,
          decay: 0.1,
          sustain: 0.3,
          release: 0.2
        }
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should handle mixed layer and master envelopes', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [
          {
            type: 'oscillator',
            gain: 0.7,
            oscillator: { waveform: 'sine', frequency: 60, detune: 0 },
            envelope: { attack: 0.001, decay: 0.05, sustain: 0.5, release: 0.3 }
          },
          {
            type: 'noise',
            gain: 0.3,
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.02, sustain: 0, release: 0.05 }
          }
        ]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply unison voices', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'oscillator',
          gain: 1,
          oscillator: {
            waveform: 'sawtooth',
            frequency: 220,
            detune: 0,
            unison: { voices: 5, detune: 30, spread: 0.8 }
          }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.numberOfChannels).toBe(2);
  });

  it('should add sub oscillator', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'oscillator',
          gain: 1,
          oscillator: {
            waveform: 'sawtooth',
            frequency: 110,
            detune: 0,
            sub: { level: 0.7, octave: -1, waveform: 'sine' }
          }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should combine unison and sub', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'oscillator',
          gain: 1,
          oscillator: {
            waveform: 'sawtooth',
            frequency: 110,
            detune: 0,
            unison: { voices: 3, detune: 15, spread: 0.5 },
            sub: { level: 0.5, octave: -1 }
          }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply per-layer filter', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'noise',
          gain: 1,
          noise: { type: 'white' },
          filter: { type: 'highpass', frequency: 2000, q: 1 }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply per-layer filter with envelope', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'oscillator',
          gain: 1,
          oscillator: { waveform: 'sawtooth', frequency: 110, detune: 0 },
          filter: {
            type: 'lowpass',
            frequency: 500,
            q: 2,
            envelope: { amount: 3000, attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.1 }
          }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply saturation', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'oscillator',
          gain: 1,
          oscillator: { waveform: 'sine', frequency: 110, detune: 0 },
          saturation: { type: 'soft', drive: 3, mix: 0.5 }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should combine filter and saturation', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      synthesis: {
        layers: [{
          type: 'oscillator',
          gain: 1,
          oscillator: { waveform: 'sawtooth', frequency: 110, detune: 0 },
          filter: { type: 'lowpass', frequency: 1000, q: 2 },
          saturation: { type: 'tube', drive: 2, mix: 0.7 }
        }]
      }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply LFO to filter', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      filter: { type: 'lowpass', frequency: 1000, q: 2 },
      lfo: { waveform: 'sine', frequency: 5, depth: 0.5, target: 'filter', phase: 0 }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply LFO to amplitude', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      lfo: { waveform: 'sine', frequency: 4, depth: 0.3, target: 'amplitude', phase: 0 }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply LFO to pan', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      lfo: { waveform: 'triangle', frequency: 2, depth: 0.8, target: 'pan', phase: 0 }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply LFO with delay and fade', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      timing: { duration: 2 },
      lfo: { waveform: 'sine', frequency: 5, depth: 0.5, target: 'filter', phase: 0, delay: 0.5, fade: 0.3 },
      filter: { type: 'lowpass', frequency: 1000, q: 2 }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should apply random LFO', async () => {
    const config: SoundConfig = {
      ...baseConfig,
      filter: { type: 'lowpass', frequency: 1000, q: 2 },
      lfo: { waveform: 'random', frequency: 10, depth: 0.6, target: 'filter', phase: 0 }
    };
    const buffer = await synthesizeSound(config);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe('Property-Based Tests', () => {
  /**
   * Feature: synth-ui, Property 8: Synthesis Success
   * For any valid sound configuration, clicking play should successfully synthesize audio without throwing errors.
   * Validates: Requirements 7.1
   */
  test('Property 8: Synthesis Success', async () => {
    // Helper to create valid float generator that avoids NaN
    const validFloat = (min: number, max: number) => 
      fc.float({ min: Math.fround(min), max: Math.fround(max), noNaN: true });

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          synthesis: fc.record({
            layers: fc.array(
              fc.oneof(
                // Oscillator layer
                fc.record({
                  type: fc.constant('oscillator' as const),
                  gain: validFloat(0, 1),
                  oscillator: fc.record({
                    waveform: fc.constantFrom('sine', 'square', 'sawtooth', 'triangle'),
                    frequency: validFloat(20, 20000),
                    detune: validFloat(-100, 100),
                  }),
                }),
                // Noise layer
                fc.record({
                  type: fc.constant('noise' as const),
                  gain: validFloat(0, 1),
                  noise: fc.record({
                    type: fc.constantFrom('white', 'pink', 'brown'),
                  }),
                }),
                // FM layer
                fc.record({
                  type: fc.constant('fm' as const),
                  gain: validFloat(0, 1),
                  fm: fc.record({
                    carrier: validFloat(20, 20000),
                    modulator: validFloat(20, 20000),
                    modulationIndex: validFloat(0, 1000),
                  }),
                }),
                // Karplus-Strong layer
                fc.record({
                  type: fc.constant('karplus-strong' as const),
                  gain: validFloat(0, 1),
                  karplus: fc.record({
                    frequency: validFloat(20, 2000),
                    damping: validFloat(0, 1),
                  }),
                })
              ),
              { minLength: 1, maxLength: 4 }
            ),
          }),
          envelope: fc.record({
            attack: validFloat(0.001, 5),
            decay: validFloat(0.001, 5),
            sustain: validFloat(0, 1),
            release: validFloat(0.001, 10),
          }),
          effects: fc.record({}),
          timing: fc.record({
            duration: validFloat(0.1, 2),
          }),
          dynamics: fc.record({
            velocity: validFloat(0, 1),
            normalize: fc.boolean(),
          }),
          metadata: fc.record({
            name: fc.string({ minLength: 1, maxLength: 50 }),
            category: fc.constantFrom('kick', 'snare', 'hihat', 'tom', 'perc', 'bass', 'lead', 'pad', 'fx', 'other'),
            description: fc.string({ maxLength: 200 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 }),
          }),
        }),
        async (config) => {
          // For any valid sound configuration, synthesis should succeed without throwing errors
          let buffer: AudioBuffer | null = null;
          let error: Error | null = null;

          try {
            buffer = await synthesizeSound(config);
          } catch (e) {
            error = e as Error;
          }

          // Assert that no error was thrown
          expect(error).toBeNull();
          
          // Assert that a valid buffer was returned
          expect(buffer).toBeDefined();
          expect(buffer).not.toBeNull();
          
          if (buffer) {
            // Assert buffer has valid properties
            expect(buffer.length).toBeGreaterThan(0);
            expect(buffer.sampleRate).toBe(44100);
            expect(buffer.numberOfChannels).toBe(2);
            // Duration can be very small or even 0 for short sounds, which is valid
            expect(buffer.duration).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
