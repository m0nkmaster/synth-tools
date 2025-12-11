import { FFmpeg } from '@ffmpeg/ffmpeg';
import { SLICE_GAP_SECONDS } from '../constants';

let ffmpegInstance: FFmpeg | null = null;

export async function ensureFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }

  if (!ffmpegInstance.loaded) {
    await ffmpegInstance.load();
  }

  return ffmpegInstance;
}

export async function transcodeAndConcat(
  files: File[],
  options: { maxDuration: number }
): Promise<{ data: Uint8Array; frames: number[] }> {
  const ffmpeg = await ensureFFmpeg();

  // 1. Process each file individually to remove silence and format
  const intermediateFiles: string[] = [];
  const processedFrames: number[] = [];

  const gapSamples = Math.round(SLICE_GAP_SECONDS * 44100);

  // Write all input files first
  for (let i = 0; i < files.length; i++) {
    const data = new Uint8Array(await files[i].arrayBuffer());
    await ffmpeg.writeFile(`input_${i}`, data);
  }

  // Helper to read frame count from AIFF header (COMM chunk)
  // Simplified version of parseAiff specifically for 16-bit/44.1kHz AIFF
  const readNumFrames = (data: Uint8Array): number => {
    // Check FORM/AIFF header
    if (data.length < 12) return 0;
    // Walk chunks
    let pos = 12;
    while (pos + 8 <= data.length) {
      // Chunk ID
      const id = String.fromCharCode(...data.slice(pos, pos + 4));
      // Size (Big Endian)
      const size = (data[pos + 4] << 24) | (data[pos + 5] << 16) | (data[pos + 6] << 8) | data[pos + 7];

      if (id === 'COMM') {
        // COMM chunk: numFrames is at offset 10 (2 bytes channels + 4 bytes numFrames)
        // Header (8) + Channels (2) = 10 bytes offset from pos
        const framesPos = pos + 8 + 2;
        if (framesPos + 4 <= data.length) {
          return (data[framesPos] << 24) | (data[framesPos + 1] << 16) | (data[framesPos + 2] << 8) | data[framesPos + 3];
        }
      }

      pos += 8 + size;
      if (size % 2 === 1) pos++; // Pad byte
    }
    return 0;
  };

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const inFile = `input_${i}`;
    const outFile = `processed_${i}.aif`;

    // Simple filter chain for this file - just format and pad
    const filter = `aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono,apad=pad_len=${gapSamples}`;

    await ffmpeg.exec([
      '-i', inFile,
      '-af', filter,
      '-f', 'aiff',
      '-c:a', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '1',
      '-y',
      outFile
    ]);

    const outData = await ffmpeg.readFile(outFile);
    intermediateFiles.push(outFile);
    processedFrames.push(readNumFrames(outData as Uint8Array));
  }

  // 2. Concat the processed files
  const inputs = intermediateFiles.flatMap(f => ['-i', f]);
  const filterInputs = intermediateFiles.map((_, idx) => `[${idx}:0]`).join('');
  const filterComplex = `${filterInputs}concat=n=${intermediateFiles.length}:v=0:a=1,atrim=0:${options.maxDuration},asetpts=N/SR/TB[out]`;

  await ffmpeg.exec([
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-f', 'aiff',
    '-c:a', 'pcm_s16be',
    '-ar', '44100',
    '-ac', '1',
    '-y',
    'output.aif'
  ]);

  const data = await ffmpeg.readFile('output.aif');

  // Cleanup
  for (let i = 0; i < files.length; i++) {
    try { await ffmpeg.deleteFile(`input_${i}`); } catch { /* ignore cleanup errors */ }
    try { await ffmpeg.deleteFile(`processed_${i}.aif`); } catch { /* ignore cleanup errors */ }
  }
  try { await ffmpeg.deleteFile('output.aif'); } catch { /* ignore cleanup errors */ }

  return { data: data as Uint8Array, frames: processedFrames };
}
