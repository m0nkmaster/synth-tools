# Developer Documentation

Technical documentation for OP Done development.

## Project Overview

OP Done is a browser-based toolkit for Teenage Engineering OP-Z:
- **Drum Kit Creator** — Build packs from audio samples
- **Sample Analyzer** — Inspect existing packs
- **Synthesizer** — Full-featured synth with MIDI and AI
- **AI Kit Generator** — Generate complete kits from text
- **USB Browser** — Direct OP-Z file management

All processing runs client-side using ffmpeg.wasm and Web Audio API.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System design, modules, data flow |
| [Format Spec](./format-spec.md) | OP-Z AIFF format details |
| [Audio Processing](./audio-processing.md) | FFmpeg, classification, synthesis |
| [Contributing](./contributing.md) | Dev workflow, testing, code style |

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Bun |
| UI | Vite + React 18 + TypeScript + MUI |
| Audio | ffmpeg.wasm + Web Audio API |
| AI | OpenAI GPT / Google Gemini |
| Testing | Vitest |
| Linting | ESLint 9 |

## Quick Start

```bash
bun install
bun dev           # localhost:5173
bun test
bun run lint
```

## Project Structure

```
src/
├── audio/              # Core audio (pure TypeScript)
│   ├── aiff.ts         # AIFF parsing/encoding
│   ├── pack.ts         # Pack building
│   ├── ffmpeg.ts       # FFmpeg.wasm wrapper
│   ├── classify.ts     # Audio classification
│   ├── pitch.ts        # Pitch detection
│   ├── synthesizer.ts  # Offline synthesis
│   └── realtimeSynth.ts # Live MIDI synthesis
├── components/         # React components
├── hooks/              # React hooks
│   ├── useSlices.ts    # Slice state management
│   ├── useMidi.ts      # Web MIDI integration
│   └── useNodeGraph.ts # Visual synth state
├── pages/              # Route pages
│   ├── DrumCreator.tsx
│   ├── SampleAnalyzer.tsx
│   ├── SynthesizerUI.tsx
│   ├── AIKitGenerator.tsx
│   ├── USBBrowser.tsx
│   └── VisualNodeSynth.tsx
├── services/           # External APIs
│   └── ai.ts           # OpenAI/Gemini integration
├── types/              # TypeScript types
│   ├── types.ts        # Core types
│   └── soundConfig.ts  # Synthesis config
├── utils/              # Utilities
├── config.ts           # Configuration constants
└── constants.ts        # Re-exported constants
```

## Routes

| Path | Page | Description |
|------|------|-------------|
| `/drum-creator` | DrumCreator | Build packs from samples |
| `/sample-analyzer` | SampleAnalyzer | Inspect OP-Z packs |
| `/synthesizer` | SynthesizerUI | Full synth with MIDI/AI |
| `/ai-kit-generator` | AIKitGenerator | AI-powered kit creation |
| `/usb-browser` | USBBrowser | Direct device management |
| `/visual-node-synth` | VisualNodeSynth | Experimental node editor |

## Key Configuration

From `src/config.ts`:

```typescript
OPZ: {
  MAX_SLICES: 24,
  MAX_DURATION_SECONDS: 11.8,
  MAX_SLICE_DURATION_SECONDS: 4,
  SLICE_GAP_SECONDS: 0,
  POSITION_SCALE: 4058,
  MAX_POSITION: 0x7ffffffe,
  DEFAULT_VOLUME: 8192,
  DEFAULT_PITCH: 0,
  DEFAULT_PLAYMODE: 12288,  // Play Out mode
  DEFAULT_REVERSE: 8192,
}
```

## Commands

```bash
bun install       # Install dependencies
bun dev           # Dev server
bun run build     # Production build
bun test          # Run tests
bun test --watch  # Watch mode
bun run lint      # Check linting
bun run lint:fix  # Auto-fix lint issues
```

## Core Principles

### Pure Audio Core
Audio modules (`src/audio/`) are pure TypeScript with no React dependencies. This enables:
- Deterministic output
- Easy testing
- Framework portability

### Client-Side Processing
All audio processing runs in browser:
- ffmpeg.wasm for format conversion
- Web Audio API for synthesis
- No server required

### Type Safety
Strict TypeScript throughout:
- No `any` types
- Explicit interfaces
- Validated configurations

## Resources

### Official

- [TE Drum Utility](https://teenage.engineering/apps/drum-utility) — Official web tool for compatibility testing
- [OP-Z User Guide](https://teenage.engineering/guides/op-z) — Official device documentation

### Community

- [teoperator](https://github.com/schollz/teoperator) — Format reverse engineering reference by @schollz
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html) — Audio filter documentation
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API) — Synthesis reference
- [Web MIDI API](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) — MIDI integration reference
