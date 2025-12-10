# OP Done Developer Documentation

Technical documentation for developers working on the OP Done codebase.

## Purpose

OP Done is a browser-based tool for electronic music producers to create custom drum sample packs for the Teenage Engineering OP-Z synthesizer. It converts audio files into OP-Z-compatible AIFF format with proper metadata, enables AI-powered sound synthesis, and provides sample analysis tools.

## Documentation Structure

- **[Core Concepts](./core-concepts.md)** - OP-Z format, AIFF structure, metadata encoding
- **[Architecture](./architecture.md)** - System design, data flow, module organization
- **[Audio Pipeline](./audio-pipeline.md)** - Processing chain, FFmpeg integration, format conversion
- **[Classification System](./classification.md)** - Audio analysis, pitch detection, drum classification
- **[Synthesis Engine](./synthesis.md)** - AI-powered sound generation, Web Audio synthesis
- **[State Management](./state-management.md)** - React hooks, slice lifecycle, UI state
- **[Testing Guide](./testing.md)** - Unit tests, integration tests, test patterns
- **[Contributing](./contributing.md)** - Code style, PR process, development workflow

## Quick Start

```bash
# Install dependencies
bun install

# Run dev server
bun dev

# Run tests
bun test

# Lint code
bun run lint
bun run lint:fix
```

## Tech Stack

- **Runtime**: Bun (never npm/npx)
- **UI**: Vite + React 18 + TypeScript + MUI
- **Audio**: ffmpeg.wasm, Web Audio API
- **AI**: OpenAI GPT-5.1, Google Gemini 3 Pro
- **Testing**: Vitest
- **Linting**: ESLint 9

## Key Features

### 1. Drum Kit Creator
Converts up to 24 audio files into OP-Z drum packs with:
- Automatic format conversion (mono, 16-bit, 44.1kHz AIFF)
- Silence trimming
- Per-slice volume/pitch/reverse controls
- Audio classification (kick, snare, hat, etc.)
- Pitch detection for melodic samples
- Real-time duration validation

### 2. Sample Analyzer
Inspects existing OP-Z packs:
- Waveform visualization
- Metadata extraction
- Slice boundary display
- Interactive playback

### 3. Sound Creation (Experimental)
AI-powered synthesis:
- Text-to-sound generation
- Multi-provider support (OpenAI, Gemini)
- Web Audio synthesis engine
- Layered synthesis architecture
- Export to WAV

## Core Principles

### Pure Functions
Audio processing modules (`src/audio/`) are pure TypeScript functions with no React dependencies. This enables:
- Deterministic output
- Easy testing
- Future Electron integration
- Framework portability

### Client-Side Only
All processing happens in the browser:
- No backend required
- No network calls (except AI features)
- Privacy-preserving
- Works offline (except Sound Creation)

### Minimal Dependencies
Only essential packages:
- React ecosystem (react, react-dom, react-router-dom)
- MUI for UI components
- ffmpeg.wasm for audio processing
- AI SDKs for sound generation

### Type Safety
Strict TypeScript throughout:
- No `any` types
- Explicit interfaces for all data structures
- Type-safe audio processing pipeline

## Project Structure

```
src/
├── audio/              # Core audio processing (pure TS)
│   ├── aiff.ts        # AIFF parsing/encoding
│   ├── pack.ts        # Pack building orchestration
│   ├── ffmpeg.ts      # FFmpeg integration
│   ├── convert.ts     # Format conversion
│   ├── metadata.ts    # Duration probing
│   ├── classify.ts    # Audio classification
│   ├── pitch.ts       # Pitch detection
│   └── synthesizer.ts # Sound synthesis engine
├── components/         # React UI components
├── hooks/             # React hooks (state management)
├── pages/             # Route pages
├── services/          # External services (AI)
├── utils/             # Utility functions
├── types/             # TypeScript types
├── config.ts          # Centralized configuration
└── constants.ts       # Exported constants

docs/                  # User documentation
developer-docs/        # This documentation
wip-docs/             # Work-in-progress docs
```

## Development Workflow

### Before Work
```bash
bun run lint
bun test
```

### After Work
```bash
bun run lint:fix
bun test
```

### New Feature
1. Create `docs/features/<name>.md`
2. Implement minimal code
3. Add tests if core logic
4. Update `docs/ARCHITECTURE.md` if needed

## Key Constraints

### OP-Z Format
- AIFF: mono, 16-bit, 44.1kHz
- Max duration: 12 seconds
- Max slices: 24
- Metadata: APPL chunk with OP-1/OP-Z drum JSON

### Performance
- ffmpeg.wasm: ~30MB, 2-5s load time
- Duration probing: Web Audio API (fast)
- Waveform rendering: Canvas 2D (async)
- Memory: Files held in state, no copies

### Browser Compatibility
- Modern browsers with Web Audio API
- WebAssembly support required
- File API for drag-drop
- No IE11 support

## Common Tasks

### Adding a New Audio Feature
1. Implement pure function in `src/audio/`
2. Add unit tests in `src/audio/__tests__/`
3. Integrate into pipeline (`pack.ts` or `ffmpeg.ts`)
4. Update UI in relevant page component
5. Document in `docs/features/`

### Modifying OP-Z Metadata
1. Update types in `src/types.ts` (`DrumMetadata`)
2. Modify encoding in `src/audio/aiff.ts` (`buildDrumMetadataChunk`)
3. Update defaults in `src/constants.ts` (`OPZ_DEFAULTS`)
4. Test with real OP-Z device

### Adding AI Provider
1. Implement generator in `src/services/ai.ts`
2. Add provider type to `AIProvider` union
3. Update UI selector in `SoundCreation.tsx`
4. Add API key to `.env.example`
5. Document in `docs/features/`

## Debugging

### FFmpeg Issues
- Check browser console for ffmpeg.wasm logs
- Verify filter chain syntax
- Test with minimal input files
- Check virtual FS cleanup

### AIFF Parsing Errors
- Validate chunk structure (FORM, COMM, SSND)
- Check byte order (big-endian)
- Verify frame count calculation
- Test with known-good AIFF files

### Classification Accuracy
- Check spectral analysis parameters
- Adjust thresholds in `src/config.ts`
- Test with diverse sample library
- Review confidence scores

### Synthesis Issues
- Validate SoundConfig schema
- Check envelope timing (attack + decay + release ≤ duration)
- Verify frequency ranges (20-20000 Hz)
- Test with minimal config

## Resources

- [OP-Z Format Spec](../wip-docs/guides/opz-drum-format.md)
- [teoperator (reference implementation)](https://github.com/schollz/teoperator)
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

## Support

For questions or issues:
1. Check existing documentation
2. Review test files for examples
3. Examine similar features in codebase
4. Create issue with minimal reproduction

---

**Last Updated**: 2025  
**Maintainers**: OP Done Team
