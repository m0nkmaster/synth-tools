# Audio Pipeline

Deep dive into audio processing, FFmpeg integration, and format conversion.

## Pipeline Overview

```
Input Files → Probe → Classify → FFmpeg → Parse → Calculate → Inject → Output
```

Each stage is independent and testable.

## Stage 1: Duration Probing

### Purpose
Fast validation of file duration before heavy processing.

### Implementation

```typescript
// src/audio/metadata.ts
export async function probeDuration(blob: Blob): Promise<number> {
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
    ctx.close().catch(() => {});
  }
}
```

### Why Web Audio API?

**Pros**:
- Native browser API (fast)
- Supports all common formats
- No external dependencies
- Accurate duration

**Cons**:
- Requires full file decode (memory intensive for large files)
- Async (but parallelizable)

### Fallback Strategy

If decode fails:
- Return `duration = 0`
- Mark slice as `status = 'error'`
- Continue processing other files
- User can remove and retry

### Performance

- **Speed**: ~50-200ms per file
- **Parallelization**: All files probed concurrently
- **Memory**: Temporary AudioBuffer (garbage collected)

## Stage 2: Classification

### Purpose
Automatically detect sample type for intelligent naming and organization.

### Algorithm

**Spectral Analysis**:
1. Decode audio → AudioBuffer
2. Downmix to mono
3. Normalize amplitude
4. Trim silence
5. Compute FFT (2048 bins)
6. Extract features:
   - Spectral centroid (frequency center)
   - Band energy (low/mid/high)
   - Spectral flatness (noise vs tone)
   - Harmonic concentration (peak vs average)

**Decision Tree**:
```
Duration < 0.5s AND Flatness > 0.35?
    → drum_hit
        Centroid < 300 Hz AND Low energy dominant?
            → kick
        Centroid > 4000 Hz AND High energy dominant?
            → hat
        Centroid 600-3000 Hz AND Mid+Low > High?
            → snare
        High energy > 0.45 AND Duration > 0.5s?
            → cymbal
        Else:
            → other

Harmonic concentration > 3 AND Flatness < 0.35?
    → melodic
        Detect pitch → note name

Else:
    → unknown
```

### Feature Extraction

**Spectral Centroid**:
```typescript
function computeSpectralCentroid(spectrum: Spectrum, sampleRate: number): number {
  const mags = spectrum.magnitudes;
  const fftSize = 2048;
  let weighted = 0;
  let total = 0;
  
  for (let i = 0; i < mags.length; i++) {
    const freq = (i * sampleRate) / fftSize;
    weighted += freq * mags[i];
    total += mags[i];
  }
  return total > 0 ? weighted / total : 0;
}
```

**Band Energy**:
```typescript
function computeBandEnergy(spectrum: Spectrum, sampleRate: number, low: number, high: number): number {
  const mags = spectrum.magnitudes;
  const binHz = sampleRate / 2048;
  const lowBin = Math.floor(low / binHz);
  const highBin = Math.ceil(high / binHz);

  let band = 0;
  let total = 0;
  for (let i = 0; i < mags.length; i++) {
    const mag = mags[i];
    if (i >= lowBin && i <= highBin) band += mag * mag;
    total += mag * mag;
  }
  return total > 0 ? band / total : 0;
}
```

**Spectral Flatness**:
```typescript
function computeSpectralFlatness(spectrum: Spectrum): number {
  const mags = spectrum.magnitudes;
  let geo = 0;
  let arith = 0;
  const eps = 1e-12;
  
  for (let i = 0; i < mags.length; i++) {
    const mag = mags[i] + eps;
    geo += Math.log(mag);
    arith += mag;
  }
  geo = Math.exp(geo / mags.length);
  arith /= mags.length;
  return arith > 0 ? geo / arith : 0;
}
```

### Confidence Scoring

```typescript
let confidence = 0.5; // Base

// Boost for strong RMS
confidence += rms * 0.1;

// Boost for clear band dominance
confidence += bandDominanceScore * 0.2;

// Boost for low flatness (melodic)
if (sampleType === 'melodic') {
  confidence += (1 - flatness) * 0.5;
  confidence += harmonicConcentration * 0.1;
}

// Boost for high flatness (drum)
if (sampleType === 'drum_hit') {
  confidence += flatness * 0.5;
}

confidence = clamp(confidence, 0, 1);
```

### Tuning Thresholds

