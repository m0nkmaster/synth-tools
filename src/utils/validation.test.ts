/**
 * Property-based tests for parameter validation and clamping
 */

import { describe, test, expect } from 'vitest';
import fc from 'fast-check';
import {
  clampParameter,
  clampEnvelopeParameter,
  clampOscillatorParameter,
  clampFilterParameter,
  clampLFOParameter,
  clampTimingParameter,
  clampFMParameter,
  clampKarplusParameter,
  PARAMETER_BOUNDS,
  validateJSONSyntax,
  validateSoundConfigSchema,
  validateParameterRanges,
  validateSoundConfigJSON,
} from './validation';

describe('Parameter Clamping', () => {
  /**
   * Feature: synth-ui, Property 1: Parameter Clamping
   * For any numeric parameter with defined min/max bounds, when a user provides
   * an out-of-range value, the system should clamp the value to the valid range.
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 4.2, 4.3, 4.5, 6.3, 7.5, 11.2, 11.3, 11.4, 12.2, 12.3, 12.4
   */
  test('clampParameter should clamp any value to the specified range', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -1e6, max: 1e6, noNaN: true }),
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 101, max: 1000, noNaN: true }),
        (value, min, max) => {
          const clamped = clampParameter(value, min, max);
          
          // Clamped value must be within bounds
          expect(clamped).toBeGreaterThanOrEqual(min);
          expect(clamped).toBeLessThanOrEqual(max);
          
          // If value was already in range, it should be unchanged
          if (value >= min && value <= max) {
            expect(clamped).toBe(value);
          }
          
          // If value was below min, it should be clamped to min
          if (value < min) {
            expect(clamped).toBe(min);
          }
          
          // If value was above max, it should be clamped to max
          if (value > max) {
            expect(clamped).toBe(max);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 1: Parameter Clamping
   * Envelope parameters (attack, decay, sustain, release) should be clamped to valid ranges
   * Validates: Requirements 2.1, 2.2, 2.3, 2.4
   */
  test('envelope parameters should be clamped to valid ranges', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -100, max: 100, noNaN: true }),
        (value) => {
          // Test attack (0.001 - 5 seconds)
          const attack = clampEnvelopeParameter('attack', value);
          expect(attack).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.envelope.attack.min);
          expect(attack).toBeLessThanOrEqual(PARAMETER_BOUNDS.envelope.attack.max);
          
          // Test decay (0.001 - 5 seconds)
          const decay = clampEnvelopeParameter('decay', value);
          expect(decay).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.envelope.decay.min);
          expect(decay).toBeLessThanOrEqual(PARAMETER_BOUNDS.envelope.decay.max);
          
          // Test sustain (0 - 1)
          const sustain = clampEnvelopeParameter('sustain', value);
          expect(sustain).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.envelope.sustain.min);
          expect(sustain).toBeLessThanOrEqual(PARAMETER_BOUNDS.envelope.sustain.max);
          
          // Test release (0.001 - 10 seconds)
          const release = clampEnvelopeParameter('release', value);
          expect(release).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.envelope.release.min);
          expect(release).toBeLessThanOrEqual(PARAMETER_BOUNDS.envelope.release.max);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 1: Parameter Clamping
   * Oscillator parameters (frequency, detune) should be clamped to valid ranges
   * Validates: Requirements 3.2, 3.3
   */
  test('oscillator parameters should be clamped to valid ranges', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -10000, max: 50000, noNaN: true }),
        (value) => {
          // Test frequency (20 - 20000 Hz)
          const frequency = clampOscillatorParameter('frequency', value);
          expect(frequency).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.oscillator.frequency.min);
          expect(frequency).toBeLessThanOrEqual(PARAMETER_BOUNDS.oscillator.frequency.max);
          
          // Test detune (-100 - 100 cents)
          const detune = clampOscillatorParameter('detune', value);
          expect(detune).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.oscillator.detune.min);
          expect(detune).toBeLessThanOrEqual(PARAMETER_BOUNDS.oscillator.detune.max);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 1: Parameter Clamping
   * Filter parameters (frequency, Q, envelope amount) should be clamped to valid ranges
   * Validates: Requirements 4.2, 4.3, 4.5
   */
  test('filter parameters should be clamped to valid ranges', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -50000, max: 50000, noNaN: true }),
        (value) => {
          // Test frequency (20 - 20000 Hz)
          const frequency = clampFilterParameter('frequency', value);
          expect(frequency).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.filter.frequency.min);
          expect(frequency).toBeLessThanOrEqual(PARAMETER_BOUNDS.filter.frequency.max);
          
          // Test Q (0.0001 - 100)
          const q = clampFilterParameter('q', value);
          expect(q).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.filter.q.min);
          expect(q).toBeLessThanOrEqual(PARAMETER_BOUNDS.filter.q.max);
          
          // Test envelope amount (-10000 - 10000 Hz)
          const envelopeAmount = clampFilterParameter('envelopeAmount', value);
          expect(envelopeAmount).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.filter.envelopeAmount.min);
          expect(envelopeAmount).toBeLessThanOrEqual(PARAMETER_BOUNDS.filter.envelopeAmount.max);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 1: Parameter Clamping
   * LFO frequency should be clamped to valid range
   * Validates: Requirement 6.3
   */
  test('LFO frequency should be clamped to valid range', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -100, max: 100, noNaN: true }),
        (value) => {
          // Test frequency (0.01 - 20 Hz)
          const frequency = clampLFOParameter('frequency', value);
          expect(frequency).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.lfo.frequency.min);
          expect(frequency).toBeLessThanOrEqual(PARAMETER_BOUNDS.lfo.frequency.max);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 1: Parameter Clamping
   * Duration should be clamped to valid range
   * Validates: Requirement 7.5
   */
  test('duration should be clamped to valid range', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -100, max: 100, noNaN: true }),
        (value) => {
          // Test duration (0.1 - 10 seconds)
          const duration = clampTimingParameter('duration', value);
          expect(duration).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.timing.duration.min);
          expect(duration).toBeLessThanOrEqual(PARAMETER_BOUNDS.timing.duration.max);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 1: Parameter Clamping
   * FM synthesis parameters should be clamped to valid ranges
   * Validates: Requirements 11.2, 11.3, 11.4
   */
  test('FM parameters should be clamped to valid ranges', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -10000, max: 50000, noNaN: true }),
        (value) => {
          // Test carrier frequency (20 - 20000 Hz)
          const carrier = clampFMParameter('carrier', value);
          expect(carrier).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.fm.carrier.min);
          expect(carrier).toBeLessThanOrEqual(PARAMETER_BOUNDS.fm.carrier.max);
          
          // Test modulator frequency (20 - 20000 Hz)
          const modulator = clampFMParameter('modulator', value);
          expect(modulator).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.fm.modulator.min);
          expect(modulator).toBeLessThanOrEqual(PARAMETER_BOUNDS.fm.modulator.max);
          
          // Test modulation index (0 - 1000)
          const modulationIndex = clampFMParameter('modulationIndex', value);
          expect(modulationIndex).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.fm.modulationIndex.min);
          expect(modulationIndex).toBeLessThanOrEqual(PARAMETER_BOUNDS.fm.modulationIndex.max);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 1: Parameter Clamping
   * Karplus-Strong parameters should be clamped to valid ranges
   * Validates: Requirements 12.2, 12.3, 12.4
   */
  test('Karplus-Strong parameters should be clamped to valid ranges', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -10000, max: 10000, noNaN: true }),
        (value) => {
          // Test frequency (20 - 2000 Hz)
          const frequency = clampKarplusParameter('frequency', value);
          expect(frequency).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.karplus.frequency.min);
          expect(frequency).toBeLessThanOrEqual(PARAMETER_BOUNDS.karplus.frequency.max);
          
          // Test damping (0 - 1)
          const damping = clampKarplusParameter('damping', value);
          expect(damping).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.karplus.damping.min);
          expect(damping).toBeLessThanOrEqual(PARAMETER_BOUNDS.karplus.damping.max);
          
          // Test pluck location (0 - 1)
          const pluckLocation = clampKarplusParameter('pluckLocation', value);
          expect(pluckLocation).toBeGreaterThanOrEqual(PARAMETER_BOUNDS.karplus.pluckLocation.min);
          expect(pluckLocation).toBeLessThanOrEqual(PARAMETER_BOUNDS.karplus.pluckLocation.max);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('JSON Validation', () => {
  /**
   * Feature: synth-ui, Property 10: Invalid JSON Rejection
   * For any JSON string with invalid syntax, the system should display validation errors
   * and prevent the invalid configuration from being applied to visual controls.
   * Validates: Requirements 15.4
   */
  test('invalid JSON syntax should be rejected with errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Missing closing brace
          fc.constant('{"synthesis": {"layers": []'),
          // Missing quotes
          fc.constant('{synthesis: {layers: []}}'),
          // Trailing comma
          fc.constant('{"synthesis": {"layers": [],}}'),
          // Single quotes instead of double
          fc.constant("{'synthesis': {'layers': []}}"),
          // Unclosed string
          fc.constant('{"synthesis": "unclosed'),
          // Invalid escape sequence
          fc.constant('{"synthesis": "\\x"}'),
          // Multiple root objects
          fc.constant('{"a": 1}{"b": 2}'),
          // Just random text
          fc.constant('not json at all'),
          // Empty string
          fc.constant(''),
          // Just whitespace
          fc.constant('   \n\t  ')
        ),
        (invalidJSON) => {
          const result = validateJSONSyntax(invalidJSON);
          
          // Should not be valid
          expect(result.valid).toBe(false);
          
          // Should have at least one error
          expect(result.errors.length).toBeGreaterThan(0);
          
          // Error should be of type 'syntax'
          expect(result.errors[0].type).toBe('syntax');
          
          // Error should have a message
          expect(result.errors[0].message).toBeTruthy();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 10: Invalid JSON Rejection
   * For any configuration missing required fields, the system should display schema validation errors
   * Validates: Requirements 15.4
   */
  test('configurations missing required fields should be rejected with schema errors', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Missing synthesis
          fc.constant({ envelope: {}, effects: {}, timing: {}, dynamics: {}, metadata: {} }),
          // Missing envelope
          fc.constant({ synthesis: { layers: [] }, effects: {}, timing: {}, dynamics: {}, metadata: {} }),
          // Missing effects
          fc.constant({ synthesis: { layers: [] }, envelope: {}, timing: {}, dynamics: {}, metadata: {} }),
          // Missing timing
          fc.constant({ synthesis: { layers: [] }, envelope: {}, effects: {}, dynamics: {}, metadata: {} }),
          // Missing dynamics
          fc.constant({ synthesis: { layers: [] }, envelope: {}, effects: {}, timing: {}, metadata: {} }),
          // Missing metadata
          fc.constant({ synthesis: { layers: [] }, envelope: {}, effects: {}, timing: {}, dynamics: {} }),
          // Empty object
          fc.constant({}),
          // Not an object
          fc.constant([]),
          fc.constant(null),
          fc.constant('string'),
          fc.constant(42)
        ),
        (invalidConfig) => {
          const result = validateSoundConfigSchema(invalidConfig);
          
          // Should not be valid
          expect(result.valid).toBe(false);
          
          // Should have at least one error
          expect(result.errors.length).toBeGreaterThan(0);
          
          // All errors should be of type 'schema'
          result.errors.forEach(error => {
            expect(error.type).toBe('schema');
            expect(error.message).toBeTruthy();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 11: Value Clamping on JSON Import
   * For any JSON configuration with valid syntax but out-of-range parameter values,
   * the system should display warnings and clamp values to valid ranges when applied.
   * Validates: Requirements 15.5
   */
  test('out-of-range parameter values should generate warnings', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate out-of-range envelope values
          attack: fc.oneof(
            fc.constant(-1),
            fc.constant(0),
            fc.constant(100),
            fc.float({ min: 10, max: 1000, noNaN: true })
          ),
          decay: fc.oneof(
            fc.constant(-1),
            fc.constant(0),
            fc.constant(100),
            fc.float({ min: 10, max: 1000, noNaN: true })
          ),
          sustain: fc.oneof(
            fc.constant(-1),
            fc.constant(2),
            fc.constant(100),
            fc.float({ min: 2, max: 1000, noNaN: true })
          ),
          release: fc.oneof(
            fc.constant(-1),
            fc.constant(0),
            fc.constant(100),
            fc.float({ min: 20, max: 1000, noNaN: true })
          ),
        }),
        (outOfRangeEnvelope) => {
          const config = {
            synthesis: { layers: [] },
            envelope: outOfRangeEnvelope,
            effects: {},
            timing: { duration: 1 },
            dynamics: { velocity: 0.8, normalize: true },
            metadata: { name: 'Test', category: 'other', description: '', tags: [] },
          };
          
          const result = validateParameterRanges(config);
          
          // Should still be "valid" (warnings, not errors)
          expect(result.valid).toBe(true);
          
          // Should have warnings for out-of-range values
          expect(result.warnings.length).toBeGreaterThan(0);
          
          // All warnings should be of type 'range'
          result.warnings.forEach(warning => {
            expect(warning.type).toBe('range');
            expect(warning.message).toBeTruthy();
            expect(warning.path).toBeTruthy();
            expect(warning.value).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 11: Value Clamping on JSON Import
   * For any configuration with out-of-range filter parameters, warnings should be generated
   * Validates: Requirements 15.5
   */
  test('out-of-range filter parameters should generate warnings', () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.constantFrom('lowpass', 'highpass', 'bandpass', 'notch'),
          frequency: fc.oneof(
            fc.constant(-100),
            fc.constant(0),
            fc.constant(50000),
            fc.float({ min: 30000, max: 100000, noNaN: true })
          ),
          q: fc.oneof(
            fc.constant(-1),
            fc.constant(0),
            fc.constant(200),
            fc.float({ min: 150, max: 1000, noNaN: true })
          ),
        }),
        (outOfRangeFilter) => {
          const config = {
            synthesis: { layers: [] },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 },
            filter: outOfRangeFilter,
            effects: {},
            timing: { duration: 1 },
            dynamics: { velocity: 0.8, normalize: true },
            metadata: { name: 'Test', category: 'other', description: '', tags: [] },
          };
          
          const result = validateParameterRanges(config);
          
          // Should still be "valid" (warnings, not errors)
          expect(result.valid).toBe(true);
          
          // Should have warnings for out-of-range values
          expect(result.warnings.length).toBeGreaterThan(0);
          
          // All warnings should be of type 'range'
          result.warnings.forEach(warning => {
            expect(warning.type).toBe('range');
            expect(warning.message).toBeTruthy();
            expect(warning.path).toMatch(/^filter\./);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 11: Value Clamping on JSON Import
   * For any configuration with out-of-range timing parameters, warnings should be generated
   * Validates: Requirements 15.5
   */
  test('out-of-range timing parameters should generate warnings', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(-1),
          fc.constant(0),
          fc.constant(0.05),
          fc.constant(20),
          fc.float({ min: 15, max: 1000, noNaN: true })
        ),
        (outOfRangeDuration) => {
          const config = {
            synthesis: { layers: [] },
            envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 },
            effects: {},
            timing: { duration: outOfRangeDuration },
            dynamics: { velocity: 0.8, normalize: true },
            metadata: { name: 'Test', category: 'other', description: '', tags: [] },
          };
          
          const result = validateParameterRanges(config);
          
          // Should still be "valid" (warnings, not errors)
          expect(result.valid).toBe(true);
          
          // Should have warnings for out-of-range duration
          expect(result.warnings.length).toBeGreaterThan(0);
          
          // Should have a warning about duration
          const durationWarning = result.warnings.find(w => w.path === 'timing.duration');
          expect(durationWarning).toBeDefined();
          expect(durationWarning?.type).toBe('range');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: synth-ui, Property 11: Value Clamping on JSON Import
   * Complete JSON validation should combine syntax, schema, and range checks
   * Validates: Requirements 15.4, 15.5
   */
  test('complete JSON validation should handle all validation types', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Invalid syntax
          fc.constant('{"invalid": json}'),
          // Missing required fields
          fc.constant('{"synthesis": {"layers": []}}'),
          // Valid structure with out-of-range values
          fc.constant(JSON.stringify({
            synthesis: { layers: [] },
            envelope: { attack: 100, decay: 100, sustain: 5, release: 100 },
            effects: {},
            timing: { duration: 100 },
            dynamics: { velocity: 0.8, normalize: true },
            metadata: { name: 'Test', category: 'other', description: '', tags: [] },
          }))
        ),
        (jsonString) => {
          const result = validateSoundConfigJSON(jsonString);
          
          // Should have either errors or warnings (or both)
          const hasIssues = result.errors.length > 0 || result.warnings.length > 0;
          expect(hasIssues).toBe(true);
          
          // If there are syntax or schema errors, valid should be false
          if (result.errors.length > 0) {
            expect(result.valid).toBe(false);
          }
          
          // All errors should have proper structure
          result.errors.forEach(error => {
            expect(error.type).toMatch(/^(syntax|schema|range)$/);
            expect(error.message).toBeTruthy();
          });
          
          // All warnings should have proper structure
          result.warnings.forEach(warning => {
            expect(warning.type).toBe('range');
            expect(warning.message).toBeTruthy();
            expect(warning.path).toBeTruthy();
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
