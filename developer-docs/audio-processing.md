# Audio Processing

FFmpeg integration, classification, pitch detection, and synthesis.

## FFmpeg Integration

### Setup

FFmpeg.wasm runs in the browser. Lazy-loaded on first use.

```typescript
let ffmpegInstance: FFmpeg | null = null;

export async function ensureFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }
  if (!ffmpegInstance.loaded) {
    await ffmpegInstance.load(); // ~30MB download
  }
  return ffmpegInstance;
}
```

### Transcoding Pipeline

```typescript
async function transcodeAndConcat(files: File[]): Promise<{ data: Uint8Array; frames: number[] }> {
  const ffmpeg = await ensureFFmpeg();
  
  // Write files to virtual FS
  for (let i = 0; i < files.length; i++) {
    await ffmpeg.writeFile(`in_${i}`, new Uint8Array(await files[i].arrayBuffer()));
  }
  
  // Convert each to target format
  const frames: number[] = [];
  for (let i = 0; i < files.length; i++) {
    await ffmpeg.exec([
      '-i', `in_${i}`,
      '-ac', '1',           // Mono
      '-ar', '44100',       // Sample rate
      '-sample_fmt', 's16', // 16-bit
      '-f', 'aiff',
      `out_${i}.aif`
    ]);
    const data = await ffmpeg.readFile(`out_${i}.aif`) as Uint8Array;
    frames.push(extractFrameCount(data));
  }
  
  // Concatenate
  const inputs = files.map((_, i) => `-i out_${i}.aif`).join(' ');
  const filterInputs = files.map((_, i) => `[${i}:0]`).join('');
  await ffmpeg.exec([
    ...files.flatMap((_, i) => ['-i', `out_${i}.aif`]),
    '-filter_complex', `${filterInputs}concat=n=${files.length}:v=0:a=1,atrim=0:11.8[out]`,
    '-map', '[out]',
    '-f', 'aiff', '-ac', '1', '-ar', '44100',
    'final.aif'
  ]);
  
  const result = await ffmpeg.readFile('final.aif') as Uint8Array;
  
  // Cleanup
  for (let i = 0; i < files.length; i++) {
    await ffmpeg.deleteFile(`in_${i}`).catch(() => {});
    await ffmpeg.deleteFile(`out_${i}.aif`).catch(() => {});
  }
  await ffmpeg.deleteFile('final.aif').catch(() => {});
  
  return { data: result, frames };
}
```

### Format Conversion

For playback (browsers don't all support AIFF):

```typescript
async function convertToWav(file: File): Promise<Blob> {
  const ffmpeg = await ensureFFmpeg();
  await ffmpeg.writeFile('input', new Uint8Array(await file.arrayBuffer()));
  await ffmpeg.exec(['-i', 'input', '-f', 'wav', 'output.wav']);
  const data = await ffmpeg.readFile('output.wav') as Uint8Array;
  await ffmpeg.deleteFile('input').catch(() => {});
  await ffmpeg.deleteFile('output.wav').catch(() => {});
  return new Blob([data], { type: 'audio/wav' });
}
```

---

## Duration Probing

Fast duration check using Web Audio:

```typescript
async function probeDuration(blob: Blob): Promise<number> {
  const ctx = new AudioContext();
  try {
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buffer);
    return audioBuffer.duration;
  } catch {
    return 0;
  } finally {
    ctx.close();
  }
}
```

---

## Audio Classification

Automatic detection of sample type.

### Features Extracted

| Feature | Purpose |
|---------|---------|
| Spectral centroid | Frequency "brightness" |
| Band energy | Low/mid/high distribution |
| Spectral flatness | Noise vs. tone |
| Harmonic concentration | Peak vs. average |
| Duration | Short hits vs. sustained |

### Spectral Centroid

Weighted average of frequencies:

```typescript
function spectralCentroid(magnitudes: Float32Array, sampleRate: number): number {
  let weighted = 0, total = 0;
  const fftSize = magnitudes.length * 2;
  for (let i = 0; i < magnitudes.length; i++) {
    const freq = (i * sampleRate) / fftSize;
    weighted += freq * magnitudes[i];
    total += magnitudes[i];
  }
  return total > 0 ? weighted / total : 0;
}
```

| Centroid | Interpretation |
|----------|----------------|
| < 300 Hz | Bass (kicks) |
| 600-3000 Hz | Mids (snares) |
| > 4000 Hz | Highs (hats) |

### Band Energy

Energy distribution:

```typescript
function bandEnergy(magnitudes: Float32Array, sampleRate: number, lowHz: number, highHz: number): number {
  const binHz = sampleRate / (magnitudes.length * 2);
  const lowBin = Math.floor(lowHz / binHz);
  const highBin = Math.ceil(highHz / binHz);
  
  let band = 0, total = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    const mag = magnitudes[i] ** 2;
    if (i >= lowBin && i <= highBin) band += mag;
    total += mag;
  }
  return total > 0 ? band / total : 0;
}
```

### Spectral Flatness

Noise indicator (geometric mean / arithmetic mean):

```typescript
function spectralFlatness(magnitudes: Float32Array): number {
  const eps = 1e-12;
  let geo = 0, arith = 0;
  for (const mag of magnitudes) {
    geo += Math.log(mag + eps);
    arith += mag;
  }
  geo = Math.exp(geo / magnitudes.length);
  arith /= magnitudes.length;
  return arith > 0 ? geo / arith : 0;
}
```

| Flatness | Type |
|----------|------|
| > 0.35 | Noisy (drums) |
| < 0.35 | Tonal (melodic) |

### Decision Tree

```
Duration < 0.5s AND Flatness > 0.35?
    → drum_hit
        Centroid < 300 Hz → kick
        Centroid > 4000 Hz → hat
        Centroid 600-3000 Hz → snare
        High energy > 0.45 AND Duration > 0.5s → cymbal
        Else → other

Harmonic concentration > 3 AND Flatness < 0.35?
    → melodic

Else → unknown
```

### Configuration

Thresholds in `src/config.ts`:

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

Autocorrelation-based fundamental frequency detection.

### Algorithm

```typescript
function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  // Frequency range
  const minPeriod = Math.floor(sampleRate / 1000); // 1000 Hz max
  const maxPeriod = Math.floor(sampleRate / 50);   // 50 Hz min
  
  let bestOffset = -1, bestCorr = -1;
  
  for (let offset = minPeriod; offset < maxPeriod; offset++) {
    let sum = 0;
    for (let i = 0; i < buffer.length - offset; i++) {
      sum += buffer[i] * buffer[i + offset];
    }
    const corr = sum / (buffer.length - offset);
    if (corr > bestCorr) {
      bestCorr = corr;
      bestOffset = offset;
    }
  }
  
  return bestCorr > 0.1 ? sampleRate / bestOffset : null;
}
```

### Frequency to Note

```typescript
const freqToMidi = (freq: number): number =>
  69 + 12 * Math.log2(freq / 440);

const midiToNote = (midi: number): string => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${notes[note]}${octave}`;
};
```

---

## Synthesis Engine

Web Audio-based synthesis from SoundConfig.

### Architecture

```
Layer Sources → Layer Filters → Saturation → Layer Envelopes
    ↓
