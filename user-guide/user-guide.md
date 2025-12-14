# OP Done User Guide

Create OP-Z compatible drum packs in your browser. No installation, no uploads—everything runs locally.

## Quick Start

1. Open OP Done in a modern browser (Chrome, Firefox, Edge)
2. Go to **Drum Kit Creator**
3. Drag audio files onto the drop zone (WAV, AIFF, MP3, M4A, FLAC)
4. Adjust per-slice volume and pitch if needed
5. Click **Export** to download your pack
6. Copy the `.aif` file to `sample packs/<track>/<slot>/` on your OP-Z
7. Reboot the OP-Z to load

---

## Drum Kit Creator

Build custom drum packs from your own samples.

### Adding Samples

- **Drag & drop** files onto the upload area, or click to browse
- Supports: WAV, AIFF, MP3, M4A, FLAC
- Files are automatically analyzed for type (kick, snare, hat, etc.) and pitch

### Limits

| Constraint | Value |
|------------|-------|
| Max slices | 24 |
| Max total duration | ~11.8 seconds |
| Max per-slice | ~4 seconds (recommended) |
| Output format | Mono, 16-bit, 44.1kHz AIFF |

A 0.1s gap is added between each slice automatically.

### Per-Slice Controls

| Control | Range | Notes |
|---------|-------|-------|
| Volume | 0–16383 | 8192 = unity gain |
| Pitch | ±12 semitones | 0.1 step precision |
| Play | — | Preview with current settings |
| Delete | — | Remove from pack |

### Classification

