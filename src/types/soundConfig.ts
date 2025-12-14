/**
 * Comprehensive audio synthesis configuration using Zod
 * Single source of truth for types, validation, and AI prompts
 */

import { z } from 'zod';

// ============================================================================
// Enums
// ============================================================================

export const layerTypeEnum = z.enum(['oscillator', 'noise', 'fm', 'karplus-strong']);
export const waveformEnum = z.enum(['sine', 'square', 'sawtooth', 'triangle']);
export const noiseTypeEnum = z.enum(['white', 'pink', 'brown']);
export const filterTypeEnum = z.enum(['lowpass', 'highpass', 'bandpass', 'notch']);
export const globalFilterTypeEnum = z.enum(['lowpass', 'highpass', 'bandpass', 'notch', 'allpass', 'peaking']);
export const saturationTypeEnum = z.enum(['soft', 'hard', 'tube', 'tape']);
export const distortionTypeEnum = z.enum(['soft', 'hard', 'fuzz', 'bitcrush', 'waveshaper']);
export const lfoWaveformEnum = z.enum(['sine', 'square', 'sawtooth', 'triangle', 'random']);
export const lfoTargetEnum = z.enum(['pitch', 'filter', 'amplitude', 'pan']);
export const categoryEnum = z.enum(['kick', 'snare', 'hihat', 'tom', 'perc', 'bass', 'lead', 'pad', 'fx', 'other']);
export const subOctaveEnum = z.enum(['-1', '-2']).transform(v => parseInt(v) as -1 | -2);

// ============================================================================
// Parameter Bounds (centralized)
// ============================================================================

export const BOUNDS = {
  envelope: {
    attack: { min: 0.001, max: 5 },
    decay: { min: 0.001, max: 5 },
    sustain: { min: 0, max: 1 },
    release: { min: 0.001, max: 10 },
  },
  oscillator: {
    frequency: { min: 20, max: 20000 },
    detune: { min: -1200, max: 1200 },
  },
  unison: {
    voices: { min: 1, max: 8 },
    detune: { min: 0, max: 100 },
    spread: { min: 0, max: 1 },
  },
  sub: {
    level: { min: 0, max: 1 },
  },
  filter: {
    frequency: { min: 20, max: 20000 },
    q: { min: 0.0001, max: 100 },
    envelopeAmount: { min: -10000, max: 10000 },
  },
  saturation: {
    drive: { min: 0, max: 10 },
    mix: { min: 0, max: 1 },
  },
  fm: {
    carrier: { min: 20, max: 20000 },
    modulator: { min: 20, max: 20000 },
    modulationIndex: { min: 0, max: 1000 },
  },
  karplus: {
    frequency: { min: 20, max: 2000 },
    damping: { min: 0, max: 1 },
  },
  lfo: {
    frequency: { min: 0.01, max: 20 },
    depth: { min: 0, max: 1 },
    delay: { min: 0, max: 10 },
    fade: { min: 0, max: 10 },
  },
  distortion: {
    amount: { min: 0, max: 1 },
    mix: { min: 0, max: 1 },
  },
  reverb: {
    decay: { min: 0.1, max: 10 },
    damping: { min: 0, max: 1 },
    mix: { min: 0, max: 1 },
  },
  delay: {
    time: { min: 0.01, max: 2 },
    feedback: { min: 0, max: 0.9 },
    mix: { min: 0, max: 1 },
  },
  compressor: {
    threshold: { min: -60, max: 0 },
    ratio: { min: 1, max: 20 },
    attack: { min: 0, max: 1 },
    release: { min: 0, max: 1 },
    knee: { min: 0, max: 40 },
  },
  gate: {
    attack: { min: 0, max: 1 },
    hold: { min: 0, max: 2 },
    release: { min: 0, max: 1 },
  },
  pitchEnvelope: {
    amount: { min: -4800, max: 4800 },  // cents (±4 octaves)
    attack: { min: 0, max: 2 },
    decay: { min: 0.001, max: 5 },
    sustain: { min: -4800, max: 4800 },  // cents (sustain deviation)
    release: { min: 0.001, max: 5 },
  },
  chorus: {
    rate: { min: 0.1, max: 10 },
    depth: { min: 0, max: 1 },
    mix: { min: 0, max: 1 },
    feedback: { min: 0, max: 0.9 },
    delay: { min: 1, max: 50 },  // ms: 1-5 = flanger, 20-50 = chorus
  },
  eq: {
    gain: { min: -24, max: 24 },
    frequency: { min: 20, max: 20000 },
    q: { min: 0.1, max: 10 },
  },
  timing: {
    duration: { min: 0.1, max: 12 },
  },
  dynamics: {
    velocity: { min: 0, max: 1 },
  },
  gain: { min: 0, max: 1 },
} as const;