Mixer → Global Filter → Master Envelope → LFO
    ↓
Effects: Distortion → Compressor → Gate → Delay → Reverb
    ↓
Output
```

### Layer Types

| Type | Implementation |
|------|----------------|
| Oscillator | OscillatorNode (sine, square, saw, triangle) |
| Noise | BufferSourceNode with noise buffer |
| FM | Modulator → GainNode → Carrier.frequency |
| Karplus-Strong | Ring buffer with lowpass feedback |

### Oscillator with Unison

```typescript
function createUnison(ctx: AudioContext, config: OscillatorConfig): AudioNode[] {
  const { voices = 1, detune = 0, spread = 0 } = config.unison || {};
  const nodes: OscillatorNode[] = [];
  
  for (let i = 0; i < voices; i++) {
    const osc = ctx.createOscillator();
    osc.type = config.waveform;
    osc.frequency.value = config.frequency;
    
    // Spread detune across voices
    const detuneOffset = voices > 1 ? (i / (voices - 1) - 0.5) * detune : 0;
    osc.detune.value = config.detune + detuneOffset;
    
    nodes.push(osc);
  }
  
  return nodes;
}
```

### Noise Generation

```typescript
function createNoise(ctx: AudioContext, type: 'white' | 'pink' | 'brown'): AudioBufferSourceNode {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  if (type === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink') {
    // Paul Kellet's pink noise filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 + white * -0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  }
  
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}
```

### ADSR Envelope

```typescript
function applyEnvelope(param: AudioParam, env: ADSR, duration: number): void {
  const { attack, decay, sustain, release } = env;
  const FLOOR = 0.0001;
  
  param.setValueAtTime(FLOOR, 0);
  param.exponentialRampToValueAtTime(1, attack);
  param.exponentialRampToValueAtTime(Math.max(FLOOR, sustain), attack + decay);
  param.setValueAtTime(Math.max(FLOOR, sustain), duration - release);
  param.exponentialRampToValueAtTime(FLOOR, duration);
}
```

### Effects

**Distortion:**
```typescript
const shaper = ctx.createWaveShaper();
const curve = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const x = (i - 128) / 128;
  curve[i] = Math.tanh(x * drive);
}
shaper.curve = curve;
```

**Reverb:**
```typescript
const convolver = ctx.createConvolver();
const length = ctx.sampleRate * decay;
const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
for (let ch = 0; ch < 2; ch++) {
  const data = impulse.getChannelData(ch);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, damping * 3);
  }
}
convolver.buffer = impulse;
```

### Rendering

```typescript
async function synthesizeSound(config: SoundConfig): Promise<AudioBuffer> {
  const duration = config.timing.duration + calculateTail(config);
  const ctx = new OfflineAudioContext(2, duration * 44100, 44100);
  
  // Build audio graph...
  
  const buffer = await ctx.startRendering();
  
  if (config.dynamics.normalize) {
    normalize(buffer);
  }
  
  return buffer;
}
```

---

## MIDI Integration

Web MIDI API support for live playing.

### Device Detection

```typescript
async function getMidiDevices(): Promise<MIDIInput[]> {
  const access = await navigator.requestMIDIAccess();
  return Array.from(access.inputs.values());
}
```

### Note Handling

```typescript
function handleMidiMessage(event: MIDIMessageEvent): void {
  const [status, note, velocity] = event.data;
  const command = status >> 4;
  
  if (command === 9 && velocity > 0) {
    // Note On
    synth.noteOn(note, velocity / 127);
  } else if (command === 8 || (command === 9 && velocity === 0)) {
    // Note Off
    synth.noteOff(note);
  }
}
```

### Real-time Synthesis

`RealtimeSynth` uses real-time AudioContext (not offline) for low-latency playback during MIDI input. Each note creates a new set of audio nodes based on the current SoundConfig.
