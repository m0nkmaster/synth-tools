# Architecture

System design, module organization, and data flow patterns.

## System Overview

OP Done follows a **layered architecture** with clear separation between UI and core logic:

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

**1. Pure Core**
- Audio processing modules are pure functions
- No React dependencies in `src/audio/` or `src/utils/`
- Deterministic output (same input → same output)
- Easy to test, port, and reason about

**2. Unidirectional Data Flow**
- User actions → State updates → UI re-renders
- No circular dependencies
- Clear data ownership

**3. Minimal Coupling**
- Modules depend on interfaces, not implementations
- Easy to swap implementations (e.g., different AI providers)
- Future-proof for Electron migration

**4. Progressive Enhancement**
- Core features work without AI
- Graceful degradation on errors
- Optional features clearly marked

## Module Organization

### `/src/audio/` - Core Audio Processing

**Purpose**: Pure TypeScript modules for audio manipulation.

**Modules**:

- **`aiff.ts`** - AIFF parsing and encoding
  - `parseAiff()`: Extract chunks, frame count, sample rate
  - `injectDrumMetadata()`: Insert APPL chunk before SSND
  - `buildDrumMetadataChunk()`: Encode JSON to AIFF chunk
  - No dependencies on other modules

- **`pack.ts`** - Pack building orchestration
  - `buildDrumPack()`: Main export function
  - Coordinates: FFmpeg → Parse → Calculate → Inject
  - Depends on: `ffmpeg.ts`, `aiff.ts`, `utils/opz.ts`

- **`ffmpeg.ts`** - FFmpeg.wasm integration
  - `ensureFFmpeg()`: Lazy load singleton instance
  - `transcodeAndConcat()`: Process and concatenate files
  - Returns: Raw AIFF + frame counts per slice
  - Manages virtual file system cleanup

- **`convert.ts`** - Format conversion utilities
  - `convertToWav()`: AIFF → WAV for playback
  - Used for browser audio playback (AIFF not universally supported)

- **`metadata.ts`** - Audio metadata extraction
  - `probeDuration()`: Fast duration check via Web Audio API
  - Fallback: Returns 0 on decode failure

- **`classify.ts`** - Audio classification engine
  - `classifyAudio()`: Detect sample type (kick, snare, hat, etc.)
  - Spectral analysis: FFT, centroid, flatness, band energy
  - Returns: Type, confidence, note name (if melodic)

- **`pitch.ts`** - Pitch detection
  - `detectPitch()`: Autocorrelation-based frequency detection
  - `semitonesToNote()`: Convert pitch shift to note name
  - Handles AIFF conversion internally

- **`synthesizer.ts`** - Sound synthesis engine
  - `synthesizeSound()`: Generate audio from SoundConfig
  - Web Audio API: Oscillators, noise, FM, Karplus-Strong
  - Effects: Reverb, delay, distortion, compression, gate
  - LFO modulation: Filter, amplitude, pan

**Dependencies**:
```
pack.ts → ffmpeg.ts, aiff.ts, utils/opz.ts
classify.ts → utils/dsp.ts, utils/audio.ts
pitch.ts → ffmpeg.ts, utils/audio.ts
synthesizer.ts → types/soundConfig.ts, config.ts
```

### `/src/utils/` - Utility Functions

**Purpose**: Reusable pure functions for common operations.

**Modules**:

- **`opz.ts`** - OP-Z format utilities
  - `encodePositions()`: Frame → Scaled position (× 4096)
  - `decodePositions()`: Scaled position → Frame
  - `calculateSliceBoundaries()`: Compute start/end arrays

- **`audio.ts`** - Audio math utilities
  - `freqToMidi()`: Frequency → MIDI note number
  - `midiToNoteName()`: MIDI → Note name (e.g., "C4")
  - `frequencyToNote()`: Frequency → Note name
  - `semitonesToPitchParam()`: Semitones → OP-Z pitch value
  - `formatDuration()`: Seconds → MM:SS.mmm

