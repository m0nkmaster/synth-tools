/**
 * Shared synthesis core - used by both static and real-time synthesizers
 * All audio graph creation logic lives here to ensure identical sound
 */

import type { SoundConfig } from '../types/soundConfig';
import { BOUNDS } from '../types/soundConfig';
import { PINK_NOISE } from '../config';

// Type alias for either AudioContext or OfflineAudioContext
type AnyAudioContext = AudioContext | OfflineAudioContext;

// Safe value helper - returns fallback for non-finite values
function safe(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

interface LayerSources {
  sources: AudioScheduledSourceNode[];
  output: AudioNode;
}

// Extended result for FM layers supporting inter-layer modulation
export interface FMLayerResult extends LayerSources {
  carrierFrequencyParam: AudioParam;  // For receiving modulation from other FM layers
  modulationOutput: GainNode;         // For routing modulation to other FM layers
  isFM: true;
}

// Type guard for FM layer results
export function isFMLayerResult(result: LayerSources): result is FMLayerResult {
  return 'isFM' in result && result.isFM === true;
}

/**
 * Create all sources for a single layer
 * @param duration - Optional duration for envelope scheduling (static synthesis)
 */
export function createLayerSources(
  ctx: AnyAudioContext,
  layer: SoundConfig['synthesis']['layers'][0],
  frequency: number,
  startTime: number,
  duration?: number
): LayerSources | FMLayerResult {
  const sources: AudioScheduledSourceNode[] = [];
  
  if (layer.type === 'oscillator' && layer.oscillator) {
    return createOscillatorLayer(ctx, layer.oscillator, frequency, startTime, sources);
  }
  
  if (layer.type === 'fm' && layer.fm) {
    return createFMLayer(ctx, layer.fm as FMConfigNormalized, frequency, startTime, sources, duration);
  }
  
  if (layer.type === 'noise' && layer.noise) {
    return createNoiseLayer(ctx, layer.noise.type, startTime, sources);
  }
  
  if (layer.type === 'karplus-strong' && layer.karplus) {
    return createKarplusStrongLayer(ctx, layer.karplus, frequency, startTime, sources);
  }
  
  // Fallback: simple oscillator
  const osc = ctx.createOscillator();
  osc.frequency.value = frequency;
  sources.push(osc);
  return { sources, output: osc };
}

function createOscillatorLayer(
  ctx: AnyAudioContext,
  config: NonNullable<SoundConfig['synthesis']['layers'][0]['oscillator']>,
  frequency: number,
  startTime: number,
  sources: AudioScheduledSourceNode[]
): LayerSources {
  const unison = config.unison || { voices: 1, detune: 0, spread: 0 };
  const voices = Math.max(1, Math.min(8, unison.voices));
  
  const safeFreq = safe(frequency, 440);
  const safeDetune = safe(config.detune, 0);
  
  if (voices === 1 && !config.sub) {
    const osc = ctx.createOscillator();
    osc.type = config.waveform;
    osc.frequency.value = safeFreq;
    osc.detune.value = safeDetune;
    osc.start(startTime);
    sources.push(osc);
    return { sources, output: osc };
  }
  
  const mixer = ctx.createGain();
  const gainPerVoice = 1 / Math.sqrt(voices);
  
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator();
    osc.type = config.waveform;
    osc.frequency.value = safeFreq;
    
    const voiceDetune = voices > 1 
      ? (i / (voices - 1) - 0.5) * 2 * safe(unison.detune, 0) 
      : 0;
    osc.detune.value = safeDetune + voiceDetune;
    
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = gainPerVoice;
    
    if (voices > 1 && unison.spread > 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, (i / (voices - 1) - 0.5) * 2 * safe(unison.spread, 0)));
      osc.connect(panner);
      panner.connect(voiceGain);
    } else {
      osc.connect(voiceGain);
    }
    
    voiceGain.connect(mixer);
    osc.start(startTime);
    sources.push(osc);
  }
  
  // Sub oscillator
  if (config.sub) {
    const sub = ctx.createOscillator();
    sub.type = config.sub.waveform || 'sine';
    sub.frequency.value = frequency / Math.pow(2, Math.abs(config.sub.octave));
    
    const subGain = ctx.createGain();
    subGain.gain.value = config.sub.level;
    
    sub.connect(subGain);
    subGain.connect(mixer);
    sub.start(startTime);
    sources.push(sub);
  }
  
  return { sources, output: mixer };
}

// FM Config type after migration (always in new format)
interface FMConfigNormalized {
  ratio: number;
  waveform?: 'sine' | 'square' | 'sawtooth' | 'triangle';
  modulationIndex: number;
  feedback?: number;
  modulatesLayer?: number;
  envelope?: { attack: number; decay: number; sustain: number; release: number };
}

