# Audio Processing

FFmpeg integration, classification, pitch detection, and synthesis engine.

## Pipeline Overview

```
Input Files → Probe → Classify → FFmpeg → Parse → Calculate → Inject → Output
```

Each stage is independent and testable.

---

## Duration Probing

Fast validation of file duration using Web Audio API.

```typescript
export async function probeDuration(blob: Blob): Promise<number> {
  const ctx = new AudioContext();
  try {
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buffer);
    return audioBuffer.duration;
  } catch {
    return 0; // Fallback on decode failure
  } finally {
    ctx.close();
  }
}
```

**Performance:** ~50-200ms per file, all files probed in parallel.

---

## Audio Classification

Automatically detects sample type for intelligent naming.

### Algorithm

1. Decode audio → AudioBuffer
2. Downmix to mono
3. Normalize amplitude (peak = 1.0)
4. Trim silence
5. Compute FFT (2048 bins)
6. Extract spectral features
7. Apply decision tree

### Feature Extraction

#### Spectral Centroid

Weighted average frequency ("brightness"):

```typescript
function computeSpectralCentroid(spectrum: Float32Array, sampleRate: number): number {
  let weighted = 0, total = 0;
  for (let i = 0; i < spectrum.length; i++) {
    const freq = (i * sampleRate) / 2048;
    weighted += freq * spectrum[i];
    total += spectrum[i];
  }
  return total > 0 ? weighted / total : 0;
}
```

| Centroid | Interpretation |
|----------|----------------|
| < 300 Hz | Bass-heavy (kicks, subs) |
| 600-3000 Hz | Mid-range (snares, toms) |
| > 4000 Hz | Bright (hats, cymbals) |

#### Band Energy

Energy distribution across frequency bands:

```typescript
const bands = {
  low: computeBandEnergy(spectrum, 0, 200),      // Bass
  mid: computeBandEnergy(spectrum, 200, 2000),   // Mids
  high: computeBandEnergy(spectrum, 2000, 22050) // Highs
};
```

#### Spectral Flatness

Noise vs. tone ratio (geometric mean / arithmetic mean):

| Flatness | Interpretation |
|----------|----------------|
| > 0.35 | Noise-like (drums, percussion) |
| < 0.35 | Tonal (melodic instruments) |

#### Harmonic Concentration

Peak magnitude vs. average (strong fundamentals have high concentration):

| Concentration | Interpretation |
|---------------|----------------|
| > 3 | Clear harmonic content |
| < 3 | Diffuse energy |

### Decision Tree

```
Duration < 0.5s AND Flatness > 0.35?
    → drum_hit
        Centroid < 300 Hz? → kick
        Centroid > 4000 Hz? → hat
        Centroid 600-3000 Hz? → snare
        High energy > 0.45 AND Duration > 0.5s? → cymbal
        Else → other

Harmonic concentration > 3 AND Flatness < 0.35?
    → melodic (run pitch detection)

Else → unknown
```

### Confidence Scoring

```typescript
let confidence = 0.5; // Base

// Boosts
confidence += rms * 0.1;                    // Louder = more confident
confidence += bandDominanceScore * 0.2;    // Clear band = more confident

if (sampleType === 'drum_hit') {
  confidence += flatness * 0.5;             // Noisier = more confident
}
if (sampleType === 'melodic') {
  confidence += (1 - flatness) * 0.5;       // More tonal = more confident
}

confidence = clamp(confidence, 0, 1);
```

### Tuning Thresholds

All thresholds are in `src/config.ts`:

```typescript
CLASSIFICATION: {
  FFT_SIZE: 2048,
  DRUM_HIT_MAX_DURATION: 0.5,
  FLATNESS_DRUM_THRESHOLD: 0.35,
  HARMONIC_CONCENTRATION_THRESHOLD: 3,
}

DRUM_THRESHOLDS: {
  KICK_CENTROID_MAX: 300,
  SNARE_CENTROID_MIN: 600,
  SNARE_CENTROID_MAX: 3000,
  HAT_CENTROID_MIN: 4000,
}
```

---

## Pitch Detection

Detects fundamental frequency for melodic samples using autocorrelation.

### Algorithm

