/**
 * Validation utilities - re-exports from soundConfig (Zod-based)
 */

export { 
  BOUNDS,
  validateSoundConfig, 
  validateSoundConfigJSON,
  type ValidationResult,
} from '../types/soundConfig';

/**
 * Clamps a numeric value to a specified range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