- **`dsp.ts`** - Digital signal processing
  - `downmixToMono()`: Multi-channel → Mono
  - `normalizeBuffer()`: Peak normalization
  - `trimSilence()`: Remove leading/trailing silence
  - `computeRMS()`: Root mean square calculation

- **`array.ts`** - Array utilities
  - `padArray()`: Pad to fixed length
  - `clamp()`: Constrain value to range

- **`naming.ts`** - File naming utilities
  - `formatNamePrefix()`: Generate prefix from classification

- **`metadata.ts`** - Metadata utilities
  - Metadata encoding/decoding helpers

### `/src/components/` - React UI Components

**Purpose**: Reusable UI components.

**Components**:

- **`TEBackground.tsx`** - Teenage Engineering-inspired background
  - Animated gradient
  - Brand colors

- **`TELogo.tsx`** - OP Done logo
  - SVG-based
  - Responsive sizing

- **`PitchDial.tsx`** - Pitch control dial
  - Vertical slider
  - Note name display
  - Semitone adjustment

### `/src/pages/` - Route Pages

**Purpose**: Top-level page components for each feature.

**Pages**:

- **`DrumCreator.tsx`** - Main drum pack builder
  - File upload (drag-drop + picker)
  - Slice list with controls
  - Metadata editor
  - Export button

- **`SampleAnalyzer.tsx`** - OP-Z pack inspector
  - File loader
  - Waveform visualization
  - Metadata display
  - Slice playback

- **`SoundCreation.tsx`** - AI sound synthesis
  - Provider selector (OpenAI, Gemini)
  - Text prompt input
  - Iterative refinement
  - WAV export

- **`SynthTest.tsx`** - Synthesis testing page
  - Manual SoundConfig editor
  - Real-time preview
  - Debug output

- **`USBBrowser.tsx`** - USB device browser (future)
  - Direct OP-Z file system access
  - Drag-drop installation

- **`DrumPackPage.tsx`** - Landing page
  - Feature overview
  - Navigation links

### `/src/hooks/` - React Hooks

**Purpose**: Encapsulate stateful logic for reuse.

**Hooks**:

- **`useSlices.ts`** - Slice state management
  - `addFiles()`: Process and add files
  - `removeSlice()`: Delete slice
  - `updateSlice()`: Modify slice properties
  - `reorder()`: Drag-drop reordering
  - `reset()`: Clear all slices
  - Computed: `totalDuration`, `isProcessing`, `error`

### `/src/services/` - External Services

**Purpose**: Integration with external APIs.

**Services**:

- **`ai.ts`** - AI provider abstraction
  - `generateSoundConfig()`: Text → SoundConfig
  - Supports: OpenAI GPT-5.1, Google Gemini 3 Pro
  - Validation and defaults

- **`openai.ts`** - OpenAI-specific implementation (deprecated)
  - Replaced by unified `ai.ts`

### `/src/types/` - TypeScript Types

**Purpose**: Shared type definitions.

**Files**:

- **`types.ts`** - Core types
  - `Slice`, `SliceStatus`, `DrumMetadata`, `PackOptions`
  - `SampleType`, `DrumClass`, `SampleAnalysis`

- **`soundConfig.ts`** - Synthesis types
  - `SoundConfig`: Complete synthesis configuration
  - Layer types: Oscillator, Noise, FM, Karplus-Strong
  - Effect types: Reverb, Delay, Distortion, Compressor, Gate
  - LFO, Envelope, Filter types

### `/src/` - Root Files

- **`App.tsx`** - Application shell
  - React Router setup
  - Navigation bar
  - Background and theme

- **`main.tsx`** - Entry point
  - React DOM rendering
  - Theme provider

- **`theme.ts`** - MUI theme
  - Teenage Engineering-inspired colors
  - Typography
  - Component overrides

- **`config.ts`** - Configuration constants
  - All tunable parameters
  - Centralized for easy adjustment

- **`constants.ts`** - Exported constants
  - Re-exports from `config.ts`
  - Backward compatibility

## Data Flow

### Import Flow