1. Compute RMS (reject if too quiet)
2. Normalize buffer
3. Autocorrelation: find lag with maximum self-similarity
4. Parabolic interpolation for sub-sample accuracy
5. Convert lag to frequency: `freq = sampleRate / lag`

```typescript
function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  // Frequency range: 50-1000 Hz
  const minPeriod = Math.floor(sampleRate / 1000);
  const maxPeriod = Math.floor(sampleRate / 50);
  
  let bestOffset = -1, bestCorrelation = -1;
  
  for (let offset = minPeriod; offset < maxPeriod; offset++) {
    let sum = 0;
    for (let i = 0; i < buffer.length - offset; i++) {
      sum += buffer[i] * buffer[i + offset];
    }
    const correlation = sum / (buffer.length - offset);
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  
  return bestCorrelation > 0.1 ? sampleRate / bestOffset : null;
}
```

### Frequency → Note Conversion

```typescript
const freqToMidi = (freq: number): number =>
  69 + 12 * Math.log2(freq / 440);

const midiToNoteName = (midi: number): string => {
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTES[note]}${octave}`;
};
```

---

## FFmpeg Processing

Converts all files to OP-Z format and concatenates into single AIFF.

### Why FFmpeg.wasm?

- Client-side processing (no server)
- Full FFmpeg feature set
- Cross-platform (browser sandbox)

**Trade-offs:**
- ~30MB bundle
- 2-5s first load
- Memory intensive

### Singleton Pattern

```typescript
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
  
  // 2. Process each file (convert + add gap)
  const gapSamples = Math.round(0.1 * 44100); // 0.1s gap
  const frames: number[] = [];
  
  for (let i = 0; i < files.length; i++) {
    await ffmpeg.exec([
      '-i', `input_${i}`,
      '-af', `aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono,apad=pad_len=${gapSamples}`,
      '-f', 'aiff',
      '-y', `processed_${i}.aif`
    ]);
    
    const outData = await ffmpeg.readFile(`processed_${i}.aif`);
    frames.push(readNumFrames(outData as Uint8Array));
  }
  
  // 3. Concatenate all processed files
  const filterComplex = files.map((_, i) => `[${i}:0]`).join('') +
    `concat=n=${files.length}:v=0:a=1,atrim=0:${options.maxDuration}[out]`;
  
  await ffmpeg.exec([
    ...files.flatMap((_, i) => ['-i', `processed_${i}.aif`]),
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-f', 'aiff', '-c:a', 'pcm_s16be', '-ar', '44100', '-ac', '1',
    '-y', 'output.aif'
  ]);
  
  const data = await ffmpeg.readFile('output.aif') as Uint8Array;
  
  // 4. Cleanup virtual FS
  // ...
  
  return { data, frames };
}
```

### Filter Chain

**Per-file:**
```
aformat=sample_fmts=s16:sample_rates=44100:channel_layouts=mono  → Convert
apad=pad_len=4410                                                  → Add 0.1s gap
```

**Concatenation:**
```
[0:0][1:0][2:0]...concat=n=N:v=0:a=1  → Join all files
atrim=0:12                             → Trim to max duration
```

---

## Slice Boundary Calculation

Compute start/end frame positions for each slice.

```typescript
export function calculateSliceBoundaries(
  sliceFrames: number[],
  totalFrames: number
): { start: number[]; end: number[] } {
  const gapFrames = Math.round(0.1 * 44100);
  const start: number[] = [];
  const end: number[] = [];
  
  let cursor = 0;
  for (let i = 0; i < 24; i++) {
    const frames = sliceFrames[i] ?? 0;
    
    if (frames === 0) {
      start.push(cursor);
      end.push(cursor);
      continue;
    }
    
    const blockLen = frames + gapFrames;
    const available = totalFrames - cursor;
    const clampedLen = Math.min(blockLen, available);
    
    start.push(cursor);
    
    // Safety buffer to prevent bleed
    const safetyBuffer = 20; // ~0.5ms
    end.push(cursor + Math.max(1, clampedLen - safetyBuffer) - 1);
    
    cursor += clampedLen;
  }
  
  return { start, end };
}
```

---

## Synthesis Engine

Generates audio from SoundConfig using Web Audio API.

### Signal Flow

```
Layer Sources → Layer Filters → Saturation → Layer Envelopes
    ↓
Mixer → Global Filter → Master Envelope → LFO Modulation
    ↓
