/**
 * Real-time synthesizer for live MIDI input
 * Uses AudioContext (not OfflineAudioContext) for immediate playback
 * Shares core audio graph creation with static synthesizer via synthCore
 */

import type { SoundConfig } from '../types/soundConfig';
import {
  createLayerSources,
  createFilter,
  createSaturation,
  createEffectsChain,
  createLFO,
  applyADSREnvelope,
  applyReleaseEnvelope,
  applyFilterEnvelope,
  applyPitchEnvelopeRealtime,
} from './synthCore';

// Safe value helper - returns fallback for non-finite values
function safe(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

interface ActiveVoice {
  note: number;
  sources: AudioScheduledSourceNode[];
  gainNode: GainNode;
  filterNode?: BiquadFilterNode;
  filterBaseFreq?: number;
  releaseTime: number;
  startTime: number;
  lfoSources?: AudioScheduledSourceNode[];
}

export class RealtimeSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsInput: AudioNode | null = null;
  private effectsOutput: AudioNode | null = null;
  private activeVoices: Map<number, ActiveVoice> = new Map();
  private config: SoundConfig;
  private maxPolyphony = 16;

  constructor(config: SoundConfig) {
    this.config = config;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      // Match the static synth's output level (no arbitrary reduction)
      this.masterGain.gain.value = 1.0;

      // Create effects chain
      this.rebuildEffectsChain();
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    return this.ctx;
  }

  private rebuildEffectsChain(): void {
    if (!this.ctx || !this.masterGain) return;

    // Disconnect old effects chain if it exists
    if (this.effectsOutput) {
      try {
        this.effectsOutput.disconnect();
      } catch {
        // Already disconnected
      }
    }

    // Create new effects chain
    const effects = createEffectsChain(this.ctx, this.config.effects);
    this.effectsInput = effects.input;
    this.effectsOutput = effects.output;
    effects.output.connect(this.masterGain);
  }

  updateConfig(config: SoundConfig): void {
    this.config = config;
    // Rebuild effects chain when config changes
    this.rebuildEffectsChain();
  }

  noteOn(note: number, velocity: number): void {
    const ctx = this.ensureContext();
    const now = ctx.currentTime;

    // Steal oldest voice if at max polyphony
    if (this.activeVoices.size >= this.maxPolyphony) {
      const oldest = Array.from(this.activeVoices.entries()).sort(
        (a, b) => a[1].startTime - b[1].startTime
      )[0];
      if (oldest) {
        this.releaseVoice(oldest[0], true);
      }
    }

    // Release any existing voice on this note
    if (this.activeVoices.has(note)) {
      this.releaseVoice(note, true);
    }

    const baseFreq = 440 * Math.pow(2, (note - 69) / 12);
    const velocityGain = (velocity / 127) * this.config.dynamics.velocity;
    const { attack, decay, sustain, release } = this.config.envelope;

    // Create voice using shared core
    const voice = this.createVoice(
      ctx,
      baseFreq,
      velocityGain,
      now,
      attack,
      decay,
      sustain,
      release
    );

    this.activeVoices.set(note, {
      note,
      sources: voice.sources,
      gainNode: voice.gainNode,
      filterNode: voice.filterNode,
      filterBaseFreq: voice.filterBaseFreq,
      releaseTime: voice.releaseTime,
      lfoSources: voice.lfoSources,
      startTime: now,
    });
  }

  noteOff(note: number): void {
    this.releaseVoice(note, false);
  }

  private createVoice(
    ctx: AudioContext,
    frequency: number,
    velocity: number,
    startTime: number,
    attack: number,
    decay: number,
    sustain: number,
    release: number
  ): Omit<ActiveVoice, 'note' | 'startTime'> {
    const gainNode = ctx.createGain();
    const allSources: AudioScheduledSourceNode[] = [];
    const lfoSources: AudioScheduledSourceNode[] = [];
    let filterNode: BiquadFilterNode | undefined;
    let filterBaseFreq: number | undefined;

    // Create layer mix node
    const layerMix = ctx.createGain();

    for (const layer of this.config.synthesis.layers) {
      const layerGain = ctx.createGain();

      // Use shared core for layer creation - always use MIDI frequency
      const { sources, output } = createLayerSources(
        ctx,
        layer,
        frequency, // Use MIDI note frequency, not config frequency
        startTime
      );
      allSources.push(...sources);

      // Apply pitch envelope to oscillator sources
      if (layer.oscillator?.pitchEnvelope) {
        const pitchEnv = layer.oscillator.pitchEnvelope;
        for (const source of sources) {
          if (source instanceof OscillatorNode) {
            applyPitchEnvelopeRealtime(source.frequency, frequency, pitchEnv, startTime);
          }
        }
      }

      // Layer filter with envelope (matching static synth)
      let layerOutput: AudioNode = output;
      if (layer.filter) {
        const lf = createFilter(ctx, layer.filter);
        output.connect(lf);
        layerOutput = lf;
        
        // Apply filter envelope if defined
        if (layer.filter.envelope) {
          applyFilterEnvelope(
            lf.frequency,
            layer.filter.frequency,
            layer.filter.envelope,
            startTime
          );
        }
      }

      // Layer saturation (matching static synth)
      if (layer.saturation) {
        const sat = createSaturation(ctx, layer.saturation);
        layerOutput.connect(sat);
        layerOutput = sat;
      }

      // Apply per-layer envelope if defined, otherwise use layer gain
      if (layer.envelope) {
        applyADSREnvelope(
          layerGain.gain,
          layer.envelope,
          layer.gain,
          startTime
        );
      } else {
        layerGain.gain.value = safe(layer.gain, 1);
      }

      layerOutput.connect(layerGain);
      layerGain.connect(layerMix);
    }

    // Global filter with envelope (matching static synth)
    if (this.config.filter) {
      filterNode = createFilter(ctx, this.config.filter);
      filterBaseFreq = this.config.filter.frequency;
      layerMix.connect(filterNode);
      filterNode.connect(gainNode);
      
      // Apply global filter envelope if defined
      if (this.config.filter.envelope) {
        applyFilterEnvelope(
          filterNode.frequency,
          this.config.filter.frequency,
          this.config.filter.envelope,
          startTime
        );
      }
    } else {
      layerMix.connect(gainNode);
    }

    // Apply envelope using shared core
    applyADSREnvelope(
      gainNode.gain,
      { attack, decay, sustain, release },
      velocity,
      startTime
    );

    // Determine what to connect to effects
    let outputNode: AudioNode = gainNode;

    // LFO modulation (using shared core)
    if (this.config.lfo) {
      const lfoResult = createLFO(ctx, this.config.lfo, gainNode, filterNode ?? null, allSources, startTime);
      if (lfoResult.output) {
        outputNode = lfoResult.output;
      }
      lfoSources.push(...lfoResult.sources);
    }

    // Connect to effects chain or master
    if (this.effectsInput) {
      outputNode.connect(this.effectsInput);
    } else if (this.masterGain) {
      outputNode.connect(this.masterGain);
    }

    return {
      sources: allSources,
      gainNode,
      filterNode,
      filterBaseFreq,
      releaseTime: release,
      lfoSources: lfoSources.length > 0 ? lfoSources : undefined,
    };
  }

  private releaseVoice(note: number, immediate: boolean): void {
    const active = this.activeVoices.get(note);
    if (!active) return;

    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const releaseTime = immediate ? 0.01 : Math.max(0.001, active.releaseTime);

    // Apply release envelope using shared core
    applyReleaseEnvelope(active.gainNode.gain, releaseTime, now);

    // Apply filter release envelope if applicable
    if (active.filterNode && active.filterBaseFreq !== undefined && this.config.filter?.envelope) {
      const filterRelease = this.config.filter.envelope.release;
      const safeRelease = Math.max(0.001, immediate ? 0.01 : filterRelease);
      const targetFreq = Math.max(20, active.filterBaseFreq);
      
      active.filterNode.frequency.cancelScheduledValues(now);
      active.filterNode.frequency.setValueAtTime(active.filterNode.frequency.value, now);
      active.filterNode.frequency.exponentialRampToValueAtTime(targetFreq, now + safeRelease);
    }

    // Stop sources after release
    const stopTime = now + releaseTime + 0.01;
    active.sources.forEach((src) => {
      try {
        src.stop(stopTime);
      } catch {
        // Source already stopped
      }
    });

    // Stop LFO sources
    active.lfoSources?.forEach((src) => {
      try {
        src.stop(stopTime);
      } catch {
        // Source already stopped
      }
    });

    // Clean up after release
    setTimeout(
      () => {
        try {
          active.gainNode.disconnect();
          active.filterNode?.disconnect();
        } catch {
          // Already disconnected
        }
      },
      (releaseTime + 0.1) * 1000
    );

    this.activeVoices.delete(note);
  }

  allNotesOff(): void {
    for (const note of this.activeVoices.keys()) {
      this.releaseVoice(note, true);
    }
  }

  dispose(): void {
    this.allNotesOff();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.effectsInput = null;
  }

  getActiveNoteCount(): number {
    return this.activeVoices.size;
  }
}