```
User selects files
    ↓
useSlices.addFiles()
    ↓
For each file:
    ├── probeDuration(file) → duration
    ├── classifyAudio(file) → analysis
    ├── detectPitch(file) → note, frequency
    └── convertToWav(file) → playableBlob (if AIFF)
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
DrumCreator.handleExport()
    ↓
Validate:
    ├── slices.length ≤ 24
    ├── totalDuration ≤ 12s
    └── all slices status === 'ready'
    ↓
buildDrumPack(slices, options)
    ↓
transcodeAndConcat(files, options)
    ├── Load ffmpeg.wasm (if not loaded)
    ├── Write files to virtual FS
    ├── Build filter chain
    ├── Execute ffmpeg
    ├── Read output AIFF
    ├── Parse frame counts
    └── Cleanup virtual FS
    ↓
parseAiff(data)
    ├── Find COMM chunk → numFrames
    └── Find SSND chunk → insertPos
    ↓
calculateSliceBoundaries(frames, numFrames)
    ├── Compute start/end positions
    └── Encode with 4096 scale
    ↓
injectDrumMetadata(aiff, start, end, metadata)
    ├── Build APPL chunk
    ├── Insert before SSND
    └── Update FORM size
    ↓
Create Blob
    ↓
Trigger download
```

### Classification Flow

```
classifyAudio(blob)
    ↓
Decode audio → AudioBuffer
    ↓
downmixToMono() → Float32Array
    ↓
normalizeBuffer() → Normalized samples
    ↓
trimSilence() → Trimmed samples
    ↓
Spectral Analysis:
    ├── computeSpectrum() → FFT magnitudes
    ├── computeSpectralCentroid() → Frequency center
    ├── computeBandEnergy() → Low/Mid/High energy
    ├── computeSpectralFlatness() → Noise vs tone
    └── computeHarmonicConcentration() → Harmonic strength
    ↓
decideSampleType()
    ├── Percussive? → 'drum_hit'
    ├── Melodic? → 'melodic'
    └── Else → 'unknown'
    ↓
If drum_hit:
    classifyDrum() → 'kick' | 'snare' | 'hat' | 'cymbal' | 'other'
    ↓
If melodic:
    detectPitch() → frequency → note name
    ↓
Return SampleAnalysis
```

### Synthesis Flow

```
User enters prompt
    ↓
generateSoundConfig(prompt, provider)
    ↓
If OpenAI:
    ├── POST /v1/responses
    ├── Parse JSON response
    └── Extract SoundConfig
    ↓
If Gemini:
    ├── models.generateContent()
    ├── Parse JSON response
    └── Extract SoundConfig
    ↓
ensureDefaults(config)
    ↓
validateConfig(config)
    ↓
synthesizeSound(config)
    ↓
Create OfflineAudioContext
    ↓
For each layer:
    ├── Create source (oscillator/noise/FM/KS)
    ├── Apply layer filter (if defined)
    ├── Apply saturation (if defined)
    ├── Apply layer envelope
    └── Connect to mixer
    ↓
Apply global filter (if defined)
    ↓
Apply master envelope (VCA)
    ↓
Apply LFO (if defined)
    ↓
Apply effects chain:
    ├── Distortion
    ├── Compressor
    ├── Gate
    ├── Delay
    └── Reverb
    ↓
Start rendering
    ↓
Normalize buffer (if requested)
    ↓
Return AudioBuffer
    ↓
Convert to WAV Blob
    ↓
Play or download
```

## State Management

### React Hooks Pattern

OP Done uses **React hooks** for state management (no Redux/Zustand).

**Why?**
- Simpler architecture
- Fewer dependencies
- Sufficient for current scope
- Easy to understand

### State Ownership

**`useSlices` Hook**:
- Owns: Slice array, processing state, errors
- Provides: CRUD operations, validation
- Used by: `DrumCreator.tsx`

**Page Components**:
- Own: UI state (modals, selections, form inputs)
- Delegate: Audio processing to core modules
- Lift state: Only when shared across components

### State Update Patterns

**Immutable Updates**:
```typescript
// Add slice
setSlices(prev => [...prev, newSlice]);

// Update slice
setSlices(prev => prev.map(s => 
  s.id === id ? { ...s, ...updates } : s
));

// Remove slice
setSlices(prev => prev.filter(s => s.id !== id));
```

