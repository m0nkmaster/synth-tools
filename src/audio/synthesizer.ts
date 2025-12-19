import type { SoundConfig } from '../types/soundConfig';
import { SYNTHESIS } from '../config';
import {
  createLayerSources,
  createFilter,
  createSaturation,
  createEffectsChain,
  createLFO,
  applyPitchEnvelope,
  isFMLayerResult,
  type FMLayerResult,
} from './synthCore';

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
  const allSources: AudioScheduledSourceNode[] = [];

  // === FM ROUTING: Two-pass processing ===
  // Pass 1: Create all layers, collecting FM layer results for routing
  interface LayerResult {
    layerIndex: number;
    result: ReturnType<typeof createLayerSources>;
    layer: SoundConfig['synthesis']['layers'][0];
    chain: AudioNode;
    layerGain: GainNode;
  }
  const layerResults: LayerResult[] = [];
  const fmLayerResults: Map<number, FMLayerResult> = new Map();

  for (let i = 0; i < config.synthesis.layers.length; i++) {
    const layer = config.synthesis.layers[i];
    // Get base frequency for the layer
    // For FM layers, use oscillator frequency as base (ratio is applied internally)
    const layerFreq = layer.oscillator?.frequency ?? layer.karplus?.frequency ?? 440;
    
    // Pass duration for FM envelope scheduling
    const result = createLayerSources(ctx, layer, safeValue(layerFreq, 440), 0, config.timing.duration);
    let chain: AudioNode = result.output;

    // Track FM layers for routing
    if (isFMLayerResult(result)) {
      fmLayerResults.set(i, result);
    }

    // Apply pitch envelope to oscillator sources
    if (layer.oscillator?.pitchEnvelope) {
      const pitchEnv = layer.oscillator.pitchEnvelope;
      for (const source of result.sources) {
        if (source instanceof OscillatorNode) {
          applyPitchEnvelope(source.frequency, layerFreq, pitchEnv, 0, config.timing.duration);
        }
      }
    }

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
    
    layerResults.push({ layerIndex: i, result, layer, chain, layerGain });
    allSources.push(...result.sources);
  }

  // Pass 2: Wire up FM modulation routing
  for (const { layerIndex, layer, layerGain } of layerResults) {
    const fmResult = fmLayerResults.get(layerIndex);
    
    if (fmResult && layer.fm?.modulatesLayer !== undefined) {
      // This FM layer modulates another FM layer
      const targetIndex = layer.fm.modulatesLayer;
      const targetFM = fmLayerResults.get(targetIndex);
      
      if (targetFM) {
        // Route modulation output to target's carrier frequency
        fmResult.modulationOutput.connect(targetFM.carrierFrequencyParam);
        // Don't connect to mixer (this is a modulator, not an audio output)
      } else {
        // Target not found or not an FM layer - fall back to audio output
        layerGain.connect(mixer);
      }
    } else {
      // Normal audio output to mixer
      layerGain.connect(mixer);
    }
  }

  const filter = config.filter ? createFilter(ctx, config.filter) : null;
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
    const lfoResult = createLFO(ctx, config.lfo, outputChain, filter, allSources, 0);
    if (lfoResult.output) {
      outputChain = lfoResult.output;
    }
  }

  // Wire up effects properly
  const { input: effectsInput, output: effectsOutput } = createEffects(ctx, config);
  outputChain.connect(effectsInput);
  effectsOutput.connect(ctx.destination);

  // Stop all sources at the end of the sound duration
  const stopTime = config.timing.duration;
  allSources.forEach(s => s.stop(stopTime));

  const buffer = await ctx.startRendering();
  // Only normalize if requested, otherwise we amplify noise floor on quiet sounds
  if (config.dynamics.normalize) {
    normalizeBuffer(buffer);
  }
  return buffer;
}

// Note: createLayerSource, createOscillatorSource, createNoiseSource, createFMSource, 
// createKarplusStrongSource are now in ./synthCore for shared code

function applyEnvelope(
  param: AudioParam,
  envelope: { attack: number; decay: number; sustain: number; release: number; attackCurve?: string; releaseCurve?: string },
  config: SoundConfig,
  peakValue: number
) {
  const { attack, decay, sustain, release } = envelope;
  const sustainLevel = Math.max(0, Math.min(1, sustain));
  const duration = config.timing.duration;

  // Ensure envelope phases don't exceed duration
  const totalEnvTime = attack + decay + release;
  const scale = totalEnvTime > duration * 0.95 ? (duration * 0.95) / totalEnvTime : 1;
  
  const safeAttack = Math.max(0.001, attack * scale);
  const safeDecay = Math.max(0.001, decay * scale);
  const safeRelease = Math.max(0.001, release * scale);
  const releaseStart = Math.max(safeAttack + safeDecay, duration - safeRelease);

  // Use 0.0001 (-80dB) as silence floor instead of 0.001 (-60dB) to prevent hiss
  // exponentialRampToValueAtTime can't target 0, so ensure peakValue is at least SILENCE
  const SILENCE = 0.0001;
  const safePeak = Math.max(SILENCE, peakValue);

  param.setValueAtTime(SILENCE, 0);
  param.exponentialRampToValueAtTime(safePeak, safeAttack);
  param.exponentialRampToValueAtTime(Math.max(SILENCE, safePeak * sustainLevel), safeAttack + safeDecay);
  param.setValueAtTime(Math.max(SILENCE, safePeak * sustainLevel), releaseStart);
  param.exponentialRampToValueAtTime(SILENCE, duration);
}

function applyFilterEnvelope(param: AudioParam, filter: NonNullable<SoundConfig['filter']>, config: SoundConfig) {
  const env = filter.envelope!;
  const baseFreq = filter.frequency;
  const amount = safeValue(env.amount, 0);
  const sustainLevel = Math.max(0, Math.min(1, env.sustain));
  const duration = config.timing.duration;

  // Ensure envelope phases don't exceed duration
  const totalEnvTime = env.attack + env.decay + env.release;
  const scale = totalEnvTime > duration * 0.95 ? (duration * 0.95) / totalEnvTime : 1;
  
  const safeAttack = Math.max(0.001, env.attack * scale);
  const safeDecay = Math.max(0.001, env.decay * scale);
  const safeRelease = Math.max(0.001, env.release * scale);
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

    // Ensure envelope phases don't exceed duration
    const totalEnvTime = env.attack + env.decay + env.release;
    const scale = totalEnvTime > duration * 0.95 ? (duration * 0.95) / totalEnvTime : 1;
    
    const safeAttack = Math.max(0.001, env.attack * scale);
    const safeDecay = Math.max(0.001, env.decay * scale);
    const safeRelease = Math.max(0.001, env.release * scale);
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

function createEffects(ctx: OfflineAudioContext, config: SoundConfig): { input: AudioNode, output: AudioNode } {
  // Use shared effects chain for distortion, compressor, delay, reverb
  const { input, output: sharedOutput } = createEffectsChain(ctx, config.effects);

  // Gate (static synth only - needs duration info, inserted after shared chain)
  if (config.effects.gate) {
    const gate = createGateEffect(ctx, config.effects.gate);
    const finalOutput = ctx.createGain();
    sharedOutput.connect(gate.input);
    gate.output.connect(finalOutput);
    return { input, output: finalOutput };
  }

  return { input, output: sharedOutput };
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