Effects Chain → Output
```

### Layer Types

| Type | Implementation |
|------|----------------|
| Oscillator | OscillatorNode with optional unison/sub |
| Noise | BufferSourceNode with white/pink/brown noise |
| FM | Modulator → modulationGain → carrier.frequency |
| Karplus-Strong | Ring buffer with lowpass feedback |

### Effects Chain

```typescript
// Order matters
input
  → distortion (waveshaper)
  → compressor (DynamicsCompressorNode)
  → gate (gain envelope)
  → delay (feedback loop with filter)
  → reverb (ConvolverNode)
  → output
```

### Effects Tail

Render duration extends to capture reverb/delay tails:

```typescript
function calculateEffectsTail(config: SoundConfig): number {
  let tail = 0;
  
  if (config.effects?.reverb) {
    tail = Math.max(tail, config.effects.reverb.decay);
  }
  
  if (config.effects?.delay) {
    const { time = 0.25, feedback = 0.3 } = config.effects.delay;
    const repeats = -3 / Math.log10(Math.max(0.01, feedback));
    tail = Math.max(tail, Math.min(10, repeats * time));
  }
  
  return tail + 0.1; // Safety buffer
}
```

### Rendering

```typescript
export async function synthesizeSound(config: SoundConfig): Promise<AudioBuffer> {
  const totalDuration = config.timing.duration + calculateEffectsTail(config);
  const ctx = new OfflineAudioContext(2, totalDuration * 44100, 44100);
  
  // Build audio graph...
  
  const buffer = await ctx.startRendering();
  
  if (config.dynamics?.normalize) {
    normalizeBuffer(buffer);
  }
  
  return buffer;
}
```

---

## AI Integration

### System Prompt

Instructs AI to generate valid SoundConfig with synthesis rules:

**Drums:**
- Kicks: 40-80Hz sine + sub, attack <2ms, decay 50-100ms
- Snares: 180-250Hz tone + white noise (bandpass 2-4kHz)
- Hats: noise highpass >8kHz, decay <100ms

**Bass:**
- Sub: 40-80Hz sine/triangle, long sustain
- Mid: 80-250Hz saw/square, filter envelope

**Leads/Pads:**
- Leads: saw/square 200-2000Hz, unison 3-5 voices
- Pads: detuned saws, slow attack, reverb

### Provider Abstraction

```typescript
export async function generateSoundConfig(
  description: string,
  provider: 'openai' | 'gemini',
  currentConfig?: SoundConfig
): Promise<SoundConfig> {
  const config = provider === 'openai'
    ? await generateWithOpenAI(description, currentConfig)
    : await generateWithGemini(description, currentConfig);
  
  ensureDefaults(config);
  validateConfig(config);
  return config;
}
```

### Validation

```typescript
function validateConfig(config: SoundConfig): void {
  // Clamp frequencies
  config.synthesis.layers.forEach(layer => {
    if (layer.oscillator?.frequency) {
      layer.oscillator.frequency = clamp(layer.oscillator.frequency, 20, 20000);
    }
  });
  
  // Ensure envelope fits duration
  const totalEnv = config.envelope.attack + config.envelope.decay + config.envelope.release;
  if (totalEnv > config.timing.duration) {
    const scale = config.timing.duration / totalEnv;
    config.envelope.attack *= scale;
    config.envelope.decay *= scale;
    config.envelope.release *= scale;
  }
}
```

---

## Error Handling

### FFmpeg Errors

```typescript
try {
  await ffmpeg.exec([...]);
} catch (err) {
  console.error('FFmpeg error:', err);
  throw new Error('Unable to process audio file. Try converting to WAV first.');
}
```

**Common causes:** Unsupported format, corrupted file, out of memory, filter syntax error.

### AIFF Parsing Errors

```typescript
try {
  const { numFrames } = parseAiff(data);
} catch (err) {
  throw new Error('Invalid AIFF file structure.');
}
```

**Common causes:** Invalid header, missing COMM chunk, truncated file.

### Graceful Degradation

| Failure | Recovery |
|---------|----------|
| Duration probe fails | duration = 0, show warning |
| Classification fails | type = 'unknown', continue |
| Pitch detection fails | no note display, continue |
| Playback fails | disable play button, continue |

