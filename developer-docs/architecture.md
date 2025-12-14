# Architecture

System design, module organization, and data flow patterns.

## Layered Architecture

```
┌─────────────────────────────────────────────┐
│         Presentation Layer (React)          │
│  Pages, Components, Hooks, Theme            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│      Application Layer (Services)           │
│  AI Integration, State Management           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│       Domain Layer (Pure TypeScript)        │
│  Audio Processing, Classification, Utils    │
└─────────────────────────────────────────────┘
```

### Design Principles

1. **Pure Core** — Audio modules are pure functions with no React dependencies
2. **Unidirectional Data Flow** — User actions → state updates → UI re-renders
3. **Minimal Coupling** — Modules depend on interfaces, not implementations
4. **Client-Side First** — All processing in browser; AI features are opt-in

---

## Module Reference

### `/src/audio/` — Core Audio Processing

Pure TypeScript modules for audio manipulation.

| Module | Purpose |
|--------|---------|
| `aiff.ts` | AIFF parsing, metadata injection, chunk building |
| `pack.ts` | Orchestrates pack building: FFmpeg → Parse → Calculate → Inject |
| `ffmpeg.ts` | FFmpeg.wasm integration, file transcoding, concatenation |
| `convert.ts` | Format conversion (AIFF → WAV for playback) |
| `metadata.ts` | Duration probing via Web Audio API |
| `classify.ts` | Audio classification (drum type detection) |
| `pitch.ts` | Pitch detection via autocorrelation |
| `synthesizer.ts` | Web Audio synthesis engine |

**Dependencies:**
```
pack.ts → ffmpeg.ts, aiff.ts, utils/opz.ts
classify.ts → utils/dsp.ts, utils/audio.ts
pitch.ts → ffmpeg.ts, utils/audio.ts
synthesizer.ts → types/soundConfig.ts, config.ts
```

### `/src/utils/` — Utility Functions

| Module | Purpose |
|--------|---------|
| `opz.ts` | Position encoding/decoding, slice boundary calculation |
| `audio.ts` | Frequency → MIDI, MIDI → note name, pitch conversions |
| `dsp.ts` | Downmix, normalize, trim silence, RMS calculation |
| `array.ts` | Array padding, clamping |
| `naming.ts` | Filename prefix generation from classification |

### `/src/hooks/` — React Hooks

| Hook | Purpose |
|------|---------|
| `useSlices.ts` | Slice array state, CRUD operations, validation |
| `useMidi.ts` | Web MIDI API integration |
| `useNodeGraph.ts` | Visual node editor state |

### `/src/pages/` — Route Pages

| Page | Purpose |
|------|---------|
| `DrumCreator.tsx` | Main drum pack builder |
| `SampleAnalyzer.tsx` | OP-Z pack inspector |
| `AIKitGenerator.tsx` | AI-powered sound creation |
| `SynthesizerUI.tsx` | Manual synthesis testing |
| `USBBrowser.tsx` | File System Access API browser |

### `/src/services/` — External Services

| Service | Purpose |
|---------|---------|
| `ai.ts` | AI provider abstraction (OpenAI, Gemini) |
| `openai.ts` | OpenAI-specific implementation |

### `/src/types/` — TypeScript Types

| File | Key Types |
|------|-----------|
| `types.ts` | Slice, SliceStatus, DrumMetadata, SampleAnalysis |
| `soundConfig.ts` | SoundConfig, layer types, effect types |
| `nodeGraph.ts` | Node editor types |

---

## Data Flow

### Import Flow

```
User selects files
    ↓
useSlices.addFiles()
    ↓
For each file (parallel):
    ├── probeDuration() → duration
    ├── classifyAudio() → type, drumClass, confidence
    └── detectPitch() → note, frequency
    ↓
Create Slice objects
    ↓
Update state: setSlices([...prev, ...new])
    ↓
UI re-renders with new slices
```

### Export Flow

```
User clicks Export
    ↓
Validate:
    ├── slices.length ≤ 24
    ├── totalDuration ≤ 12s
    └── all slices status === 'ready'
    ↓
buildDrumPack(slices, options)
    ↓
transcodeAndConcat(files)
    ├── Load ffmpeg.wasm (lazy)
    ├── Write files to virtual FS
    ├── Execute filter chain
    ├── Read output + frame counts
    └── Cleanup virtual FS
    ↓
parseAiff(data)
    ├── Find COMM chunk → numFrames
    └── Locate SSND chunk → insertPos
    ↓
calculateSliceBoundaries(frames, totalFrames)
    ├── Compute start/end positions
    └── Encode with × 4096 scale
    ↓
injectDrumMetadata(aiff, start, end, metadata)
    ├── Build APPL chunk
    ├── Insert before SSND
    └── Update FORM size
    ↓
Create Blob → Trigger download
```