// ============================================================================
// Sub-schemas
// ============================================================================

const envelopeSchema = z.object({
  attack: z.number().min(BOUNDS.envelope.attack.min).max(BOUNDS.envelope.attack.max),
  decay: z.number().min(BOUNDS.envelope.decay.min).max(BOUNDS.envelope.decay.max),
  sustain: z.number().min(BOUNDS.envelope.sustain.min).max(BOUNDS.envelope.sustain.max),
  release: z.number().min(BOUNDS.envelope.release.min).max(BOUNDS.envelope.release.max),
});

const filterEnvelopeSchema = z.object({
  amount: z.number().min(BOUNDS.filter.envelopeAmount.min).max(BOUNDS.filter.envelopeAmount.max),
  attack: z.number().min(BOUNDS.envelope.attack.min).max(BOUNDS.envelope.attack.max),
  decay: z.number().min(BOUNDS.envelope.decay.min).max(BOUNDS.envelope.decay.max),
  sustain: z.number().min(BOUNDS.envelope.sustain.min).max(BOUNDS.envelope.sustain.max),
  release: z.number().min(BOUNDS.envelope.release.min).max(BOUNDS.envelope.release.max),
});

const unisonSchema = z.object({
  voices: z.number().int().min(BOUNDS.unison.voices.min).max(BOUNDS.unison.voices.max),
  detune: z.number().min(BOUNDS.unison.detune.min).max(BOUNDS.unison.detune.max),
  spread: z.number().min(BOUNDS.unison.spread.min).max(BOUNDS.unison.spread.max),
});

const subOscillatorSchema = z.object({
  level: z.number().min(BOUNDS.sub.level.min).max(BOUNDS.sub.level.max),
  octave: z.union([z.literal(-1), z.literal(-2)]),
  waveform: z.enum(['sine', 'square', 'triangle']).optional(),
});

const pitchEnvelopeSchema = z.object({
  amount: z.number().min(BOUNDS.pitchEnvelope.amount.min).max(BOUNDS.pitchEnvelope.amount.max),
  attack: z.number().min(BOUNDS.pitchEnvelope.attack.min).max(BOUNDS.pitchEnvelope.attack.max),
  decay: z.number().min(BOUNDS.pitchEnvelope.decay.min).max(BOUNDS.pitchEnvelope.decay.max),
  sustain: z.number().min(BOUNDS.pitchEnvelope.sustain.min).max(BOUNDS.pitchEnvelope.sustain.max),
  release: z.number().min(BOUNDS.pitchEnvelope.release.min).max(BOUNDS.pitchEnvelope.release.max),
});

const oscillatorConfigSchema = z.object({
  waveform: waveformEnum,
  frequency: z.number().min(BOUNDS.oscillator.frequency.min).max(BOUNDS.oscillator.frequency.max),
  detune: z.number().min(BOUNDS.oscillator.detune.min).max(BOUNDS.oscillator.detune.max),
  unison: unisonSchema.optional(),
  sub: subOscillatorSchema.optional(),
  pitchEnvelope: pitchEnvelopeSchema.optional(),
});

