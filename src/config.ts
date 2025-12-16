/** Centralized configuration for Synth Tools */

// Audio Processing
export const AUDIO = {
  SAMPLE_RATE: 44100,
  BIT_DEPTH: 16,
  CHANNELS: 1, // Mono
  MAX_FILE_SIZE_MB: 50,
  SILENCE_THRESHOLD_DB: -50,
  RMS_THRESHOLD: 0.01,
} as const;

// OP-Z Format
export const OPZ = {
  MAX_SLICES: 24,
  MAX_DURATION_SECONDS: 11.8,
  MAX_SLICE_DURATION_SECONDS: 4,
  SLICE_GAP_SECONDS: 0, // No gap between slices - pack them tightly
  // Position scale: MAX_POSITION / (SAMPLE_RATE * MAX_DURATION) ≈ 4058
  // This matches TE's encoding (not 4096 as commonly assumed)
  POSITION_SCALE: 4058,
  MAX_POSITION: 0x7ffffffe,
  DEFAULT_VOLUME: 8192,
  DEFAULT_PITCH: 0,
  DEFAULT_PLAYMODE: 12288, // Play Out - sample plays to completion
  DEFAULT_REVERSE: 8192,
} as const;

// Audio Classification
export const CLASSIFICATION = {
  FFT_SIZE: 2048,
  DRUM_HIT_MAX_DURATION: 0.5,
  DRUM_HIT_EXTENDED_DURATION: 0.9,
  FLATNESS_DRUM_THRESHOLD: 0.35,
  FLATNESS_DRUM_EXTENDED: 0.45,
  FLATNESS_MELODIC_THRESHOLD: 0.35,
  HARMONIC_CONCENTRATION_THRESHOLD: 3,
  CONFIDENCE_BASE: 0.5,
  CONFIDENCE_EXTENDED: 0.35,
  CONFIDENCE_UNKNOWN: 0.2,
  CONFIDENCE_RMS_FACTOR: 0.1,
  CONFIDENCE_FLATNESS_FACTOR: 0.5,
  CONFIDENCE_BAND_FACTOR: 0.2,
  CONFIDENCE_HARMONIC_FACTOR: 0.1,
  CONFIDENCE_MELODIC_PENALTY: 0.6,
  CONFIDENCE_MELODIC_MIN: 0.3,
} as const;

// Drum Classification Thresholds
export const DRUM_THRESHOLDS = {
  KICK_CENTROID_MAX: 300,
  SNARE_CENTROID_MIN: 600,
  SNARE_CENTROID_MAX: 3000,
  SNARE_MID_LOW_RATIO: 0.6,
  HAT_CENTROID_MIN: 4000,
  HAT_DURATION_MAX: 0.5,
  CYMBAL_HIGH_ENERGY_MIN: 0.45,
  CYMBAL_DURATION_MIN: 0.5,
} as const;

// Frequency Bands
export const FREQUENCY_BANDS = {
  LOW_MAX: 200,
  MID_MIN: 200,
  MID_MAX: 2000,
  HIGH_MIN: 2000,
} as const;

// Pitch Detection
export const PITCH = {
  MIN_FREQUENCY: 20,
  MAX_FREQUENCY: 4186,
  MIN_LAG_FREQUENCY: 2000,
  MAX_LAG_FREQUENCY: 40,
  AUTOCORR_THRESHOLD: 0.1,
  SKIP_SILENCE_DURATION: 0.05,
  ANALYZE_DURATION: 0.8,
  MIN_ANALYZE_LENGTH: 0.1,
  WINDOW_SIZE: 8192,
  MIN_WINDOW_SIZE: 2048,
  MIN_PERIOD_HZ: 1000,
  MAX_PERIOD_HZ: 50,
} as const;

// Synthesis
export const SYNTHESIS = {
  SAMPLE_RATE: 44100,
  CHANNELS: 2,
  NOISE_BUFFER_DURATION: 2,
  DEFAULT_FREQUENCY: 440,
  MAX_DELAY_TIME: 2,
  WAVESHAPER_CURVE_SIZE: 256,
  WAVESHAPER_AMOUNT_MULTIPLIER: 100,
  REVERB_DAMPING_MULTIPLIER: 3,
  PINK_NOISE_OUTPUT_GAIN: 0.11,
} as const;

// AI Generation
export const AI = {
  /** Sounds per API call. Set to 1 for maximum parallelism, 24 for single batch. Default 6. */
  BATCH_CHUNK_SIZE: parseInt(import.meta.env.VITE_AI_BATCH_CHUNK_SIZE || '4', 10),
} as const;

// Pink Noise Filter Coefficients
export const PINK_NOISE = {
  B0_DECAY: 0.99886,
  B0_GAIN: 0.0555179,
  B1_DECAY: 0.99332,
  B1_GAIN: 0.0750759,
  B2_DECAY: 0.96900,
  B2_GAIN: 0.1538520,
  B3_DECAY: 0.86650,
  B3_GAIN: 0.3104856,
  B4_DECAY: 0.55000,
  B4_GAIN: 0.5329522,
  B5_DECAY: -0.7616,
  B5_GAIN: -0.0168980,
  B6_GAIN: 0.115926,
  WHITE_GAIN: 0.5362,
} as const;

// Waveform Display
export const WAVEFORM = {
  DEFAULT_HEIGHT: 32,
  DEFAULT_WIDTH: 48,
  AMPLITUDE_SCALE: 0.4,
  MIN_BAR_HEIGHT: 1,
  BAR_WIDTH: 1,
} as const;

// File Formats
export const FORMATS = {
  SUPPORTED_EXTENSIONS: ['.wav', '.aif', '.aiff', '.mp3', '.m4a', '.flac'] as const,
  AIFF_EXTENSIONS: ['.aif', '.aiff'] as const,
} as const;

// DSP
export const DSP = {
  EPSILON: 1e-12,
  EPSILON_SMALL: 1e-6,
} as const;
