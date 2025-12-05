import type { SoundConfig } from '../types/soundConfig';
import { SYNTHESIS, PINK_NOISE, WAVESHAPER_CURVE_SIZE } from '../config';

function safeValue(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export async function synthesizeSound(config: SoundConfig): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(
    SYNTHESIS.CHANNELS,
    Math.ceil(config.timing.duration * SYNTHESIS.SAMPLE_RATE),
    SYNTHESIS.SAMPLE_RATE
  );

  const mixer = ctx.createGain();
  const sources: AudioScheduledSourceNode[] = [];

  for (const layer of config.synthesis.layers) {
    const source = createLayerSource(ctx, layer);
    const layerGain = ctx.createGain();
    
    if (layer.envelope) {
      applyEnvelope(layerGain.gain, layer.envelope, config, safeValue(layer.gain, 1));
    } else {
      layerGain.gain.value = safeValue(layer.gain, 1);
    }
    
    source.connect(layerGain);
    layerGain.connect(mixer);
    
    if ('start' in source && typeof source.start === 'function') {
      sources.push(source as AudioScheduledSourceNode);
    }
  }

  const filter = config.filter ? createFilter(ctx, config) : null;
  let chain: AudioNode = mixer;
  
  if (filter) {
    mixer.connect(filter);
    chain = filter;
    
    if (config.filter.envelope) {
      applyFilterEnvelope(filter.frequency, config.filter, config);
    }
  }
  
  const masterGain = ctx.createGain();
  chain.connect(masterGain);
  
  const hasLayerEnvelopes = config.synthesis.layers.some(l => l.envelope);
  if (!hasLayerEnvelopes) {
    applyEnvelope(masterGain.gain, config.envelope, config, config.dynamics.velocity);
  } else {
    masterGain.gain.value = config.dynamics.velocity;
  }
  
  const effectsChain = createEffects(ctx, config);
  masterGain.connect(effectsChain);
  effectsChain.connect(ctx.destination);
  
  sources.forEach(s => {
    s.start(0);
    s.stop(config.timing.duration);
  });
  
  const buffer = await ctx.startRendering();
  normalizeBuffer(buffer);
  return buffer;
}

function createLayerSource(ctx: OfflineAudioContext, layer: SoundConfig['synthesis']['layers'][0]): AudioNode {
  if (layer.type === 'noise' && layer.noise) {
    return createNoiseSource(ctx, layer.noise.type);
  }
  
  if (layer.type === 'fm' && layer.fm) {
    return createFMSource(ctx, layer.fm);
  }
  
  if (layer.type === 'oscillator' && layer.oscillator) {
    return createOscillatorSource(ctx, layer.oscillator);
  }
  
  const osc = ctx.createOscillator();
  osc.frequency.value = SYNTHESIS.DEFAULT_FREQUENCY;
  return osc;
}

function createOscillatorSource(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['synthesis']['layers'][0]['oscillator']>): AudioNode {
  const unison = config.unison || { voices: 1, detune: 0, spread: 0 };
  const voices = Math.max(1, Math.min(8, unison.voices));
  
  if (voices === 1 && !config.sub) {
    const osc = ctx.createOscillator();
    osc.type = config.waveform;
    osc.frequency.value = safeValue(config.frequency, 440);
    osc.detune.value = safeValue(config.detune, 0);
    return osc;
  }
  
  const mixer = ctx.createGain();
  const gainPerVoice = 1 / Math.sqrt(voices);
  
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator();
    osc.type = config.waveform;
    osc.frequency.value = safeValue(config.frequency, 440);
    
    const voiceDetune = voices > 1 ? (i / (voices - 1) - 0.5) * 2 * unison.detune : 0;
    osc.detune.value = safeValue(config.detune, 0) + voiceDetune;
    
    const voiceGain = ctx.createGain();
    voiceGain.gain.value = gainPerVoice;
    
    if (voices > 1 && unison.spread > 0) {
      const panner = ctx.createStereoPanner();
      const pan = (i / (voices - 1) - 0.5) * 2 * unison.spread;
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      osc.connect(panner);
      panner.connect(voiceGain);
    } else {
      osc.connect(voiceGain);
    }
    
    voiceGain.connect(mixer);
    osc.start(0);
  }
  
  if (config.sub) {
    const sub = ctx.createOscillator();
    sub.type = config.sub.waveform || 'sine';
    const octaveDivisor = Math.pow(2, Math.abs(config.sub.octave));
    sub.frequency.value = safeValue(config.frequency, 440) / octaveDivisor;
    
    const subGain = ctx.createGain();
    subGain.gain.value = safeValue(config.sub.level, 0);
    
    sub.connect(subGain);
    subGain.connect(mixer);
    sub.start(0);
  }
  
  return mixer;
}

function createNoiseSource(ctx: OfflineAudioContext, type: string): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * SYNTHESIS.NOISE_BUFFER_DURATION;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
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
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * PINK_NOISE.WHITE_GAIN) * SYNTHESIS.PINK_NOISE_OUTPUT_GAIN;
      b6 = white * PINK_NOISE.B6_GAIN;
    }
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function createFMSource(ctx: OfflineAudioContext, fm: { carrier: number; modulator: number; modulationIndex: number }): OscillatorNode {
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modulatorGain = ctx.createGain();
  
  carrier.frequency.value = safeValue(fm.carrier, 440);
  modulator.frequency.value = safeValue(fm.modulator, 440);
  modulatorGain.gain.value = safeValue(fm.modulationIndex, 0);
  
  modulator.connect(modulatorGain);
  modulatorGain.connect(carrier.frequency);
  modulator.start(0);
  
  return carrier;
}

