import { OP1_SCALE, MAX_POSITION, MAX_SLICES, SLICE_GAP_SECONDS } from '../constants';

/** Encodes frame positions for OP-Z metadata (scaled × 4096) */
export const encodePositions = (frames: number[]): number[] =>
  frames.map((frame) => {
    const scaled = Math.max(0, frame * OP1_SCALE);
    return Math.min(MAX_POSITION, Math.round(scaled));
  });

/** Decodes frame positions from OP-Z metadata (scaled ÷ 4096) */
export const decodePositions = (encoded: number[]): number[] =>
  encoded.map((val) => Math.round(val / OP1_SCALE));

/** Calculates slice boundaries from Frame Counts and total frames */
export const calculateSliceBoundaries = (
  sliceFrames: number[],
  totalFrames: number
): { start: number[]; end: number[] } => {
  const gapFrames = Math.round(SLICE_GAP_SECONDS * 44100);
  // Total Frames should imply validation?
  // We trust TotalFrames from the file.

  const start: number[] = [];
  const end: number[] = [];

  let cursor = 0;
  for (let i = 0; i < MAX_SLICES; i++) {
    const frames = sliceFrames[i] ?? 0;
    if (frames === 0) {
      start.push(cursor);
      end.push(cursor);
      continue;
    }

    // sliceLen is exactly frames
    const contentLen = frames;
    const totalBlockLen = contentLen + gapFrames;

    // Clamp to file end
    const available = totalFrames - cursor;
    const clampedBlockLen = Math.max(0, Math.min(totalBlockLen, available));

    start.push(cursor);
    // End is inclusive, so -1. But make sure we don't go negative if len is 0.
    // Also, End should not include gap?
    // "End" usually marks the loop end point.
    // If we want to play the content, end should be cursor + contentLen - 1?
    // But if clampedBlockLen < contentLen, we are truncated.
    const effectiveContentLen = Math.min(contentLen, clampedBlockLen);

    // Subtract a small safety buffer (20 samples ~0.5ms) to ensure we stop before the gap/next slice
    // BUT ensure we have a minimum duration for playback (e.g. 0.1s) by extending into the gap if needed.
    const safetyBuffer = 20;
    const minFrames = 4410; // 0.1s

    // We can extend up to totalBlockLen - safetyBuffer (i.e. use the gap)
    const maxLen = Math.max(1, clampedBlockLen - safetyBuffer);

    // Target length is contentLen, but at least minFrames (clamped to maxLen)
    const targetLen = Math.min(maxLen, Math.max(effectiveContentLen, minFrames));

    end.push(cursor + targetLen - 1);

    cursor += clampedBlockLen;
  }

  return { start, end };
};
