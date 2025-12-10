# OP Done — Technical Architecture

## Overview

OP Done is a browser-based application for creating OP-Z drum sample packs. The architecture prioritizes client-side processing, deterministic output, and framework-agnostic core modules for future Electron packaging.

## Stack

- **UI Framework**: React 18 + TypeScript
- **Routing**: React Router DOM v7
- **Component Library**: Material-UI (MUI) v5
- **Build Tool**: Vite
- **Audio Processing**: ffmpeg.wasm (WebAssembly port of FFmpeg)
- **Audio Analysis**: Web Audio API (duration probing, waveform rendering)

## Architecture Layers

```
┌─────────────────────────────────────────┐
│           UI Layer (React)              │
│  App.tsx, components/, hooks/           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│      Core Audio Modules (Pure TS)       │
│  audio/pack.ts, audio/aiff.ts,          │
│  audio/ffmpeg.ts, audio/metadata.ts     │
└─────────────────────────────────────────┘
```

### UI Layer

**Responsibilities:**
- User input (file picker, drag-drop)
- Slice state management
- Settings configuration
- Validation and error display
- Export orchestration
- Navigation between tools

**Key Files:**
- `App.tsx`: Layout shell with navigation
- `pages/DrumCreator.tsx`: Drum kit creation tool
- `pages/SampleAnalyzer.tsx`: OP-Z file visualization tool
- `hooks/useSlices.ts`: Slice state management, file input handling
- `components/TEBackground.tsx`: Visual branding
- `theme.ts`: MUI theme customization

**State Management:**
- React hooks (useState, useCallback, useMemo)
- No external state library (Redux, Zustand) to minimize dependencies
- Slice state: array of `Slice` objects with status tracking
- Metadata state: `DrumMetadata` object with 24-element arrays

### Core Audio Modules

**Design Principles:**
- Framework-agnostic (pure TypeScript)
- No React dependencies
- Deterministic output (same inputs → same output)
- Minimal side effects

**Modules:**

#### `audio/metadata.ts`
- **Purpose**: Probe audio file duration
- **Method**: Web Audio API (`AudioContext.decodeAudioData`)
- **Fallback**: Returns 0 on decode failure
- **Usage**: Pre-flight validation, duration display

#### `audio/ffmpeg.ts`
- **Purpose**: Audio transcoding and concatenation
- **Method**: ffmpeg.wasm (WebAssembly)
- **Pipeline**:
  1. Load ffmpeg.wasm (lazy, singleton)
  2. Write input files to virtual FS
  3. Build filter chain: silence removal → format conversion → normalization → concat → trim
  4. Execute ffmpeg with filter_complex
  5. Read output AIFF from virtual FS
  6. Cleanup temp files
- **Normalization modes**:
  - `loudnorm`: LUFS-based (`loudnorm` + `alimiter`)
  - `peak`: Peak-based (`acompressor` + `alimiter`)
  - `off`: Limiter only (`alimiter`)

#### `audio/aiff.ts`
- **Purpose**: AIFF parsing and OP-Z metadata injection
- **Methods**:
  - `parseAiff()`: Parse AIFF chunks, extract frame count
  - `injectDrumMetadata()`: Insert `APPL` chunk before `SSND`
  - `buildDrumMetadataChunk()`: Encode OP-Z drum JSON to AIFF chunk
  - `encodePositions()`: Scale frame indices by 4096, clamp to `0x7ffffffe`
- **Format**: Big-endian integers, even-length chunks (pad byte if needed)

#### `audio/pack.ts`
- **Purpose**: Orchestrate pack building
- **Flow**:
  1. Call `transcodeAndConcat()` to get raw AIFF
  2. Parse AIFF to get total frame count
  3. Calculate slice boundaries from probed durations
  4. Call `injectDrumMetadata()` to add OP-Z metadata
  5. Return Blob for download

## Data Flow

### Import Flow

```
User selects files
       ↓
useSlices.addFiles()
       ↓
probeDuration() for each file (Web Audio API)
       ↓
Create Slice objects with status='ready'
       ↓
Update UI (slice list, duration display)
```

### Export Flow

```
User clicks Export
       ↓
App.handleExport()
       ↓
buildDrumPack(slices, options)
       ↓
transcodeAndConcat() → raw AIFF
       ↓
parseAiff() → frame count
       ↓
Calculate slice boundaries
       ↓
injectDrumMetadata() → annotated AIFF
       ↓
Create Blob → download
```

## Key Algorithms

### Slice Boundary Calculation

```typescript
// Given: probed durations, total frame count
// Output: start/end frame arrays (24 elements)

let cursor = 0;
for (let i = 0; i < 24; i++) {
  const len = lengths[i] ?? 0;
  const sliceLen = Math.min(len, numFrames - cursor);
  const start = cursor;
  const end = sliceLen > 0 ? start + sliceLen - 1 : start;
  startFrames.push(start);
  endFrames.push(end);
  cursor += sliceLen;
}
```

**Rationale:**
- Slices are laid out sequentially in concatenated AIFF
- Unused slots (i >= slices.length) get zero-length markers (start == end)
- Prevents overlap or gaps in slice boundaries

### Frame Scaling

```typescript
// OP-Z format: scaled_frame = frame_index * 4096
const OP1_SCALE = 4096;
const MAX_POSITION = 0x7ffffffe; // INT32_MAX - 1

function encodePositions(frames: number[]): number[] {
  return frames.map((frame) => {
    const scaled = Math.max(0, Math.round(frame * OP1_SCALE));
    return Math.min(MAX_POSITION, scaled);
  });
}
```

**Rationale:**
- Legacy OP-1 format uses fixed-point representation
- Scaling by 4096 allows sub-frame precision
- Clamping prevents INT32 overflow

