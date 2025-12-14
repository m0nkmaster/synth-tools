# Architecture

System design, modules, and data flow.

## Layers

```
┌─────────────────────────────────────────────┐
│         Presentation (React)                │
│  Pages, Components, Hooks, Theme            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Services                            │
│  AI Integration (OpenAI, Gemini)            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         Core (Pure TypeScript)              │
│  Audio Processing, Synthesis, Utilities     │
└─────────────────────────────────────────────┘
```

## Module Reference

### `/src/audio/` — Core Audio

| Module | Purpose |
|--------|---------|
| `aiff.ts` | AIFF parsing, chunk manipulation, metadata injection |
| `pack.ts` | Orchestrates pack building |
| `ffmpeg.ts` | FFmpeg.wasm wrapper, transcoding, concatenation |
| `convert.ts` | Format conversion (AIFF → WAV for playback) |
| `metadata.ts` | Duration probing via Web Audio |
| `classify.ts` | Audio classification (drum type detection) |
| `pitch.ts` | Pitch detection via autocorrelation |
| `synthesizer.ts` | Offline audio synthesis |
| `realtimeSynth.ts` | Live MIDI synthesis |

### `/src/hooks/` — React Hooks

| Hook | Purpose |
|------|---------|
| `useSlices` | Slice array state, add/remove/update/reorder |
| `useMidi` | Web MIDI API, device detection, note handling |
| `useNodeGraph` | Visual node editor state |
| `useDefaultPreset` | Default SoundConfig preset |

### `/src/pages/` — Route Pages

| Page | Route | Purpose |
|------|-------|---------|
| `DrumCreator` | `/drum-creator` | Build packs from samples |
| `SampleAnalyzer` | `/sample-analyzer` | Inspect OP-Z packs |
| `SynthesizerUI` | `/synthesizer` | Full synth with MIDI/AI |
| `AIKitGenerator` | `/ai-kit-generator` | Generate kits from text |
| `USBBrowser` | `/usb-browser` | Direct device file management |
| `VisualNodeSynth` | `/visual-node-synth` | Experimental node editor |

### `/src/services/` — External Services

| Service | Purpose |
|---------|---------|
| `ai.ts` | OpenAI and Gemini integration, SoundConfig generation |

### `/src/utils/` — Utilities

| Module | Purpose |
|--------|---------|
| `opz.ts` | Position encoding/decoding, slice boundaries |
| `audio.ts` | Frequency/MIDI/note conversions |
| `dsp.ts` | Downmix, normalize, trim, RMS |
| `validation.ts` | SoundConfig validation |
| `metadata.ts` | DrumMetadata utilities |
| `naming.ts` | Filename prefix generation |

---

## Data Flow

### Drum Pack Export

```
User clicks Export
    ↓
Validate slices (count, duration, status)
    ↓
buildDrumPack(slices, options)
    ↓
transcodeAndConcat(files)
    ├── Load ffmpeg.wasm
    ├── Write files to virtual FS
    ├── Convert each to mono/16-bit/44.1kHz
    ├── Concatenate all
    ├── Read frame counts per slice
    └── Cleanup virtual FS
    ↓
parseAiff(data)
    ├── Extract COMM chunk → numFrames
    └── Locate SSND chunk → insert position
    ↓
calculateSliceBoundaries(frames, total)
    ├── Compute start/end for each slice
    └── Encode with × 4058 scale
    ↓
injectDrumMetadata(aiff, start, end, metadata)
    ├── Build APPL chunk
    ├── Insert before SSND
    └── Update FORM size
    ↓
Blob → Download
```

### Sample Import

```
User adds files
    ↓
useSlices.addFiles()
    ↓
For each file (parallel):
    ├── probeDuration() → seconds
    ├── classifyAudio() → type, drumClass, confidence
    ├── detectPitch() → note, frequency
    └── convertToWav() → playable blob (if AIFF)
    ↓
Create Slice objects
    ↓
setSlices([...prev, ...new])
```

### AI Kit Generation

