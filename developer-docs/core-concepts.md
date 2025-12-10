# Core Concepts

Understanding the fundamental concepts behind OP Done.

## OP-Z Drum Format

### Purpose
The OP-Z requires drum samples in a specific AIFF format with embedded metadata that defines slice boundaries and playback parameters.

### Format Specification

**Audio Format**:
- Container: AIFF (Audio Interchange File Format)
- Sample Rate: 44,100 Hz
- Bit Depth: 16-bit signed integer
- Channels: Mono (1 channel)
- Byte Order: Big-endian
- Max Duration: 12 seconds (529,200 frames)

**Metadata Format**:
- Chunk Type: `APPL` (Application-specific)
- Signature: `op-1` (4 bytes)
- Payload: JSON string with drum parameters
- Position: Before `SSND` (sound data) chunk

### Slice System

The OP-Z drum format supports **24 slices** per pack. Each slice represents a separate sound that can be triggered independently.

**Slice Boundaries**:
- Defined by `start` and `end` frame positions
- Frames are scaled by 4096 for sub-frame precision
- Empty slots have `start == end == 0`
- Slices are laid out sequentially in the audio file

**Frame Scaling**:
```typescript
// Raw frame position
const frameIndex = 44100; // 1 second at 44.1kHz

// OP-Z encoded position
const encoded = frameIndex * 4096; // 180,633,600

// Maximum position (INT32_MAX - 1)
const MAX_POSITION = 0x7ffffffe; // 2,147,483,646
```

**Why 4096?**
- Legacy from OP-1 format
- Allows sub-frame precision for pitch shifting
- Maintains compatibility with existing tools

### Metadata Structure

```json
{
  "drum_version": 3,
  "type": "drum",
  "name": "My Drum Pack",
  "octave": 0,
  "start": [0, 44100, 88200, ...],  // 24 elements
  "end": [44099, 88199, 132299, ...],  // 24 elements
  "pitch": [0, 0, 0, ...],  // 24 elements
  "playmode": [8192, 8192, 8192, ...],  // 24 elements
  "reverse": [8192, 8192, 8192, ...],  // 24 elements
  "volume": [8192, 8192, 8192, ...],  // 24 elements
  "dyna_env": [0, 8192, 0, 0, 0, 0, 0, 0],
  "editable": true,
  "fx_active": false,
  "fx_type": "delay",
  "fx_params": [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
  "lfo_active": false,
  "lfo_type": "tremolo",
  "lfo_params": [0, 0, 0, 0, 0, 0, 0, 0]
}
```

**Parameter Ranges**:
- `drum_version`: 2 (OP-1 legacy) or 3 (OP-Z)
- `octave`: -4 to +4
- `pitch`: 0 = center, ±683 per semitone
- `volume`: 0-16383 (8192 = unity gain)
- `playmode`: 8192 = mono, other values for poly/legato
- `reverse`: 8192 = forward, other values for reverse

## AIFF Structure

### Chunk-Based Format

AIFF files are composed of chunks with this structure:
```
[4 bytes: Chunk ID]
[4 bytes: Chunk Size (big-endian)]
[N bytes: Chunk Data]
[1 byte: Pad (if size is odd)]
```

### Required Chunks

**FORM Chunk** (container):
```
Offset  Size  Description
0       4     "FORM"
4       4     File size - 8
8       4     "AIFF" or "AIFC"
12      ...   Other chunks
```

**COMM Chunk** (format):
```
Offset  Size  Description
0       4     "COMM"
4       4     Chunk size (18 for AIFF)
8       2     Channels (1 = mono)
10      4     Number of frames
14      2     Bits per sample (16)
16      10    Sample rate (80-bit float)
```

**SSND Chunk** (audio data):
```
Offset  Size  Description
0       4     "SSND"
4       4     Chunk size
8       4     Offset (usually 0)
12      4     Block size (usually 0)
16      ...   Audio samples (big-endian)
```

**APPL Chunk** (OP-Z metadata):
```
Offset  Size  Description
0       4     "APPL"
4       4     Chunk size
8       4     "op-1" signature
12      ...   JSON string
```