function createFilter(ctx: OfflineAudioContext, config: SoundConfig): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = config.filter!.type;
  filter.frequency.value = safeValue(config.filter!.frequency, 1000);
  filter.Q.value = safeValue(config.filter!.q, 1);
  if (config.filter!.gain !== undefined) {
    filter.gain.value = safeValue(config.filter!.gain, 0);
  }
  return filter;
}

function applyEnvelope(
  param: AudioParam,
  envelope: { attack: number; decay: number; sustain: number; release: number; attackCurve?: string; releaseCurve?: string },
  config: SoundConfig,
  peakValue: number
) {
  const { attack, decay, sustain, release } = envelope;
  const sustainLevel = Math.max(0, Math.min(1, sustain));
  const duration = config.timing.duration;
  
  const safeAttack = Math.max(0.001, attack);
  const safeDecay = Math.max(0.001, decay);
  const safeRelease = Math.max(0.001, release);
  const releaseStart = Math.max(safeAttack + safeDecay, duration - safeRelease);
  
  param.setValueAtTime(0.001, 0);
  param.exponentialRampToValueAtTime(peakValue, safeAttack);
  param.exponentialRampToValueAtTime(Math.max(0.001, peakValue * sustainLevel), safeAttack + safeDecay);
  param.setValueAtTime(Math.max(0.001, peakValue * sustainLevel), releaseStart);
  param.exponentialRampToValueAtTime(0.001, duration);
}

function applyFilterEnvelope(param: AudioParam, filter: NonNullable<SoundConfig['filter']>, config: SoundConfig) {
  const env = filter.envelope!;
  const baseFreq = filter.frequency;
  const amount = safeValue(env.amount, 0);
  const sustainLevel = Math.max(0, Math.min(1, env.sustain));
  const duration = config.timing.duration;
  
  const safeAttack = Math.max(0.001, env.attack);
  const safeDecay = Math.max(0.001, env.decay);
  const safeRelease = Math.max(0.001, env.release);
  const releaseStart = Math.max(safeAttack + safeDecay, duration - safeRelease);
  
  const startFreq = Math.max(20, baseFreq);
  const peakFreq = Math.max(20, Math.min(20000, baseFreq + amount));
  const sustainFreq = Math.max(20, baseFreq + (amount * sustainLevel));
  
  param.setValueAtTime(startFreq, 0);
  param.exponentialRampToValueAtTime(peakFreq, safeAttack);
  param.exponentialRampToValueAtTime(sustainFreq, safeAttack + safeDecay);
  param.setValueAtTime(sustainFreq, releaseStart);
  param.exponentialRampToValueAtTime(startFreq, duration);
}

function createEffects(ctx: OfflineAudioContext, config: SoundConfig): AudioNode {
  let chain: AudioNode = ctx.createGain();
  const input = chain;
  
  if (config.effects.distortion) {
    const dist = createDistortion(ctx, config.effects.distortion);
    chain.connect(dist);
    chain = dist;
  }
  
  if (config.effects.reverb) {
    const reverb = createReverb(ctx, config.effects.reverb);
    chain.connect(reverb);
    chain = reverb;
  }
  
  if (config.effects.delay) {
    const delay = createDelay(ctx, config.effects.delay);
    chain.connect(delay);
    chain = delay;
  }
  
  if (config.effects.compressor) {
    const comp = createCompressor(ctx, config.effects.compressor);
    chain.connect(comp);
    chain = comp;
  }
  
  return input;
}

function createDistortion(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['effects']['distortion']>): WaveShaperNode {
  const distortion = ctx.createWaveShaper();
  const curve = new Float32Array(SYNTHESIS.WAVESHAPER_CURVE_SIZE);
  const amount = config.amount * SYNTHESIS.WAVESHAPER_AMOUNT_MULTIPLIER;
  
  for (let i = 0; i < SYNTHESIS.WAVESHAPER_CURVE_SIZE; i++) {
    const x = (i - SYNTHESIS.WAVESHAPER_CURVE_SIZE / 2) / (SYNTHESIS.WAVESHAPER_CURVE_SIZE / 2);
    curve[i] = Math.tanh(x * amount);
  }
  
  distortion.curve = curve;
  return distortion;
}

function createReverb(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['effects']['reverb']>): ConvolverNode {
  const convolver = ctx.createConvolver();
  const length = ctx.sampleRate * config.decay;
  const impulse = ctx.createBuffer(SYNTHESIS.CHANNELS, length, ctx.sampleRate);
  
  for (let channel = 0; channel < SYNTHESIS.CHANNELS; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, config.damping * SYNTHESIS.REVERB_DAMPING_MULTIPLIER);
    }
  }
  
  convolver.buffer = impulse;
  return convolver;
}

function createDelay(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['effects']['delay']>): DelayNode {
  const delay = ctx.createDelay(SYNTHESIS.MAX_DELAY_TIME);
  const feedback = ctx.createGain();
  
  delay.delayTime.value = safeValue(config.time, 0.25);
  feedback.gain.value = safeValue(config.feedback, 0);
  
  delay.connect(feedback);
  feedback.connect(delay);
  
  return delay;
}

function createCompressor(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['effects']['compressor']>): DynamicsCompressorNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = safeValue(config.threshold, -24);
  comp.ratio.value = safeValue(config.ratio, 12);
  comp.attack.value = safeValue(config.attack, 0.003);
  comp.release.value = safeValue(config.release, 0.25);
  comp.knee.value = safeValue(config.knee, 30);
  return comp;
}

function normalizeBuffer(buffer: AudioBuffer): void {
  let maxPeak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      maxPeak = Math.max(maxPeak, Math.abs(data[i]));
    }
  }
  
  if (maxPeak > 0 && maxPeak !== 1) {
    const scale = 0.95 / maxPeak;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] *= scale;
      }
    }
  }
}
