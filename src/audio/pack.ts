import { transcodeAndConcat } from './ffmpeg';
import { injectDrumMetadata, parseAiff } from './aiff';
import { calculateSliceBoundaries } from '../utils/opz';
import type { DrumMetadata, Slice } from '../types';

export type BuildPackOptions = {
  silenceThreshold: number;
  maxDuration: number;
  metadata: DrumMetadata;
};

export async function buildDrumPack(
  slices: Slice[],
  options: BuildPackOptions
): Promise<Blob> {
  const files = slices.map((s) => s.file);
  const data = await transcodeAndConcat(files, options);
  const { numFrames } = parseAiff(data);

  const durations = slices.map((s) => s.duration || 0);
  const { start: startFrames, end: endFrames } = calculateSliceBoundaries(
    durations,
    numFrames
  );

  const annotated = injectDrumMetadata(
    data,
    startFrames,
    endFrames,
    options.metadata
  );
  const buffer = annotated.buffer as ArrayBuffer;
  return new Blob([buffer], { type: 'audio/aiff' });
}