### Chunk Ordering

OP Done inserts the APPL chunk **before** the SSND chunk:
```
FORM
├── COMM
├── APPL  ← OP-Z metadata
└── SSND  ← Audio data
```

This ordering is critical for OP-Z compatibility.

## Audio Processing Pipeline

### Input → Output Flow

```
User Files (WAV/AIFF/MP3/M4A/FLAC)
    ↓
[Duration Probing] (Web Audio API)
    ↓
[Classification] (Spectral analysis)
    ↓
[Pitch Detection] (Autocorrelation)
    ↓
[FFmpeg Processing]
    ├── Format conversion (mono, 16-bit, 44.1kHz)
    ├── Silence trimming (optional)
    ├── Padding (0.1s gap between slices)
    └── Concatenation
    ↓
[AIFF Parsing] (Extract frame count)
    ↓
[Boundary Calculation] (Slice start/end positions)
    ↓
[Metadata Injection] (Insert APPL chunk)
    ↓
OP-Z Compatible AIFF File
```

### Processing Stages

**1. Duration Probing**
- Purpose: Validate total duration ≤ 12s
- Method: Web Audio API `decodeAudioData()`
- Speed: Fast (native browser API)
- Fallback: Returns 0 on failure

**2. Classification**
- Purpose: Auto-detect sample type (kick, snare, hat, etc.)
- Method: FFT + spectral analysis
- Output: Sample type, confidence score, note name (if melodic)
- Used for: Auto-prefixing filenames

**3. FFmpeg Transcoding**
- Purpose: Convert to OP-Z format and concatenate
- Method: ffmpeg.wasm with filter chain
- Output: Raw AIFF + frame counts per slice
- Adds: 0.1s silence gap between slices

**4. Metadata Injection**
- Purpose: Add OP-Z drum metadata
- Method: Parse AIFF, insert APPL chunk, update FORM size
- Output: Final OP-Z-compatible AIFF

## Slice Lifecycle

### States

```typescript
type SliceStatus = 'pending' | 'processing' | 'ready' | 'error';
```

**pending**: File added, not yet processed  
**processing**: Duration probing / classification in progress  
**ready**: Processed successfully, ready for export  
**error**: Processing failed (decode error, unsupported format, etc.)

### State Transitions

```
User adds file
    ↓
pending
    ↓
[probeDuration() + classifyAudio() + detectPitch()]
    ↓
processing
    ↓
Success? → ready
Failure? → error
```

### Slice Data Structure

```typescript
type Slice = {
  id: string;                    // UUID
  file: File;                    // Original file object
  name: string;                  // Display name (with prefix)
  duration: number;              // Seconds
  status: SliceStatus;           // Current state
  error?: string;                // Error message (if status='error')
  analysis?: SampleAnalysis;     // Classification results
  detectedNote?: string | null;  // Pitch (e.g., "C4")
  detectedFrequency?: number | null;  // Hz
  semitones?: number;            // Pitch adjustment
  playableBlob?: Blob;           // WAV for playback (if AIFF input)
};
```

## Configuration System

### Centralized Config

All constants are defined in `src/config.ts` and re-exported via `src/constants.ts`.

**Why?**
- Single source of truth
- Easy to adjust thresholds
- Type-safe configuration
- Prevents magic numbers

### Config Categories

**AUDIO**: Processing parameters
```typescript
SAMPLE_RATE: 44100
BIT_DEPTH: 16
CHANNELS: 1
SILENCE_THRESHOLD_DB: -50
```

**OPZ**: Format constraints
```typescript
MAX_SLICES: 25
MAX_DURATION_SECONDS: 11.8
SLICE_GAP_SECONDS: 0.1
POSITION_SCALE: 4096
```

**CLASSIFICATION**: Analysis thresholds
```typescript
FFT_SIZE: 2048
DRUM_HIT_MAX_DURATION: 0.5
FLATNESS_DRUM_THRESHOLD: 0.35
```

**SYNTHESIS**: Sound generation
```typescript
SAMPLE_RATE: 44100
CHANNELS: 2
NOISE_BUFFER_DURATION: 2
```

### Adjusting Thresholds

