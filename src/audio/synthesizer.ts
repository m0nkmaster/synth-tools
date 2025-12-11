import type { SoundConfig } from '../types/soundConfig';
import { SYNTHESIS, PINK_NOISE } from '../config';

function safeValue(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export async function synthesizeSound(config: SoundConfig): Promise<AudioBuffer> {
  // Calculate tail duration for effects (Reverb, Delay) so they don't get cut off
  const tailDuration = calculateEffectsTail(config);
  const totalDuration = config.timing.duration + tailDuration;

  const ctx = new OfflineAudioContext(
    SYNTHESIS.CHANNELS,
    Math.ceil(totalDuration * SYNTHESIS.SAMPLE_RATE),
    SYNTHESIS.SAMPLE_RATE
  );

  const mixer = ctx.createGain();
  const sources: AudioScheduledSourceNode[] = [];
  const allSources: AudioScheduledSourceNode[] = [];

  for (const layer of config.synthesis.layers) {
    const layerSources: AudioScheduledSourceNode[] = [];
    const source = createLayerSource(ctx, layer, layerSources);
    let chain: AudioNode = source;

    if (layer.filter) {
      const layerFilter = createLayerFilter(ctx, layer.filter, config);
      chain.connect(layerFilter);
      chain = layerFilter;
    }

    if (layer.saturation) {
      const saturation = createSaturation(ctx, layer.saturation);
      chain.connect(saturation);
      chain = saturation;
    }

    const layerGain = ctx.createGain();
    if (layer.envelope) {
      applyEnvelope(layerGain.gain, layer.envelope, config, safeValue(layer.gain, 1));
    } else {
      layerGain.gain.value = safeValue(layer.gain, 1);
    }

    chain.connect(layerGain);
    layerGain.connect(mixer);

    if ('start' in source && typeof source.start === 'function') {
      sources.push(source as AudioScheduledSourceNode);
    }
    allSources.push(...layerSources);
  }

  const filter = config.filter ? createFilter(ctx, config) : null;
  let chain: AudioNode = mixer;

  if (filter) {
    mixer.connect(filter);
    chain = filter;

    // We know config.filter is defined because filter node was created from it
    if (config.filter!.envelope) {
      applyFilterEnvelope(filter.frequency, config.filter!, config);
    }
  }

  const masterGain = ctx.createGain();
  chain.connect(masterGain);

  // Always apply global envelope (VCA) to master gain
  // This ensures that even if layers have their own spectral envelopes, the overall sound
  // follows the master amplitude envelope (preventing "stuck notes" for layers without envelopes).
  applyEnvelope(masterGain.gain, config.envelope, config, config.dynamics.velocity);

  let outputChain: AudioNode = masterGain;

  if (config.lfo) {
    outputChain = applyLFO(ctx, outputChain, config, filter);
  }

  // Wire up effects properly
  const { input: effectsInput, output: effectsOutput } = createEffects(ctx, config);
  outputChain.connect(effectsInput);
  effectsOutput.connect(ctx.destination);

  const stopTime = config.timing.duration;
  sources.forEach(s => {
    s.start(0);
    s.stop(stopTime);
  });
  allSources.forEach(s => s.stop(stopTime));

  const buffer = await ctx.startRendering();
  // Only normalize if requested, otherwise we amplify noise floor on quiet sounds
  if (config.dynamics.normalize) {
    normalizeBuffer(buffer);
  }
  return buffer;
}

function createLayerSource(ctx: OfflineAudioContext, layer: SoundConfig['synthesis']['layers'][0], sources: AudioScheduledSourceNode[]): AudioNode {
  if (layer.type === 'noise' && layer.noise) {
    return createNoiseSource(ctx, layer.noise.type, sources);
  }

  if (layer.type === 'fm' && layer.fm) {
    return createFMSource(ctx, layer.fm, sources);
  }

  if (layer.type === 'oscillator' && layer.oscillator) {
    return createOscillatorSource(ctx, layer.oscillator, sources);
  }

  if (layer.type === 'karplus-strong' && layer.karplus) {
    return createKarplusStrongSource(ctx, layer.karplus);
  }

  const osc = ctx.createOscillator();
  osc.frequency.value = SYNTHESIS.DEFAULT_FREQUENCY;
  return osc;
}

function createOscillatorSource(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['synthesis']['layers'][0]['oscillator']>, sources: AudioScheduledSourceNode[]): AudioNode {
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
    const phaseRandom = (Math.random() - 0.5) * 2;
    osc.detune.value = safeValue(config.detune, 0) + voiceDetune + phaseRandom;

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
    sources.push(osc);
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
    sources.push(sub);
  }

  return mixer;
}