```
User enters prompt
    ↓
KIT_PLANNER_PROMPT → AI
    ↓
AI returns { kitName, sounds[24] }
    ↓
For each sound:
    ├── generateSoundConfig(description)
    ├── synthesizeSound(config)
    └── Create Slice from AudioBuffer
    ↓
buildDrumPack(slices)
    ↓
Download pack
```

### Synthesizer Playback

```
User clicks Play (or MIDI note)
    ↓
synthesizeSound(config)
    ↓
Create OfflineAudioContext
    ↓
For each layer:
    ├── Create source (oscillator/noise/FM/KS)
    ├── Apply layer filter
    ├── Apply saturation
    ├── Apply layer envelope
    └── Connect to mixer
    ↓
Apply: global filter → master envelope → LFO
    ↓
Apply effects chain:
    distortion → compressor → gate → delay → reverb
    ↓
Render → Normalize (optional)
    ↓
Play AudioBuffer / Export WAV
```

### MIDI Input

```
MIDI device connected
    ↓
useMidi hook detects device
    ↓
Note On event
    ↓
RealtimeSynth.noteOn(note, velocity)
    ├── Create AudioContext nodes
    ├── Apply SoundConfig parameters
    └── Start sources
    ↓
Note Off event
    ↓
RealtimeSynth.noteOff(note)
    └── Trigger release phase
```

---

## State Management

React hooks, no Redux.

### Slice State (`useSlices`)

```typescript
const [slices, setSlices] = useState<Slice[]>([]);
const [isProcessing, setIsProcessing] = useState(false);
const [error, setError] = useState<string | null>(null);

const totalDuration = useMemo(
  () => slices.reduce((acc, s) => acc + s.duration, 0),
  [slices]
);
```

### Slice Lifecycle

```
pending → processing → ready
                    ↘ error
```

| Status | Meaning |
|--------|---------|
| pending | File added, not processed |
| processing | Duration/classification running |
| ready | All processing complete |
| error | Processing failed |

### Immutable Updates

```typescript
// Add
setSlices(prev => [...prev, newSlice]);

// Update
setSlices(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));

// Remove
setSlices(prev => prev.filter(s => s.id !== id));

// Reorder
setSlices(prev => {
  const next = [...prev];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
});
```

---

## Singletons

### FFmpeg Instance

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

Lazy-loaded on first use.

---

## Theme System

Light/dark mode via React context:

```typescript
const { mode, toggleMode } = useThemeMode();
const theme = mode === 'dark' ? darkTheme : lightTheme;
```

Theme tokens in `src/theme.ts` with TE-inspired colors:
- Orange (#FF6B00) — Primary accent
- Cyan (#00D4AA) — Secondary accent
- Yellow (#FFD93D) — Highlights

---

## Key Types

### Slice

```typescript
type Slice = {
  id: string;
  file: File;
  name: string;
  duration: number;
  status: SliceStatus;
  error?: string;
  analysis?: SampleAnalysis;
  detectedNote?: string | null;
  detectedFrequency?: number | null;
  semitones?: number;
  playableBlob?: Blob;
};
```

### SoundConfig

See `src/types/soundConfig.ts` — comprehensive synthesis configuration:
- `synthesis.layers[]` — Oscillator, Noise, FM, Karplus-Strong
- `envelope` — Master ADSR
- `filter` — Global filter with envelope
- `lfo` — Modulation
- `effects` — Distortion, compressor, gate, delay, reverb
- `timing` — Duration
- `dynamics` — Velocity, normalize
- `metadata` — Name, category, tags

### DrumMetadata

```typescript
type DrumMetadata = {
  name: string;
  octave: number;
  drumVersion: number;
  pitch: number[];
  playmode: number[];
  reverse: number[];
  volume: number[];
};
```

---

## Performance

### Parallelization

| Operation | Parallel? |
|-----------|-----------|
| Duration probing | Yes — all files |
| Classification | Yes — all files |
| Pitch detection | Yes — all files |
| FFmpeg processing | No — single instance |
| Sound synthesis | Sequential |

### Memory

- File objects held in React state
- AudioContext closed after use
- FFmpeg virtual FS cleaned after operations
- Blob URLs revoked after download

### Lazy Loading

- FFmpeg loaded on first export/analysis
- Route components can be code-split