### Normalization Filter Chain

```typescript
function buildNormalizationFilter(mode: NormalizeMode): string {
  if (mode === 'peak') {
    return 'acompressor=threshold=-18dB:ratio=2:attack=5:release=50,alimiter=limit=-1dB';
  }
  if (mode === 'off') {
    return 'alimiter=limit=-1dB';
  }
  // default loudnorm
  return 'loudnorm=I=-14:TP=-1.2:LRA=11:linear=true:dual_mono=true,alimiter=limit=-1.2dB';
}
```

**Rationale:**
- `loudnorm`: EBU R128 loudness normalization (LUFS-based)
- `alimiter`: Safety limiter to prevent clipping
- `acompressor`: Peak-based compression for `peak` mode
- `off` mode still applies limiter to avoid clipping

## Performance Considerations

### ffmpeg.wasm Loading
- **Strategy**: Lazy load on first export
- **Singleton**: Reuse instance across exports
- **Size**: ~30 MB (core + wasm)
- **Load time**: 2–5 seconds on first export

### Duration Probing
- **Method**: Web Audio API (fast, native)
- **Parallelization**: All files probed concurrently
- **Fallback**: Returns 0 on decode failure (non-blocking)

### Waveform Rendering
- **Method**: Canvas 2D API
- **Downsampling**: Bucket averaging (e.g., 48 buckets for 48px width)
- **Async**: Runs in useEffect, cancellable
- **Cleanup**: AudioContext closed after decode

### Memory Management
- **File objects**: Held in React state (no copies)
- **Blob URLs**: Created for playback, revoked on stop
- **ffmpeg virtual FS**: Temp files deleted after export
- **AudioContext**: Closed after duration probe/waveform render

## Validation Strategy

### Pre-Export Validation
- Max 24 slices
- Total duration ≤ 12s
- All slices status === 'ready'
- No processing in progress

### Runtime Validation
- File decode errors → status='error'
- ffmpeg errors → export error alert
- AIFF parse errors → export error alert

### User Feedback
- Real-time duration display: `current / max`
- Slice count: `count / 24`
- Over-duration warning: red text + alert banner
- Export button disabled until valid

## Future: Electron Integration

### Planned Changes
- **File System Access**: Direct writes to mounted OP-Z (`sample packs/<track>/<slot>/`)
- **Settings Persistence**: Remember last paths, normalization mode, etc.
- **Drag-to-Desktop**: Export slot files for backup
- **Native Dialogs**: Replace browser file picker with native dialogs

### Shared Code
- Core audio modules (no changes needed)
- React UI (minimal changes: FS API calls)
- Theme and components (no changes)

### Electron-Specific Modules
- `electron/main.ts`: Main process, IPC handlers
- `electron/preload.ts`: Secure IPC bridge
- `electron/fs.ts`: File system operations (read/write/list)

## Testing Strategy

### Unit Tests (Planned)
- `audio/aiff.ts`: parseAiff, encodePositions, injectDrumMetadata
- `audio/metadata.ts`: probeDuration (mock AudioContext)
- `hooks/useSlices.ts`: addFiles, removeSlice, validation

### Integration Tests (Planned)
- Full export flow: files → AIFF → metadata injection
- Golden samples: known inputs → expected outputs (bit-identical)

### Manual QA Checklist
- [ ] Import 24 slices, export, load on OP-Z
- [ ] Import <24 slices, verify unused slots padded
- [ ] Over-duration rejection (>12s)
- [ ] Normalization modes (loudnorm, peak, off)
- [ ] Silence trimming on/off
- [ ] Per-slice controls (volume, pitch, reverse)
- [ ] Playback preview
- [ ] Error handling (bad file, decode failure)

## Dependencies

### Production
- `react`, `react-dom`: UI framework
- `react-router-dom`: Client-side routing
- `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`: Component library
- `@ffmpeg/ffmpeg`: Audio processing (WebAssembly)

### Development
- `vite`: Build tool
- `typescript`: Type checking
- `@vitejs/plugin-react`: React support for Vite

### Rationale
- **Minimal dependencies**: Easier maintenance, smaller bundle
- **No state library**: React hooks sufficient for current scope
- **Client-side routing**: React Router for multi-tool navigation
- **No backend**: Client-side only

## Build Output

### Development
- `bun dev` or `npm run dev`
- Vite dev server on http://localhost:5173
- Hot module replacement (HMR)
- Source maps enabled

### Production
- `bun run build` or `npm run build`
- Output: `dist/` folder
- Minified JS/CSS
- Code splitting (React, MUI, ffmpeg.wasm)
- Estimated bundle size: ~500 KB (excluding ffmpeg.wasm)

### Deployment
- Static hosting (Netlify, Vercel, GitHub Pages)
- No server-side rendering (SSR) required
- No environment variables (all client-side)

## Security Considerations

### Client-Side Only
- No network calls (except CDN for ffmpeg.wasm)
- No user data sent to server
- No cookies or tracking

### File Handling
- Files read via File API (user-initiated)
- No file system access (browser sandbox)
- Blob URLs scoped to session

### Future: Electron
- File system access limited to OP-Z mount point
- No arbitrary file writes
- User confirmation for overwrites

## Accessibility

### MUI Defaults
- ARIA labels on interactive elements
- Keyboard navigation (Tab, Enter, Space)
- Focus indicators
- Screen reader support

### Custom Components
- Waveform canvas: decorative (aria-hidden)
- File input: hidden, triggered by accessible button
- Drag-drop: keyboard alternative (file picker button)

### Future Improvements
- High contrast mode
- Reduced motion support
- Keyboard shortcuts (e.g., Cmd+O for file picker)

---

**Document Version:** 1.0  
**Last Updated:** 2025
