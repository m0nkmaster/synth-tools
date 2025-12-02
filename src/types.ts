export type SliceStatus = 'pending' | 'processing' | 'ready' | 'error';

export type NormalizeMode = 'loudnorm' | 'peak' | 'off';

export type Slice = {
  id: string;
  file: File;
  name: string;
  duration: number; // seconds
  status: SliceStatus;
  error?: string;
  classification?: string;
};

export type DrumMetadata = {
  name: string;
  octave: number;
  drumVersion: number;
  pitch: number[]; // length <= 24
  playmode: number[];
  reverse: number[];
  volume: number[];
};

export type PackOptions = {
  normalizeMode: NormalizeMode;
  silenceThreshold: number;
  maxDuration: number;
};