const noiseConfigSchema = z.object({
  type: noiseTypeEnum,
});

const fmConfigSchema = z.object({
  carrier: z.number().min(BOUNDS.fm.carrier.min).max(BOUNDS.fm.carrier.max),
  modulator: z.number().min(BOUNDS.fm.modulator.min).max(BOUNDS.fm.modulator.max),
  modulationIndex: z.number().min(BOUNDS.fm.modulationIndex.min).max(BOUNDS.fm.modulationIndex.max),
});

const karplusConfigSchema = z.object({
  frequency: z.number().min(BOUNDS.karplus.frequency.min).max(BOUNDS.karplus.frequency.max),
  damping: z.number().min(BOUNDS.karplus.damping.min).max(BOUNDS.karplus.damping.max),
});

const layerFilterSchema = z.object({
  type: filterTypeEnum,
  frequency: z.number().min(BOUNDS.filter.frequency.min).max(BOUNDS.filter.frequency.max),
  q: z.number().min(BOUNDS.filter.q.min).max(BOUNDS.filter.q.max),
  envelope: filterEnvelopeSchema.optional(),
});

const saturationSchema = z.object({
  type: saturationTypeEnum,
  drive: z.number().min(BOUNDS.saturation.drive.min).max(BOUNDS.saturation.drive.max),
  mix: z.number().min(BOUNDS.saturation.mix.min).max(BOUNDS.saturation.mix.max),
});

const layerSchema = z.object({
  type: layerTypeEnum,
  gain: z.number().min(BOUNDS.gain.min).max(BOUNDS.gain.max),
  envelope: envelopeSchema.optional(),
  filter: layerFilterSchema.optional(),
  saturation: saturationSchema.optional(),
  oscillator: oscillatorConfigSchema.optional(),
  noise: noiseConfigSchema.optional(),
  fm: fmConfigSchema.optional(),
  karplus: karplusConfigSchema.optional(),
});

const globalFilterSchema = z.object({
  type: globalFilterTypeEnum,
  frequency: z.number().min(BOUNDS.filter.frequency.min).max(BOUNDS.filter.frequency.max),
  q: z.number().min(BOUNDS.filter.q.min).max(BOUNDS.filter.q.max),
  gain: z.number().optional(), // dB for peaking filter
  envelope: filterEnvelopeSchema.optional(),
});

const lfoSchema = z.object({
  waveform: lfoWaveformEnum,
  frequency: z.number().min(BOUNDS.lfo.frequency.min).max(BOUNDS.lfo.frequency.max),
  depth: z.number().min(BOUNDS.lfo.depth.min).max(BOUNDS.lfo.depth.max),
  target: lfoTargetEnum,
  delay: z.number().min(BOUNDS.lfo.delay.min).max(BOUNDS.lfo.delay.max).optional(),
  fade: z.number().min(BOUNDS.lfo.fade.min).max(BOUNDS.lfo.fade.max).optional(),
});

const distortionSchema = z.object({
  type: distortionTypeEnum,
  amount: z.number().min(BOUNDS.distortion.amount.min).max(BOUNDS.distortion.amount.max),
  mix: z.number().min(BOUNDS.distortion.mix.min).max(BOUNDS.distortion.mix.max),
});

const reverbSchema = z.object({
  decay: z.number().min(BOUNDS.reverb.decay.min).max(BOUNDS.reverb.decay.max),
  damping: z.number().min(BOUNDS.reverb.damping.min).max(BOUNDS.reverb.damping.max),
  mix: z.number().min(BOUNDS.reverb.mix.min).max(BOUNDS.reverb.mix.max),
});

const delaySchema = z.object({
  time: z.number().min(BOUNDS.delay.time.min).max(BOUNDS.delay.time.max),
  feedback: z.number().min(BOUNDS.delay.feedback.min).max(BOUNDS.delay.feedback.max),
  mix: z.number().min(BOUNDS.delay.mix.min).max(BOUNDS.delay.mix.max),
});