/**
 * Create FM layer (single operator)
 * 
 * Each FM layer is a single operator that can:
 * - Output audio directly (when modulatesLayer is undefined)
 * - Route modulation to another FM layer (when modulatesLayer is set)
 * - Self-modulate via feedback
 * 
 * The carrier frequency = baseFrequency * ratio
 * Modulation index controls the depth of modulation output
 */
export function createFMLayer(
  ctx: AnyAudioContext,
  config: FMConfigNormalized,
  frequency: number,
  startTime: number,
  sources: AudioScheduledSourceNode[],
  duration?: number
): FMLayerResult {
  const safeRatio = safe(config.ratio, 1);
  const safeModIndex = safe(config.modulationIndex, 10);
  const safeFeedback = safe(config.feedback, 0);
  const safeFreq = safe(frequency, 440);
  const waveform = config.waveform || 'sine';
  
  // Operator frequency = base frequency * ratio
  const operatorFreq = Math.max(BOUNDS.oscillator.frequency.min, Math.min(BOUNDS.oscillator.frequency.max, safeFreq * safeRatio));
  
  // Create the carrier oscillator
  const carrier = ctx.createOscillator();
  carrier.type = waveform;
  carrier.frequency.value = operatorFreq;
  carrier.start(startTime);
  sources.push(carrier);
  
  // Modulation output: this is what gets routed to other FM layers
  // The modulation depth is scaled by modulationIndex and operator frequency
  // FM formula: Δf = modulationIndex × modulatorFreq
  // CRITICAL: Divide by 100 for gentle modulation (modIndex 10 = ~4.4Hz deviation @ 440Hz)
  const modulationOutput = ctx.createGain();
  modulationOutput.gain.value = (safeModIndex / 100) * operatorFreq;
  carrier.connect(modulationOutput);
  
  // Apply per-operator envelope to modulation depth (critical for FM timbres)
  if (config.envelope && duration !== undefined) {
    const env = config.envelope;
    const SILENCE = 0.0001;
    const safeAttack = Math.max(0.001, env.attack);
    const safeDecay = Math.max(0.001, env.decay);
    const safeRelease = Math.max(0.001, env.release);
    // Ensure peakGain is never 0 (exponentialRamp can't target 0)
    // Match the /100 scaling from above
    const peakGain = Math.max(SILENCE, (safeModIndex / 100) * operatorFreq);
    const sustainGain = Math.max(SILENCE, env.sustain * peakGain);
    const releaseStart = Math.max(safeAttack + safeDecay + 0.01, duration - safeRelease);
    
    modulationOutput.gain.setValueAtTime(SILENCE, startTime);
    modulationOutput.gain.exponentialRampToValueAtTime(peakGain, startTime + safeAttack);
    modulationOutput.gain.exponentialRampToValueAtTime(sustainGain, startTime + safeAttack + safeDecay);
    modulationOutput.gain.setValueAtTime(sustainGain, startTime + releaseStart);
    modulationOutput.gain.exponentialRampToValueAtTime(SILENCE, startTime + duration);
  }
  
  // Self-modulation (feedback) via a tiny delay
  // Feedback creates metallic/harsh tones (0.3 = metallic, 0.7+ = harsh/noisy)
  if (safeFeedback > 0) {
    // 1-sample delay approximation for feedback loop stability
    const feedbackDelay = ctx.createDelay(0.01);
    feedbackDelay.delayTime.value = 1 / ctx.sampleRate;
    
    const feedbackGain = ctx.createGain();
    // Scale feedback to modulate frequency in Hz (similar to modulation index)
    feedbackGain.gain.value = safeFeedback * operatorFreq * 2;
    
    carrier.connect(feedbackDelay);
    feedbackDelay.connect(feedbackGain);
    feedbackGain.connect(carrier.frequency);
  }
  
  // Audio output (for layers that output to mixer rather than modulating another layer)
  const audioOutput = ctx.createGain();
  audioOutput.gain.value = 1;
  carrier.connect(audioOutput);
  
  return {
    sources,
    output: audioOutput,
    carrierFrequencyParam: carrier.frequency,
    modulationOutput,
    isFM: true,
  };
}

function createNoiseLayer(
  ctx: AnyAudioContext,
  type: string,
  startTime: number,
  sources: AudioScheduledSourceNode[]
): LayerSources {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  if (type === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = PINK_NOISE.B0_DECAY * b0 + white * PINK_NOISE.B0_GAIN;
      b1 = PINK_NOISE.B1_DECAY * b1 + white * PINK_NOISE.B1_GAIN;
      b2 = PINK_NOISE.B2_DECAY * b2 + white * PINK_NOISE.B2_GAIN;
      b3 = PINK_NOISE.B3_DECAY * b3 + white * PINK_NOISE.B3_GAIN;
      b4 = PINK_NOISE.B4_DECAY * b4 + white * PINK_NOISE.B4_GAIN;
      b5 = PINK_NOISE.B5_DECAY * b5 + white * PINK_NOISE.B5_GAIN;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * PINK_NOISE.WHITE_GAIN) * 0.11;
      b6 = white * PINK_NOISE.B6_GAIN;
    }
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + white * 0.02) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    }
  } else {
    // White noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  noise.start(startTime);
  sources.push(noise);
  
  return { sources, output: noise };
}

