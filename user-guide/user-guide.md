# OP Done User Guide

Complete guide to all OP Done features.

---

## Drum Kit Creator

Build OP-Z drum packs from your own audio samples.

### Quick Workflow

1. Drag audio files onto the drop zone (or click to browse)
2. Review the slice list—each sample shows waveform, duration, classification
3. Adjust per-slice volume and pitch if needed
4. Set pack name in the metadata section
5. Click **Export** to download the `.aif` file

### Supported Formats

WAV, AIFF, MP3, M4A, FLAC

All files are converted to mono, 16-bit, 44.1kHz.

### Constraints

| Limit | Value |
|-------|-------|
| Max slices | 24 |
| Max total duration | 11.8 seconds |
| Max per-slice (recommended) | 4 seconds |

### Per-Slice Controls

| Control | Range | Notes |
|---------|-------|-------|
| Volume | 0–16383 | 8192 = unity gain |
| Pitch | ±12 semitones | 0.1 step precision |
| Play | — | Preview with current settings |
| Delete | — | Remove from pack |

### Classification

Samples are automatically classified:

| Type | Examples |
|------|----------|
| Kick | Bass drums, 808s |
| Snare | Snares, claps, rimshots |
| Hat | Hi-hats, shakers |
| Cymbal | Crashes, rides |
| Melodic | Pitched sounds (shows detected note) |
| Other/Unknown | Ambiguous content |

Classification affects the auto-generated filename prefix only—it doesn't modify audio.

### Pack Metadata

| Field | Description |
|-------|-------------|
| Name | Displayed on OP-Z |
| Octave | Global pitch offset (-4 to +4) |
| Drum Version | 2 (OP-1 legacy) or 3 (OP-Z) |

### Export

The export button enables when:
- At least one slice is added
- All slices show "Ready" status
- Total duration is under 11.8 seconds

---

## Sample Analyzer

Inspect existing OP-Z drum packs.

### Usage

1. Click **Select File** and choose an `.aif` file
2. View metadata (name, octave, drum version)
3. See the waveform with slice boundaries overlaid
4. Click on a slice region to play it
5. Scroll down for the full slice table

### What It Shows

- **Waveform** with start/end markers for each slice
- **Metadata** including pack name and octave
- **Slice Table** with frame positions, volume, pitch, playmode, reverse

Empty slots (start = end = 0) are hidden.

### Requirements

The file must be an AIFF with OP-Z metadata (APPL chunk with `op-1` signature).

---

## Synthesizer

Full-featured Web Audio synthesizer with MIDI support and AI generation.

### Interface Sections

**Top Bar**
- Sound name display
- Generate button (AI)
- Play/Stop buttons
- Export WAV

**Scope**
- Real-time waveform visualization

**Layers**
- Add up to 4 synthesis layers
- Each layer can be: Oscillator, Noise, FM, or Karplus-Strong
- Per-layer filter, saturation, and envelope

**Global Controls**
- Master envelope (ADSR)
- Global filter with envelope
- LFO (modulates pitch, filter, amplitude, or pan)

**Effects**
- Distortion, Compressor, Gate, Delay, Reverb

**JSON Editor**
- Direct SoundConfig editing
- Validation with error display
- Copy/paste configurations

### Layer Types

| Type | Description |
|------|-------------|
| Oscillator | Waveforms: sine, square, saw, triangle. Optional unison and sub-oscillator |
| Noise | White, pink, or brown noise |
| FM | Frequency modulation synthesis |
| Karplus-Strong | Physical modeling (plucked strings) |

### MIDI Support

1. Connect a MIDI controller
2. The synth automatically detects available devices
3. Play notes to trigger sounds in real-time
4. The keyboard display shows active notes

### AI Generation

1. Enter a text description (e.g., "punchy 808 kick", "ethereal pad")
2. Select provider (OpenAI or Gemini)
3. Click **Generate**
4. AI returns a complete SoundConfig
5. Preview and refine with follow-up prompts

Requires API key in settings.

### Export

Click **Export WAV** to download the rendered sound. Use this to create samples for the Drum Kit Creator.

---

## AI Kit Generator

Generate complete 24-sound drum kits from text descriptions.

### Workflow

1. Enter a kit description (e.g., "80s synthwave", "dark techno", "acoustic jazz")
2. Select AI provider and enter API key
3. Click **Generate Kit**
4. AI plans 24 sounds optimized for OP-Z constraints
5. Each sound is synthesized in sequence
6. Download the complete pack when finished

### Generation Phases

| Phase | What Happens |
|-------|--------------|
| Planning | AI creates 24 sound descriptions |
| Generating | AI generates SoundConfig for each |
| Synthesizing | Web Audio renders each sound |
| Building | Pack is assembled with metadata |
| Complete | Download is ready |

### Sound Categories