const compressorSchema = z.object({
  threshold: z.number().min(BOUNDS.compressor.threshold.min).max(BOUNDS.compressor.threshold.max),
  ratio: z.number().min(BOUNDS.compressor.ratio.min).max(BOUNDS.compressor.ratio.max),
  attack: z.number().min(BOUNDS.compressor.attack.min).max(BOUNDS.compressor.attack.max),
  release: z.number().min(BOUNDS.compressor.release.min).max(BOUNDS.compressor.release.max),
  knee: z.number().min(BOUNDS.compressor.knee.min).max(BOUNDS.compressor.knee.max),
});

const gateSchema = z.object({
  attack: z.number().min(BOUNDS.gate.attack.min).max(BOUNDS.gate.attack.max),
  hold: z.number().min(BOUNDS.gate.hold.min).max(BOUNDS.gate.hold.max),
  release: z.number().min(BOUNDS.gate.release.min).max(BOUNDS.gate.release.max),
});

const chorusSchema = z.object({
  rate: z.number().min(BOUNDS.chorus.rate.min).max(BOUNDS.chorus.rate.max),
  depth: z.number().min(BOUNDS.chorus.depth.min).max(BOUNDS.chorus.depth.max),
  mix: z.number().min(BOUNDS.chorus.mix.min).max(BOUNDS.chorus.mix.max),
  feedback: z.number().min(BOUNDS.chorus.feedback.min).max(BOUNDS.chorus.feedback.max).optional(),
  delay: z.number().min(BOUNDS.chorus.delay.min).max(BOUNDS.chorus.delay.max).optional(),
});

const eqBandSchema = z.object({
  frequency: z.number().min(BOUNDS.eq.frequency.min).max(BOUNDS.eq.frequency.max),
  gain: z.number().min(BOUNDS.eq.gain.min).max(BOUNDS.eq.gain.max),
  q: z.number().min(BOUNDS.eq.q.min).max(BOUNDS.eq.q.max).optional(),
});

const eqSchema = z.object({
  low: eqBandSchema,
  mid: eqBandSchema,
  high: eqBandSchema,
});

const effectsSchema = z.object({
  distortion: distortionSchema.optional(),
  reverb: reverbSchema.optional(),
  delay: delaySchema.optional(),
  compressor: compressorSchema.optional(),
  gate: gateSchema.optional(),
  chorus: chorusSchema.optional(),
  eq: eqSchema.optional(),
});

const timingSchema = z.object({
  duration: z.number().min(BOUNDS.timing.duration.min).max(BOUNDS.timing.duration.max),
});

const dynamicsSchema = z.object({
  velocity: z.number().min(BOUNDS.dynamics.velocity.min).max(BOUNDS.dynamics.velocity.max),
  normalize: z.boolean(),
});

const metadataSchema = z.object({
  name: z.string(),
  category: categoryEnum,
  description: z.string(),
  tags: z.array(z.string()),
});

// ============================================================================
// Main SoundConfig Schema
// ============================================================================

export const soundConfigSchema = z.object({
  synthesis: z.object({
    layers: z.array(layerSchema).min(1),
  }),
  envelope: envelopeSchema,
  filter: globalFilterSchema.optional(),
  lfo: lfoSchema.optional(),
  effects: effectsSchema,
  timing: timingSchema,
  dynamics: dynamicsSchema,
  metadata: metadataSchema,
});

// ============================================================================
// Derived Types
// ============================================================================

export type SoundConfig = z.infer<typeof soundConfigSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type FilterConfig = z.infer<typeof globalFilterSchema>;
export type LFOConfig = z.infer<typeof lfoSchema>;
export type EffectsConfig = z.infer<typeof effectsSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  data?: SoundConfig;
  errors: Array<{ path: string; message: string }>;
}

/**
 * Validates and parses a SoundConfig, returning typed result
 */
