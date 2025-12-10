# OP Done — Feature Requirements

Utility app for preparing content for Teenage Engineering devices (starting with OP-Z). This doc tracks feature requirements and implementation status.

## References
- OP-Z import rules: `docs/guides/how_to_import.txt`
- DMX guide (context only): `docs/guides/how_to_dmx.txt`
- Legacy conversion script: `legacy-scripts/to-opz.sh` (ffmpeg pipeline and defaults)
- Legacy OP-1 Drum Utility app bundle: `legacy-scripts/OP-1 Drum Utility.app`
- TE Operator existing utility: `https://teoperator.com/patch?audioURL=https%3A%2F%2Fwww.instagram.com%2Fp%2FCAluNy9lswZ%2F&secondsStart=0&secondsEnd=30&synthPatch=drum`

## Delivery Approach
- **Web UI first** (runs locally in browser; no backend). Plan to wrap in Electron later with minimal changes.
- **Core processing runs client-side** (ffmpeg.wasm). Avoid network calls.
- **File I/O** uses browser file picker/drag-drop + OP-Z disk mount (later: Electron file system access).

### UI Library
- **MUI (Material UI)** — mature, strong accessibility defaults, theming support, large community, Electron-friendly, easy to restyle.

## Feature Scope
- ✅ **Drum Sample Pack builder** (MVP shipped)
- ⏳ **Synth Sample clipper** (follow-up; stub requirements below)

---

## Drum Sample Pack Builder (MVP) — ✅ IMPLEMENTED

### Implementation Status

#### ✅ Core Features
- [x] Accept up to 24 audio files (WAV, AIFF, MP3, M4A, FLAC)
- [x] Drag-drop and file picker input
- [x] Convert to mono 44.1 kHz 16-bit PCM AIFF
- [x] Enforce 12-second total duration cap with real-time validation
- [x] Generate single drum `.aif` with OP-Z metadata
- [x] Download exported pack

#### ✅ Processing
- [x] Silence trimming: configurable threshold (default -35 dB)
- [x] Duration enforcement: auto-trim to 12s max
- [x] Metadata stripping during conversion
- [x] Deterministic slice ordering
- [x] Format conversion: mono 44.1 kHz 16-bit PCM

#### ✅ Metadata
- [x] OP-Z drum JSON format (`drum_version` 2 or 3)
- [x] 24-element `start`/`end` arrays (scaled frames × 4096, clamped to `0x7ffffffe`)
- [x] Per-slice `volume`, `pitch`, `reverse`, `playmode` (default 8192)
- [x] Safe defaults for `dyna_env`, `fx_*`, `lfo_*`
- [x] Pack name and octave configuration
- [x] `APPL` chunk injection before `SSND`

#### ✅ UI
- [x] Left panel: input controls, processing settings, metadata fields
- [x] Main panel: slice list with waveform thumbnails
- [x] Per-slice controls: volume, pitch, reverse, delete, preview playback
- [x] Real-time duration display: `current / max` with slice count
- [x] Validation messaging: over-duration warnings, error alerts
- [x] Export button: disabled until valid pack ready
- [x] Progress feedback: processing and export states

#### ✅ Validation
- [x] Pre-check: max 24 files, total duration ≤ 12s
- [x] Per-slice status: pending/processing/ready/error
- [x] Inline error display for failed slices
- [x] Export guard: disabled if over duration or slices not ready

#### ⏳ Pending Features
- [ ] Manual slice reorder (drag-drop in list)
- [ ] Electron: direct FS writes to mounted OP-Z slot folders
- [ ] Electron: remember last paths/settings
- [ ] Advanced settings panel: LUFS/TP/LRA targets, silence threshold override
- [ ] Output filename template configuration
- [ ] Track/slot destination picker (currently manual copy)
- [ ] Size guardrail: warn if approaching 24 MB OP-Z sample budget
- [ ] Overwrite guard: confirm before replacing existing pack
- [ ] Retry option for failed slices
- [ ] Golden sample fixtures for testing
- [ ] Manual QA checklist automation

### Functional Requirements

**Input:**
- Accept up to 24 slices per pack; enforce cap with clear error.
- Supported formats: WAV, AIFF, MP3, M4A, FLAC.

