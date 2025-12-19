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
    attack: { min: 0.001, max: 5 },  // Attack timing: <0.002s=percussive/pluck, 0.002-0.01s=piano/mallet, 0.01-0.05s=soft strike, 0.05-0.2s=bowed/blown, 0.2-1s+=swells. Typical: 0.005-0.02s
    decay: { min: 0.001, max: 5 },  // Peak to sustain time: 0.01-0.1s=tight, 0.1-0.5s=snappy, 0.5-2s=moderate, 2-5s=long. For sustain=0 sounds, this IS the body length
    sustain: { min: 0, max: 1 },  // Held level: 0=one-shot/percussive/plucks, 0.1-0.3=gentle fade, 0.5-0.8=sustained notes, 0.9-1.0=organs/drones
    release: { min: 0.001, max: 10 },  // Fadeout after note off: 0.01-0.1s=tight, 0.1-0.5s=natural, 0.5-2s=long tail, 2-10s=extreme ambient
  },
  oscillator: {
    frequency: { min: 20, max: 20000 },
    detune: { min: -1200, max: 1200 },
  },
  unison: {
    voices: { min: 1, max: 8 },  // 1=mono, 2-3=subtle thickness, 4-6=supersaw, 7-8=extreme. Typical: 2-3
    detune: { min: 0, max: 100 },  // Cents per voice: 0=unison, 5-15=subtle, 20-40=obvious, 50-100=extreme detuning. Typical: 10-20
    spread: { min: 0, max: 1 },  // Stereo width: 0=mono/center, 0.2-0.4=subtle, 0.5-0.8=wide, 1.0=extreme
  },
  sub: {
    level: { min: 0, max: 1 },
  },
  filter: {
    frequency: { min: 20, max: 20000 },  // Cutoff frequency: 20-80Hz=sub, 80-250Hz=bass, 250-2000Hz=mids, 2000-6000Hz=presence, 6000-12000Hz=air, 12000+=extreme highs
    q: { min: 0.1, max: 100 },  // Resonance: 0.1-0.7=gentle/natural, 0.7-1.5=standard synth, 2-5=resonant peak/acid, 5-10=self-oscillating, 10-100=extreme. Typical: 0.5-2.0
    envelopeAmount: { min: -10000, max: 10000 },  // Hz to sweep: ±500-1500=subtle, ±2000-4000=classic synth, ±5000-10000=dramatic. Negative=sweep down (bright→dark)
  },
  saturation: {
    drive: { min: 0, max: 1 },  // 0-0.1=subtle warmth, 0.1-0.3=gentle coloration, 0.3-0.5=obvious saturation, 0.5-0.8=heavy, 0.8-1.0=extreme clipping. Per-layer only.
    mix: { min: 0, max: 1 },  // Dry/wet: 0.1-0.3=parallel (keeps dynamics), 0.5-0.7=balanced, 0.8-1.0=full saturation
  },
  fm: {
    ratio: { min: 0.5, max: 16 },  // Frequency multiplier: 1=fundamental, 2/3/4=harmonic overtones, non-integer=inharmonic/metallic, <1=sub-harmonic
    modulationIndex: { min: 0, max: 1 },  // FM depth: 0.01-0.05=subtle/warm EP, 0.1-0.3=moderate/DX7, 0.4-0.7=strong/brass, 0.8-1.0=extreme/harsh (Hz deviation = value × carrierFreqHz)
    feedback: { min: 0, max: 1 },  // Self-modulation: 0=clean, 0.1-0.3=subtle edge, 0.3-0.5=metallic/brass, 0.6-0.9=harsh/aggressive, 0.9+=chaotic
  },
  karplus: {
    frequency: { min: 20, max: 2000 },
    damping: { min: 0, max: 1 },  // Decay rate: 0-0.1=infinite ring/bell, 0.1-0.3=long decay/piano, 0.3-0.5=medium/guitar, 0.5-0.7=short, 0.7-0.9=fast pluck, 0.9-1.0=immediate
    inharmonicity: { min: 0, max: 1 },  // Harmonic stretch: 0=pure/synthetic, 0.1-0.2=guitar, 0.3-0.5=piano, 0.5-0.7=high piano/vibes, 0.7-0.9=glockenspiel, 0.9-1.0=bells. WARNING: Creates instant pluck transient - sounds like harp/harpsichord even with slow layer envelope
  },
  lfo: {
    frequency: { min: 0.01, max: 20 },  // Rate: 0.1-0.5Hz=slow sweep, 0.5-2Hz=slow mod, 2-6Hz=musical vibrato, 6-12Hz=fast tremolo, 12-20Hz=extreme. Typical: 2-6Hz
    depth: { min: 0, max: 1 },  // Intensity: pitch=0.02-0.05 subtle vibrato, 0.1+=obvious; filter=0.3-0.7; amplitude/pan=0.3-0.6. Target-dependent scaling
    delay: { min: 0, max: 10 },  // Seconds before LFO starts (0=immediate, 0.5-2s=expressive delay)
    fade: { min: 0, max: 10 },  // Fade-in time after delay (0=instant, 0.5-2s=gradual)
  },
  distortion: {
    amount: { min: 0, max: 1 },  // Distortion intensity
    mix: { min: 0, max: 1 },  // Dry/wet blend: 0 = clean, 1 = fully distorted
  },
  reverb: {
    decay: { min: 0.1, max: 5 },  // Room size: 0.1-0.5s=small room, 0.5-1.5s=medium/studio, 1.5-3s=large hall, 3-5s=cathedral. Typical: 1-2s
    damping: { min: 0, max: 1 },  // Surface absorption: 0-0.3=hard/bright (tile), 0.3-0.6=natural (wood), 0.6-0.9=soft/dark (carpet). Typical: 0.4-0.6
    mix: { min: 0, max: 1 },  // Amount: 0.05-0.15=subtle ambience, 0.15-0.3=present, 0.3-0.5=obvious, 0.5+=washy/distant. Typical: 0.2-0.3
  },
  delay: {
    time: { min: 0.01, max: 2 },  // Delay time in seconds
    feedback: { min: 0, max: 0.9 },  // Feedback amount: 0 = single echo, 0.9 = long repeating echoes
    mix: { min: 0, max: 1 },  // Dry/wet blend
  },
  compressor: {
    threshold: { min: -60, max: 0 },  // Where compression starts: -60dB=always on, -30dB=moderate, -18 to -12dB=typical/peaks only, -6dB=subtle. Typical: -18dB
    ratio: { min: 1, max: 20 },  // How much to compress: 1=none, 2-3=gentle, 4-6=moderate, 8-12=heavy, 20=limiting. Typical: 2.5-4
    attack: { min: 0, max: 1 },  // Response speed: <0.01s=fast/dulls transients, 0.02-0.05s=preserves punch (typical), 0.1-0.5s=slow/pumping
    release: { min: 0, max: 1 },  // Recovery speed: <0.1s=pumping/breathing, 0.15-0.3s=musical (typical), 0.5-1s=slow/smooth
    knee: { min: 0, max: 40 },  // Compression onset: 0dB=hard/obvious, 10-20dB=moderate (typical), 30-40dB=soft/transparent
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
  frequency: z.number().default(440).transform(f => 
    f <= 0 ? 440 : Math.max(BOUNDS.oscillator.frequency.min, Math.min(BOUNDS.oscillator.frequency.max, f))
  ),
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
  frequency: z.number().transform(f => 
    f <= 0 ? 440 : Math.max(BOUNDS.karplus.frequency.min, Math.min(BOUNDS.karplus.frequency.max, f))
  ),
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
  return `CRITICAL: You MUST use EXACT enum values and effect names as shown. DO NOT invent new effects or use synonyms.

Examples of CORRECT usage:
- Layer type: "oscillator" (NOT "osc", "synth", "synthesizer")
- Layer type: "karplus-strong" (NOT "karplus", "physical-modeling", "string")
- Filter type: "lowpass" (NOT "low-pass", "lp", "lpf")
- Effect: "distortion" with type "bitcrush" (NOT "bitcrusher", "crusher", separate effect)

VALID EFFECTS (only these exist):
- distortion, reverb, delay, compressor, gate, chorus, eq

DO NOT invent effects like: bitcrusher, phaser, flanger (use chorus with low delay), limiter (use compressor with high ratio)

STRICT RULES:
- ONLY use exact enum values shown below
- ONLY use effects listed above
- Keep all numbers within specified bounds
- oscillator/karplus frequency must be 20-20000 (not 0)
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
  return `CRITICAL: You MUST use EXACT enum values and effect names as shown. DO NOT invent new effects.

VALID EFFECTS (only these exist):
- distortion, reverb, delay, compressor, gate, chorus, eq

DO NOT invent: bitcrusher, phaser, flanger, limiter, etc.

STRICT RULES:
- ONLY use exact enum values shown below
- ONLY use effects listed above
- Keep all numbers within specified bounds
- oscillator/karplus frequency must be 20-20000 (not 0)
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
LAYER TYPES & CHARACTERISTICS:

oscillator: Periodic waveforms. Best for synth sounds, basses, leads, pads
  * Waveforms: sine=pure/soft/sub, triangle=warm/mellow, sawtooth=bright/rich (most versatile), square=hollow/video-game
  * frequency: ${range(b.oscillator.frequency, 'Hz')} - MUST be valid frequency (not 0). Use 440 if unsure (MIDI notes override this for playback)
  * detune: ${range(b.oscillator.detune, 'cents')}
  * unison: ${range(b.unison.voices)} voices (typical: 2-3), detune ${range(b.unison.detune, 'cents')} (typical: 10-20), spread ${range(b.unison.spread)} (typical: 0.2-0.4)
  * sub: Level ${range(b.sub.level)} (bass: 0.4-0.6), 1-2 octaves below
  * pitchEnvelope: Amount ${range(b.pitchEnvelope.amount, 'cents')}, sustain ${range(b.pitchEnvelope.sustain)}=percentage of amount

noise: white=hiss/air, pink=natural/wind, brown=rumble. Best for transients, breath, cymbals. ALWAYS filter (raw is harsh)

fm: Frequency modulation. Best for electric pianos, bells, metallic tones
  * ratio: ${range(b.fm.ratio)} (1=fundamental, 2/3/4=harmonic, non-integer=inharmonic/bells, <1=sub)
  * modulationIndex: ${range(b.fm.modulationIndex)} (0.01-0.05=subtle EP, 0.1-0.3=DX7, 0.4-0.7=brass, 0.8-1.0=harsh)
  * feedback: ${range(b.fm.feedback)} (0=clean, 0.1-0.3=edge, 0.3-0.5=metallic, 0.6-0.9=harsh, 0.9+=chaotic)
  * modulatesLayer: Route to another FM layer (set this layer gain=0)
  * envelope: Modulates FM depth over time

karplus-strong: Physical string model. Best for plucked strings, struck bars
  * WARNING: Creates INSTANT pluck transient. Layer envelope can't soften it. Sounds like harp/harpsichord/mandolin
  * NOT recommended for piano - use filtered oscillators with slow attack + filter sweep instead
  * frequency: ${range(b.karplus.frequency, 'Hz')}
  * damping: ${range(b.karplus.damping)} (0-0.1=bell, 0.1-0.3=piano/bass, 0.3-0.5=guitar, 0.5-0.7=short, 0.7-0.9=pluck, 0.9-1.0=immediate)
  * inharmonicity: ${range(b.karplus.inharmonicity)} (0=pure, 0.1-0.2=guitar, 0.3-0.5=piano, 0.7-0.9=glock, 0.9-1.0=bells)

PER-LAYER PROCESSING:
- gain: ${range(b.gain)}. Typical: primary=0.5-0.8, supporting=0.2-0.4, transients=0.05-0.15. Total all layers: ~0.8-1.2
- envelope: Attack ${range(b.envelope.attack, 's')} (<0.002s=percussive, 0.005-0.02s=piano/mallet, 0.05-0.2s=bowed, 0.2s+=swell), decay ${range(b.envelope.decay, 's')} (for sustain=0 this IS body length), sustain ${range(b.envelope.sustain)} (0=one-shot, 0.5-1.0=held), release ${range(b.envelope.release, 's')}
- filter: ${enumStr(filterTypeEnum)}. Frequency ${range(b.filter.frequency, 'Hz')}, Q ${range(b.filter.q)} (typical: 0.5-2.0). Envelope amount ${range(b.filter.envelopeAmount, 'Hz')} (±2000-4000 typical sweep)
- saturation: ${enumStr(saturationTypeEnum)} (PER-LAYER only, subtle coloration). Drive ${range(b.saturation.drive)} (0.1-0.3 typical), mix ${range(b.saturation.mix)}

GLOBAL PROCESSING:
- envelope: Master ADSR (always applied, controls overall amplitude)
- filter: ${enumStr(globalFilterTypeEnum)}. Same ranges as layer filter
- lfo: Waveform ${enumStr(lfoWaveformEnum)}, frequency ${range(b.lfo.frequency, 'Hz')} (2-6Hz typical vibrato), depth ${range(b.lfo.depth)} (pitch: 0.02-0.05 typical), target ${enumStr(lfoTargetEnum)}

EFFECTS (order matters: EQ → Distortion → Compressor → Chorus → Delay → Reverb → Gate):
- distortion: GLOBAL only. Type ${enumStr(distortionTypeEnum)} (NOT tape/tube - those are saturation), amount ${range(b.distortion.amount)}, mix ${range(b.distortion.mix)}
- compressor: threshold ${range(b.compressor.threshold, 'dB')} (typical: -18dB), ratio ${range(b.compressor.ratio)} (typical: 2.5-4)
- chorus: rate ${range(b.chorus.rate, 'Hz')}, depth ${range(b.chorus.depth)} (0.1-0.3 typical), delay ${range(b.chorus.delay, 'ms')} (1-5=flanger, 20-50=chorus)
- reverb: decay ${range(b.reverb.decay, 's')} (1-2s typical), damping ${range(b.reverb.damping)} (0.4-0.6 typical), mix ${range(b.reverb.mix)} (0.2-0.3 typical)
- delay: time ${range(b.delay.time, 's')}, feedback ${range(b.delay.feedback)}
- eq: 3-band, gain ${range(b.eq.gain, 'dB')} per band
- gate: For gated reverb effects (80s snare)
`.trim();
}
