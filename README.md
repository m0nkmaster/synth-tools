# OP Done

Browser-based drum sample pack builder for Teenage Engineering OP-Z. Converts audio files into OP-Z-compatible AIFF drum packs with proper slice metadata.

## Features

- **24-slice drum packs**: Import up to 24 audio files (WAV, AIFF, MP3, M4A, FLAC)
- **Automatic conversion**: Mono, 16-bit, 44.1 kHz AIFF with OP-Z drum metadata
- **Normalization**: Loudness (LUFS), peak, or off with safety limiter
- **Silence trimming**: Configurable leading-silence removal (-35 dB default)
- **Duration enforcement**: 12-second pack limit with real-time validation
- **Per-slice controls**: Volume, pitch, reverse, and playback preview
- **Waveform preview**: Visual feedback for each slice
- **Browser-based**: Runs locally via ffmpeg.wasm—no server required

## Quick Start

**Using Bun (recommended):**
```bash
bun install
bun dev
```

**Using npm:**
```bash
npm install
npm run dev
```

Open http://localhost:5173

## Usage

1. **Add slices**: Drag/drop or select up to 24 audio files
2. **Configure**: Choose normalization mode, adjust silence threshold
3. **Customize**: Set per-slice volume, pitch, reverse; edit pack name/octave
4. **Export**: Download `.aif` file when total duration ≤ 12s

## OP-Z Drum Format

- **File**: AIFF, mono, 16-bit, 44.1 kHz, ≤ 12s total
- **Slices**: 24 slots with explicit start/end frame markers (scaled × 4096, clamped to `0x7ffffffe`)
- **Metadata**: `APPL` chunk with OP-1/OP-Z drum JSON (`drum_version` 2 or 3) inserted before `SSND`
  - `start`/`end`: 24-element arrays of slice boundaries
  - `playmode`, `reverse`, `volume`: default 8192 per slot
  - `pitch`: all zero; `dyna_env`, `fx_*`, `lfo_*` set to safe defaults
- **Compatibility**: Matches stock OP-Z packs and legacy `teoperator` tool

## Installation on OP-Z

1. Mount OP-Z in content mode
2. Navigate to `sample packs/` → track folder (1–4 for drums) → slot folder (01–10)
3. Copy exported `.aif` file into chosen slot folder (one file per slot)
4. Eject OP-Z; device will import on restart
5. Check `import.log` if issues occur

## Build

```bash
bun run build      # or npm run build
bun run preview    # or npm run preview
```

## Documentation

- Feature requirements: `docs/features/op-done.md`
- Format reference: `docs/guides/opz-drum-format.md`
- Sample files: `docs/sample-files/`

## Tech Stack

- **UI**: Vite + React + TypeScript + MUI
- **Audio**: ffmpeg.wasm (client-side processing)
- **Format**: Custom AIFF encoder with OP-Z drum metadata injection

## Notes

- Processing is fully local; no network calls
- Electron packaging planned for direct FS writes to mounted OP-Z
- Synth sample clipper (6s limit) is next on roadmap
