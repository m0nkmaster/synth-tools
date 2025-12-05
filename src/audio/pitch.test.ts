import { describe, it, expect } from 'vitest';
import { semitonesToNote, frequencyToNote, semitonesToPitchParam } from './pitch';

describe('pitch utilities', () => {
  describe('frequencyToNote', () => {
    it('should convert A4 (440 Hz) to A4', () => {
      expect(frequencyToNote(440)).toBe('A4');
    });

    it('should convert C4 (261.63 Hz) to C4', () => {
      const note = frequencyToNote(261.63);
      expect(note).toContain('C4');
    });

    it('should handle low frequencies', () => {
      const note = frequencyToNote(55);
      expect(note).toBeDefined();
    });

    it('should handle high frequencies', () => {
      const note = frequencyToNote(2000);
      expect(note).toBeDefined();
    });
  });

  describe('semitonesToNote', () => {
    it('should return null for null base frequency', () => {
      expect(semitonesToNote(null, 0)).toBeNull();
    });

    it('should return same note for 0 semitones', () => {
      const result = semitonesToNote(440, 0);
      expect(result).toBe('A4');
    });

    it('should shift up by octave for +12 semitones', () => {
      const result = semitonesToNote(440, 12);
      expect(result).toBe('A5');
    });

    it('should shift down by octave for -12 semitones', () => {
      const result = semitonesToNote(440, -12);
      expect(result).toBe('A3');
    });
  });

  describe('semitonesToPitchParam', () => {
    it('should return 8192 for 0 semitones', () => {
      expect(semitonesToPitchParam(0)).toBe(8192);
    });

    it('should return positive value for positive semitones', () => {
      expect(semitonesToPitchParam(1)).toBeGreaterThan(8192);
    });

    it('should return negative value for negative semitones', () => {
      expect(semitonesToPitchParam(-1)).toBeLessThan(8192);
    });

    it('should scale linearly from center', () => {
      const one = semitonesToPitchParam(1) - 8192;
      const two = semitonesToPitchParam(2) - 8192;
      expect(two).toBeCloseTo(one * 2, 0);
    });
  });
});
