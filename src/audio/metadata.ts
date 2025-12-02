export async function probeDuration(blob: Blob): Promise<number> {
  // Prefer Web Audio API for quick duration reads; fallback to 0 on failure.
  if (typeof AudioContext === 'undefined' && typeof (window as any).webkitAudioContext === 'undefined') {
    return 0;
  }

  const AudioCtx = AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
    return audioBuffer.duration || 0;
  } catch (err) {
    console.warn('Unable to decode audio duration', err);
    return 0;
  } finally {
    if (typeof ctx.close === 'function') {
      ctx.close().catch(() => {});
    }
  }
}
