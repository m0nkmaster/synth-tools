/**
 * Shared synthesis core - used by both static and real-time synthesizers
 * All audio graph creation logic lives here to ensure identical sound
 */

import type { SoundConfig } from '../types/soundConfig';
import { PINK_NOISE } from '../config';

// Type alias for either AudioContext or OfflineAudioContext
type AnyAudioContext = AudioContext | OfflineAudioContext;

interface LayerSources {
  sources: AudioScheduledSourceNode[];
  output: AudioNode;
}

/**
 * Create all sources for a single layer
 */
export function createLayerSources(
  ctx: AnyAudioContext,
  layer: SoundConfig['synthesis']['layers'][0],
  frequency: number,
  startTime: number
): LayerSources {
  const sources: AudioScheduledSourceNode[] = [];
  
  if (layer.type === 'oscillator' && layer.oscillator) {
    return createOscillatorLayer(ctx, layer.oscillator, frequency, startTime, sources);
  }
  
  if (layer.type === 'fm' && layer.fm) {
    return createFMLayer(ctx, layer.fm, frequency, startTime, sources);
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
  
  if (voices === 1 && !config.sub) {
    const osc = ctx.createOscillator();
    osc.type = config.waveform;
    osc.frequency.value = frequency;
    osc.detune.value = config.detune || 0;
    osc.start(startTime);
    sources.push(osc);
    return { sources, output: osc };
  }
  
  const mixer = ctx.createGain();
  const gainPerVoice = 1 / Math.sqrt(voices);
  
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator();
    osc.type = config.waveform;
    osc.frequency.value = frequency;
    
    const voiceDetune = voices > 1 
      ? (i / (voices - 1) - 0.5) * 2 * unison.detune 
      : 0;
    osc.detune.value = (config.detune || 0) + voiceDetune;
    
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = gainPerVoice;
    
    if (voices > 1 && unison.spread > 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, (i / (voices - 1) - 0.5) * 2 * unison.spread));
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

function createFMLayer(
  ctx: AnyAudioContext,
  config: { carrier: number; modulator: number; modulationIndex: number },
  frequency: number,
  startTime: number,
  sources: AudioScheduledSourceNode[]
): LayerSources {
  const ratio = config.modulator / config.carrier;
  
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modGain = ctx.createGain();
  
  const modulatorFreq = frequency * ratio;
  carrier.frequency.value = frequency;
  modulator.frequency.value = modulatorFreq;
  
  // FM modulation index (β) = Δf / f_mod, so Δf = β × f_mod
  // The gain controls frequency deviation in Hz
  modGain.gain.value = config.modulationIndex * modulatorFreq;
  
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  
  carrier.start(startTime);
  modulator.start(startTime);
  sources.push(carrier, modulator);
  
  return { sources, output: carrier };
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
  config: { frequency: number; damping: number; pluckLocation?: number },
  frequency: number,
  startTime: number,
  sources: AudioScheduledSourceNode[]
): LayerSources {
  const period = 1 / frequency;
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
  
  // Damping factor
  const damping = Math.max(0.01, Math.min(0.999, 1 - (config.damping * 0.1)));
  
  let prevSample = 0;
  let pointer = 0;
  
  for (let i = 0; i < bufferSize; i++) {
    const val = ring[pointer];
    data[i] = val;
    
    const newVal = damping * 0.5 * (val + prevSample);
    ring[pointer] = newVal;
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
  filter.frequency.value = Math.max(20, Math.min(20000, config.frequency));
  filter.Q.value = Math.max(0.0001, config.q);
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
  const drive = Math.max(0, Math.min(10, config.drive));
  const mix = Math.max(0, Math.min(1, config.mix));
  
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
  config: { type: string; amount: number; mix: number }
): { input: GainNode; output: GainNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  
  const shaper = ctx.createWaveShaper();
  const curveSize = 256;
  const curve = new Float32Array(curveSize);
  const amount = config.amount * 100;
  
  for (let i = 0; i < curveSize; i++) {
    const x = (i - curveSize / 2) / (curveSize / 2);
    curve[i] = Math.tanh(x * amount);
  }
  shaper.curve = curve;
  
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  dryGain.gain.value = 1 - config.mix;
  wetGain.gain.value = config.mix;
  
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
  
  const time = Math.min(2, Math.max(0.001, config.time));
  const feedbackValue = Math.min(0.9, Math.max(0, config.feedback));
  const mix = Math.max(0, Math.min(1, config.mix));
  
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
  
  const decay = Math.min(5, Math.max(0.1, config.decay));
  const damping = Math.max(0, Math.min(1, config.damping));
  const mix = Math.max(0, Math.min(1, config.mix));
  
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
  config: { threshold: number; ratio: number; attack: number; release: number; knee?: number }
): DynamicsCompressorNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = Math.max(-100, Math.min(0, config.threshold));
  comp.ratio.value = Math.max(1, Math.min(20, config.ratio));
  comp.attack.value = Math.max(0, Math.min(1, config.attack));
  comp.release.value = Math.max(0, Math.min(1, config.release));
  comp.knee.value = config.knee ?? 30;
  return comp;
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
  const sustainLevel = Math.max(SILENCE, envelope.sustain * peakValue);
  
  param.setValueAtTime(SILENCE, startTime);
  param.exponentialRampToValueAtTime(peakValue, startTime + safeAttack);
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
  const sustainLevel = Math.max(0, Math.min(1, envelope.sustain));
  
  const safeAttack = Math.max(0.001, envelope.attack);
  const safeDecay = Math.max(0.001, envelope.decay);
  
  const startFreq = Math.max(20, baseFreq);
  const peakFreq = Math.max(20, Math.min(20000, baseFreq + amount));
  const sustainFreq = Math.max(20, baseFreq + (amount * sustainLevel));
  
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
  const safeRelease = Math.max(0.001, releaseTime);
  const targetFreq = Math.max(20, baseFreq);
  
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
  const delay = lfo.delay || 0;
  const fade = lfo.fade || 0;

  // Create LFO source
  let lfoSource: AudioScheduledSourceNode;
  if (lfo.waveform === 'random') {
    // Random LFO using buffer source
    const bufferSize = ctx.sampleRate * 10; // 10 seconds of random
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    const samplesPerStep = Math.floor(ctx.sampleRate / (lfo.frequency * 10));
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
    osc.frequency.value = Math.max(0.01, lfo.frequency);
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
      const detuneAmount = lfo.depth * 100; // depth 1 = 100 cents = 1 semitone
      const detuneGain = ctx.createGain();
      detuneGain.gain.value = detuneAmount;
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
        filterGain.gain.value = filterNode.frequency.value * lfo.depth;
        lfoGain.connect(filterGain);
        filterGain.connect(filterNode.frequency);
      }
      return { output: null, sources };
    }

    case 'amplitude': {
      const ampGain = ctx.createGain();
      ampGain.gain.value = lfo.depth;
      lfoGain.connect(ampGain);

      const output = ctx.createGain();
      output.gain.value = 1;
      ampGain.connect(output.gain);
      inputNode.connect(output);
      return { output, sources };
    }

    case 'pan': {
      const panGain = ctx.createGain();
      panGain.gain.value = lfo.depth;
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

