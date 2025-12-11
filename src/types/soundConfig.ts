/**
 * Comprehensive audio synthesis configuration
 */

export interface SoundConfig {
  // Core synthesis
  synthesis: {
    layers: Array<{
      type: 'oscillator' | 'noise' | 'fm' | 'karplus-strong';
      gain: number; // 0-1 mix level
      envelope?: {
        attack: number;
        decay: number;
        sustain: number;
        release: number;
      };
      filter?: {
        type: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
        frequency: number;
        q: number;
        envelope?: {
          amount: number;
          attack: number;
          decay: number;
          sustain: number;
          release: number;
        };
      };
      saturation?: {
        type: 'soft' | 'hard' | 'tube' | 'tape';
        drive: number;  // 0-10
        mix: number;    // 0-1
      };
      oscillator?: {
        waveform: 'sine' | 'square' | 'sawtooth' | 'triangle';
        frequency: number;
        detune: number;
        unison?: {
          voices: number;      // 1-8
          detune: number;      // cents spread
          spread: number;      // stereo width 0-1
        };
        sub?: {
          level: number;       // 0-1 mix
          octave: -1 | -2;     // octave below
          waveform?: 'sine' | 'square' | 'triangle';
        };
      };
      noise?: {
        type: 'white' | 'pink' | 'brown';
      };
      fm?: {
        carrier: number;
        modulator: number;
        modulationIndex: number;
      };
      karplus?: {
        frequency: number;
        damping: number; // 0-1 (brightness decay)
        pluckLocation?: number; // 0-1 (affects comb filtering)
      };
    }>;
  };

  // Envelope
  envelope: {
    attack: number; // seconds
    decay: number; // seconds
    sustain: number; // 0-1 level
    release: number; // seconds
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
    delay?: number; // seconds before LFO starts
    fade?: number; // seconds to fade in LFO
  };

  // Effects
  effects: {
    distortion?: {
      type: 'soft' | 'hard' | 'fuzz' | 'bitcrush' | 'waveshaper';
      amount: number; // 0-1
      mix: number; // 0-1
    };
    reverb?: {
      decay: number; // seconds
      damping: number; // 0-1 high freq absorption
      mix: number; // 0-1
    };
    delay?: {
      time: number; // seconds
      feedback: number; // 0-1
      mix: number; // 0-1
    };

    compressor?: {
      threshold: number; // dB
      ratio: number; // 1-20
      attack: number; // seconds
      release: number; // seconds
      knee: number; // dB
    };
    gate?: {
      attack: number; // seconds
      hold: number; // seconds
      release: number; // seconds
    };
  };

  // Timing
  timing: {
    duration: number; // seconds
  };

  // Dynamics
  dynamics: {
    velocity: number; // 0-1
    normalize: boolean;
  };

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
  lfo: undefined,
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
