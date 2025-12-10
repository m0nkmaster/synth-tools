# Implementation Approach

Scope for first deliverable:
1) Upload a collection of audio files and distribute into a 12-second drum clip.  
2) Export a single OP-Z-compatible AIFF file.

## Tech stack
- Web app: Vite + React + TypeScript.
- UI: MUI (with custom theme in `src/theme.ts`).
- Runtime: Bun (preferred) / Node for fallback.
- Audio tooling: ffmpeg.wasm (client-side; no network), Web Audio API for quick metadata/duration reads.

## High-level flow
1) User drops/selects files (wav/aiff/mp3/m4a/flac).
2) Pre-validate (count ≤ 24, readable, estimated total length).
3) Per-file prep:
   - Decode duration (Web Audio or ffmpeg probe).
   - Convert to mono 44.1 kHz 16-bit PCM.
   - Apply normalization (default loudnorm + limiter; alt peak + limiter).
   - For synth tracks transpose to 'A'.
   - Trim leading and end silence (optional; -35 dB default).
4) Pack assembly:
   - Order slices (UI drag/drop).
   - Concatenate and trim/fit to 12s cap (warn if over; allow auto-trim).
   - Set Playmode/Notestyle (see note 1). Default to playing all
   - Write AIFF with OP-Z/OP-1 drum format expectations.
5) Export:
   - Browser: download `.aif`.
   - Electron (later): write directly to selected slot folder.

## Modules to build
- `audio/ffmpeg.ts`: lazy-load and wrap ffmpeg.wasm; expose helpers `ensureReady`, `transcodeToAiff`, `concatSlices`.
- `audio/metadata.ts`: quick duration/format probe (Web Audio); fallback to ffmpeg if needed.
- `audio/pack.ts`: assemble slices, enforce 12s cap, produce final AIFF blob.
- `state/slices.ts`: slice list, ordering, status, errors.
- `ui/*`: dropzone, slice list, processing settings, export bar.

## Processing details
- Target format: mono, 44.1 kHz, 16-bit PCM AIFF, metadata stripped.
- Normalization defaults (from legacy script):
  - Loudnorm: `loudnorm=I=-14:TP=-1.2:LRA=11:linear=true:dual_mono=true` + `alimiter=limit=-1.2dB`.
  - Peak mode: `acompressor=threshold=-18dB:ratio=2:attack=5:release=50` + `alimiter=limit=-1dB`.
- Silence trim: `silenceremove=start_periods=1:start_duration=0:start_threshold=-35dB` (toggleable).
- Duration cap: enforce total ≤ 12s; if over, prompt to trim tail or remove slices.
- Max slices: 24; hard stop with clear error if exceeded.

## UI behaviors
- Dropzone + “Select files” button; show accepted formats and count.
- Slice cards: name, duration, status chip, delete, preview (stub for now), drag handle.
- Settings: normalize mode select, silence threshold, max duration (read-only 12s), filename.
- Export button disabled until at least one ready slice; progress bar during export; error banner with retry.

## Data handling
- Keep files in memory (not persisted). On refresh, state resets.
- Avoid network access; ffmpeg.wasm loads from local bundle.
- Consider Web Worker for ffmpeg to keep UI responsive; communicate via messages.

## Success criteria for first feature
- Can load multiple audio files, see them listed with durations.
- Export produces a single `.aif` that respects mono/44.1k/16-bit and ≤12s total.
- Clear errors for unsupported files, over-limit duration, or >24 slices.
- Download flow works in browser (Electron slot write is out of scope for this iteration).

## Status (phase 1)
- UI scaffolding in `src/App.tsx` with drag/drop, settings, validation, and export CTA.
- Slice ingestion using Web Audio duration probe; limits to 24 slices; warns on >12s total.
- ffmpeg.wasm wrapper (`src/audio/ffmpeg.ts`) concatenates inputs, normalizes, trims silence, enforces 12s, and emits AIFF.
- Pack writer (`src/audio/aiff.ts`, `src/audio/pack.ts`) injects OP-1/OP-Z drum metadata via an `APPL` chunk (start/end per slice, scaled by 4096 like teoperator/op-1 format) so slicing follows the provided order instead of equal splits.
- Export flow downloads `opz-drum-pack.aif` in browser. Slot writing is deferred to Electron.

## Next steps
1) Move ffmpeg work into a Web Worker to avoid main-thread blocking; add progress hooks.
2) Add per-slice preview and waveform hints; enable drag/drop reordering with a11y focus.
3) Add unit/CLI tests for duration enforcement and filter strings; add manual QA checklist (OP-Z import, no `rejected/`).


## Notes

1. Note behavior:

[arrow]
retrig = will use note length
gate = will use note length
loop = will loop according to the hold setting on the envelope

[arrow with line] (default when sampling into drum sampler)
retrig = will use envelope
gate = will use note length
loop = will loop according to the hold setting on the envelope

[loop]
retrig = will use note length and loop according to the hold setting on envelope
gate = will use note length and envelope
loop = will use note length and loop according to the hold setting on envelope

2. Sample OP-Z compabible files

See [Sample Files](./sample-files) for an example of a compatible OP-Z drum and synth audio file.

Note that synth tracks should be in 'A' on the 5th Octave so the OP-Z transposes the audio correctly.
