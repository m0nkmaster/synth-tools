# OP Done Agent

## What It Is

Browser-based OP-Z drum pack builder. Converts audio files to OP-Z AIFF format with metadata.

**Stack:** Vite + React + TypeScript + MUI + ffmpeg.wasm  
**Runtime:** Bun (never npm/npx)

## Rules

### Code
- Minimal code only
- Remove unnecessary code
- Pure functions in `src/audio/`
- Strict TypeScript

### Tests & Linting
- `bun test` must pass always
- `bun run lint` before commits
- `bun run lint:fix` to auto-fix

### Docs
- New features → `docs/features/<name>.md`
- Review existing docs before editing
- Renew, don't append
- Keep concise

## Workflow

**Before work:**
```bash
bun run lint
bun test
```

**After work:**
```bash
bun run lint:fix
bun test
```

**New feature:**
1. Create `docs/features/<name>.md`
2. Implement minimal code
3. Add tests if core logic
4. Update `docs/ARCHITECTURE.md` if needed

## Commands

```bash
bun install       # Install
bun dev           # Dev server
bun run build     # Build
bun test          # Tests
bun run lint      # Check lint
bun run lint:fix  # Fix lint
```

## Structure

```
src/audio/     # Core (pure TS)
src/components/ # React UI
src/utils/     # Utils + tests
docs/features/ # Feature specs
```

## Synthesizer

### Architecture
- **Layers**: Oscillator, Noise, FM, Karplus-Strong (up to 8)
- **Per-layer**: Filter, Envelope, Saturation, Pitch Envelope
- **Global**: Filter, LFO, Effects chain
- **Effects**: EQ → Distortion → Compressor → Chorus → Delay → Reverb → Gate

### Key Files
- `src/types/soundConfig.ts` - Zod schemas + AI prompts
- `src/audio/synthCore.ts` - Shared audio graph functions
- `src/audio/synthesizer.ts` - Offline rendering
- `src/audio/realtimeSynth.ts` - MIDI playback

### Adding Synth Features
1. Add bounds + schema in `soundConfig.ts`
2. Update `generateSchemaPrompt()` for AI
3. Add audio function in `synthCore.ts`
4. Wire into `synthesizer.ts` (static)
5. Wire into `realtimeSynth.ts` (MIDI)
6. Add UI controls in `SynthesizerUI.tsx`
7. Run `bun test` + `bun run lint:fix`

## Constraints

- AIFF: mono, 16-bit, 44.1kHz, ≤12s
- 24 slices max
- Client-side only
- No new dependencies without justification
