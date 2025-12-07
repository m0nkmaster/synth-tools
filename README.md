# OP Done

Browser-based drum sample pack builder for Teenage Engineering OP-Z. Converts audio files into OP-Z-compatible AIFF drum packs with proper slice metadata.

## Features

### 🥁 Drum Kit Creator
- **24-slice drum packs**: Import up to 24 audio files (WAV, AIFF, MP3, M4A, FLAC)
- **Automatic conversion**: Mono, 16-bit, 44.1 kHz AIFF with OP-Z drum metadata
- **Silence trimming**: Configurable leading-silence removal (-35 dB default)
- **Duration enforcement**: 12-second pack limit with real-time validation
- **Per-slice controls**: Volume, pitch, reverse, and playback preview
- **Waveform preview**: Visual feedback for each slice
- **Audio classification**: Automatic detection of kicks, snares, hats, etc.
- **Pitch detection**: Automatic pitch detection for melodic samples

### 🔍 Sample Analyzer
- **Inspect existing packs**: Load and analyze OP-Z drum packs
- **Visual waveform**: See slice boundaries and structure
- **Metadata viewer**: Examine pack settings and slice parameters
- **Interactive playback**: Click slices to preview

### 🎹 Sound Creation (Experimental)
- **AI-powered synthesis**: Generate sound from text descriptions
- **Multiple AI providers**: Choose between OpenAI or Google Gemini
- **Web Audio synthesis**: Real-time audio generation in browser
- **Customizable parameters**: Full control over synthesis engine
- **Export to WAV**: Download generated sounds

## Quick Start

**Using npm:**
```bash
npm install
npm run dev
```

Open http://localhost:5173

## Usage

### Drum Kit Creator

1. **Add slices**: Drag/drop or select up to 24 audio files
2. **Configure**: Adjust silence threshold if needed
3. **Customize**: Set per-slice volume, pitch, reverse; edit pack name/octave
4. **Export**: Download `.aif` file when total duration ≤ 12s

### Sample Analyzer

1. **Load pack**: Select an existing OP-Z `.aif` file
2. **Inspect**: View waveform, metadata, and slice boundaries
3. **Play**: Click on slice regions to preview

### Sound Creation

1. **Select provider**: Choose OpenAI or Gemini
2. **Describe**: Enter text description (e.g., "Deep 808 kick", "Warm analog pad", "Metallic pluck")
3. **Generate**: AI creates synthesis parameters
4. **Preview**: Listen to generated sound
5. **Download**: Export as WAV file

**Note:** Requires API key in `.env`:
- OpenAI: `VITE_OPENAI_KEY`
- Gemini: `VITE_GEMINI_KEY`

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

**See [User Guide](docs/USER_GUIDE.md) for detailed instructions.**

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** - Complete usage instructions
- **[Architecture](docs/ARCHITECTURE.md)** - Technical architecture
- **[OP-Z Format](docs/guides/opz-drum-format.md)** - Format specification
- **[Audit](docs/AUDIT.md)** - Codebase audit and cleanup plan

## Build

```bash
npm run build      # Production build
npm run preview    # Preview production build
npm test           # Run tests
npm run test:ui    # Run tests with UI
npm run lint       # Check code quality
npm run lint:fix   # Auto-fix linting issues
```

## Tech Stack

- **UI**: Vite + React + TypeScript + MUI
- **Audio**: ffmpeg.wasm (client-side processing)
- **Format**: Custom AIFF encoder with OP-Z drum metadata injection
- **Testing**: Vitest with pure function unit tests

## Features in Detail

### Audio Classification
Automatically detects sample type:
- **Drum hits**: Kicks, snares, hats, cymbals, percussion
- **Melodic**: Pitched instruments with note detection
- **Unknown**: Ambiguous samples

Results used for:
- Auto-prefixing filenames
- Optimizing processing
- Pitch detection for melodic samples

### Pitch Detection
- Autocorrelation-based algorithm
- Detects fundamental frequency
- Converts to note name (e.g., "C4")
- Displays in pitch control modal
- Works best with clean, monophonic samples

### Per-Slice Controls
- **Volume**: 0-16383 (8192 = unity)
- **Pitch**: ±12 semitones in 0.1 increments
- **Reverse**: Playback direction (future)
- **Playmode**: Mono/poly/legato (future)

## Notes

- Processing is fully local; no network calls (except Sound Creation)
- Electron packaging planned for direct FS writes to mounted OP-Z
- All features work offline except Sound Creation

## Troubleshooting

**"Over 12s cap" warning:**
- Remove slices or trim files before import
- Increase silence threshold to trim more

**Export button disabled:**
- Check total duration ≤ 12s
- Ensure all slices are "Ready" status
- Wait for processing to complete

**Playback not working:**
- Click page first (browser security)
- Check audio permissions

**See [User Guide](docs/USER_GUIDE.md#troubleshooting) for more help.**

## Contributing

See [Development Guide](docs/DEVELOPMENT.md) (coming soon) for setup and contribution guidelines.

## License

MIT

## Credits

- Format specification based on [teoperator](https://github.com/schollz/teoperator)
- Inspired by OP-1 Drum Utility
- Built for the OP-Z community