function createKarplusStrongLayer(
  ctx: AnyAudioContext,
  config: { frequency: number; damping: number; inharmonicity?: number },
  frequency: number,
  startTime: number,
  sources: AudioScheduledSourceNode[]
): LayerSources {
  const safeFreq = safe(frequency, 440);
  const period = 1 / Math.max(20, safeFreq); // Prevent divide by zero or extreme values
  const periodSamples = Math.floor(period * ctx.sampleRate);
  
  const bufferSize = ctx.sampleRate * 4; // 4 seconds max
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  // Initialize ring buffer with noise
  const N = Math.max(2, periodSamples);
  const ring = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    ring[i] = Math.random() * 2 - 1;
  }
  
  // Damping factor: higher config.damping = faster decay (more intuitive)
  // The feedback coefficient must stay very close to 1.0 for audible sustain
  // (at 44.1kHz, even 0.99 decays almost instantly)
  // Maps 0-1 input to narrow usable range: 0.9999 (long ring) to 0.95 (short pluck)
  const minCoeff = 0.95;   // shortest useful sustain
  const maxCoeff = 0.9999; // longest sustain (near infinite)
  const damping = maxCoeff - config.damping * (maxCoeff - minCoeff);
  
  // Inharmonicity: cascaded allpass filters to stretch higher partials (piano-like)
  // 0 = pure harmonics (plucked string), 0.3-0.5 = piano-like, 1 = bell-like
  const inharmonicity = safe(config.inharmonicity, 0);
  // Use multiple allpass stages for stronger, more audible effect
  const numStages = 4;
  // Stronger coefficient for audible effect
  const allpassCoeff = inharmonicity * 0.85;
  
  let prevSample = 0;
  let pointer = 0;
  // Cascaded allpass filter states (4 stages for stronger effect)
  const apPrevIn = new Float32Array(numStages);
  const apPrevOut = new Float32Array(numStages);
  
  for (let i = 0; i < bufferSize; i++) {
    const val = ring[pointer];
    data[i] = val;
    
    // Basic lowpass averaging (original KS)
    let filtered = damping * 0.5 * (val + prevSample);
    
    // Apply cascaded allpass filters for inharmonicity (stretches higher partials)
    // Each stage adds phase dispersion, making the effect more pronounced
    // First-order allpass: y[n] = a * x[n] + x[n-1] - a * y[n-1]
    if (inharmonicity > 0) {
      for (let stage = 0; stage < numStages; stage++) {
        const input = filtered;
        const output = allpassCoeff * input + apPrevIn[stage] - allpassCoeff * apPrevOut[stage];
        apPrevIn[stage] = input;
        apPrevOut[stage] = output;
        filtered = output;
      }
    }
    
    ring[pointer] = filtered;
    prevSample = val;
    
    pointer = (pointer + 1) % N;
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.start(startTime);
  sources.push(source);
  
  return { sources, output: source };
}

/**
 * Create a filter node
 */
export function createFilter(
  ctx: AnyAudioContext,
  config: { type: BiquadFilterType; frequency: number; q: number; gain?: number }
): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = config.type;
  filter.frequency.value = Math.max(BOUNDS.filter.frequency.min, Math.min(BOUNDS.filter.frequency.max, config.frequency));
  filter.Q.value = Math.max(BOUNDS.filter.q.min, config.q);
  if (config.gain !== undefined) {
    filter.gain.value = config.gain;
  }
  return filter;
}

/**
 * Create saturation/waveshaper
 */
export function createSaturation(
  ctx: AnyAudioContext,
  config: { type: string; drive: number; mix: number }
): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const curveSize = 256;
  const curve = new Float32Array(curveSize);
  const drive = Math.max(BOUNDS.saturation.drive.min, Math.min(BOUNDS.saturation.drive.max, config.drive));
  const mix = Math.max(BOUNDS.saturation.mix.min, Math.min(BOUNDS.saturation.mix.max, config.mix));
  
  for (let i = 0; i < curveSize; i++) {
    const x = (i - curveSize / 2) / (curveSize / 2);
    let y: number;
    
    switch (config.type) {
      case 'soft':
        y = Math.tanh(x * drive);
        break;
      case 'hard':
        y = Math.max(-1, Math.min(1, x * drive));
        break;
      case 'tube':
        y = x < 0 ? Math.tanh(x * drive * 0.8) : Math.tanh(x * drive * 1.2);
        break;
      case 'tape':
        y = Math.tanh(x * drive * 0.7);
        break;
      default:
        y = Math.tanh(x * drive);
    }
    
    curve[i] = x * (1 - mix) + y * mix;
  }
  
  shaper.curve = curve;
  return shaper;
}

