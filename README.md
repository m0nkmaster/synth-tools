# OP Done

Browser-based drum sample pack builder for the Teenage Engineering OP-Z. Converts audio files into OP-Z-compatible AIFF drum packs with proper slice metadata.

## Features

### Drum Kit Creator
- Import up to 24 audio files (WAV, AIFF, MP3, M4A, FLAC)
- Automatic conversion to mono, 16-bit, 44.1kHz AIFF
- Audio classification (kick, snare, hat, cymbal, melodic)
- Pitch detection for melodic samples
- Per-slice volume, pitch, and playback controls
- Real-time duration validation (12s max)
- Waveform preview for each slice

### Sample Analyzer
- Load and inspect existing OP-Z drum packs
- Visualize waveform with slice boundaries
- View metadata and slice parameters
- Click to audition individual slices

### AI Sound Creation
- Generate sounds from text descriptions
- Supports OpenAI and Google Gemini
- Web Audio synthesis engine
- Export to WAV

## Quick Start

```bash
bun install
bun dev
```

Open http://localhost:5173

## Usage

### Create a Drum Pack

1. Go to **Drum Kit Creator**
2. Drag audio files onto the drop zone (up to 24)
3. Adjust per-slice volume and pitch as needed
4. Set pack name and metadata
5. Click **Export** to download the `.aif` file

### Install on OP-Z

1. Connect OP-Z in content mode
2. Copy the `.aif` to `sample packs/<track>/<slot>/`
3. Eject and reboot the OP-Z
4. Check `import.log` if issues occur

### AI Sound Creation

1. Select provider (OpenAI or Gemini)
2. Enter your API key
3. Describe the sound you want
4. Generate, preview, and export

Requires API key in `.env`:
- OpenAI: `VITE_OPENAI_KEY`
- Gemini: `VITE_GEMINI_KEY`

## OP-Z Format

| Constraint | Value |
|------------|-------|
| Container | AIFF-C (mono, 16-bit, 44.1kHz) |
| Max duration | 12 seconds |
| Max slices | 24 |
| Metadata | APPL chunk with `op-1` JSON |
| Position encoding | Frame × 4096 |

## Commands

```bash
bun install       # Install dependencies
bun dev           # Start dev server
bun run build     # Production build
bun test          # Run tests
bun run lint      # Check linting
bun run lint:fix  # Auto-fix lint issues
```

## Tech Stack

- **Runtime**: Bun
- **UI**: Vite + React + TypeScript + MUI
- **Audio**: ffmpeg.wasm (client-side processing)
- **Testing**: Vitest

## Documentation

- **[User Guide](user-guide/user-guide.md)** — Complete usage instructions
- **[Developer Docs](developer-docs/README.md)** — Technical documentation
  - [Architecture](developer-docs/architecture.md)
  - [Format Spec](developer-docs/format-spec.md)
  - [Audio Processing](developer-docs/audio-processing.md)
  - [Contributing](developer-docs/contributing.md)

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Export disabled | Check duration ≤ 12s, all slices ready |
| Silent playback | Click page first to unlock audio |
| Slices ignored on OP-Z | Keep per-slice < 4s, re-export |
| AI fails | Verify API key, check network |

See [User Guide](user-guide/user-guide.md#troubleshooting) for more help.

## Privacy

- All audio processing runs locally in your browser
- No files are uploaded (except AI prompts to your chosen provider)
- Works offline (except AI features)

## License

MIT

## Credits

- Format specification based on [teoperator](https://github.com/schollz/teoperator)
- Built for the OP-Z community