Each sample is automatically classified:
- **Drums**: kick, snare, hat, cymbal, other
- **Melodic**: Shows detected note (e.g., C4, F#3)
- **Unknown**: Ambiguous content

Classification only affects the suggested filename prefix—it doesn't modify your audio.

### Pack Metadata

| Field | Description |
|-------|-------------|
| Name | Pack name shown on OP-Z |
| Octave | -4 to +4, shifts all slices |
| Drum Version | 2 (OP-1 legacy) or 3 (OP-Z) |

### Export

The **Export** button enables when:
- At least one slice is added
- All slices are in "ready" status
- Total duration is under the limit
- No processing is in progress

Exports `opz-drum-pack.aif` with embedded OP-Z metadata.

### Best Practices

- **Trim samples** before importing—dead air wastes the 11.8s budget
- **Keep slices short** for punchy drums (< 1s typical)
- **Balance levels** using per-slice volume rather than over-compressing
- **Use 24 slices max**—the 25th slot can cause issues
- **Test on device** after export to verify playback

---

## Sample Analyzer

Inspect existing OP-Z drum packs to verify metadata and slice boundaries.

### Usage

1. Click **Select File** and choose an `.aif` file with OP-Z metadata
2. View pack metadata (name, octave, version)
3. Waveform displays with slice boundaries overlaid
4. Click within a slice region to audition it
5. Slice list shows frame positions, volume, and pitch values

### What It Shows

- **Metadata**: Pack name, octave, drum version
- **Waveform**: Full audio with start/end markers for each slice
- **Slice Table**: Frame positions, volume, pitch, playmode, reverse

Empty slots (start = 0, end = 0) are hidden.

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "No APPL chunk" | Missing OP-Z metadata | Re-export from Drum Kit Creator |
| Silent playback | Audio context locked | Click anywhere on the page first |
| Boundaries offset | Sample rate mismatch | Usually visual only; metadata is accurate |

---

## AI Sound Creation

Generate synth sounds from text descriptions using AI.

### Setup

1. Go to **Sound Creation**
2. Select provider: OpenAI or Gemini
3. Enter your API key (stored locally in browser)
4. Type a sound description and click **Generate**

### How It Works

1. Your text prompt is sent to the AI provider
2. AI returns a synthesis configuration (SoundConfig JSON)
3. OP Done renders the sound using Web Audio
4. Preview, refine, or export as WAV

### Prompting Tips

**Good prompts:**
- "Deep 808 kick with long sub decay"
- "Crispy hi-hat, tight and bright"
- "Analog pad, slow attack, rich harmonics"
- "Punchy snare with gated reverb"

**Refining:**
- "Make it punchier"
- "Add more high-end"
- "Longer decay"
- "Less reverb"

The AI modifies the previous config, so iterative refinement works well.

### Export

Click **Export WAV** to download the rendered sound. You can then import it into Drum Kit Creator to include in a pack.

### Privacy

- Text prompts are sent to OpenAI or Gemini (your choice)
- Audio rendering happens locally in your browser
- No audio files are ever uploaded
- API keys are stored in your browser only

---

## Synth Engine Reference

The Web Audio synthesizer supports layered synthesis with effects.

### Signal Flow

```
Source (oscillator/noise/FM/Karplus) → Layer Filter → Saturation → Layer Envelope
→ Mixer → Global Filter → Master Envelope → LFO Modulation
→ Effects (distortion → compressor → gate → delay → reverb) → Output
```

### Layer Types

| Type | Parameters |
|------|------------|
| Oscillator | waveform (sine/square/saw/triangle), frequency, detune, unison, sub |
| Noise | type (white/pink/brown) |
| FM | carrier, modulator, modulationIndex |
| Karplus-Strong | frequency, damping, pluckLocation |

### Envelope (ADSR)

All envelopes have: attack, decay, sustain, release

| Stage | Range | Typical Drums | Typical Pads |
|-------|-------|---------------|--------------|
| Attack | 0.001–10s | 1–5ms | 100–500ms |
| Decay | 0.001–10s | 50–200ms | 200–1000ms |
| Sustain | 0–1 | 0–0.3 | 0.6–1.0 |
| Release | 0.001–10s | 50–300ms | 500–3000ms |

### Filter

| Parameter | Range | Notes |
|-----------|-------|-------|
| Type | lowpass, highpass, bandpass, notch | — |
| Frequency | 20–20000 Hz | Cutoff frequency |
| Q | 0.1–20 | Resonance |
| Envelope | Optional | Modulates frequency over time |

### LFO

| Parameter | Range |
|-----------|-------|
| Waveform | sine, square, triangle, sawtooth, random |
| Frequency | 0.01–20 Hz |
| Depth | 0–1 |
| Target | pitch, filter, amplitude, pan |

### Effects

| Effect | Key Parameters |
|--------|----------------|
| Reverb | size, decay, damping, mix |
| Delay | time, feedback, mix, pingPong |
| Distortion | type (soft/hard/tube), drive, mix |
| Compressor | threshold, ratio, attack, release |
| Gate | threshold, attack, hold, release |

### Saturation Types

| Type | Character |
|------|-----------|
| Soft | Gentle warmth |
| Hard | Aggressive clipping |
| Tube | Asymmetric, vintage |
| Tape | Compression + warmth |

---

## USB Browser (Beta)

Direct file management on a connected OP-Z.

### Requirements

- Chromium-based browser (Chrome, Edge)
- OP-Z connected and mounted as USB storage
- File System Access API support

### Usage

1. Connect OP-Z via USB
2. Put it in Content Mode (if required)
3. Click **Connect** and select the OP-Z folder
4. Browse sample pack folders
5. Drag packs to install, or delete existing ones

### Limitations

- Safari and Firefox don't support the File System Access API
- Some systems require additional drivers for OP-Z mounting

---

## Troubleshooting

### Export Button Disabled

| Cause | Solution |
|-------|----------|
| Slice has error status | Remove the problematic slice |
| Processing in progress | Wait for completion |
| Total duration exceeded | Remove or shorten slices |
| No slices added | Add at least one sample |

### Slices Ignored on OP-Z

| Cause | Solution |
|-------|----------|
| Slice too long | Keep under 4s per slice |
| Total too long | Stay under 11.8s total |
| 25th slice used | Use only 24 slices |
| Corrupted export | Re-export and try again |

### Silent Playback

| Cause | Solution |
|-------|----------|
| Audio context locked | Click anywhere on page |
| System muted | Check system audio output |
| Unsupported format | Try a different browser |

### AI Generation Fails

| Cause | Solution |
|-------|----------|
| Invalid API key | Verify key in settings |
| Network blocked | Check firewall/VPN |
| Rate limited | Wait and retry |
| Provider down | Try alternate provider |

### File Won't Load

| Cause | Solution |
|-------|----------|
| Corrupted file | Try another source |
| Unsupported codec | Convert to WAV first |
| File too large | Split into smaller files |

---

## Data & Privacy

### Local Processing

- All audio processing runs in your browser
- No files are uploaded to any server
- No tracking, analytics, or cookies
- Works offline (except AI features)

### AI Features

When using Sound Creation:
- Text prompts are sent to OpenAI or Gemini
- No audio data is transmitted
- API keys are stored locally in your browser
- You control which provider to use

### Storage

- Files are held in memory during your session
- Nothing is saved to disk unless you export
- Closing the tab clears all data