/**
 * Create distortion effect
 */
export function createDistortion(
  ctx: AnyAudioContext,
  config: { type?: string; amount?: number; mix?: number }
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  
  const amount = Math.max(BOUNDS.distortion.amount.min, Math.min(BOUNDS.distortion.amount.max, safe(config.amount, 0.5)));
  const mix = Math.max(BOUNDS.distortion.mix.min, Math.min(BOUNDS.distortion.mix.max, safe(config.mix, 0.5)));
  const type = config.type || 'soft';
  
  // Bitcrush uses sample rate reduction, others use waveshaping
  if (type === 'bitcrush') {
    // Bitcrusher: reduce bit depth via quantization
    // amount 0-1 maps to 16 bits down to 2 bits
    const bits = Math.max(2, Math.round(16 - amount * 14));
    const levels = Math.pow(2, bits);
    
    const shaper = ctx.createWaveShaper();
    const curveSize = 65536; // Higher resolution for stair-step effect
    const curve = new Float32Array(curveSize);
    
    for (let i = 0; i < curveSize; i++) {
      const x = (i / (curveSize - 1)) * 2 - 1; // -1 to 1
      // Quantize to discrete levels
      curve[i] = Math.round(x * levels) / levels;
    }
    shaper.curve = curve;
    shaper.oversample = 'none'; // No oversampling for that crunchy sound
    
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    dryGain.gain.value = 1 - mix;
    wetGain.gain.value = mix;
    
    input.connect(dryGain);
    dryGain.connect(output);
    input.connect(shaper);
    shaper.connect(wetGain);
    wetGain.connect(output);
    
    return { input, output };
  }
  
  // Waveshaping distortion types
  const shaper = ctx.createWaveShaper();
  const curveSize = 256;
  const curve = new Float32Array(curveSize);
  const drive = amount * 100;
  
  for (let i = 0; i < curveSize; i++) {
    const x = (i - curveSize / 2) / (curveSize / 2);
    let y: number;
    
    switch (type) {
      case 'hard':
        // Hard clipping
        y = Math.max(-1, Math.min(1, x * (1 + drive)));
        break;
      case 'fuzz':
        // Asymmetric fuzz with octave-up harmonics
        // Inspired by classic fuzz pedals
        y = x >= 0
          ? Math.tanh(x * drive * 2) * 0.9
          : Math.tanh(x * drive * 0.8) * -0.7 - 0.1 * Math.sin(x * drive * Math.PI);
        break;
      case 'waveshaper': {
        // Chebyshev polynomial for rich harmonics
        const k = drive / 50;
        y = (1 + k) * x / (1 + k * Math.abs(x));
        break;
      }
      case 'soft':
      default:
        // Soft clipping (tanh)
        y = Math.tanh(x * drive);
        break;
    }
    
    curve[i] = y;
  }
  shaper.curve = curve;
  
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;
  
  input.connect(dryGain);
  dryGain.connect(output);
  input.connect(shaper);
  shaper.connect(wetGain);
  wetGain.connect(output);
  
  return { input, output };
}

/**
 * Create delay effect
 */
export function createDelay(
  ctx: AnyAudioContext,
  config: { time: number; feedback: number; mix: number }
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  
  const time = Math.max(BOUNDS.delay.time.min, Math.min(BOUNDS.delay.time.max, config.time));
  const feedbackValue = Math.max(BOUNDS.delay.feedback.min, Math.min(BOUNDS.delay.feedback.max, config.feedback));
  const mix = Math.max(BOUNDS.delay.mix.min, Math.min(BOUNDS.delay.mix.max, config.mix));
  
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;
  
  const delay = ctx.createDelay(2);
  delay.delayTime.value = time;
  
  const feedback = ctx.createGain();
  feedback.gain.value = feedbackValue;
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 4000;
  
  input.connect(dryGain);
  dryGain.connect(output);
  
  input.connect(delay);
  delay.connect(filter);
  filter.connect(feedback);
  feedback.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(output);
  
  return { input, output };
}

/**
 * Create reverb effect using convolution
 */