The AI distributes sounds across categories:
- **Kicks** — Low-frequency punchy hits
- **Snares** — Mid-range transients with noise
- **Hi-hats** — High-frequency, short decay
- **Toms** — Pitched, quick decay
- **Percussion** — Clicks, pops, claps
- **FX** — Blips, zaps, impacts

### Tips

- Be specific: "deep 808 sub kick" works better than "kick"
- Mention genres: "90s jungle breaks", "minimal techno"
- The AI targets 0.3–0.6s per sound to fit 24 sounds in 11.8 seconds
- Generation takes 1–3 minutes depending on AI provider

---

## USB Browser

Direct file management on a connected OP-Z.

### Requirements

- Chromium browser (Chrome, Edge, Opera, Brave)
- OP-Z connected and mounted as USB storage
- Browser must support File System Access API

**Not supported:** Safari, Firefox

### Usage

1. Connect OP-Z via USB
2. Put OP-Z in content mode if needed
3. Click **Connect**
4. Select the OP-Z root folder when prompted
5. Browse the slot grid (4 tracks × 10 slots)
6. Upload packs to empty slots or replace existing ones

### Slot Grid

| Track | Purpose |
|-------|---------|
| 1-kick | Kick drum samples |
| 2-snare | Snare samples |
| 3-perc | Percussion samples |
| 4-sample | General samples |

Each track has 10 slots (01–10).

### Operations

- **Upload** — Click the upload icon on an empty slot
- **Delete** — Click the delete icon on an occupied slot
- **Refresh** — Re-scan the device

---

## Troubleshooting

### Drum Kit Creator

| Problem | Solution |
|---------|----------|
| Export button disabled | Check: duration ≤ 11.8s, all slices ready, not processing |
| Slice shows error | Try a different audio format (WAV usually works best) |
| Classification wrong | Classification is just a suggestion—it doesn't affect the audio |

### Sample Analyzer

| Problem | Solution |
|---------|----------|
| "No APPL chunk" | File doesn't have OP-Z metadata—export from Drum Kit Creator first |
| Silent playback | Click anywhere on the page to unlock audio |
| Wrong boundaries | Visual positions use original frame count; metadata is accurate |

### Synthesizer

| Problem | Solution |
|---------|----------|
| No sound | Check volume isn't zero, attack isn't too long, frequency is audible |
| MIDI not working | Check browser permissions, try refreshing |
| AI fails | Verify API key, check network connection |
| Clicks/pops | Increase attack/release times slightly |

### AI Kit Generator

| Problem | Solution |
|---------|----------|
| Generation stuck | Refresh and try again—AI providers can timeout |
| Sounds too similar | Use more specific prompts with variety keywords |
| Pack too long | AI targets short sounds, but some may be trimmed |

### USB Browser

| Problem | Solution |
|---------|----------|
| "Not supported" | Use Chrome, Edge, or another Chromium browser |
| Can't see folders | Make sure you selected the OP-Z root folder |
| Upload fails | Check OP-Z isn't write-protected or full |

### General

| Problem | Solution |
|---------|----------|
| Nothing loads | Refresh the page, check browser console for errors |
| Slow performance | ffmpeg.wasm is large (~30MB)—first load takes time |
| Audio cuts off | Total duration must be under 11.8 seconds |

---

## OP-Z Installation Guide

### Step by Step

1. **Export** your pack from Drum Kit Creator or AI Kit Generator
2. **Connect** OP-Z to computer via USB
3. **Enable content mode** if prompted
4. **Copy** the `.aif` file to:
   ```
   OP-Z/sample packs/<track>/<slot>/
   ```
   - Tracks: `1-kick`, `2-snare`, `3-perc`, `4-sample`
   - Slots: `01` through `10`
5. **Eject** the OP-Z properly
6. **Reboot** the OP-Z

### Checking Installation

- Samples should be available on the corresponding track
- If not working, check `import.log` on the OP-Z for errors
- Common issues: file too long, wrong format, corrupted metadata

---

## Privacy & Data

### Local Processing

- All audio processing runs in your browser
- No files are uploaded to any server
- No tracking, analytics, or cookies

### AI Features

When using Synthesizer AI or AI Kit Generator:
- Text prompts are sent to OpenAI or Gemini (your choice)
- No audio data is transmitted
- API keys are stored locally in your browser

### Offline Support

Everything works offline except:
- AI sound generation (requires network)
- AI kit generation (requires network)

---

## Resources

### Official Teenage Engineering

- **[TE Drum Utility](https://teenage.engineering/apps/drum-utility)** — Official web tool for creating OP-1/OP-Z drum packs. Use this to verify your packs work correctly before loading onto your device.
- **[OP-Z User Guide](https://teenage.engineering/guides/op-z)** — Official documentation for the OP-Z.

### Community Tools

- **[teoperator](https://github.com/schollz/teoperator)** — Command-line tool by @schollz for creating OP-1/OP-Z patches from audio files.