function createNoiseSource(ctx: OfflineAudioContext, type: string, sources: AudioScheduledSourceNode[]): AudioBufferSourceNode {
  const bufferSize = ctx.sampleRate * SYNTHESIS.NOISE_BUFFER_DURATION;
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
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * PINK_NOISE.WHITE_GAIN) * SYNTHESIS.PINK_NOISE_OUTPUT_GAIN;
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
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  sources.push(source);
  return source;
}

function createFMSource(ctx: OfflineAudioContext, fm: { carrier: number; modulator: number; modulationIndex: number }, sources: AudioScheduledSourceNode[]): OscillatorNode {
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const modulatorGain = ctx.createGain();

  carrier.frequency.value = safeValue(fm.carrier, 440);
  modulator.frequency.value = safeValue(fm.modulator, 440);
  modulatorGain.gain.value = safeValue(fm.modulationIndex, 0);

  modulator.connect(modulatorGain);
  modulatorGain.connect(carrier.frequency);
  modulator.start(0);
  sources.push(carrier);
  sources.push(modulator);

  return carrier;
}

function createKarplusStrongSource(ctx: OfflineAudioContext, config: { frequency: number; damping: number; pluckLocation?: number }): AudioBufferSourceNode {
  // Karplus-Strong Algorithm:
  // 1. Create a burst of noise (the "pluck")
  // 2. Feed it into a delay line (the "string")
  // 3. Filter the feedback loop (the "damping")

  // Target frequency determines delay time: T = 1 / f
  const frequency = safeValue(config.frequency, 440);
  const period = 1 / frequency;
  const periodSamples = Math.floor(period * ctx.sampleRate);

  // Create noise burst - length of period
  const bufferSize = ctx.sampleRate * 4.0; // 4 seconds max duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Initial noise burst (pluck)
  // Length of burst affects "energy", but for KS it should be exactly one period long to fill the delay line
  // or a short burst. Classic KS initializes the delay line with noise.
  // Here we pre-calculate the KS algorithm into the buffer because feedback loops with very short delays 
  // (high pitches) are imprecise with Web Audio delay nodes at block boundaries.

  // Initialize ring buffer with noise
  const N = periodSamples;
  const ringParams = new Float32Array(N);

  // Pluck excitation: White noise or filtered noise
  // pluckLocation can simulate plucking near bridge (bright) vs neck (dark)
  // but for basic implementation, just random noise.
  for (let i = 0; i < N; i++) {
    ringParams[i] = Math.random() * 2 - 1;
  }

  // Pre-calculate the result (Synthesis)
  // Low-pass filter coefficient for damping (0.5 is average, 1.0 is highly damped? No, 
  // usually y[n] = 0.5 * (x[n] + x[n-1]).
  // We'll use a variable decay factor.
  // S = 0.5 (simple average) gives fast decay. We want 'damping' to control t60.
  // We'll use the classic algorithm: y[n] = alpha * y[n-N] + (1-alpha) * y[n-(N+1)]?
  // Classic: y[i] = 0.5 * (y[i-BUFFER_SIZE] + y[i-BUFFER_SIZE-1])

  // Let's implement extended KS:
  // pointer wraps around N.
  // We fill the output buffer.

  let prevSample = 0;
  let pointer = 0;

  // Damping factor: 1.0 = sustain forever (no loss), 0.0 = instant mute
  // In KS, averaging is inherent damping.
  // Let's modify the blend.
  // The classic "average" filter corresponds to a specific brightness decay.
  // To allow longer sustains (like steel strings), we add a 'sustain' multiplier.
  const damping = Math.max(0.01, Math.min(0.999, 1 - (config.damping * 0.1))); // Map damping to sustain factor.

  // Generate audio
  for (let i = 0; i < bufferSize; i++) {
    // Read from Ring Buffer
    const val = ringParams[pointer];

    // Output
    data[i] = val;

    // Feedback Lowpass: Average coupled with sustain factor
    // y[n] = factor * 0.5 * (current + previous)
    const newVal = damping * 0.5 * (val + prevSample);

    // Update Ring Buffer
    ringParams[pointer] = newVal;

    // Store for next step
    prevSample = val;

    // Advance pointer
    pointer++;
    if (pointer >= N) pointer = 0;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
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

  // Use 0.0001 (-80dB) as silence floor instead of 0.001 (-60dB) to prevent hiss
  const SILENCE = 0.0001;

  param.setValueAtTime(SILENCE, 0);
  param.exponentialRampToValueAtTime(peakValue, safeAttack);
  param.exponentialRampToValueAtTime(Math.max(SILENCE, peakValue * sustainLevel), safeAttack + safeDecay);
  param.setValueAtTime(Math.max(SILENCE, peakValue * sustainLevel), releaseStart);
  param.exponentialRampToValueAtTime(SILENCE, duration);
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

function createLayerFilter(ctx: OfflineAudioContext, filterConfig: NonNullable<SoundConfig['synthesis']['layers'][0]['filter']>, config: SoundConfig): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = filterConfig.type;
  filter.frequency.value = safeValue(filterConfig.frequency, 1000);
  filter.Q.value = safeValue(filterConfig.q, 1);

  if (filterConfig.envelope) {
    const env = filterConfig.envelope;
    const baseFreq = filterConfig.frequency;
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

    filter.frequency.setValueAtTime(startFreq, 0);
    filter.frequency.exponentialRampToValueAtTime(peakFreq, safeAttack);
    filter.frequency.exponentialRampToValueAtTime(sustainFreq, safeAttack + safeDecay);
    filter.frequency.setValueAtTime(sustainFreq, releaseStart);
    filter.frequency.exponentialRampToValueAtTime(startFreq, duration);
  }

  return filter;
}

function createSaturation(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['synthesis']['layers'][0]['saturation']>): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(SYNTHESIS.WAVESHAPER_CURVE_SIZE);
  const drive = Math.max(0, Math.min(10, config.drive));
  const mix = Math.max(0, Math.min(1, config.mix));

  for (let i = 0; i < SYNTHESIS.WAVESHAPER_CURVE_SIZE; i++) {
    const x = (i - SYNTHESIS.WAVESHAPER_CURVE_SIZE / 2) / (SYNTHESIS.WAVESHAPER_CURVE_SIZE / 2);
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

function applyLFO(ctx: OfflineAudioContext, input: AudioNode, config: SoundConfig, filter: BiquadFilterNode | null): AudioNode {
  const lfo = config.lfo!;
  const delay = lfo.delay || 0;
  const fade = lfo.fade || 0;

  let lfoSource: AudioScheduledSourceNode;

  if (lfo.waveform === 'random') {
    const bufferSize = ctx.sampleRate * ctx.length / ctx.sampleRate;
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
    lfoSource = source;
  } else {
    const osc = ctx.createOscillator();
    osc.type = lfo.waveform;
    osc.frequency.value = safeValue(lfo.frequency, 1);
    lfoSource = osc;
  }

  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0, 0);

  if (delay > 0) {
    lfoGain.gain.setValueAtTime(0, delay);
    if (fade > 0) {
      lfoGain.gain.linearRampToValueAtTime(1, delay + fade);
    } else {
      lfoGain.gain.setValueAtTime(1, delay);
    }
  } else if (fade > 0) {
    lfoGain.gain.linearRampToValueAtTime(1, fade);
  } else {
    lfoGain.gain.setValueAtTime(1, 0);
  }

  lfoSource.connect(lfoGain);
  lfoSource.start(0);

  switch (lfo.target) {
    case 'filter': {
      if (filter) {
        const filterGain = ctx.createGain();
        filterGain.gain.value = filter.frequency.value * lfo.depth;
        lfoGain.connect(filterGain);
        filterGain.connect(filter.frequency);
      }
      break;
    }

    case 'amplitude': {
      const ampGain = ctx.createGain();
      ampGain.gain.value = lfo.depth;
      lfoGain.connect(ampGain);

      const output = ctx.createGain();
      output.gain.value = 1;
      ampGain.connect(output.gain);

      input.connect(output);
      return output;
    }

    case 'pan': {
      const panGain = ctx.createGain();
      panGain.gain.value = lfo.depth;
      lfoGain.connect(panGain);

      const panner = ctx.createStereoPanner();
      panGain.connect(panner.pan);
      input.connect(panner);
      return panner;
    }
  }

  return input;
}

function createEffects(ctx: OfflineAudioContext, config: SoundConfig): { input: AudioNode, output: AudioNode } {
  const input = ctx.createGain();
  let current: AudioNode = input;

  // Distortion
  if (config.effects.distortion) {
    const distortion = createDistortion(ctx, config.effects.distortion);
    current.connect(distortion);
    current = distortion;
  }

  // Compressor (Pre-FX)
  if (config.effects.compressor) {
    const compressor = createCompressor(ctx, config.effects.compressor);
    current.connect(compressor);
    current = compressor;
  }

  // Gate
  if (config.effects.gate) {
    const gate = createGateEffect(ctx, config.effects.gate);
    current.connect(gate.input);
    current = gate.output;
  }

  // Delay
  if (config.effects.delay) {
    const { input: delayInput, output: delayOutput } = createDelay(ctx, config.effects.delay);
    current.connect(delayInput);
    current = delayOutput;
  }

  // Reverb
  if (config.effects.reverb) {
    const { input: reverbInput, output: reverbOutput } = createReverbFX(ctx, config.effects.reverb);
    current.connect(reverbInput);
    current = reverbOutput;
  }

  return { input, output: current };
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
  const length = ctx.sampleRate * Math.min(3, config.decay);
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

// Helper for reverb to conform to Input/Output pattern
function createReverbFX(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['effects']['reverb']>): { input: AudioNode, output: AudioNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const reverb = createReverb(ctx, config);

  const mix = safeValue(config.mix, 0.5);
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;

  input.connect(dryGain);
  dryGain.connect(output);

  input.connect(reverb);
  reverb.connect(wetGain);
  wetGain.connect(output);

  return { input, output };
}

function createDelay(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['effects']['delay']>): { input: AudioNode, output: AudioNode } {
  const input = ctx.createGain();
  const output = ctx.createGain();

  const time = Math.min(SYNTHESIS.MAX_DELAY_TIME, safeValue(config.time, 0.25));
  const feedbackValue = Math.min(0.5, safeValue(config.feedback, 0.3));
  const mix = safeValue(config.mix, 0.5);

  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();

  dryGain.gain.value = 1 - mix;
  wetGain.gain.value = mix;

  input.connect(dryGain);
  dryGain.connect(output);

  const delay = ctx.createDelay(SYNTHESIS.MAX_DELAY_TIME);
  delay.delayTime.value = time;

  const feedback = ctx.createGain();
  feedback.gain.value = feedbackValue;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 4000;
  filter.Q.value = 0.5;

  input.connect(delay);
  delay.connect(filter);
  filter.connect(feedback);
  feedback.connect(delay);
  delay.connect(wetGain);
  wetGain.connect(output);

  return { input, output };
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

function createGateEffect(ctx: OfflineAudioContext, config: NonNullable<SoundConfig['effects']['gate']>): { input: AudioNode, output: AudioNode } {
  // Since we are in OfflineAudioContext, we can't easily do real-time signal analysis (no AudioWorklet without external file loading).
  // However, for synthesized sounds like drums, the 'Gate' usually applies to the Reverb Tail.
  // A true noise gate analyzes the input level. 
  // For '80s Snare', it's often a "Gated Reverb" where the reverb is just cut off after a fixed time.
  // Or it detects silence. 
  // Given we are generating one-shot sounds, we can approximate a "Gated Reverb" effect 
  // by simply applying a hard volume envelope at the end of the 'hold' time.

  // But wait, the user might want a real gate that reacts to the signal level.
  // Implementation of a "Sidechain Gate" is hard in OfflineContext without ScriptProcessor (deprecated) or Worklet.
  // BUT: We know the trigger time is t=0.
  // So a Gated Reverb on a snare effectively means:
  // "Let sound pass for X ms, then silence it."

  const input = ctx.createGain();
  const output = ctx.createGain();

  // Logic: 
  // 1. Gate is Open at t=0 (Attack)
  // 2. Stays Open for 'hold' time
  // 3. Closes over 'release' time

  const attack = safeValue(config.attack, 0.001);
  const hold = safeValue(config.hold, 0.2); // e.g. 200ms reverb tail
  const release = safeValue(config.release, 0.05); // quick closure

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, 0);
  envelope.gain.linearRampToValueAtTime(1, attack);
  envelope.gain.setValueAtTime(1, attack + hold);
  envelope.gain.linearRampToValueAtTime(0, attack + hold + release);

  input.connect(envelope);
  envelope.connect(output);

  return { input, output };
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

function calculateEffectsTail(config: SoundConfig): number {
  let tail = 0;

  if (config.effects?.reverb) {
    tail = Math.max(tail, Math.min(3, config.effects.reverb.decay));
  }

  if (config.effects?.delay) {
    const { time = 0.25, feedback = 0.3 } = config.effects.delay;
    const safeFeedback = Math.min(0.7, Math.max(0.01, feedback));
    const repeats = -3 / Math.log10(safeFeedback);
    const delayTail = repeats * time;
    tail = Math.max(tail, Math.min(5, delayTail));
  }

  // Add a small safety buffer (0.1s)
  return tail > 0 ? tail + 0.1 : 0.1;
}