**Processing:**
- Total pack duration must not exceed 12s; auto-trim with clear validation.
- Silence handling: leading-silence trim using configurable threshold (default -35 dB).
- File ordering: deterministic; support manual reorder via UI drag/drop + numeric sorting fallback.
- Format conversion: mono 44.1 kHz 16-bit PCM AIFF.

**Output:**
- Format: `.aif` mono, 44.1 kHz, 16-bit PCM.
- Metadata: OP-Z drum JSON with explicit slice boundaries; strip all input metadata tags.
- Folder targeting: user can choose track + slot; must conform to OP-Z structure:
  - 10 slots per track (subfolders `01`–`10`).
  - Any extra files in a slot are rejected by the device; ensure only one `.aif` written.

**Validation:**
- Pre-check inputs: unreadable file, unsupported codec, >24 files, total estimated length >12s.
- Processing errors: ffmpeg missing, conversion failure, write permission issues.
- Import safety: confirm target path exists/created under `sample packs/<track>/<slot>/`; warn before overwriting an existing pack.
- Provide actionable messages (what failed, how to fix, max duration reminder, supported formats).

### Configuration Surface (Exposed to User)

**Implemented:**
- Silence threshold (dB)
- Max duration (12s, read-only)
- Pack name
- Octave
- Drum version (2 or 3)
- Per-slice: volume, pitch, reverse

**Planned:**
- Output filename template
- Track/slot destination picker
- Per-slice normalization controls

### Non-Functional Requirements
- Deterministic renders: same inputs + settings produce bit-identical output.
- No network access required.
- Keep processing time minimal; parallelize per-slice prep if it does not change order.
- Logging that is readable for support (commands run, durations, normalization mode).

### Testing & Verification
- Unit/CLI tests for: format conversion, duration enforcement, slice ordering, metadata stripping, overwrite guard.
- Golden sample fixtures covering: 24-slice max, silence-trim on/off, over-length rejection.
- Manual QA checklist: import onto OP-Z via disk mode, verify pack loads and no files end up in `rejected/`.

---

## Synth Sample Clipper (Next) — ⏳ PLANNED

Goal: convert a single audio source to an OP-Z synth sample slot (6s limit).

**Requirements:**
- Inputs: single file (WAV/AIFF/MP3/M4A/FLAC).
- Processing: mono 44.1 kHz 16-bit AIFF, trim/loop to 6s.
- Output: one synth-format `.aif` placed in chosen track/slot; prevent multiple files per slot.
- Metadata: OP-1 snapshot format with base frequency (440 Hz default for key A).
- Validation: exactly 6s length to avoid "sample bleed" (buffer overflow playing unrelated audio).

**Open Questions:**
- Confirm exact synth sample duration cap (6s per format guide).
- Confirm loop behavior and envelope defaults.
- ADSR envelope handling (ignored by OP-Z; user must adjust on device).

---

## Implementation Notes

### Architecture
- **Core modules** (framework-agnostic):
  - `audio/ffmpeg.ts`: ffmpeg.wasm wrapper, transcode/concat pipeline
  - `audio/aiff.ts`: AIFF parser, OP-Z drum metadata encoder/injector
  - `audio/metadata.ts`: duration probing via Web Audio API
  - `audio/pack.ts`: orchestrates slice processing and metadata injection
- **UI layer** (React + MUI):
  - `App.tsx`: main UI, slice list, controls, export flow
  - `hooks/useSlices.ts`: slice state management, file input handling
  - `components/TEBackground.tsx`: Teenage Engineering-inspired background
  - `theme.ts`: MUI theme customization

### Web vs Electron
- **Web**: use ffmpeg.wasm; avoid blocking UI; show that processing happens locally; instruct user to copy the exported file into OP-Z disk. No persistent storage beyond browser memory unless the user explicitly saves.
- **Electron**: direct file system writes to mounted OP-Z; reuse the same UI; enable remembering last paths/settings; optional drag file from slot to desktop for backup.

### Format Details
- **Slice boundaries**: stored as scaled frame indices (`frame * 4096`), clamped to `0x7ffffffe` (INT32_MAX - 1).
- **Metadata chunk**: `APPL` chunk with `op-1` prefix + JSON payload, inserted before `SSND`.
- **Padding**: AIFF chunks must be even-length; add pad byte if needed.
- **Unused slots**: padded with zero-length markers (start == end).

---

Repo: git@github.com:m0nkmaster/op-done.git
