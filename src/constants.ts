import { OPZ, AUDIO, FORMATS } from './config';

/** Maximum number of slices in an OP-Z drum pack */
export const MAX_SLICES = OPZ.MAX_SLICES;

/** Maximum duration in seconds for OP-Z drum pack */
export const MAX_DURATION_SECONDS = OPZ.MAX_DURATION_SECONDS;

/** Target sample rate for OP-Z */
export const TARGET_SAMPLE_RATE = AUDIO.SAMPLE_RATE;

/** OP-Z position scaling factor */
export const OP1_SCALE = OPZ.POSITION_SCALE;

/** Maximum position value for OP-Z metadata */
export const MAX_POSITION = OPZ.MAX_POSITION;

/** Default OP-Z parameter values */
export const OPZ_DEFAULTS = {
  VOLUME: OPZ.DEFAULT_VOLUME,
  PITCH: OPZ.DEFAULT_PITCH,
  PLAYMODE: OPZ.DEFAULT_PLAYMODE,
  REVERSE: OPZ.DEFAULT_REVERSE,
} as const;

/** Default silence threshold in dB */
export const DEFAULT_SILENCE_THRESHOLD = OPZ.DEFAULT_SILENCE_THRESHOLD;

/** Supported audio file extensions */
export const SUPPORTED_AUDIO_FORMATS = FORMATS.SUPPORTED_EXTENSIONS;
