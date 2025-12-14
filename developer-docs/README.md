# OP Done Developer Documentation

Technical documentation for developers working on the OP Done codebase.

## What Is OP Done?

A browser-based tool for creating OP-Z drum sample packs. Converts audio files to OP-Z compatible AIFF format with proper metadata. Also includes AI-powered sound synthesis and sample analysis features.

**Stack:** Vite + React + TypeScript + MUI + ffmpeg.wasm  
**Runtime:** Bun (never npm/npx)

## Documentation Index

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System design, modules, data flow |
| [Format Spec](./format-spec.md) | OP-Z AIFF format specification |
| [Audio Processing](./audio-processing.md) | FFmpeg pipeline, classification, synthesis |
| [Contributing](./contributing.md) | Development workflow, testing, code style |

## Quick Start

```bash
# Install dependencies
bun install

# Run dev server
bun dev

# Run tests
bun test

# Check linting
bun run lint
```

## Project Structure

```
src/
├── audio/          # Core audio processing (pure TypeScript)
│   ├── aiff.ts     # AIFF parsing and encoding
│   ├── pack.ts     # Pack building orchestration
│   ├── ffmpeg.ts   # FFmpeg.wasm integration
│   ├── classify.ts # Audio classification
│   ├── pitch.ts    # Pitch detection
│   └── synthesizer.ts # Sound synthesis engine
├── components/     # React UI components
├── hooks/          # React hooks (state management)
├── pages/          # Route pages
├── services/       # External services (AI)
├── utils/          # Utility functions
├── types/          # TypeScript types
├── config.ts       # Configuration constants
└── constants.ts    # Re-exported constants

user-guide/         # User documentation
developer-docs/     # This documentation
```

## Key Features

### Drum Kit Creator
- Upload audio files (WAV, AIFF, MP3, M4A, FLAC)
- Automatic format conversion (mono, 16-bit, 44.1kHz)
- Audio classification (kick, snare, hat, etc.)
- Pitch detection for melodic samples
- Per-slice volume and pitch controls
- Export OP-Z compatible AIFF with metadata

### Sample Analyzer
- Parse existing OP-Z packs
- Visualize waveform with slice boundaries
- Display metadata and slice parameters
- Audition individual slices

### AI Sound Creation
- Text-to-sound generation via OpenAI or Gemini
- Layered Web Audio synthesis
- Iterative refinement
- WAV export

## Core Principles

### Pure Functions
Audio processing modules (`src/audio/`) are pure TypeScript functions with no React dependencies. This enables deterministic output, easy testing, and future framework portability.

### Client-Side Only
All processing happens in the browser. No file uploads, no backend required (except for AI features which call external APIs).

### Type Safety
Strict TypeScript throughout. No `any` types. Explicit interfaces for all data structures.

### Minimal Dependencies
Only essential packages. New dependencies require justification.

## Constraints

| Constraint | Value |
|------------|-------|
| Audio format | Mono, 16-bit, 44.1kHz AIFF |
| Max duration | ~12 seconds |
| Max slices | 24 |
| Position encoding | Frame × 4096 |
| Metadata chunk | APPL with `op-1` signature |

## Commands

```bash
bun install       # Install dependencies
bun dev           # Start dev server (localhost:5173)
bun run build     # Production build
bun test          # Run all tests
bun test --watch  # Watch mode
bun run lint      # Check linting
bun run lint:fix  # Auto-fix lint issues
```

## Development Workflow

### Before Starting
```bash
git pull origin main
bun run lint
bun test
```

### After Changes
```bash
bun run lint:fix
bun test
bun run build
```

## Resources

- [TE Drum Utility](https://teenage.engineering/apps/drum-utility) — Official tool for testing packs
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html) — Filter chain reference
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — Synthesis reference