Edit `src/config.ts`:
```typescript
export const CLASSIFICATION = {
  FFT_SIZE: 2048,
  DRUM_HIT_MAX_DURATION: 0.5,
  FLATNESS_DRUM_THRESHOLD: 0.35,
  HARMONIC_CONCENTRATION_THRESHOLD: 3,
  // ...
};

export const DRUM_THRESHOLDS = {
  KICK_CENTROID_MAX: 300,
  SNARE_CENTROID_MIN: 600,
  SNARE_CENTROID_MAX: 3000,
  HAT_CENTROID_MIN: 4000,
  // ...
};
```

Test with diverse samples:
```bash
bun test src/audio/classify.test.ts
```

## Stage 3: Pitch Detection

### Purpose
Detect fundamental frequency for melodic samples.

### Algorithm: Autocorrelation

```typescript
function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  // 1. Compute RMS
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.01) return null; // Too quiet
  
  // 2. Normalize
  const normalized = buffer.map(x => x / rms);
  
  // 3. Autocorrelation
  const minPeriod = Math.floor(sampleRate / 1000); // 1000 Hz max
  const maxPeriod = Math.floor(sampleRate / 50);   // 50 Hz min
  
  let bestOffset = -1;
  let bestCorrelation = -1;
  
  for (let offset = minPeriod; offset < maxPeriod; offset++) {
    let sum = 0;
    for (let i = 0; i < buffer.length - offset; i++) {
      sum += normalized[i] * normalized[i + offset];
    }
    const correlation = sum / (buffer.length - offset);
    
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  
  // 4. Parabolic interpolation for sub-sample accuracy
  if (bestOffset > minPeriod && bestOffset < maxPeriod - 1) {
    // Compute y1, y2, y3 for parabola fit
    // ...
  }
  
  return bestCorrelation > 0.1 ? sampleRate / bestOffset : null;
}
```

### Why Autocorrelation?

**Pros**:
- Simple, fast
- Works well for monophonic sounds
- No external dependencies

**Cons**:
- Fails on polyphonic audio
- Sensitive to noise
- Octave errors possible

**Alternatives**:
- YIN algorithm (more accurate, more complex)
- Cepstrum analysis
- HPS (Harmonic Product Spectrum)

### Frequency → Note Conversion

```typescript
export const freqToMidi = (freq: number): number =>
  69 + 12 * Math.log2(freq / 440);

export const midiToNoteName = (midi: number): string => {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[note]}${octave}`;
};
```

### Usage

```typescript
const { note, frequency } = await detectPitch(file);
// note: "C4"
// frequency: 261.63
```

## Stage 4: FFmpeg Processing

### Purpose
Convert all files to OP-Z format and concatenate into single AIFF.

### FFmpeg.wasm

**Why WebAssembly?**
- Client-side processing (no server)
- Full FFmpeg feature set
- Cross-platform (browser sandbox)

**Trade-offs**:
- Large bundle (~30MB)
- Slow first load (2-5s)
- Memory intensive

### Singleton Pattern

```typescript
let ffmpegInstance: FFmpeg | null = null;

export async function ensureFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }
  if (!ffmpegInstance.loaded) {
    await ffmpegInstance.load(); // Downloads wasm from CDN
  }
  return ffmpegInstance;
}
```

### Processing Pipeline

```typescript
export async function transcodeAndConcat(
  files: File[],
  options: { maxDuration: number }
): Promise<{ data: Uint8Array; frames: number[] }> {
  const ffmpeg = await ensureFFmpeg();
  
  // 1. Write input files to virtual FS
  for (let i = 0; i < files.length; i++) {
    const data = new Uint8Array(await files[i].arrayBuffer());
    await ffmpeg.writeFile(`input_${i}`, data);
  }
  
  // 2. Process each file individually
  const gapSamples = Math.round(0.1 * 44100); // 0.1s gap
  const processedFrames: number[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const filter = `aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono,apad=pad_len=${gapSamples}`;
    
    await ffmpeg.exec([
      '-i', `input_${i}`,
      '-af', filter,
      '-f', 'aiff',
      '-c:a', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '1',
      '-y',
      `processed_${i}.aif`
    ]);
    
    const outData = await ffmpeg.readFile(`processed_${i}.aif`);
    processedFrames.push(readNumFrames(outData as Uint8Array));
  }
  
  // 3. Concatenate all processed files
  const inputs = files.map((_, i) => ['-i', `processed_${i}.aif`]).flat();
  const filterInputs = files.map((_, i) => `[${i}:0]`).join('');
  const filterComplex = `${filterInputs}concat=n=${files.length}:v=0:a=1,atrim=0:${options.maxDuration}[out]`;
  
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
  
  // 4. Cleanup
  for (let i = 0; i < files.length; i++) {
    await ffmpeg.deleteFile(`input_${i}`).catch(() => {});
    await ffmpeg.deleteFile(`processed_${i}.aif`).catch(() => {});
  }
  await ffmpeg.deleteFile('output.aif').catch(() => {});
  
  return { data: data as Uint8Array, frames: processedFrames };
}
```

### Filter Chain Breakdown

**Per-File Processing**:
```
aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono
  ↓ Convert to mono, 16-bit, 44.1kHz
