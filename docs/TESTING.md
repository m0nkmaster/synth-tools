# Testing Strategy

## Philosophy

Tests focus on **pure functions** and **business logic**, avoiding low-level integration dependencies like ffmpeg.wasm, Web Audio API, and DOM manipulation.

## What We Test

### ✅ Pure Functions
- Array utilities (pad, clamp)
- Audio calculations (freq→MIDI, note names)
- DSP algorithms (normalize, RMS, trim)
- OP-Z encoding (position scaling, boundaries)
- Metadata management (defaults, updates)
- Naming logic (sample classification → filename)

### ✅ Data Transformations
- AIFF parsing (structure validation)
- Slice boundary calculations
- Metadata array operations

## What We Don't Test

### ❌ External Dependencies
- ffmpeg.wasm operations (transcoding, filtering)
- Web Audio API (decoding, playback)
- Browser APIs (File, Blob, AudioContext)
- React component rendering
- MUI component integration

### ❌ Side Effects
- File I/O operations
- Network requests
- Audio playback
- Canvas rendering

## Running Tests

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# UI mode
bun test:ui

# Coverage
bun test --coverage
```

## Test Structure

```
src/
├── utils/
│   ├── array.ts
│   ├── array.test.ts      ← Unit tests
│   ├── audio.ts
│   ├── audio.test.ts
│   └── ...
└── audio/
    ├── aiff.ts
    └── aiff.test.ts       ← Parsing tests only
```

## Adding Tests

1. Extract pure functions to `src/utils/`
2. Create corresponding `.test.ts` file
3. Test edge cases, boundaries, and happy paths
4. Avoid mocking external APIs

## Benefits

- **Fast**: No browser/audio dependencies
- **Reliable**: Pure functions are deterministic
- **Maintainable**: Tests document behavior
- **Refactor-safe**: Catch regressions early
