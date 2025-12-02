# OP-Z Sample Format Guide

Comprehensive reference for OP-Z drum and synth sample formats, import procedures, and caveats.

---

## Overview

The OP-Z supports two sample types:
- **Drum samples** (Tracks 1–4): Multi-slice AIFF with proprietary markers
- **Synth samples** (Tracks 5–8): Single 6-second AIFF with OP-1 snapshot format

Samples cannot be cross-loaded (drums on synth tracks or vice versa).

---

## Drum Samples (Tracks 1–4)

### Format Specification

**File Format:**
- Container: AIFF (Audio Interchange File Format)
- Channels: Mono
- Bit depth: 16-bit PCM
- Sample rate: 44.1 kHz
- Max duration: 12 seconds total
- Max slices: 24 (one per OP-Z drum key)
- Max slice duration: 4 seconds each

**Metadata Structure:**
- `APPL` chunk inserted before `SSND` chunk
- Payload: `op-1` prefix + JSON object
- JSON schema:
  ```json
  {
    "drum_version": 2 | 3,
    "type": "drum",
    "name": "pack-name",
    "octave": 0,
    "pitch": [0, 0, ...],           // 24 elements, all zero
    "start": [0, 16384, ...],       // 24 elements, scaled frame indices
    "end": [16383, 32767, ...],     // 24 elements, scaled frame indices
    "playmode": [8192, 8192, ...],  // 24 elements, default 8192
    "reverse": [8192, 8192, ...],   // 24 elements, default 8192
    "volume": [8192, 8192, ...],    // 24 elements, default 8192
    "dyna_env": [0, 8192, 0, 8192, 0, 0, 0, 0],
    "fx_active": false,
    "fx_type": "delay",
    "fx_params": [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
    "lfo_active": false,
    "lfo_type": "tremolo",
    "lfo_params": [16000, 16000, 16000, 16000, 0, 0, 0, 0]
  }
  ```

**Slice Boundaries:**
- `start[i]` and `end[i]` define slice `i` boundaries
- Values are frame indices scaled by 4096: `scaled_frame = frame_index * 4096`
- Clamped to `0x7ffffffe` (2,147,483,646) to avoid INT32 overflow
- Unused slots: set `start[i] == end[i]` (zero-length marker)

**Key Differences from OP-1:**
- OP-Z ignores per-slice settings from OP-1 Drum Utility (pitch, volume, envelope, FX, LFO)
- OP-Z uses global track settings; per-slice metadata is for compatibility only
- Volume leveling must be done in source files before import

### Creating Drum Packs

**Recommended Workflow:**
1. Prepare 24 or fewer audio files (WAV, AIFF, MP3, M4A, FLAC)
2. Use OP Done or similar tool to:
   - Convert to mono 44.1 kHz 16-bit AIFF
   - Normalize loudness (LUFS recommended)
   - Trim leading silence
   - Concatenate with total duration ≤ 12s
   - Inject OP-Z drum metadata with explicit slice boundaries
3. Export single `.aif` file

**Legacy Tools:**
- OP-1 Drum Utility (macOS app): creates compatible format but per-slice settings ignored by OP-Z
- `teoperator` (CLI): legacy tool for OP-1/OP-Z drum packs

### Importing to OP-Z

**Procedure:**
1. Mount OP-Z in content mode (hold Track + power on)
2. Navigate to `sample packs/` folder
3. Choose track folder: `1` (kick), `2` (snare), `3` (perc), `4` (fx)
4. Choose slot folder: `01` through `10`
5. Copy `.aif` file into slot folder (one file per slot only)
6. Delete any existing files in slot (e.g., `~kicks.aiff` placeholder)
7. Eject OP-Z; device restarts and imports samples

**Import Validation:**
- Check `import.log` in content mode if import fails
- Rejected files may appear in `rejected/` folder (firmware-dependent)
- Common failures: wrong format, >12s duration, multiple files in slot

**Import Caveats:**
- OP-Z detects imports by filename change
- To update existing pack: rename file or remove → import cycle → re-add
- Updating a pack breaks all project references (track will be silent)
- Saved presets and parameters are lost on pack update

---

## Synth Samples (Tracks 5–8)

### Format Specification

**File Format:**
- Container: AIFF (Audio Interchange File Format)
- Channels: Mono
- Bit depth: 16-bit PCM
- Sample rate: 44.1 kHz
- Duration: Exactly 6 seconds (critical—see caveats)

**Metadata Structure:**
- OP-1 "snapshot format" with proprietary markers
- Base frequency: 440 Hz (maps sample to key A)
- ADSR envelope: ignored by OP-Z (must set on device)
- Effects/LFO: ignored by OP-Z

**Key Differences from OP-1:**
- OP-Z ignores ADSR envelope from metadata (defaults to very short attack/release)
- OP-Z ignores effects and LFO settings
- OP-Z only uses base frequency for pitch mapping
- Sample name displayed from filename, not metadata

### Creating Synth Samples

**Recommended Workflow:**
1. Prepare single audio file (WAV, AIFF, MP3, M4A, FLAC)
2. Convert to mono 44.1 kHz 16-bit AIFF
3. Trim or loop to exactly 6 seconds
4. Tune sample to musical key A (440 Hz) for correct pitch mapping
5. Add OP-1 snapshot metadata with base frequency
6. Export `.aif` file

