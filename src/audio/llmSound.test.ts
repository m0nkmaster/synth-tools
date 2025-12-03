import { describe, expect, it } from 'vitest';
import { buildToneProfile, createLlmSound, encodeWav } from './llmSound';

describe('llmSound', () => {
  it('caps duration at six seconds and keeps at least one second', () => {
    const longProfile = buildToneProfile('pad', 0.3, 12);
    const shortProfile = buildToneProfile('pad', 0.3, 0.2);
    expect(longProfile.durationSeconds).toBeLessThanOrEqual(6);
    expect(shortProfile.durationSeconds).toBeGreaterThanOrEqual(1);
  });

  it('produces deterministic audio for identical prompts and creativity', () => {
    const first = createLlmSound('1980s synth with reverb', 4, 0.5);
    const second = createLlmSound('1980s synth with reverb', 4, 0.5);
    expect(first.samples.length).toBe(second.samples.length);
    expect(first.samples.slice(0, 10)).toEqual(second.samples.slice(0, 10));
  });

  it('renders WAV data with matching frame count', () => {
    const result = createLlmSound('water snare', 3, 0.6);
    const wav = encodeWav(result.samples, result.sampleRate);
    const riffHeader = String.fromCharCode(...wav.slice(0, 4));
    expect(riffHeader).toBe('RIFF');
    expect(wav.byteLength).toBe(44 + result.samples.length * 2);
  });
});
