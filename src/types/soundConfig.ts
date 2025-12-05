/**
 * Comprehensive audio synthesis configuration
 */

export interface SoundConfig {
  // Core synthesis
  synthesis: {
    layers: Array<{
      type: 'oscillator' | 'noise' | 'fm';
      gain: number; // 0-1 mix level
      envelope?: {
        attack: number;
        decay: number;
        sustain: number;
        release: number;
        attackCurve?: 'linear' | 'exponential';
        releaseCurve?: 'linear' | 'exponential';
      };
      oscillator?: {
        waveform: 'sine' | 'square' | 'sawtooth' | 'triangle';
        frequency: number;
        detune: number;
      };
      noise?: {
        type: 'white' | 'pink' | 'brown';
      };
      fm?: {
        carrier: number;
        modulator: number;
        modulationIndex: number;
      };
    }>;
  };

  // Envelope
  envelope: {
    attack: number; // seconds
    decay: number; // seconds
    sustain: number; // 0-1 level
    release: number; // seconds
    attackCurve: 'linear' | 'exponential' | 'logarithmic';
    releaseCurve: 'linear' | 'exponential' | 'logarithmic';
  };

  // Filter
  filter?: {
    type: 'lowpass' | 'highpass' | 'bandpass' | 'notch' | 'allpass' | 'peaking';
    frequency: number; // Hz
    q: number; // resonance 0.0001-1000
    gain?: number; // dB for peaking
    envelope?: {
      amount: number; // Hz modulation amount
      attack: number;
      decay: number;
      sustain: number; // 0-1 level
      release: number;
    };
  };

  // LFO
  lfo?: {
    waveform: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'random';
    frequency: number; // Hz
    depth: number; // 0-1
    target: 'pitch' | 'filter' | 'amplitude' | 'pan';
    phase: number; // 0-1
    sync: boolean;
  };

  // Effects
  effects: {
    distortion?: {
      type: 'soft' | 'hard' | 'fuzz' | 'bitcrush' | 'waveshaper';
      amount: number; // 0-1
      mix: number; // 0-1
    };
    reverb?: {
      type: 'room' | 'hall' | 'plate' | 'spring' | 'convolution';
      size: number; // 0-1
      decay: number; // seconds
      damping: number; // 0-1 high freq absorption
      mix: number; // 0-1
      predelay: number; // ms
    };
    delay?: {
      time: number; // seconds
      feedback: number; // 0-1
      mix: number; // 0-1
      sync: boolean;
      pingPong: boolean;
      filterFreq?: number; // Hz
    };
    chorus?: {
      rate: number; // Hz
      depth: number; // 0-1
      mix: number; // 0-1
      voices: number; // 1-8
    };
    phaser?: {
      rate: number; // Hz
      depth: number; // 0-1
      feedback: number; // 0-1
      stages: number; // 2-12
      mix: number; // 0-1
    };
    compressor?: {
      threshold: number; // dB
      ratio: number; // 1-20
      attack: number; // seconds
      release: number; // seconds
      knee: number; // dB
    };
  };

  // Spatial
  spatial: {
    pan: number; // -1 to 1
    width: number; // 0-1 stereo width
  };

  // Timing
  timing: {
    duration: number; // seconds
    fadeIn?: number; // seconds
    fadeOut?: number; // seconds
    tempo?: number; // BPM for sync
  };

  // Dynamics
  dynamics: {
    velocity: number; // 0-1
    gain: number; // dB
    normalize: boolean;
  };

  // Modulation matrix
  modulation?: Array<{
    source: 'lfo' | 'envelope' | 'velocity' | 'random';
    target: 'pitch' | 'filter' | 'amplitude' | 'pan' | 'fx';
    amount: number; // -1 to 1
  }>;

  // Metadata
  metadata: {
    name: string;
    category: 'kick' | 'snare' | 'hihat' | 'tom' | 'perc' | 'bass' | 'lead' | 'pad' | 'fx' | 'other';
    description: string;
    tags: string[];
  };
}

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  synthesis: {
    layers: [{
      type: 'oscillator',
      gain: 1,
      oscillator: {
        waveform: 'sine',
        frequency: 440,
        detune: 0,
      },
    }],
  },
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.5,
    release: 0.3,
    attackCurve: 'exponential',
    releaseCurve: 'exponential',
  },
  effects: {},
  spatial: {
    pan: 0,
    width: 1,
  },
  timing: {
    duration: 1,
  },
  dynamics: {
    velocity: 0.8,
    gain: 0,
    normalize: true,
  },
  metadata: {
    name: 'Untitled Sound',
    category: 'other',
    description: '',
    tags: [],
  },
};