**Critical: 6-Second Requirement**
- Samples shorter than 6s will play but cause "sample bleed"
- Sample bleed: after sample ends, buffer overflow plays unrelated audio (often drum samples or harsh noise)
- Always pad or loop to exactly 6 seconds

**Legacy Tools:**
- OP-Z synth sample hack tool (adds markers to 6s AIFF)

### Importing to OP-Z

**Procedure:**
1. Mount OP-Z in content mode (hold Track + power on)
2. Navigate to `sample packs/` folder
3. Choose track folder: `5` (lead), `6` (arp), `7` (bass), `8` (chord)
4. Choose slot folder: `01` through `10`
5. Copy `.aif` file into slot folder (one file per slot only)
6. Delete any existing files in slot (e.g., `~buzz.engine` placeholder)
7. Eject OP-Z; device restarts and imports samples

**Post-Import Setup:**
- Adjust ADSR envelope on OP-Z (green parameter page)
- Save corrected envelope to preset 1: hold Track + lowest white key

**Import Caveats:**
- Same as drum samples: filename-based detection, update breaks references
- Effect is always bitcrusher on synth parameter 1 (cannot be changed)

---

## OP-Z File Structure

```
[OP-Z mounted disk]/
├── sample packs/
│   ├── 1/  (kick drum)
│   │   ├── 01/
│   │   │   └── pack.aif
│   │   ├── 02/
│   │   └── ... (up to 10/)
│   ├── 2/  (snare drum)
│   ├── 3/  (percussion)
│   ├── 4/  (fx)
│   ├── 5/  (lead synth)
│   ├── 6/  (arp synth)
│   ├── 7/  (bass synth)
│   └── 8/  (chord synth)
├── import.log
└── rejected/  (firmware-dependent)
```

**Rules:**
- One file per slot folder
- Multiple files in slot → import rejected
- Placeholder files (starting with `~`) reference internal samples; delete to use custom samples
- Total sample budget: 24 MB across all tracks

---

## Technical Details

### AIFF Chunk Structure

**Standard AIFF:**
```
FORM (container)
├── COMM (common chunk: channels, sample rate, bit depth, frame count)
├── SSND (sound data chunk: audio samples)
└── [optional chunks]
```

**OP-Z Drum AIFF:**
```
FORM (container)
├── COMM (common chunk)
├── APPL (application-specific chunk: OP-Z drum metadata)
└── SSND (sound data chunk)
```

**APPL Chunk Format:**
- Chunk ID: `APPL` (0x4150504C)
- Chunk size: 4-byte big-endian integer (payload length)
- Payload: `op-1` (5 bytes) + JSON string
- Padding: add 1 byte if payload length is odd (AIFF requirement)

### Frame Scaling

**Why scale by 4096?**
- Legacy OP-1 format uses scaled frame indices for slice boundaries
- Scaling allows sub-frame precision in fixed-point representation
- OP-Z inherits this format for compatibility

**Calculation:**
```
scaled_frame = frame_index * 4096
clamped_value = min(scaled_frame, 0x7ffffffe)
```

**Example:**
- Sample rate: 44,100 Hz
- Slice 1: 0.5 seconds = 22,050 frames
- Scaled start: 0 * 4096 = 0
- Scaled end: 22,049 * 4096 = 90,312,704 (0x05621000)

### Metadata Defaults

**Safe defaults for unused fields:**
- `pitch`: all zero (no pitch shift)
- `playmode`: 8192 (normal playback)
- `reverse`: 8192 (forward playback; 0 = reverse)
- `volume`: 8192 (unity gain)
- `dyna_env`: `[0, 8192, 0, 8192, 0, 0, 0, 0]` (neutral envelope)
- `fx_active`: false
- `fx_params`: `[8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000]`
- `lfo_active`: false
- `lfo_params`: `[16000, 16000, 16000, 16000, 0, 0, 0, 0]`

---

## Troubleshooting

### Import Failures

**Symptoms:**
- Sample not visible in OP-Z app
- File appears in `rejected/` folder
- Error logged in `import.log`

**Common Causes:**
1. Wrong format (not mono 16-bit 44.1 kHz AIFF)
2. Duration exceeds limit (>12s for drums, ≠6s for synth)
3. Multiple files in slot folder
4. Missing or malformed metadata chunk
5. Incorrect track type (drum on synth track or vice versa)

**Solutions:**
- Verify format with audio editor or `ffprobe`
- Check `import.log` for specific error
- Ensure only one `.aif` file per slot
- Re-export with correct metadata

### Sample Bleed (Synth Only)

**Symptoms:**
- After sample ends, unrelated audio plays (drums, noise)

**Cause:**
- Sample shorter than 6 seconds → buffer overflow

**Solution:**
- Pad or loop sample to exactly 6 seconds

### Lost Project References

**Symptoms:**
- After updating sample, track is silent in existing projects

**Cause:**
- OP-Z detects sample by filename; renaming breaks references

**Solutions:**
- Keep original filename when updating
- Or: remove sample → import cycle → re-add with new name
- Note: parameters and presets will be lost either way

---

## References

- Original guide: Dec 2018, OP-Z firmware 1.1.12
- OP-1 Drum Utility: macOS app for creating drum packs
- `teoperator`: legacy CLI tool for OP-1/OP-Z drum packs
- OP Done: modern browser-based drum pack builder

---

**Document Version:** 2.0  
**Last Updated:** 2025  
**Firmware Compatibility:** OP-Z 1.1.12+
