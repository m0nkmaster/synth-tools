import { describe, it, expect } from 'vitest';
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
});