export function createReverb(
  ctx: AnyAudioContext,
  config: { decay: number; damping: number; mix: number }
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  
  const decay = Math.max(BOUNDS.reverb.decay.min, Math.min(BOUNDS.reverb.decay.max, config.decay));
  const damping = Math.max(BOUNDS.reverb.damping.min, Math.min(BOUNDS.reverb.damping.max, config.damping));
  const mix = Math.max(BOUNDS.reverb.mix.min, Math.min(BOUNDS.reverb.mix.max, config.mix));
  
  // Create impulse response
  const length = Math.floor(ctx.sampleRate * decay);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, damping * 3);
    }
  }
  
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;
  
  input.connect(dryGain);
  dryGain.connect(output);
  
  input.connect(convolver);
  convolver.connect(wetGain);
  wetGain.connect(output);
  
  return { input, output };
}

/**
 * Create compressor
 */
export function createCompressor(
  ctx: AnyAudioContext,
  config: { threshold?: number; ratio?: number; attack?: number; release?: number; knee?: number }
): DynamicsCompressorNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = Math.max(BOUNDS.compressor.threshold.min, Math.min(BOUNDS.compressor.threshold.max, safe(config.threshold, -12)));
  comp.ratio.value = Math.max(BOUNDS.compressor.ratio.min, Math.min(BOUNDS.compressor.ratio.max, safe(config.ratio, 4)));
  comp.attack.value = Math.max(BOUNDS.compressor.attack.min, Math.min(BOUNDS.compressor.attack.max, safe(config.attack, 0.003)));
  comp.release.value = Math.max(BOUNDS.compressor.release.min, Math.min(BOUNDS.compressor.release.max, safe(config.release, 0.25)));
  comp.knee.value = Math.max(BOUNDS.compressor.knee.min, Math.min(BOUNDS.compressor.knee.max, safe(config.knee, 30)));
  return comp;
}

/**
 * Apply pitch envelope to oscillator frequency
 * Modulates frequency using cents-based envelope
 */
export function applyPitchEnvelope(
  frequencyParam: AudioParam,
  baseFrequency: number,
  envelope: { amount: number; attack: number; decay: number; sustain: number; release: number },
  startTime: number,
  duration: number
): void {
  const { amount, attack, decay, sustain, release } = envelope;
  
  // Convert cents to frequency multiplier: 1200 cents = 1 octave = 2x frequency
  const peakMultiplier = Math.pow(2, amount / 1200);
  const sustainMultiplier = Math.pow(2, sustain / 1200);
  
  const peakFreq = Math.max(BOUNDS.oscillator.frequency.min, Math.min(BOUNDS.oscillator.frequency.max, baseFrequency * peakMultiplier));
  const sustainFreq = Math.max(BOUNDS.oscillator.frequency.min, Math.min(BOUNDS.oscillator.frequency.max, baseFrequency * sustainMultiplier));
  const safeBaseFreq = Math.max(BOUNDS.oscillator.frequency.min, baseFrequency);
  
  const safeAttack = Math.max(0.001, attack);
  const safeDecay = Math.max(0.001, decay);
  const safeRelease = Math.max(0.001, release);
  const releaseStart = Math.max(safeAttack + safeDecay, duration - safeRelease);
  
  frequencyParam.setValueAtTime(safeBaseFreq, startTime);
  
  if (attack > 0) {
    frequencyParam.exponentialRampToValueAtTime(peakFreq, startTime + safeAttack);
  } else {
    frequencyParam.setValueAtTime(peakFreq, startTime);
  }
  
  frequencyParam.exponentialRampToValueAtTime(sustainFreq, startTime + safeAttack + safeDecay);
  frequencyParam.setValueAtTime(sustainFreq, releaseStart);
  frequencyParam.exponentialRampToValueAtTime(safeBaseFreq, duration);
}

/**
 * Apply pitch envelope for real-time use (MIDI)
 * Uses long duration; release handled by noteOff
 */
export function applyPitchEnvelopeRealtime(
  frequencyParam: AudioParam,
  baseFrequency: number,
  envelope: { amount: number; attack: number; decay: number; sustain: number; release: number },
  startTime: number
): void {
  const { amount, attack, decay, sustain } = envelope;
  
  const peakMultiplier = Math.pow(2, amount / 1200);
  const sustainMultiplier = Math.pow(2, sustain / 1200);
  
  const peakFreq = Math.max(BOUNDS.oscillator.frequency.min, Math.min(BOUNDS.oscillator.frequency.max, baseFrequency * peakMultiplier));
  const sustainFreq = Math.max(BOUNDS.oscillator.frequency.min, Math.min(BOUNDS.oscillator.frequency.max, baseFrequency * sustainMultiplier));
  const safeBaseFreq = Math.max(BOUNDS.oscillator.frequency.min, baseFrequency);
  
  const safeAttack = Math.max(0.001, attack);
  const safeDecay = Math.max(0.001, decay);
  
  frequencyParam.setValueAtTime(safeBaseFreq, startTime);
  
  if (attack > 0) {
    frequencyParam.exponentialRampToValueAtTime(peakFreq, startTime + safeAttack);
  } else {
    frequencyParam.setValueAtTime(peakFreq, startTime);
  }
  
  frequencyParam.exponentialRampToValueAtTime(sustainFreq, startTime + safeAttack + safeDecay);
}

