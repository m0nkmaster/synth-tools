/**
 * Parameter validation and clamping utilities for synthesizer UI
 */

/**
 * Clamps a numeric value to a specified range
 * @param value - The value to clamp
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The clamped value
 */
export function clampParameter(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Parameter bounds for all synthesis parameters
 */
export const PARAMETER_BOUNDS = {
  // Envelope parameters (Requirements 2.1, 2.2, 2.3, 2.4)
  envelope: {
    attack: { min: 0.001, max: 5 },
    decay: { min: 0.001, max: 5 },
    sustain: { min: 0, max: 1 },
    release: { min: 0.001, max: 10 },
  },
  // Oscillator parameters (Requirements 3.2, 3.3)
  oscillator: {
    frequency: { min: 20, max: 20000 },
    detune: { min: -100, max: 100 },
  },
  // Filter parameters (Requirements 4.2, 4.3, 4.5)
  filter: {
    frequency: { min: 20, max: 20000 },
    q: { min: 0.0001, max: 100 },
    envelopeAmount: { min: -10000, max: 10000 },
  },
  // LFO parameters (Requirement 6.3)
  lfo: {
    frequency: { min: 0.01, max: 20 },
  },
  // Timing parameters (Requirement 7.5)
  timing: {
    duration: { min: 0.1, max: 10 },
  },
  // FM parameters (Requirements 11.2, 11.3, 11.4)
  fm: {
    carrier: { min: 20, max: 20000 },
    modulator: { min: 20, max: 20000 },
    modulationIndex: { min: 0, max: 1000 },
  },
  // Karplus-Strong parameters (Requirements 12.2, 12.3, 12.4)
  karplus: {
    frequency: { min: 20, max: 2000 },
    damping: { min: 0, max: 1 },
    pluckLocation: { min: 0, max: 1 },
  },
} as const;

/**
 * Clamps an envelope parameter to valid range
 */
export function clampEnvelopeParameter(
  param: keyof typeof PARAMETER_BOUNDS.envelope,
  value: number
): number {
  const bounds = PARAMETER_BOUNDS.envelope[param];
  return clampParameter(value, bounds.min, bounds.max);
}

/**
 * Clamps an oscillator parameter to valid range
 */
export function clampOscillatorParameter(
  param: keyof typeof PARAMETER_BOUNDS.oscillator,
  value: number
): number {
  const bounds = PARAMETER_BOUNDS.oscillator[param];
  return clampParameter(value, bounds.min, bounds.max);
}

/**
 * Clamps a filter parameter to valid range
 */
export function clampFilterParameter(
  param: keyof typeof PARAMETER_BOUNDS.filter,
  value: number
): number {
  const bounds = PARAMETER_BOUNDS.filter[param];
  return clampParameter(value, bounds.min, bounds.max);
}

/**
 * Clamps an LFO parameter to valid range
 */
export function clampLFOParameter(
  param: keyof typeof PARAMETER_BOUNDS.lfo,
  value: number
): number {
  const bounds = PARAMETER_BOUNDS.lfo[param];
  return clampParameter(value, bounds.min, bounds.max);
}

/**
 * Clamps a timing parameter to valid range
 */
export function clampTimingParameter(
  param: keyof typeof PARAMETER_BOUNDS.timing,
  value: number
): number {
  const bounds = PARAMETER_BOUNDS.timing[param];
  return clampParameter(value, bounds.min, bounds.max);
}

/**
 * Clamps an FM parameter to valid range
 */
export function clampFMParameter(
  param: keyof typeof PARAMETER_BOUNDS.fm,
  value: number
): number {
  const bounds = PARAMETER_BOUNDS.fm[param];
  return clampParameter(value, bounds.min, bounds.max);
}

/**
 * Clamps a Karplus-Strong parameter to valid range
 */
export function clampKarplusParameter(
  param: keyof typeof PARAMETER_BOUNDS.karplus,
  value: number
): number {
  const bounds = PARAMETER_BOUNDS.karplus[param];
  return clampParameter(value, bounds.min, bounds.max);
}

/**
 * Validation error types
 */
export interface ValidationError {
  type: 'syntax' | 'schema' | 'range';
  message: string;
  path?: string;
  value?: unknown;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Validates JSON syntax
 * @param jsonString - The JSON string to validate
 * @returns Validation result with syntax errors
 */
export function validateJSONSyntax(jsonString: string): ValidationResult {
  const errors: ValidationError[] = [];
  
  try {
    JSON.parse(jsonString);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    errors.push({
      type: 'syntax',
      message: error instanceof Error ? error.message : 'Invalid JSON syntax',
    });
    return { valid: false, errors, warnings: [] };
  }
}

/**
 * Validates SoundConfig schema
 * @param config - The parsed configuration object
 * @returns Validation result with schema errors
 */
export function validateSoundConfigSchema(config: unknown): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (!config || typeof config !== 'object') {
    errors.push({
      type: 'schema',
      message: 'Configuration must be an object',
    });
    return { valid: false, errors, warnings: [] };
  }
  
  const cfg = config as Record<string, unknown>;
  
  // Check required top-level fields
  if (!cfg.synthesis || typeof cfg.synthesis !== 'object') {
    errors.push({
      type: 'schema',
      message: 'Missing required field: synthesis',
      path: 'synthesis',
    });
  }
  
  if (!cfg.envelope || typeof cfg.envelope !== 'object') {
    errors.push({
      type: 'schema',
      message: 'Missing required field: envelope',
      path: 'envelope',
    });
  }
  
  if (!cfg.effects || typeof cfg.effects !== 'object') {
    errors.push({
      type: 'schema',
      message: 'Missing required field: effects',
      path: 'effects',
    });
  }
  
  if (!cfg.timing || typeof cfg.timing !== 'object') {
    errors.push({
      type: 'schema',
      message: 'Missing required field: timing',
      path: 'timing',
    });
  }
  
  if (!cfg.dynamics || typeof cfg.dynamics !== 'object') {
    errors.push({
      type: 'schema',
      message: 'Missing required field: dynamics',
      path: 'dynamics',
    });
  }
  
  if (!cfg.metadata || typeof cfg.metadata !== 'object') {
    errors.push({
      type: 'schema',
      message: 'Missing required field: metadata',
      path: 'metadata',
    });
  }
  
  return { valid: errors.length === 0, errors, warnings: [] };
}

/**
 * Validates parameter ranges in a SoundConfig
 * @param config - The configuration object to validate
 * @returns Validation result with range warnings
 */
export function validateParameterRanges(config: unknown): ValidationResult {
  const warnings: ValidationError[] = [];
  
  if (!config || typeof config !== 'object') {
    return { valid: true, errors: [], warnings };
  }
  
  const cfg = config as Record<string, unknown>;
  
  // Validate envelope parameters
  if (cfg.envelope && typeof cfg.envelope === 'object') {
    const env = cfg.envelope as Record<string, unknown>;
    
    if (typeof env.attack === 'number') {
      const bounds = PARAMETER_BOUNDS.envelope.attack;
      if (env.attack < bounds.min || env.attack > bounds.max) {
        warnings.push({
          type: 'range',
          message: `Envelope attack out of range (${bounds.min}-${bounds.max})`,
          path: 'envelope.attack',
          value: env.attack,
        });
      }
    }
    
    if (typeof env.decay === 'number') {
      const bounds = PARAMETER_BOUNDS.envelope.decay;
      if (env.decay < bounds.min || env.decay > bounds.max) {
        warnings.push({
          type: 'range',
          message: `Envelope decay out of range (${bounds.min}-${bounds.max})`,
          path: 'envelope.decay',
          value: env.decay,
        });
      }
    }
    
    if (typeof env.sustain === 'number') {
      const bounds = PARAMETER_BOUNDS.envelope.sustain;
      if (env.sustain < bounds.min || env.sustain > bounds.max) {
        warnings.push({
          type: 'range',
          message: `Envelope sustain out of range (${bounds.min}-${bounds.max})`,
          path: 'envelope.sustain',
          value: env.sustain,
        });
      }
    }
    
    if (typeof env.release === 'number') {
      const bounds = PARAMETER_BOUNDS.envelope.release;
      if (env.release < bounds.min || env.release > bounds.max) {
        warnings.push({
          type: 'range',
          message: `Envelope release out of range (${bounds.min}-${bounds.max})`,
          path: 'envelope.release',
          value: env.release,
        });
      }
    }
  }
  
  // Validate filter parameters
  if (cfg.filter && typeof cfg.filter === 'object') {
    const filter = cfg.filter as Record<string, unknown>;
    
    if (typeof filter.frequency === 'number') {
      const bounds = PARAMETER_BOUNDS.filter.frequency;
      if (filter.frequency < bounds.min || filter.frequency > bounds.max) {
        warnings.push({
          type: 'range',
          message: `Filter frequency out of range (${bounds.min}-${bounds.max})`,
          path: 'filter.frequency',
          value: filter.frequency,
        });
      }
    }
    
    if (typeof filter.q === 'number') {
      const bounds = PARAMETER_BOUNDS.filter.q;
      if (filter.q < bounds.min || filter.q > bounds.max) {
        warnings.push({
          type: 'range',
          message: `Filter Q out of range (${bounds.min}-${bounds.max})`,
          path: 'filter.q',
          value: filter.q,
        });
      }
    }
  }
  
  // Validate timing parameters
  if (cfg.timing && typeof cfg.timing === 'object') {
    const timing = cfg.timing as Record<string, unknown>;
    
    if (typeof timing.duration === 'number') {
      const bounds = PARAMETER_BOUNDS.timing.duration;
      if (timing.duration < bounds.min || timing.duration > bounds.max) {
        warnings.push({
          type: 'range',
          message: `Duration out of range (${bounds.min}-${bounds.max})`,
          path: 'timing.duration',
          value: timing.duration,
        });
      }
    }
  }
  
  // Validate LFO parameters
  if (cfg.lfo && typeof cfg.lfo === 'object') {
    const lfo = cfg.lfo as Record<string, unknown>;
    
    if (typeof lfo.frequency === 'number') {
      const bounds = PARAMETER_BOUNDS.lfo.frequency;
      if (lfo.frequency < bounds.min || lfo.frequency > bounds.max) {
        warnings.push({
          type: 'range',
          message: `LFO frequency out of range (${bounds.min}-${bounds.max})`,
          path: 'lfo.frequency',
          value: lfo.frequency,
        });
      }
    }
  }
  
  return { valid: true, errors: [], warnings };
}

/**
 * Validates a JSON string as a SoundConfig
 * Performs syntax, schema, and range validation
 * @param jsonString - The JSON string to validate
 * @returns Complete validation result
 */
export function validateSoundConfigJSON(jsonString: string): ValidationResult {
  // First check syntax
  const syntaxResult = validateJSONSyntax(jsonString);
  if (!syntaxResult.valid) {
    return syntaxResult;
  }
  
  // Parse and check schema
  const config = JSON.parse(jsonString);
  const schemaResult = validateSoundConfigSchema(config);
  if (!schemaResult.valid) {
    return schemaResult;
  }
  
  // Check parameter ranges
  const rangeResult = validateParameterRanges(config);
  
  return {
    valid: schemaResult.valid,
    errors: [...schemaResult.errors, ...rangeResult.errors],
    warnings: rangeResult.warnings,
  };
}
