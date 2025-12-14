# OP Done

Browser-based toolkit for Teenage Engineering OP-Z. Create drum packs, synthesize sounds, and manage samples—all client-side.

## Features

### 🥁 Drum Kit Creator
Build OP-Z drum packs from your own samples.
- Import up to 24 audio files (WAV, AIFF, MP3, M4A, FLAC)
- Auto-converts to OP-Z format (mono, 16-bit, 44.1kHz AIFF)
- Automatic sample classification (kick, snare, hat, cymbal)
- Pitch detection for melodic samples
- Per-slice volume, pitch, and preview controls
- Real-time duration validation (11.8s max)
- Waveform visualization

### 🔬 Sample Analyzer
Inspect existing OP-Z drum packs.
- Parse and display metadata
- Visualize waveform with slice boundaries
- Audition individual slices
- View all parameters (volume, pitch, playmode, reverse)

### 🎹 Synthesizer
Full-featured Web Audio synth with AI integration.
- Layered synthesis: oscillators, noise, FM, Karplus-Strong
- Per-layer filters and saturation
- ADSR envelopes with curve control
- LFO modulation (pitch, filter, amplitude, pan)
- Effects: reverb, delay, distortion, compressor, gate
- JSON editor for direct config editing
- MIDI input support for live playing
- AI sound generation (OpenAI/Gemini)
- Export to WAV

### 🤖 AI Kit Generator
Generate complete drum kits from text prompts.
- Describe your kit style (e.g., "vintage 808", "industrial", "lo-fi")
- AI plans 24 unique sounds
- Synthesizes and exports as ready-to-use OP-Z pack
- Supports OpenAI and Google Gemini

### 💾 USB Browser
Direct OP-Z file management (Chromium browsers only).
- Browse sample pack slots
- Upload packs directly to device
- Delete and replace existing packs
- Uses File System Access API

## Quick Start

```bash
bun install
bun dev
```

Open http://localhost:5173

## OP-Z Installation

1. Export your pack from Drum Kit Creator or AI Kit Generator
2. Connect OP-Z in content mode
3. Copy `.aif` file to `sample packs/<track>/<slot>/`
   - Tracks: `1-kick`, `2-snare`, `3-perc`, `4-sample`
   - Slots: `01` through `10`
4. Eject and reboot OP-Z

## AI Setup

For AI features (Synthesizer and AI Kit Generator), add API keys to `.env`:

```
VITE_OPENAI_KEY=sk-...
VITE_GEMINI_KEY=...
```

## Commands

```bash
bun install       # Install dependencies
bun dev           # Dev server (localhost:5173)
bun run build     # Production build
bun test          # Run tests
bun run lint      # Check linting
bun run lint:fix  # Auto-fix lint issues
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| UI | Vite + React + TypeScript + MUI |
| Audio | ffmpeg.wasm + Web Audio API |
| Testing | Vitest |
| Linting | ESLint 9 |

## Documentation

- **[User Guide](user-guide/user-guide.md)** — How to use each feature
- **[Developer Docs](developer-docs/README.md)** — Architecture and internals

## Privacy

- All audio processing runs locally in your browser
- No files uploaded except AI text prompts (when using AI features)
- Works offline (except AI features)

## Related Tools

- **[TE Drum Utility](https://teenage.engineering/apps/drum-utility)** — Official Teenage Engineering web tool for creating drum packs. Great for testing compatibility.
- **[teoperator](https://github.com/schollz/teoperator)** — Command-line tool by [@schollz](https://github.com/schollz) for creating OP-1/OP-Z patches. Invaluable format research resource.

## License

MIT

## Credits

This project builds on the work of the OP-Z community:

- **Format specification** derived from reverse engineering by [schollz/teoperator](https://github.com/schollz/teoperator)
- **Compatibility testing** validated against [TE Drum Utility](https://teenage.engineering/apps/drum-utility)
- Built with ❤️ for the Teenage Engineering community