/**
 * Create chorus/flanger effect
 * Low delay (1-5ms) = flanger, High delay (20-50ms) = chorus
 */
export function createChorus(
  ctx: AnyAudioContext,
  config: { rate: number; depth: number; mix: number; feedback?: number; delay?: number }
): { input: GainNode; output: GainNode; sources: OscillatorNode[] } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const sources: OscillatorNode[] = [];
  
  const rate = Math.max(BOUNDS.chorus.rate.min, Math.min(BOUNDS.chorus.rate.max, config.rate));
  const depth = Math.max(BOUNDS.chorus.depth.min, Math.min(BOUNDS.chorus.depth.max, config.depth));
  const mix = Math.max(BOUNDS.chorus.mix.min, Math.min(BOUNDS.chorus.mix.max, config.mix));
  const feedback = Math.max(BOUNDS.chorus.feedback.min, Math.min(BOUNDS.chorus.feedback.max, config.feedback ?? 0));
  const baseDelay = Math.max(BOUNDS.chorus.delay.min, Math.min(BOUNDS.chorus.delay.max, config.delay ?? 20)) / 1000; // ms to seconds
  
  // Dry path
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - mix * 0.5;
  
  // Wet path with 2 voices for stereo
  const wetGain = ctx.createGain();
  wetGain.gain.value = mix;
  
  const delay1 = ctx.createDelay(0.1);
  const delay2 = ctx.createDelay(0.1);
  delay1.delayTime.value = baseDelay;
  delay2.delayTime.value = baseDelay * 1.1; // Slight offset for stereo
  
  // LFOs for modulation
  const lfo1 = ctx.createOscillator();
  const lfo2 = ctx.createOscillator();
  lfo1.type = 'sine';
  lfo2.type = 'sine';
  lfo1.frequency.value = rate;
  lfo2.frequency.value = rate * 1.1; // Slight detuning
  
  const lfoGain1 = ctx.createGain();
  const lfoGain2 = ctx.createGain();
  const modDepth = baseDelay * depth * 0.5; // Modulate up to 50% of delay time
  lfoGain1.gain.value = modDepth;
  lfoGain2.gain.value = modDepth;
  
  // Feedback for flanger effect
  const feedbackGain = ctx.createGain();
  feedbackGain.gain.value = feedback;
  
  // Stereo output
  const merger = ctx.createChannelMerger(2);
  
  // Connect LFOs to delay times
  lfo1.connect(lfoGain1);
  lfo2.connect(lfoGain2);
  lfoGain1.connect(delay1.delayTime);
  lfoGain2.connect(delay2.delayTime);
  
  // Signal routing
  input.connect(dryGain);
  dryGain.connect(output);
  
  input.connect(delay1);
  input.connect(delay2);
  
  delay1.connect(feedbackGain);
  feedbackGain.connect(delay1);
  
  delay1.connect(merger, 0, 0); // Left
  delay2.connect(merger, 0, 1); // Right
  merger.connect(wetGain);
  wetGain.connect(output);
  
  lfo1.start();
  lfo2.start();
  sources.push(lfo1, lfo2);
  
  return { input, output, sources };
}

/**
 * Create 3-band parametric EQ
 * Low: lowshelf, Mid: peaking, High: highshelf
 */
export function createEQ(
  ctx: AnyAudioContext,
  config: {
    low: { frequency: number; gain: number; q?: number };
    mid: { frequency: number; gain: number; q?: number };
    high: { frequency: number; gain: number; q?: number };
  }
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  
  // Low band - lowshelf filter
  const lowBand = ctx.createBiquadFilter();
  lowBand.type = 'lowshelf';
  lowBand.frequency.value = Math.max(BOUNDS.eq.low.frequency.min, Math.min(BOUNDS.eq.low.frequency.max, config.low.frequency));
  lowBand.gain.value = Math.max(BOUNDS.eq.gain.min, Math.min(BOUNDS.eq.gain.max, config.low.gain));
  
  // Mid band - peaking filter
  const midBand = ctx.createBiquadFilter();
  midBand.type = 'peaking';
  midBand.frequency.value = Math.max(BOUNDS.eq.mid.frequency.min, Math.min(BOUNDS.eq.mid.frequency.max, config.mid.frequency));
  midBand.Q.value = Math.max(BOUNDS.eq.q.min, Math.min(BOUNDS.eq.q.max, config.mid.q ?? 1));
  midBand.gain.value = Math.max(BOUNDS.eq.gain.min, Math.min(BOUNDS.eq.gain.max, config.mid.gain));
  
  // High band - highshelf filter
  const highBand = ctx.createBiquadFilter();
  highBand.type = 'highshelf';
  highBand.frequency.value = Math.max(BOUNDS.eq.high.frequency.min, Math.min(BOUNDS.eq.high.frequency.max, config.high.frequency));
  highBand.gain.value = Math.max(BOUNDS.eq.gain.min, Math.min(BOUNDS.eq.gain.max, config.high.gain));
  
  // Chain: input -> low -> mid -> high -> output
  input.connect(lowBand);
  lowBand.connect(midBand);
  midBand.connect(highBand);
  highBand.connect(output);
  
  return { input, output };
}

