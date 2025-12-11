import { OPZ, FORMATS } from './config';

// Re-export specific values for convenience
export const {
  MAX_SLICES,
  MAX_DURATION_SECONDS,
  MAX_SLICE_DURATION_SECONDS,
  SLICE_GAP_SECONDS,
  POSITION_SCALE,
  MAX_POSITION,
} = OPZ;

export const OP1_SCALE = POSITION_SCALE;

/** Default OP-Z parameter values */
export const OPZ_DEFAULTS = {
  VOLUME: OPZ.DEFAULT_VOLUME,
  PITCH: OPZ.DEFAULT_PITCH,
  PLAYMODE: OPZ.DEFAULT_PLAYMODE,
  REVERSE: OPZ.DEFAULT_REVERSE,
} as const;

/** Supported audio file extensions */
export const SUPPORTED_AUDIO_FORMATS = FORMATS.SUPPORTED_EXTENSIONS;
