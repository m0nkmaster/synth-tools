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
    detune: { min: 0, max: 100 },  // cents per voice
    spread: { min: 0, max: 1 },  // Stereo width: 0 = mono/center, 1 = full stereo spread
  },
  sub: {
    level: { min: 0, max: 1 },
  },
  filter: {
    frequency: { min: 20, max: 20000 },  // Cutoff frequency in Hz
    q: { min: 0.1, max: 100 },  // Resonance: 0.1-1 = gentle, 1-5 = resonant peak, 5-10 = self-oscillation, 10+ = extreme
    envelopeAmount: { min: -10000, max: 10000 },  // Hz offset from base frequency over envelope
  },
  saturation: {
    drive: { min: 0, max: 1 },  // Saturation amount: 0 = clean, 1 = heavily saturated
    mix: { min: 0, max: 1 },  // Dry/wet blend: 0 = clean, 1 = fully saturated
  },
  fm: {
    ratio: { min: 0.5, max: 16 },  // Frequency multiplier relative to base pitch
    modulationIndex: { min: 0, max: 1 },  // FM modulation depth: 0-1 (Hz deviation = value × carrierFreqHz)
    feedback: { min: 0, max: 1 },  // Self-modulation amount (0=none, 0.3=metallic, 0.7+=harsh)
  },
  karplus: {
    frequency: { min: 20, max: 2000 },
    damping: { min: 0, max: 1 },  // 0 = long sustain/ring, 1 = short pluck/decay
    inharmonicity: { min: 0, max: 1 },  // Stretches higher partials: 0 = pure/plucked string, 0.3-0.5 = piano-like, 1 = bell-like
  },
  lfo: {
    frequency: { min: 0.01, max: 20 },  // LFO rate in Hz
    depth: { min: 0, max: 1 },  // Modulation amount (target-dependent: pitch=cents*100, filter=freq multiplier, amplitude/pan=direct)
    delay: { min: 0, max: 10 },  // Seconds before LFO starts
    fade: { min: 0, max: 10 },  // Seconds to fade in LFO after delay
  },
  distortion: {
    amount: { min: 0, max: 1 },  // Distortion intensity
    mix: { min: 0, max: 1 },  // Dry/wet blend: 0 = clean, 1 = fully distorted
  },
  reverb: {
    decay: { min: 0.1, max: 5 },  // Reverb tail length in seconds (capped at 5s for performance)
    damping: { min: 0, max: 1 },  // High frequency absorption: 0 = bright/reflective, 1 = dark/absorptive
    mix: { min: 0, max: 1 },  // Dry/wet blend: 0 = dry only, 1 = wet only
  },
  delay: {
    time: { min: 0.01, max: 2 },  // Delay time in seconds
    feedback: { min: 0, max: 0.9 },  // Feedback amount: 0 = single echo, 0.9 = long repeating echoes
    mix: { min: 0, max: 1 },  // Dry/wet blend
  },
  compressor: {
    threshold: { min: -60, max: 0 },  // dB level where compression starts
    ratio: { min: 1, max: 20 },  // Compression ratio: 1 = no compression, 20 = extreme limiting
    attack: { min: 0, max: 1 },  // Seconds: how quickly compression engages
    release: { min: 0, max: 1 },  // Seconds: how quickly compression disengages
    knee: { min: 0, max: 40 },  // dB: 0 = hard knee (abrupt), 40 = soft knee (gradual)
  },
  gate: {
    attack: { min: 0, max: 1 },  // Seconds: gate opening time
    hold: { min: 0, max: 2 },  // Seconds: how long gate stays open
    release: { min: 0, max: 1 },  // Seconds: gate closing time
  },
  pitchEnvelope: {
    amount: { min: -4800, max: 4800 },  // cents (±4 octaves)
    attack: { min: 0, max: 2 },
    decay: { min: 0.001, max: 5 },
    sustain: { min: 0, max: 1 },  // Sustain level (percentage of amount)
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
    frequency: { min: 20, max: 20000 },  // General range for Zod validation
    q: { min: 0.1, max: 10 },
    // Per-band frequency limits (synth clamps to these ranges)
    low: { frequency: { min: 20, max: 2000 } },
    mid: { frequency: { min: 100, max: 10000 } },
    high: { frequency: { min: 1000, max: 20000 } },
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

// Helper to clamp envelope time values to valid range (AI sometimes returns 0)
const clampedEnvelopeTime = (min: number, max: number) =>
  z.number().transform(v => Math.max(min, Math.min(max, v)));

const envelopeSchema = z.object({
  attack: clampedEnvelopeTime(BOUNDS.envelope.attack.min, BOUNDS.envelope.attack.max),
  decay: clampedEnvelopeTime(BOUNDS.envelope.decay.min, BOUNDS.envelope.decay.max),
  sustain: z.number().min(BOUNDS.envelope.sustain.min).max(BOUNDS.envelope.sustain.max),
  release: clampedEnvelopeTime(BOUNDS.envelope.release.min, BOUNDS.envelope.release.max),
});

const filterEnvelopeSchema = z.object({
  amount: z.number().min(BOUNDS.filter.envelopeAmount.min).max(BOUNDS.filter.envelopeAmount.max),
  attack: clampedEnvelopeTime(BOUNDS.envelope.attack.min, BOUNDS.envelope.attack.max),
  decay: clampedEnvelopeTime(BOUNDS.envelope.decay.min, BOUNDS.envelope.decay.max),
  sustain: z.number().min(BOUNDS.envelope.sustain.min).max(BOUNDS.envelope.sustain.max),
  release: clampedEnvelopeTime(BOUNDS.envelope.release.min, BOUNDS.envelope.release.max),
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
  attack: clampedEnvelopeTime(BOUNDS.pitchEnvelope.attack.min, BOUNDS.pitchEnvelope.attack.max),
  decay: clampedEnvelopeTime(BOUNDS.pitchEnvelope.decay.min, BOUNDS.pitchEnvelope.decay.max),
  sustain: z.number(),
  release: clampedEnvelopeTime(BOUNDS.pitchEnvelope.release.min, BOUNDS.pitchEnvelope.release.max),
}).transform(env => {
  // Migration: Convert old cent-based sustain to percentage-based
  // Old format: sustain was absolute cents
  // New format: sustain is percentage of amount (0-1)
  // If sustain > 1, assume it's old format and convert: sustainLevel = sustainCents / amount
  if (env.sustain > 1 && env.amount !== 0) {
    return {
      ...env,
      sustain: Math.max(0, Math.min(1, env.sustain / Math.abs(env.amount))),
    };
  }
  // Clamp to valid range
  return {
    ...env,
    sustain: Math.max(BOUNDS.pitchEnvelope.sustain.min, Math.min(BOUNDS.pitchEnvelope.sustain.max, env.sustain)),
  };
});

const oscillatorConfigSchema = z.object({
  waveform: waveformEnum,
  frequency: z.number().min(BOUNDS.oscillator.frequency.min).max(BOUNDS.oscillator.frequency.max).default(440),
  detune: z.number().min(BOUNDS.oscillator.detune.min).max(BOUNDS.oscillator.detune.max).default(0),
  unison: unisonSchema.optional(),
  sub: subOscillatorSchema.optional(),
  pitchEnvelope: pitchEnvelopeSchema.optional(),
});

const noiseConfigSchema = z.object({
  type: noiseTypeEnum,
});

// FM operator envelope (modulator amplitude over time - critical for FM timbres)
const fmEnvelopeSchema = z.object({
  attack: clampedEnvelopeTime(BOUNDS.envelope.attack.min, BOUNDS.envelope.attack.max),
  decay: clampedEnvelopeTime(BOUNDS.envelope.decay.min, BOUNDS.envelope.decay.max),
  sustain: z.number().min(BOUNDS.envelope.sustain.min).max(BOUNDS.envelope.sustain.max),
  release: clampedEnvelopeTime(BOUNDS.envelope.release.min, BOUNDS.envelope.release.max),
});

const fmConfigSchema = z.object({
  ratio: z.number().min(BOUNDS.fm.ratio.min).max(BOUNDS.fm.ratio.max),
  waveform: waveformEnum.default('sine'),
  modulationIndex: z.number().min(BOUNDS.fm.modulationIndex.min).max(BOUNDS.fm.modulationIndex.max),
  feedback: z.number().min(BOUNDS.fm.feedback.min).max(BOUNDS.fm.feedback.max).default(0),
  modulatesLayer: z.number().int().min(0).optional(),  // Index of layer to modulate (undefined = output)
  envelope: fmEnvelopeSchema.optional(),
});

const karplusConfigSchema = z.object({
  frequency: z.number().min(BOUNDS.karplus.frequency.min).max(BOUNDS.karplus.frequency.max),
  damping: z.number().min(BOUNDS.karplus.damping.min).max(BOUNDS.karplus.damping.max),
  inharmonicity: z.number().min(BOUNDS.karplus.inharmonicity.min).max(BOUNDS.karplus.inharmonicity.max).optional(),
});

const layerFilterSchema = z.object({
  type: filterTypeEnum,
  frequency: z.number().min(BOUNDS.filter.frequency.min).max(BOUNDS.filter.frequency.max),
  q: z.number().min(BOUNDS.filter.q.min).max(BOUNDS.filter.q.max),
  envelope: filterEnvelopeSchema.optional(),
});

const saturationSchema = z.object({
  type: z.string().transform(v => 
    saturationTypeEnum.options.includes(v as typeof saturationTypeEnum.options[number]) 
      ? v as typeof saturationTypeEnum.options[number]
      : 'soft'
  ),
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
  duration: z.number().transform(v => 
    Math.max(BOUNDS.timing.duration.min, Math.min(BOUNDS.timing.duration.max, v))
  ),
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
export type FMConfig = z.infer<typeof fmConfigSchema>;

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
    layers: [
      {
        type: 'oscillator',
        gain: 0.5,
        oscillator: {
          waveform: 'sawtooth',
          frequency: 440,
          detune: 0,
          unison: { voices: 2, detune: 15, spread: 0.2 },
        },
        filter: {
          type: 'lowpass',
          frequency: 600,
          q: 0.8,
          envelope: { amount: 3500, attack: 0, decay: 0.3, sustain: 0, release: 0.1 },
        },
        envelope: { attack: 0.002, decay: 2.5, sustain: 0, release: 0.5 },
      },
      {
        type: 'oscillator',
        gain: 0.6,
        oscillator: {
          waveform: 'triangle',
          frequency: 440,
          detune: 0,
          unison: { voices: 1, detune: 0, spread: 0 },
        },
        envelope: { attack: 0.002, decay: 3, sustain: 0, release: 0.6 },
      },
      {
        type: 'noise',
        gain: 0.1,
        noise: { type: 'pink' },
        filter: {
          type: 'bandpass',
          frequency: 2000,
          q: 1,
          envelope: { amount: 0, attack: 0, decay: 0, sustain: 0, release: 0 },
        },
        envelope: { attack: 0, decay: 0.05, sustain: 0, release: 0.01 },
      },
    ],
  },
  envelope: {
    attack: 0.00138811771238201,
    decay: 2.082176568573015,
    sustain: 0,
    release: 0.416435313714603,
  },
  filter: {
    type: 'lowpass',
    frequency: 12000,
    q: 0.5,
    gain: 0,
    envelope: { amount: 0, attack: 0, decay: 0, sustain: 0, release: 0 },
  },
  effects: {
    reverb: { decay: 2, damping: 0.4, mix: 0.35 },
    compressor: { threshold: -18, ratio: 3, attack: 0.005, release: 0.2, knee: 10 },
  },
  timing: {
    duration: 2.5,
  },
  dynamics: {
    velocity: 0.85,
    normalize: true,
  },
  metadata: {
    name: 'Grand Piano',
    category: 'other',
    description: 'A rich, multi-layered acoustic piano simulation using filtered sawtooths for brightness, triangle for body, and a noise burst for the hammer strike.',
    tags: ['piano', 'acoustic', 'keys', 'classical'],
  },
};

// ============================================================================
// JSON Schema for AI Prompts (auto-generated from enums + BOUNDS)
// ============================================================================

/** Helper to format enum values as "a"|"b"|"c" */
function enumStr(zodEnum: { options: readonly string[] }): string {
  return zodEnum.options.map(v => `"${v}"`).join('|');
}

/** Helper to format bounds as (min-max) */
function range(bounds: { min: number; max: number }, unit = ''): string {
  return `(${bounds.min}-${bounds.max}${unit ? ' ' + unit : ''})`;
}

/**
 * Generates a human-readable schema string for AI prompts
 * Auto-generated from Zod enums and BOUNDS - no manual duplication
 */
export function generateSchemaPrompt(): string {
  const b = BOUNDS;
  return `CRITICAL: You MUST use EXACT enum values as shown. DO NOT use synonyms or variations.
For example:
- Use "oscillator" NOT "osc" or "synthesizer"  
- Use "karplus-strong" NOT "karplus" or "physical-modeling"
- Use "lowpass" NOT "low-pass" or "lp"

STRICT RULES:
- ONLY use exact enum values shown below - do not invent alternatives
- Keep all numbers within specified bounds
- Return raw JSON only, no markdown

SCHEMA:
{
  "synthesis": {
    "layers": [{
      "type": ${enumStr(layerTypeEnum)},
      "gain": number ${range(b.gain)},
      "envelope": { "attack": number ${range(b.envelope.attack, 's')}, "decay": number ${range(b.envelope.decay, 's')}, "sustain": number ${range(b.envelope.sustain)}, "release": number ${range(b.envelope.release, 's')} },
      "filter": {
        "type": ${enumStr(filterTypeEnum)},
        "frequency": number ${range(b.filter.frequency, 'Hz')},
        "q": number ${range(b.filter.q)},
        "envelope": { "amount": number ${range(b.filter.envelopeAmount, 'Hz')}, "attack": number, "decay": number, "sustain": number (0-1), "release": number }
      },
      "saturation": { "type": ${enumStr(saturationTypeEnum)}, "drive": number ${range(b.saturation.drive)}, "mix": number ${range(b.saturation.mix)} },
      "oscillator": {
        "waveform": ${enumStr(waveformEnum)},
        "frequency": number ${range(b.oscillator.frequency, 'Hz')},
        "detune": number ${range(b.oscillator.detune, 'cents')},
        "unison": { "voices": number ${range(b.unison.voices)}, "detune": number ${range(b.unison.detune, 'cents')}, "spread": number ${range(b.unison.spread)} },
        "sub": { "level": number ${range(b.sub.level)}, "octave": -1 | -2, "waveform": "sine"|"square"|"triangle" },
        "pitchEnvelope": { "amount": number ${range(b.pitchEnvelope.amount, 'cents')}, "attack": number ${range(b.pitchEnvelope.attack, 's')}, "decay": number ${range(b.pitchEnvelope.decay, 's')}, "sustain": number ${range(b.pitchEnvelope.sustain)} (percentage of amount), "release": number ${range(b.pitchEnvelope.release, 's')} }
      },
      "fm": { "ratio": number ${range(b.fm.ratio)} (frequency multiplier relative to base pitch), "waveform": ${enumStr(waveformEnum)}, "modulationIndex": number ${range(b.fm.modulationIndex)} (FM depth: Hz deviation = value × carrierFreqHz), "feedback": number ${range(b.fm.feedback)} (self-modulation: 0=none, >0.3=metallic, >0.7=harsh), "modulatesLayer": number (optional: index of FM layer to modulate; when set, this layer's output routes to target layer's frequency input instead of audio output), "envelope": { "attack": number, "decay": number, "sustain": number, "release": number } (optional: modulates FM depth over time) },
      "noise": { "type": ${enumStr(noiseTypeEnum)} },
      "karplus": { "frequency": number ${range(b.karplus.frequency, 'Hz')}, "damping": number ${range(b.karplus.damping)} (0=long sustain, 1=short pluck), "inharmonicity": number ${range(b.karplus.inharmonicity)} (0=pure/plucked, 0.3-0.5=piano, 1=bell) }
    }]
  },
  "envelope": { "attack": number ${range(b.envelope.attack, 's')}, "decay": number ${range(b.envelope.decay, 's')}, "sustain": number ${range(b.envelope.sustain)}, "release": number ${range(b.envelope.release, 's')} },
  "filter": {
    "type": ${enumStr(globalFilterTypeEnum)},
    "frequency": number ${range(b.filter.frequency, 'Hz')},
    "q": number ${range(b.filter.q)},
    "gain": number (dB, for peaking),
    "envelope": { "amount": number ${range(b.filter.envelopeAmount, 'Hz')}, "attack": number, "decay": number, "sustain": number (0-1), "release": number }
  },
  "lfo": {
    "waveform": ${enumStr(lfoWaveformEnum)},
    "frequency": number ${range(b.lfo.frequency, 'Hz')},
    "depth": number ${range(b.lfo.depth)},
    "target": ${enumStr(lfoTargetEnum)},
    "delay": number ${range(b.lfo.delay, 's')},
    "fade": number ${range(b.lfo.fade, 's')}
  },
  "effects": {
    "distortion": { "type": ${enumStr(distortionTypeEnum)}, "amount": number ${range(b.distortion.amount)}, "mix": number ${range(b.distortion.mix)} },
    "reverb": { "decay": number ${range(b.reverb.decay, 's')}, "damping": number ${range(b.reverb.damping)}, "mix": number ${range(b.reverb.mix)} },
    "delay": { "time": number ${range(b.delay.time, 's')}, "feedback": number ${range(b.delay.feedback)}, "mix": number ${range(b.delay.mix)} },
    "compressor": { "threshold": number ${range(b.compressor.threshold, 'dB')}, "ratio": number ${range(b.compressor.ratio)}, "attack": number ${range(b.compressor.attack, 's')}, "release": number ${range(b.compressor.release, 's')}, "knee": number ${range(b.compressor.knee, 'dB')} },
    "gate": { "attack": number ${range(b.gate.attack, 's')}, "hold": number ${range(b.gate.hold, 's')}, "release": number ${range(b.gate.release, 's')} },
    "chorus": { "rate": number ${range(b.chorus.rate, 'Hz')}, "depth": number ${range(b.chorus.depth)}, "mix": number ${range(b.chorus.mix)}, "feedback": number ${range(b.chorus.feedback)}, "delay": number ${range(b.chorus.delay, 'ms')} (1-5=flanger, 20-50=chorus) },
    "eq": { "low": { "frequency": number (20-2000 Hz), "gain": number ${range(b.eq.gain, 'dB')} }, "mid": { "frequency": number (100-10000 Hz), "gain": number ${range(b.eq.gain, 'dB')}, "q": number ${range(b.eq.q)} }, "high": { "frequency": number (1000-20000 Hz), "gain": number ${range(b.eq.gain, 'dB')} } }
  },
  "timing": { "duration": number ${range(b.timing.duration, 's')} },
  "dynamics": { "velocity": number ${range(b.dynamics.velocity)}, "normalize": boolean },
  "metadata": { "name": string, "category": ${enumStr(categoryEnum)}, "description": string, "tags": string[] }
}`;
}

/**
 * Generates a compact schema for batch/percussive prompts
 * Auto-generated from Zod enums and BOUNDS - no manual duplication
 */
export function generateBatchSchemaPrompt(): string {
  const b = BOUNDS;
  return `CRITICAL: You MUST use EXACT enum values as shown. DO NOT use synonyms or variations.

STRICT RULES:
- ONLY use exact enum values shown below - do not invent alternatives
- Keep all numbers within specified bounds
- Return raw JSON only, no markdown

SCHEMA:
{
  "synthesis": {
    "layers": [{
      "type": ${enumStr(layerTypeEnum)},
      "gain": number ${range(b.gain)},
      "envelope": { "attack": number ${range(b.envelope.attack, 's')}, "decay": number ${range(b.envelope.decay, 's')}, "sustain": number ${range(b.envelope.sustain)}, "release": number ${range(b.envelope.release, 's')} },
      "filter": { "type": ${enumStr(filterTypeEnum)}, "frequency": number ${range(b.filter.frequency, 'Hz')}, "q": number ${range(b.filter.q)}, "envelope": { "amount": number ${range(b.filter.envelopeAmount, 'Hz')}, "attack": number, "decay": number, "sustain": number, "release": number } },
      "saturation": { "type": ${enumStr(saturationTypeEnum)}, "drive": number ${range(b.saturation.drive)}, "mix": number ${range(b.saturation.mix)} },
      "oscillator": { "waveform": ${enumStr(waveformEnum)}, "frequency": number ${range(b.oscillator.frequency, 'Hz')}, "detune": number ${range(b.oscillator.detune, 'cents')}, "pitchEnvelope": { "amount": number ${range(b.pitchEnvelope.amount, 'cents')}, "attack": number, "decay": number, "sustain": number ${range(b.pitchEnvelope.sustain)} (percentage of amount), "release": number } },
      "fm": { "ratio": number ${range(b.fm.ratio)} (frequency multiplier relative to base pitch), "waveform": ${enumStr(waveformEnum)}, "modulationIndex": number ${range(b.fm.modulationIndex)} (FM depth: Hz deviation = value × carrierFreqHz), "feedback": number ${range(b.fm.feedback)} (self-modulation: 0=none, >0.3=metallic, >0.7=harsh), "modulatesLayer": number (optional: routes modulation to target FM layer instead of audio output), "envelope": { attack, decay, sustain, release } (optional: modulates FM depth over time) },
      "noise": { "type": ${enumStr(noiseTypeEnum)} },
      "karplus": { "frequency": number ${range(b.karplus.frequency, 'Hz')}, "damping": number ${range(b.karplus.damping)} (0=long sustain, 1=short pluck), "inharmonicity": number ${range(b.karplus.inharmonicity)} (0=pure/plucked, 0.3-0.5=piano, 1=bell) }
    }]
  },
  "envelope": { "attack": number ${range(b.envelope.attack, 's')}, "decay": number ${range(b.envelope.decay, 's')}, "sustain": number ${range(b.envelope.sustain)}, "release": number ${range(b.envelope.release, 's')} },
  "filter": { "type": ${enumStr(globalFilterTypeEnum)}, "frequency": number ${range(b.filter.frequency, 'Hz')}, "q": number ${range(b.filter.q)}, "envelope": { "amount": number ${range(b.filter.envelopeAmount, 'Hz')}, "attack": number, "decay": number, "sustain": number, "release": number } },
  "effects": {
    "distortion": { "type": ${enumStr(distortionTypeEnum)}, "amount": number ${range(b.distortion.amount)}, "mix": number ${range(b.distortion.mix)} },
    "compressor": { "threshold": number ${range(b.compressor.threshold, 'dB')}, "ratio": number ${range(b.compressor.ratio)}, "attack": number ${range(b.compressor.attack, 's')}, "release": number ${range(b.compressor.release, 's')}, "knee": number ${range(b.compressor.knee, 'dB')} },
    "chorus": { "rate": number ${range(b.chorus.rate, 'Hz')}, "depth": number ${range(b.chorus.depth)}, "mix": number ${range(b.chorus.mix)}, "feedback": number ${range(b.chorus.feedback)}, "delay": number ${range(b.chorus.delay, 'ms')} (1-5=flanger, 20-50=chorus) },
    "eq": { "low": { "frequency": number (20-2000 Hz), "gain": number ${range(b.eq.gain, 'dB')} }, "mid": { "frequency": number (100-10000 Hz), "gain": number ${range(b.eq.gain, 'dB')}, "q": number ${range(b.eq.q)} }, "high": { "frequency": number (1000-20000 Hz), "gain": number ${range(b.eq.gain, 'dB')} } }
  },
  "timing": { "duration": number ${range(b.timing.duration, 's')} },
  "dynamics": { "velocity": number ${range(b.dynamics.velocity)}, "normalize": boolean },
  "metadata": { "name": string, "category": ${enumStr(categoryEnum)}, "description": string, "tags": string[] }
}`;
}

/**
 * Generate human-readable parameter descriptions for AI prompts
 * Auto-generated from BOUNDS to prevent documentation drift
 */
export function generateParameterGuide(): string {
  const b = BOUNDS;
  return `
LAYER TYPES:
- oscillator: Generates periodic waveforms (sine, square, sawtooth, triangle)
  * frequency: ${range(b.oscillator.frequency, 'Hz')}
  * detune: ${range(b.oscillator.detune, 'cents')}
  * unison: Multiple detuned voices (${range(b.unison.voices)} voices, detune ${range(b.unison.detune, 'cents')}, stereo spread ${range(b.unison.spread)})
  * sub: Sub-oscillator ${range(b.sub.level)} level, 1 or 2 octaves below
  * pitchEnvelope: ADSR envelope modulating pitch (amount ${range(b.pitchEnvelope.amount, 'cents')}, sustain ${range(b.pitchEnvelope.sustain)} = percentage of amount)

- noise: Generates white, pink, or brown noise

- fm: FM synthesis operator
  * ratio: ${range(b.fm.ratio)} - frequency multiplier relative to base pitch
  * modulationIndex: ${range(b.fm.modulationIndex)} - FM depth where Hz deviation = value × carrierFreqHz
  * feedback: ${range(b.fm.feedback)} - self-modulation (>0.3=metallic, >0.7=harsh)
  * modulatesLayer: Optional index of another FM layer to modulate (this layer outputs to that layer's frequency, not audio)
  * envelope: Optional ADSR to modulate FM depth over time

- karplus-strong: Physical modeling for plucked/struck strings
  * frequency: ${range(b.karplus.frequency, 'Hz')}
  * damping: ${range(b.karplus.damping)} (0=long sustain, 1=short pluck)
  * inharmonicity: ${range(b.karplus.inharmonicity)} (0=pure/string, 0.3-0.5=piano, 1=bell)

PER-LAYER PROCESSING:
- gain: ${range(b.gain)}
- envelope: Optional ADSR (attack ${range(b.envelope.attack, 's')}, decay ${range(b.envelope.decay, 's')}, sustain ${range(b.envelope.sustain)}, release ${range(b.envelope.release, 's')})
- filter: Optional (${enumStr(filterTypeEnum)}) with frequency ${range(b.filter.frequency, 'Hz')}, Q ${range(b.filter.q)}
- saturation: Optional (${enumStr(saturationTypeEnum)}) with drive ${range(b.saturation.drive)}, mix ${range(b.saturation.mix)}

GLOBAL PROCESSING:
- envelope: Master ADSR (always applied)
- filter: Optional (${enumStr(globalFilterTypeEnum)})
- lfo: Optional (waveform ${enumStr(lfoWaveformEnum)}, frequency ${range(b.lfo.frequency, 'Hz')}, depth ${range(b.lfo.depth)}, target ${enumStr(lfoTargetEnum)})

EFFECTS (order: EQ → Distortion → Compressor → Chorus → Delay → Reverb → Gate):
- distortion: type ${enumStr(distortionTypeEnum)}, amount ${range(b.distortion.amount)}, mix ${range(b.distortion.mix)}
- compressor: threshold ${range(b.compressor.threshold, 'dB')}, ratio ${range(b.compressor.ratio)}
- chorus: rate ${range(b.chorus.rate, 'Hz')}, depth ${range(b.chorus.depth)}, delay ${range(b.chorus.delay, 'ms')} (1-5=flanger, 20-50=chorus)
- reverb: decay ${range(b.reverb.decay, 's')}, damping ${range(b.reverb.damping)} (0=bright, 1=dark)
- delay: time ${range(b.delay.time, 's')}, feedback ${range(b.delay.feedback)}
- eq: 3-band with gain ${range(b.eq.gain, 'dB')} per band
- gate: attack ${range(b.gate.attack, 's')}, hold ${range(b.gate.hold, 's')}, release ${range(b.gate.release, 's')}
`.trim();
}