export function validateSoundConfig(data: unknown): ValidationResult {
  const result = soundConfigSchema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

/**
 * Validates a JSON string as SoundConfig
 */
export function validateSoundConfigJSON(jsonString: string): ValidationResult {
  try {
    const data = JSON.parse(jsonString);
    return validateSoundConfig(data);
  } catch {
    return {
      valid: false,
      errors: [{ path: '', message: 'Invalid JSON syntax' }],
    };
  }
}

/**
 * Parses and validates, throwing on error (for trusted sources)
 */
export function parseSoundConfig(data: unknown): SoundConfig {
  return soundConfigSchema.parse(data);
}

/**
 * Coerces values to valid ranges (for UI/AI responses that might be slightly off)
 */
export function coerceSoundConfig(data: unknown): SoundConfig {
  // First try strict parse
  const strictResult = soundConfigSchema.safeParse(data);
  if (strictResult.success) {
    return strictResult.data;
  }
  
  // If that fails, we need to coerce - for now, just return with defaults for missing
  // This is a simplified coercion; expand as needed
  const partial = data as Record<string, unknown>;
  return soundConfigSchema.parse({
    ...DEFAULT_SOUND_CONFIG,
    ...partial,
  });
}

// ============================================================================
// Default Config
// ============================================================================

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  synthesis: {
    layers: [{
      type: 'oscillator',
      gain: 1,
      oscillator: {
        waveform: 'sine',
        frequency: 440,
        detune: 0,
        unison: { voices: 1, detune: 0, spread: 0 },
      },
    }],
  },
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.5,
    release: 0.3,
  },
  effects: {},
  timing: {
    duration: 1,
  },
  dynamics: {
    velocity: 0.8,
    normalize: true,
  },
  metadata: {
    name: 'Untitled Sound',
    category: 'other',
    description: '',
    tags: [],
  },
};

// ============================================================================
// JSON Schema for AI Prompts
// ============================================================================

/**
 * Generates a human-readable schema string for AI prompts
 */