/**
 * Create the complete effects chain
 */
export function createEffectsChain(
  ctx: AnyAudioContext,
  effects: SoundConfig['effects']
): { input: AudioNode; output: AudioNode } {
  const input = ctx.createGain();
  let current: AudioNode = input;
  
  // EQ first (shape tone before other effects)
  if (effects.eq) {
    const eq = createEQ(ctx, effects.eq);
    current.connect(eq.input);
    current = eq.output;
  }
  
  if (effects.distortion) {
    const dist = createDistortion(ctx, effects.distortion);
    current.connect(dist.input);
    current = dist.output;
  }
  
  if (effects.compressor) {
    const comp = createCompressor(ctx, effects.compressor);
    current.connect(comp);
    current = comp;
  }
  
  // Chorus after compression
  if (effects.chorus) {
    const chorus = createChorus(ctx, effects.chorus);
    current.connect(chorus.input);
    current = chorus.output;
  }
  
  if (effects.delay) {
    const del = createDelay(ctx, effects.delay);
    current.connect(del.input);
    current = del.output;
  }
  
  if (effects.reverb) {
    const rev = createReverb(ctx, effects.reverb);
    current.connect(rev.input);
    current = rev.output;
  }
  
  return { input, output: current };
}

/**
 * Apply ADSR envelope to a gain parameter (for real-time use)
 * Returns the sustain level for use in release
 */
export function applyADSREnvelope(
  param: AudioParam,
  envelope: { attack: number; decay: number; sustain: number; release: number },
  peakValue: number,
  startTime: number
): number {
  const SILENCE = 0.0001;
  const safeAttack = Math.max(0.001, envelope.attack);
  const safeDecay = Math.max(0.001, envelope.decay);
  // exponentialRampToValueAtTime can't target 0, so ensure peakValue is at least SILENCE
  const safePeak = Math.max(SILENCE, peakValue);
  const sustainLevel = Math.max(SILENCE, envelope.sustain * safePeak);
  
  param.setValueAtTime(SILENCE, startTime);
  param.exponentialRampToValueAtTime(safePeak, startTime + safeAttack);
  param.exponentialRampToValueAtTime(sustainLevel, startTime + safeAttack + safeDecay);
  
  return sustainLevel;
}

/**
 * Apply release phase of envelope
 */
export function applyReleaseEnvelope(
  param: AudioParam,
  releaseTime: number,
  now: number
): void {
  const SILENCE = 0.0001;
  const safeRelease = Math.max(0.001, releaseTime);
  
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.exponentialRampToValueAtTime(SILENCE, now + safeRelease);
}

/**
 * Apply filter envelope (attack/decay to sustain)
 * Returns the base frequency for use in release
 */
export function applyFilterEnvelope(
  param: AudioParam,
  baseFreq: number,
  envelope: { amount: number; attack: number; decay: number; sustain: number; release: number },
  startTime: number
): { baseFreq: number; sustainFreq: number } {
  const amount = envelope.amount;
  const sustainLevel = Math.max(BOUNDS.envelope.sustain.min, Math.min(BOUNDS.envelope.sustain.max, envelope.sustain));
  
  const safeAttack = Math.max(BOUNDS.envelope.attack.min, envelope.attack);
  const safeDecay = Math.max(BOUNDS.envelope.decay.min, envelope.decay);
  
  const startFreq = Math.max(BOUNDS.filter.frequency.min, baseFreq);
  const peakFreq = Math.max(BOUNDS.filter.frequency.min, Math.min(BOUNDS.filter.frequency.max, baseFreq + amount));
  const sustainFreq = Math.max(BOUNDS.filter.frequency.min, baseFreq + (amount * sustainLevel));
  
  param.setValueAtTime(startFreq, startTime);
  param.exponentialRampToValueAtTime(peakFreq, startTime + safeAttack);
  param.exponentialRampToValueAtTime(sustainFreq, startTime + safeAttack + safeDecay);
  
  return { baseFreq: startFreq, sustainFreq };
}

/**
 * Apply filter release envelope
 */