apad=pad_len=4410
  ↓ Add 0.1s silence gap
```

**Concatenation**:
```
[0:0][1:0][2:0]...concat=n=24:v=0:a=1
  ↓ Concatenate all audio streams
atrim=0:12
  ↓ Trim to max duration
[out]
```

### Why Gaps?

**Problem**: Slices need separation for clean playback.

**Solution**: Add 0.1s silence between slices.

**Implementation**:
- `apad=pad_len=4410` (4410 samples = 0.1s at 44.1kHz)
- Gap is included in frame count
- Boundary calculation accounts for gap

### Frame Count Extraction

```typescript
const readNumFrames = (data: Uint8Array): number => {
  let pos = 12; // Skip FORM header
  while (pos + 8 <= data.length) {
    const id = String.fromCharCode(...data.slice(pos, pos + 4));
    const size = (data[pos + 4] << 24) | (data[pos + 5] << 16) | 
                 (data[pos + 6] << 8) | data[pos + 7];
    
    if (id === 'COMM') {
      const framesPos = pos + 8 + 2; // Skip chunk header + channels
      return (data[framesPos] << 24) | (data[framesPos + 1] << 16) | 
             (data[framesPos + 2] << 8) | data[framesPos + 3];
    }
    
    pos += 8 + size;
    if (size % 2 === 1) pos++; // Pad byte
  }
  return 0;
};
```

## Stage 5: AIFF Parsing

### Purpose
Extract metadata from concatenated AIFF for boundary calculation.

### Implementation

```typescript
export function parseAiff(buf: Uint8Array): AiffParseResult {
  // 1. Validate header
  const type = readString(buf, 8, 4);
  if (readString(buf, 0, 4) !== 'FORM' || (type !== 'AIFF' && type !== 'AIFC')) {
    throw new Error('Invalid AIFF/AIFC header');
  }

  // 2. Read FORM size
  const formSize = (buf[4] << 24) | (buf[5] << 16) | (buf[6] << 8) | buf[7];

  // 3. Parse chunks
  const chunks: ChunkInfo[] = [];
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const id = readString(buf, pos, 4);
    const size = (buf[pos + 4] << 24) | (buf[pos + 5] << 16) | 
                 (buf[pos + 6] << 8) | buf[pos + 7];
    chunks.push({ id, offset: pos, size });
    pos += 8 + size;
    if (size % 2 === 1) pos++; // Pad byte
  }

  // 4. Extract frame count from COMM chunk
  const comm = chunks.find(c => c.id === 'COMM');
  if (!comm) throw new Error('Missing COMM chunk');
  
  const view = new DataView(buf.buffer, buf.byteOffset + comm.offset, comm.size + 8);
  const numFrames = view.getUint32(10, false); // Big-endian

  // 5. Parse sample rate (80-bit extended float)
  let sampleRate: number | undefined;
  if (comm.size >= 18) {
    const sampleRateBytes = new Uint8Array(buf.buffer, buf.byteOffset + comm.offset + 16, 10);
    const sign = (sampleRateBytes[0] & 0x80) ? -1 : 1;
    const exponent = ((sampleRateBytes[0] & 0x7f) << 8) | sampleRateBytes[1];
    const expValue = exponent - 16383;
    
    let mantissa = 0;
    for (let i = 2; i < 10; i++) {
      mantissa = mantissa * 256 + sampleRateBytes[i];
    }
    
    if (expValue >= -1022 && expValue <= 1023 && exponent !== 0) {
      const mantissaFraction = mantissa / Math.pow(2, 64);
      sampleRate = sign * (1 + mantissaFraction) * Math.pow(2, expValue);
      sampleRate = Math.round(sampleRate);
    }
  }

  return { chunks, numFrames, formSize, sampleRate };
}
```

### 80-bit Extended Float

**Format**: IEEE 754 extended precision
- 1 bit: Sign
- 15 bits: Exponent (biased by 16383)
- 64 bits: Mantissa

**Conversion**:
```
value = sign × (1 + mantissa/2^64) × 2^(exponent - 16383)
```

**Why?**
- AIFF spec requires 80-bit float for sample rate
- JavaScript only has 64-bit floats
- Manual parsing required

## Stage 6: Boundary Calculation

### Purpose
Compute start/end frame positions for each slice.

### Algorithm

```typescript
export const calculateSliceBoundaries = (
  sliceFrames: number[],
  totalFrames: number
): { start: number[]; end: number[] } => {
  const gapFrames = Math.round(0.1 * 44100);
  const start: number[] = [];
  const end: number[] = [];

  let cursor = 0;
  for (let i = 0; i < 24; i++) {
    const frames = sliceFrames[i] ?? 0;
    
    if (frames === 0) {
      // Empty slot
      start.push(cursor);
      end.push(cursor);
      continue;
    }

    const contentLen = frames;
    const totalBlockLen = contentLen + gapFrames;
    const available = totalFrames - cursor;
    const clampedBlockLen = Math.max(0, Math.min(totalBlockLen, available));
    
    start.push(cursor);
    
    // Calculate end with safety buffer
    const safetyBuffer = 20; // ~0.5ms
    const minFrames = 4410; // 0.1s minimum
    const maxLen = Math.max(1, clampedBlockLen - safetyBuffer);
    const effectiveContentLen = Math.min(contentLen, clampedBlockLen);
    const targetLen = Math.min(maxLen, Math.max(effectiveContentLen, minFrames));
    
    end.push(cursor + targetLen - 1);
    cursor += clampedBlockLen;
  }

  return { start, end };
};
```

### Why Safety Buffer?

**Problem**: Slice playback can bleed into next slice or gap.

**Solution**: End slice 20 samples (~0.5ms) before actual boundary.

**Trade-off**: Slight truncation vs clean playback.

### Minimum Duration

**Problem**: Very short slices (<0.1s) may not trigger properly.

**Solution**: Extend slice into gap if needed (up to 0.1s minimum).

## Stage 7: Metadata Injection

### Purpose
Insert OP-Z drum metadata into AIFF file.

### Implementation

```typescript
export function injectDrumMetadata(
  aiff: Uint8Array,
  startFrames: number[],
  endFrames: number[],
  metadata: DrumMetadata
): Uint8Array {
  const { chunks, formSize } = parseAiff(aiff);
  const ssndChunk = chunks.find(c => c.id === 'SSND');
  const insertPos = ssndChunk ? ssndChunk.offset : aiff.length;

  const metadataChunk = buildDrumMetadataChunk(startFrames, endFrames, metadata);

  // Insert chunk before SSND
  const result = new Uint8Array(aiff.length + metadataChunk.length);
  result.set(aiff.slice(0, insertPos), 0);
  result.set(metadataChunk, insertPos);
  result.set(aiff.slice(insertPos), insertPos + metadataChunk.length);

  // Update FORM size
  const newFormSize = formSize + metadataChunk.length;
  writeUInt32BE(result, 4, newFormSize);

  return result;
}
```

### Chunk Building

```typescript
function buildDrumMetadataChunk(
  startFrames: number[],
  endFrames: number[],
  metadata: DrumMetadata
): Uint8Array {
  // 1. Pad arrays to 24 elements
  const start = padArray(startFrames, 24, 0);
  const end = padArray(endFrames, 24, 0);
  
  // 2. Encode positions (× 4096)
  const positionsStart = encodePositions(start);
  const positionsEnd = encodePositions(end);

  // 3. Build JSON payload
  const payloadObj = {
    drum_version: metadata.drumVersion,
    type: 'drum',
    name: metadata.name,
    octave: metadata.octave,
    pitch: padArray(metadata.pitch ?? [], 24, 0),
    start: positionsStart,
    end: positionsEnd,
    playmode: padArray(metadata.playmode ?? [], 24, 8192),
    reverse: padArray(metadata.reverse ?? [], 24, 8192),
    volume: padArray(metadata.volume ?? [], 24, 8192),
    dyna_env: metadata.drumVersion >= 3 
      ? [0, 8192, 0, 0, 0, 0, 0, 0]
      : [0, 8192, 0, 8192, 0, 0, 0, 0],
    editable: metadata.drumVersion >= 3 ? true : undefined,
    fx_active: false,
    fx_type: 'delay',
    fx_params: [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
    lfo_active: false,
    lfo_type: 'tremolo',
    lfo_params: metadata.drumVersion >= 3
      ? [0, 0, 0, 0, 0, 0, 0, 0]
      : [16000, 16000, 16000, 16000, 0, 0, 0, 0]
  };

  // 4. Encode to bytes
  const jsonStr = JSON.stringify(payloadObj);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  
  // 5. Build APPL chunk
  const payload = new Uint8Array(4 + jsonBytes.length);
  payload.set([0x6f, 0x70, 0x2d, 0x31], 0); // 'op-1'
  payload.set(jsonBytes, 4);
  
  const pad = payload.length % 2 === 1 ? 1 : 0;
  const chunkSize = payload.length;

  const chunk = new Uint8Array(8 + chunkSize + pad);
  chunk.set([0x41, 0x50, 0x50, 0x4c], 0); // 'APPL'
  writeUInt32BE(chunk, 4, chunkSize);
  chunk.set(payload, 8);
  if (pad) chunk[8 + chunkSize] = 0;

  return chunk;
}
```

### Chunk Structure

```
[4 bytes: 'APPL']
[4 bytes: Chunk size (big-endian)]
[4 bytes: 'op-1' signature]
[N bytes: JSON string]
[1 byte: Pad (if N is odd)]
```

## Stage 8: Export

### Purpose
Trigger browser download of final AIFF file.

### Implementation

```typescript
const blob = await buildDrumPack(slices, options);
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'opz-drum-pack.aif';
a.click();
URL.revokeObjectURL(url);
```

### Blob Creation

```typescript
const buffer = annotated.buffer as ArrayBuffer;
return new Blob([buffer], { type: 'audio/aiff' });
```

## Performance Optimization

### Parallelization

**Concurrent**:
- Duration probing (all files)
- Classification (all files)
- Pitch detection (all files)

**Sequential**:
- FFmpeg processing (single instance)
- AIFF parsing (fast, no need to parallelize)

### Memory Management

**Cleanup**:
- AudioContext closed after use
- FFmpeg virtual FS cleaned up
- Blob URLs revoked after download
- Temporary buffers garbage collected

### Caching

**FFmpeg Instance**:
- Loaded once, reused for all exports
- Saves 2-5s per export after first

**Classification Results**:
- Stored in slice state
- Not recomputed on re-export

## Error Handling

### FFmpeg Errors

**Common Issues**:
- Unsupported format
- Corrupted file
- Out of memory
- Filter syntax error

**Recovery**:
```typescript
try {
  await ffmpeg.exec([...]);
} catch (err) {
  console.error('FFmpeg error:', err);
  throw new Error('Unable to process audio file. Try converting to WAV first.');
}
```

### AIFF Parsing Errors

**Common Issues**:
- Invalid header
- Missing COMM chunk
- Truncated file

**Recovery**:
```typescript
try {
  const { numFrames } = parseAiff(data);
} catch (err) {
  console.error('AIFF parse error:', err);
  throw new Error('Invalid AIFF file structure.');
}
```

## Testing

### Unit Tests

```typescript
describe('transcodeAndConcat', () => {
  it('converts to mono 16-bit 44.1kHz', async () => {
    const files = [createMockFile('stereo.wav')];
    const { data } = await transcodeAndConcat(files, { maxDuration: 12 });
    const { sampleRate } = parseAiff(data);
    expect(sampleRate).toBe(44100);
  });
  
  it('adds 0.1s gap between slices', async () => {
    const files = [createMockFile('a.wav'), createMockFile('b.wav')];
    const { frames } = await transcodeAndConcat(files, { maxDuration: 12 });
    expect(frames[0]).toBeGreaterThan(44100); // Includes gap
  });
});
```

### Integration Tests

```typescript
describe('buildDrumPack', () => {
  it('produces valid OP-Z AIFF', async () => {
    const slices = [createMockSlice('kick.wav')];
    const blob = await buildDrumPack(slices, { maxDuration: 12, metadata: {...} });
    const data = new Uint8Array(await blob.arrayBuffer());
    
    // Validate structure
    expect(readString(data, 0, 4)).toBe('FORM');
    expect(readString(data, 8, 4)).toBe('AIFF');
    
    // Validate metadata
    const { chunks } = parseAiff(data);
    const appl = chunks.find(c => c.id === 'APPL');
    expect(appl).toBeDefined();
  });
});
```

---

**Next**: [Classification System](./classification.md)