export function generateSchemaPrompt(): string {
  const b = BOUNDS;
  return `{
  "synthesis": {
    "layers": [{
      "type": "oscillator" | "fm" | "noise" | "karplus-strong",
      "gain": number (${b.gain.min}-${b.gain.max}),
      "envelope": { "attack": number (${b.envelope.attack.min}-${b.envelope.attack.max}s), "decay": number (${b.envelope.decay.min}-${b.envelope.decay.max}s), "sustain": number (${b.envelope.sustain.min}-${b.envelope.sustain.max}), "release": number (${b.envelope.release.min}-${b.envelope.release.max}s) },
      "filter": {
        "type": "lowpass"|"highpass"|"bandpass"|"notch",
        "frequency": number (${b.filter.frequency.min}-${b.filter.frequency.max} Hz),
        "q": number (${b.filter.q.min}-${b.filter.q.max}),
        "envelope": { "amount": number (${b.filter.envelopeAmount.min}-${b.filter.envelopeAmount.max} Hz), "attack": number, "decay": number, "sustain": number (0-1), "release": number }
      },
      "saturation": { "type": "soft"|"hard"|"tube"|"tape", "drive": number (${b.saturation.drive.min}-${b.saturation.drive.max}), "mix": number (${b.saturation.mix.min}-${b.saturation.mix.max}) },
      "oscillator": {
        "waveform": "sine"|"square"|"sawtooth"|"triangle",
        "frequency": number (${b.oscillator.frequency.min}-${b.oscillator.frequency.max} Hz),
        "detune": number (${b.oscillator.detune.min}-${b.oscillator.detune.max} cents),
        "unison": { "voices": number (${b.unison.voices.min}-${b.unison.voices.max}), "detune": number (${b.unison.detune.min}-${b.unison.detune.max} cents), "spread": number (${b.unison.spread.min}-${b.unison.spread.max}) },
        "sub": { "level": number (${b.sub.level.min}-${b.sub.level.max}), "octave": -1 | -2, "waveform": "sine"|"square"|"triangle" },
        "pitchEnvelope": { "amount": number (${b.pitchEnvelope.amount.min}-${b.pitchEnvelope.amount.max} cents), "attack": number (${b.pitchEnvelope.attack.min}-${b.pitchEnvelope.attack.max}s), "decay": number (${b.pitchEnvelope.decay.min}-${b.pitchEnvelope.decay.max}s), "sustain": number (${b.pitchEnvelope.sustain.min}-${b.pitchEnvelope.sustain.max} cents), "release": number (${b.pitchEnvelope.release.min}-${b.pitchEnvelope.release.max}s) }
      },
      "fm": { "carrier": number (${b.fm.carrier.min}-${b.fm.carrier.max} Hz), "modulator": number (${b.fm.modulator.min}-${b.fm.modulator.max} Hz), "modulationIndex": number (${b.fm.modulationIndex.min}-${b.fm.modulationIndex.max}) },
      "noise": { "type": "white"|"pink"|"brown" },
      "karplus": { "frequency": number (${b.karplus.frequency.min}-${b.karplus.frequency.max} Hz), "damping": number (${b.karplus.damping.min}-${b.karplus.damping.max}) }
    }]
  },
  "envelope": { "attack": number (${b.envelope.attack.min}-${b.envelope.attack.max}s), "decay": number (${b.envelope.decay.min}-${b.envelope.decay.max}s), "sustain": number (${b.envelope.sustain.min}-${b.envelope.sustain.max}), "release": number (${b.envelope.release.min}-${b.envelope.release.max}s) },
  "filter": {
    "type": "lowpass"|"highpass"|"bandpass"|"notch"|"allpass"|"peaking",
    "frequency": number (${b.filter.frequency.min}-${b.filter.frequency.max} Hz),
    "q": number (${b.filter.q.min}-${b.filter.q.max}),
    "gain": number (dB, for peaking),
    "envelope": { "amount": number (${b.filter.envelopeAmount.min}-${b.filter.envelopeAmount.max} Hz), "attack": number, "decay": number, "sustain": number (0-1), "release": number }
  },
  "lfo": {
    "waveform": "sine"|"square"|"sawtooth"|"triangle"|"random",
    "frequency": number (${b.lfo.frequency.min}-${b.lfo.frequency.max} Hz),
    "depth": number (${b.lfo.depth.min}-${b.lfo.depth.max}),
    "target": "pitch"|"filter"|"amplitude"|"pan",
    "delay": number (${b.lfo.delay.min}-${b.lfo.delay.max}s),
    "fade": number (${b.lfo.fade.min}-${b.lfo.fade.max}s)
  },
  "effects": {
    "distortion": { "type": "soft"|"hard"|"fuzz"|"bitcrush"|"waveshaper", "amount": number (${b.distortion.amount.min}-${b.distortion.amount.max}), "mix": number (${b.distortion.mix.min}-${b.distortion.mix.max}) },
    "reverb": { "decay": number (${b.reverb.decay.min}-${b.reverb.decay.max}s), "damping": number (${b.reverb.damping.min}-${b.reverb.damping.max}), "mix": number (${b.reverb.mix.min}-${b.reverb.mix.max}) },
    "delay": { "time": number (${b.delay.time.min}-${b.delay.time.max}s), "feedback": number (${b.delay.feedback.min}-${b.delay.feedback.max}), "mix": number (${b.delay.mix.min}-${b.delay.mix.max}) },
    "compressor": { "threshold": number (${b.compressor.threshold.min}-${b.compressor.threshold.max} dB), "ratio": number (${b.compressor.ratio.min}-${b.compressor.ratio.max}), "attack": number (${b.compressor.attack.min}-${b.compressor.attack.max}s), "release": number (${b.compressor.release.min}-${b.compressor.release.max}s), "knee": number (${b.compressor.knee.min}-${b.compressor.knee.max} dB) },
    "gate": { "attack": number (${b.gate.attack.min}-${b.gate.attack.max}s), "hold": number (${b.gate.hold.min}-${b.gate.hold.max}s), "release": number (${b.gate.release.min}-${b.gate.release.max}s) },
    "chorus": { "rate": number (${b.chorus.rate.min}-${b.chorus.rate.max} Hz), "depth": number (${b.chorus.depth.min}-${b.chorus.depth.max}), "mix": number (${b.chorus.mix.min}-${b.chorus.mix.max}), "feedback": number (${b.chorus.feedback.min}-${b.chorus.feedback.max}), "delay": number (${b.chorus.delay.min}-${b.chorus.delay.max} ms, 1-5=flanger, 20-50=chorus) },
    "eq": { "low": { "frequency": number, "gain": number (${b.eq.gain.min}-${b.eq.gain.max} dB) }, "mid": { "frequency": number, "gain": number (${b.eq.gain.min}-${b.eq.gain.max} dB), "q": number (${b.eq.q.min}-${b.eq.q.max}) }, "high": { "frequency": number, "gain": number (${b.eq.gain.min}-${b.eq.gain.max} dB) } }
  },
  "timing": { "duration": number (${b.timing.duration.min}-${b.timing.duration.max}s) },
  "dynamics": { "velocity": number (${b.dynamics.velocity.min}-${b.dynamics.velocity.max}), "normalize": boolean },
  "metadata": { "name": string, "category": "kick"|"snare"|"hihat"|"tom"|"perc"|"bass"|"lead"|"pad"|"fx"|"other", "description": string, "tags": string[] }
}`;
}