To modify classification behavior:
1. Edit `src/config.ts`
2. Run tests: `bun test`
3. Test with diverse samples
4. Document changes in commit message

## Type System

### Core Types

**Slice Types**:
```typescript
type SliceStatus = 'pending' | 'processing' | 'ready' | 'error';
type SampleType = 'drum_hit' | 'melodic' | 'unknown';
type DrumClass = 'kick' | 'snare' | 'hat' | 'cymbal' | 'other';
```

**Metadata Types**:
```typescript
type DrumMetadata = {
  name: string;
  octave: number;
  drumVersion: number;
  pitch: number[];      // 24 elements
  playmode: number[];   // 24 elements
  reverse: number[];    // 24 elements
  volume: number[];     // 24 elements
};
```

**Analysis Types**:
```typescript
type SampleAnalysis = {
  type: SampleType;
  drumClass?: DrumClass;
  noteName?: string;
  midiNote?: number;
  confidence: number;  // 0-1
};
```

### Type Safety Benefits

- Compile-time error detection
- IDE autocomplete
- Refactoring safety
- Self-documenting code

## Performance Considerations

### Memory Management

**File Objects**:
- Held in React state (no copies)
- Original File objects passed to FFmpeg
- Blob URLs created only for playback

**Audio Buffers**:
- Created temporarily for analysis
- Discarded after processing
- AudioContext closed after use

**FFmpeg Virtual FS**:
- Temp files written for processing
- Deleted immediately after export
- Singleton instance reused

### Optimization Strategies

**Lazy Loading**:
- ffmpeg.wasm loaded on first export (not on page load)
- Reduces initial bundle size
- Improves perceived performance

**Parallel Processing**:
- Duration probing: All files concurrently
- Classification: All files concurrently
- FFmpeg: Sequential (single instance)

**Caching**:
- FFmpeg instance: Singleton, reused
- Waveform canvas: Rendered once per slice
- Classification results: Stored in slice state

### Performance Targets

- Duration probing: <100ms per file
- Classification: <500ms per file
- FFmpeg processing: ~1s per 12s pack
- Waveform rendering: <50ms per slice
- Total export time: <5s for 24 slices

## Error Handling

### Error Categories

**User Errors**:
- Too many slices (>24)
- Total duration exceeds 12s
- Unsupported file format
- Corrupted audio file

**Processing Errors**:
- FFmpeg execution failure
- AIFF parsing error
- Metadata encoding error
- Out of memory

**Network Errors** (AI features only):
- API key missing
- API request failed
- Invalid response format
- Rate limit exceeded

### Error Recovery

**Graceful Degradation**:
- Duration probe fails → duration = 0, show warning
- Classification fails → type = 'unknown', continue
- Pitch detection fails → no note display, continue
- Playback fails → disable play button, continue

**User Feedback**:
- Inline error messages (per slice)
- Toast notifications (global errors)
- Export button disabled (validation errors)
- Console logs (debug info)

### Error Messages

**Good**:
- "Unable to decode audio file. Try converting to WAV first."
- "Total duration (13.2s) exceeds 12s limit. Remove 1.2s of audio."

**Bad**:
- "Error"
- "Something went wrong"
- "Failed to process"

## Security & Privacy

### Client-Side Only

**No Network Calls**:
- All processing in browser
- No file uploads
- No tracking or analytics
- No cookies

**Exceptions**:
- ffmpeg.wasm CDN (first load only)
- AI API calls (Sound Creation feature only)

### File Access

**Browser Sandbox**:
- Files accessed via File API (user-initiated)
- No arbitrary file system access
- Blob URLs scoped to session
- No persistent storage

**Future Electron**:
- File system access limited to OP-Z mount point
- User confirmation for overwrites
- No arbitrary writes outside OP-Z folders

### Data Privacy

**No Data Collection**:
- No user data sent to servers
- No telemetry or crash reports
- No usage analytics
- Audio files never leave device

**AI Features**:
- Text prompts sent to AI providers
- No audio files sent
- API keys stored in `.env` (not committed)
- User responsible for API key security

---

**Next**: [Architecture](./architecture.md)