**Computed Values**:
```typescript
const totalDuration = useMemo(
  () => slices.reduce((acc, s) => acc + s.duration, 0),
  [slices]
);
```

**Callbacks**:
```typescript
const removeSlice = useCallback((id: string) => {
  setSlices(prev => prev.filter(s => s.id !== id));
}, []);
```

## Routing

### React Router v7

**Routes**:
- `/` - Landing page (`DrumPackPage`)
- `/creator` - Drum kit creator (`DrumCreator`)
- `/analyzer` - Sample analyzer (`SampleAnalyzer`)
- `/sound-creation` - AI synthesis (`SoundCreation`)
- `/synth-test` - Synthesis testing (`SynthTest`)
- `/usb` - USB browser (`USBBrowser`)

**Navigation**:
- Top bar with links
- Programmatic: `useNavigate()`
- No nested routes (flat structure)

## Dependency Injection

### Singleton Pattern

**FFmpeg Instance**:
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

**Why?**
- Expensive to load (~30MB, 2-5s)
- Reuse across exports
- Lazy initialization

### Provider Pattern

**AI Services**:
```typescript
export async function generateSoundConfig(
  description: string,
  provider: AIProvider,
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

**Why?**
- Easy to add new providers
- Consistent interface
- Centralized validation

## Error Boundaries

### Current State

No React error boundaries implemented yet.

### Future Implementation

```typescript
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

**Benefits**:
- Catch rendering errors
- Prevent white screen
- Log errors for debugging

## Performance Optimizations

### Memoization

**useMemo**:
```typescript
const totalDuration = useMemo(
  () => slices.reduce((acc, s) => acc + s.duration, 0),
  [slices]
);
```

**useCallback**:
```typescript
const removeSlice = useCallback((id: string) => {
  setSlices(prev => prev.filter(s => s.id !== id));
}, []);
```

### Lazy Loading

**FFmpeg**:
- Loaded on first export (not on page load)
- Reduces initial bundle size

**Route Splitting**:
```typescript
const SoundCreation = lazy(() => import('./pages/SoundCreation'));
```

### Debouncing

**Future**: Debounce text inputs for AI prompts
```typescript
const debouncedPrompt = useDebounce(prompt, 500);
```

## Testing Strategy

### Unit Tests

**Pure Functions** (`src/audio/`, `src/utils/`):
- Test inputs → outputs
- Mock external dependencies (AudioContext, FFmpeg)
- Fast, deterministic

**Example**:
```typescript
describe('encodePositions', () => {
  it('scales frames by 4096', () => {
    expect(encodePositions([0, 44100])).toEqual([0, 180633600]);
  });
  
  it('clamps to MAX_POSITION', () => {
    expect(encodePositions([1000000000])).toEqual([0x7ffffffe]);
  });
});
```

### Integration Tests

**Full Pipeline**:
- Files → buildDrumPack() → AIFF
- Validate output structure
- Compare with golden samples

### Manual Testing

**Real Device**:
- Export pack
- Load on OP-Z
- Verify playback
- Check slice boundaries

## Future: Electron Migration

### Planned Architecture

```
┌─────────────────────────────────────────┐
│         Renderer Process (React)        │
│  Same UI code, minimal changes          │
└──────────────────┬──────────────────────┘
                   │ IPC
┌──────────────────▼──────────────────────┐
│         Main Process (Node.js)          │
│  File system access, native dialogs     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│       Core Audio (Pure TypeScript)      │
│  No changes needed (framework-agnostic) │
└─────────────────────────────────────────┘
```

### Changes Required

**Renderer**:
- Replace File API with IPC calls
- Use native dialogs instead of `<input type="file">`
- Add settings persistence

**Main**:
- Implement IPC handlers
- File system operations (read/write/list)
- OP-Z device detection
- Auto-install to mounted device

**Core**:
- No changes (pure TypeScript)

---

**Next**: [Audio Pipeline](./audio-pipeline.md)
