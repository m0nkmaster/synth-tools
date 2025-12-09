import { transcodeAndConcat } from './ffmpeg';
import { injectDrumMetadata, parseAiff } from './aiff';
import { calculateSliceBoundaries } from '../utils/opz';
import type { DrumMetadata, Slice } from '../types';
import { SLICE_GAP_SECONDS } from '../constants';

export type BuildPackOptions = {
  maxDuration: number;
  metadata: DrumMetadata;
};

export async function buildDrumPack(
  slices: Slice[],
  options: BuildPackOptions
): Promise<Blob> {
  const files = slices.map((s) => s.file);
  // frames returned include the padding added by ffmpeg
  const { data, frames: chunkFrames } = await transcodeAndConcat(files, options);
  const { numFrames } = parseAiff(data);

  // We need to pass the *content* duration (without padding) to the boundary calculator,
  // because that function adds the gap duration itself.
  const gapSamples = Math.round(SLICE_GAP_SECONDS * 44100);
  const contentFrames = chunkFrames.map((f) => Math.max(0, f - gapSamples));

  const { start: startFrames, end: endFrames } = calculateSliceBoundaries(
    contentFrames,
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