export function applyFilterReleaseEnvelope(
  param: AudioParam,
  baseFreq: number,
  releaseTime: number,
  now: number
): void {
  const safeRelease = Math.max(BOUNDS.envelope.release.min, releaseTime);
  const targetFreq = Math.max(BOUNDS.filter.frequency.min, baseFreq);
  
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.exponentialRampToValueAtTime(targetFreq, now + safeRelease);
}

/**
 * LFO configuration
 */
export interface LFOConfig {
  waveform: OscillatorType | 'random';
  frequency: number;
  depth: number;
  target: 'pitch' | 'filter' | 'amplitude' | 'pan';
  delay?: number;
  fade?: number;
}

/**
 * Create and apply LFO modulation
 * Returns the output node (if routing changes signal path) and LFO sources for cleanup
 */
export function createLFO(
  ctx: AnyAudioContext,
  lfo: LFOConfig,
  inputNode: AudioNode,
  filterNode: BiquadFilterNode | null,
  oscillatorSources: AudioScheduledSourceNode[],
  startTime: number
): { output: AudioNode | null; sources: AudioScheduledSourceNode[] } {
  const sources: AudioScheduledSourceNode[] = [];
  const delay = Math.max(BOUNDS.lfo.delay.min, Math.min(BOUNDS.lfo.delay.max, safe(lfo.delay, 0)));
  const fade = Math.max(BOUNDS.lfo.fade.min, Math.min(BOUNDS.lfo.fade.max, safe(lfo.fade, 0)));
  const safeFreq = Math.max(BOUNDS.lfo.frequency.min, Math.min(BOUNDS.lfo.frequency.max, safe(lfo.frequency, 1)));
  const safeDepth = Math.max(BOUNDS.lfo.depth.min, Math.min(BOUNDS.lfo.depth.max, safe(lfo.depth, 0.5)));

  // Create LFO source
  let lfoSource: AudioScheduledSourceNode;
  if (lfo.waveform === 'random') {
    // Random LFO using buffer source
    const bufferSize = ctx.sampleRate * 10; // 10 seconds of random
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const samplesPerStep = Math.max(1, Math.floor(ctx.sampleRate / (safeFreq * 10)));
    let currentValue = Math.random() * 2 - 1;
    for (let i = 0; i < bufferSize; i++) {
      if (i % samplesPerStep === 0) {
        currentValue = Math.random() * 2 - 1;
      }
      data[i] = currentValue;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    lfoSource = source;
  } else {
    const osc = ctx.createOscillator();
    osc.type = lfo.waveform;
    osc.frequency.value = Math.max(0.01, safeFreq);
    lfoSource = osc;
  }

  // LFO gain with delay/fade envelope
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0, startTime);
  if (delay > 0) {
    lfoGain.gain.setValueAtTime(0, startTime + delay);
    if (fade > 0) {
      lfoGain.gain.linearRampToValueAtTime(1, startTime + delay + fade);
    } else {
      lfoGain.gain.setValueAtTime(1, startTime + delay);
    }
  } else if (fade > 0) {
    lfoGain.gain.linearRampToValueAtTime(1, startTime + fade);
  } else {
    lfoGain.gain.setValueAtTime(1, startTime);
  }

  lfoSource.connect(lfoGain);
  lfoSource.start(startTime);
  sources.push(lfoSource);

  // Route LFO based on target
  switch (lfo.target) {
    case 'pitch': {
      // Modulate detune of all oscillators (in cents, ±1200 = ±1 octave)
      const detuneAmount = safeDepth * 100; // depth 1 = 100 cents = 1 semitone
      const detuneGain = ctx.createGain();
      detuneGain.gain.value = safe(detuneAmount, 50);
      lfoGain.connect(detuneGain);

      // Connect to all oscillator detune parameters
      for (const source of oscillatorSources) {
        if (source instanceof OscillatorNode) {
          detuneGain.connect(source.detune);
        }
      }
      return { output: null, sources };
    }

    case 'filter': {
      if (filterNode) {
        const filterGain = ctx.createGain();
        filterGain.gain.value = safe(filterNode.frequency.value * safeDepth, 1000);
        lfoGain.connect(filterGain);
        filterGain.connect(filterNode.frequency);
      }
      return { output: null, sources };
    }

    case 'amplitude': {
      const ampGain = ctx.createGain();
      ampGain.gain.value = safeDepth;
      lfoGain.connect(ampGain);

      const output = ctx.createGain();
      output.gain.value = 1;
      ampGain.connect(output.gain);
      inputNode.connect(output);
      return { output, sources };
    }

    case 'pan': {
      const panGain = ctx.createGain();
      panGain.gain.value = safeDepth;
      lfoGain.connect(panGain);

      const panner = ctx.createStereoPanner();
      panGain.connect(panner.pan);
      inputNode.connect(panner);
      return { output: panner, sources };
    }

    default:
      return { output: null, sources };
  }
}