/**
 * Generates a compact schema for batch/percussive prompts
 */
export function generateBatchSchemaPrompt(): string {
  const b = BOUNDS;
  return `{
  "synthesis": {
    "layers": [{
      "type": "oscillator" | "fm" | "noise",
      "gain": number (${b.gain.min}-${b.gain.max}),
      "envelope": { "attack": number, "decay": number, "sustain": number (0-1), "release": number },
      "filter": { "type": "lowpass"|"highpass"|"bandpass"|"notch", "frequency": number, "q": number, "envelope": { "amount": number, "attack": number, "decay": number, "sustain": number, "release": number } },
      "saturation": { "type": "soft"|"hard"|"tube"|"tape", "drive": number (0-10), "mix": number (0-1) },
      "oscillator": { "waveform": "sine"|"square"|"sawtooth"|"triangle", "frequency": number, "detune": number, "pitchEnvelope": { "amount": number (cents), "attack": number, "decay": number, "sustain": number (cents), "release": number } },
      "fm": { "carrier": number, "modulator": number, "modulationIndex": number },
      "noise": { "type": "white"|"pink"|"brown" }
    }]
  },
  "envelope": { "attack": number, "decay": number, "sustain": number (0-1), "release": number },
  "filter": { "type": "lowpass"|"highpass"|"bandpass"|"notch", "frequency": number, "q": number, "envelope": { "amount": number, "attack": number, "decay": number, "sustain": number, "release": number } },
  "effects": {
    "distortion": { "type": "soft"|"hard"|"fuzz"|"bitcrush", "amount": number (0-1), "mix": number (0-1) },
    "compressor": { "threshold": number (dB), "ratio": number, "attack": number, "release": number },
    "chorus": { "rate": number (Hz), "depth": number (0-1), "mix": number (0-1), "feedback": number (0-0.9), "delay": number (ms, 1-5=flanger, 20-50=chorus) },
    "eq": { "low": { "frequency": number, "gain": number (dB) }, "mid": { "frequency": number, "gain": number (dB), "q": number }, "high": { "frequency": number, "gain": number (dB) } }
  },
  "timing": { "duration": number (0.05-0.5s for drums) },
  "dynamics": { "velocity": number (0-1), "normalize": true },
  "metadata": { "name": string, "category": string, "description": string, "tags": string[] }
}`;
}