### Classification Flow

```
classifyAudio(blob)
    ↓
Decode → AudioBuffer
    ↓
downmixToMono() → Float32Array
    ↓
normalizeBuffer() → Peak = 1.0
    ↓
trimSilence() → Remove quiet sections
    ↓
Spectral Analysis:
    ├── computeSpectrum() → FFT magnitudes
    ├── computeSpectralCentroid() → Frequency center
    ├── computeBandEnergy() → Low/Mid/High ratios
    ├── computeSpectralFlatness() → Noise vs tone
    └── computeHarmonicConcentration() → Peak strength
    ↓
decideSampleType() → drum_hit | melodic | unknown
    ↓
If drum_hit: classifyDrum() → kick | snare | hat | cymbal | other
If melodic: detectPitch() → note name
    ↓
Return SampleAnalysis
```

### Synthesis Flow

```
User enters prompt
    ↓
generateSoundConfig(prompt, provider)
    ↓
AI returns SoundConfig JSON
    ↓
ensureDefaults() + validateConfig()
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
Apply effects: distortion → compressor → gate → delay → reverb
    ↓
Render → Normalize → Return AudioBuffer
    ↓
Convert to WAV Blob → Play or download
```

---

## State Management

OP Done uses React hooks (no Redux/Zustand).

### Slice State (`useSlices`)

```typescript
const [slices, setSlices] = useState<Slice[]>([]);
const [error, setError] = useState<string | null>(null);
const [isProcessing, setIsProcessing] = useState(false);

const totalDuration = useMemo(
  () => slices.reduce((acc, s) => acc + s.duration, 0),
  [slices]
);
```

### Slice Lifecycle

```typescript
type SliceStatus = 'pending' | 'processing' | 'ready' | 'error';
```

| Status | Meaning |
|--------|---------|
| pending | File added, not yet processed |
| processing | Duration/classification in progress |
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
  const [item] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, item);
  return next;
});
```

---

## Routing

React Router v7 with flat route structure:

| Path | Page | Purpose |
|------|------|---------|
| `/` | Landing | Feature overview |
| `/creator` | DrumCreator | Drum pack builder |
| `/analyzer` | SampleAnalyzer | Pack inspector |
| `/ai-kit` | AIKitGenerator | AI sound creation |
| `/synth` | SynthesizerUI | Synthesis testing |
| `/usb` | USBBrowser | USB file browser |

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
    await ffmpegInstance.load(); // ~30MB, 2-5s
  }
  return ffmpegInstance;
}
```

Lazy-loaded on first export to reduce initial load time.

---

## Performance

### Parallelization

| Operation | Parallel | Notes |
|-----------|----------|-------|
| Duration probing | Yes | All files concurrent |
| Classification | Yes | All files concurrent |
| Pitch detection | Yes | All files concurrent |
| FFmpeg processing | No | Single instance |

### Memory Management

- File objects held in React state (no copies)
- AudioContext closed after use
- FFmpeg virtual FS cleaned after export
- Blob URLs revoked after download

### Optimization Strategies

- FFmpeg loaded lazily on first export
- Route code-splitting with `lazy()`
- `useMemo` for computed values
- `useCallback` for stable function references

---

## Error Handling

### Categories

| Category | Examples |
|----------|----------|
| User errors | Too many slices, duration exceeded, unsupported format |
| Processing errors | FFmpeg failure, AIFF parsing error, decode error |
| Network errors | API key missing, request failed, rate limited |

### Strategy

- Graceful degradation: probe fails → duration = 0, classification fails → type = 'unknown'
- Per-slice error state with inline messages
- Global error toast for export failures
- Console logging for debugging

---

## Future: Electron Migration

The pure core architecture enables future Electron packaging:

```
┌─────────────────────────────────────────┐
│         Renderer Process (React)        │
│  Same UI code, minimal changes          │
└──────────────────┬──────────────────────┘
                   │ IPC
┌──────────────────▼──────────────────────┐
│         Main Process (Node.js)          │
│  File system, native dialogs            │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│       Core Audio (Pure TypeScript)      │
│  No changes needed                      │
└─────────────────────────────────────────┘
```

Changes required:
- **Renderer**: Replace File API with IPC, native dialogs
- **Main**: Implement IPC handlers, file system ops, device detection
- **Core**: No changes (framework-agnostic)
