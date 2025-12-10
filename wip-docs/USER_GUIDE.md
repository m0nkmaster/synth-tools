# OP Done User Guide

Complete guide to using OP Done for creating and analyzing OP-Z drum sample packs.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Drum Kit Creator](#drum-kit-creator)
3. [Sample Analyzer](#sample-analyzer)
4. [Sound Creation](#sound-creation)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

---

## Getting Started

### What is OP Done?

OP Done is a browser-based tool for creating custom drum sample packs for the Teenage Engineering OP-Z synthesizer. It converts your audio files into the specific AIFF format required by the OP-Z, complete with proper metadata for slice markers.

### System Requirements

- **Browser:** Modern browser with Web Audio API support (Chrome, Firefox, Safari, Edge)
- **Memory:** 4 GB RAM minimum (8 GB recommended for large files)
- **Storage:** No installation required, runs entirely in browser

### Quick Start

1. Open OP Done in your browser
2. Navigate to **Drum Kit Creator**
3. Drag and drop up to 24 audio files
4. Adjust settings if needed
5. Click **Export** to download your `.aif` file
6. Copy to your OP-Z (see [Installing on OP-Z](#installing-on-op-z))

---

## Drum Kit Creator

### Overview

The Drum Kit Creator is the main tool for building OP-Z drum packs. It takes your audio files (WAV, AIFF, MP3, M4A, FLAC) and converts them into a single AIFF file with OP-Z drum metadata.

### Step-by-Step Guide

#### 1. Add Audio Files

**Method A: Drag and Drop**
- Drag up to 24 audio files directly onto the upload area
- Files are processed immediately

**Method B: File Picker**
- Click "Select Files" button
- Choose files from your computer
- Hold Cmd/Ctrl to select multiple files

**Supported Formats:**
- WAV (recommended)
- AIFF
- MP3
- M4A
- FLAC

**Limitations:**
- Maximum 24 slices per pack
- Total duration must be ≤ 12 seconds
- Individual files should be < 1 MB

#### 2. Review Slices

Each added file appears as a "slice" in the list with:
- **Waveform preview** - Visual representation of audio
- **File name** - Automatically prefixed with detected type (e.g., `kick_`, `snare_`)
- **Duration** - Length in seconds
- **Status** - Ready, Processing, or Error

**Slice Controls:**
- **Play button** - Preview the slice
- **Delete button** - Remove from pack
- **Volume button** - Adjust slice volume (0-16383, default 8192)
- **Pitch button** - Adjust pitch in semitones (-12 to +12)

#### 3. Configure Processing

**Silence Threshold** (default: -35 dB)
- Removes leading silence from each slice
- Lower values (e.g., -40) remove more silence
- Higher values (e.g., -30) preserve more quiet audio
- Set to 0 to disable trimming

**Max Duration** (fixed: 12 seconds)
- OP-Z hardware limitation
- Total of all slices must fit within 12 seconds
- Red warning appears if exceeded

#### 4. Set Metadata

**Name**
- Pack name (appears on OP-Z display)
- Default: "drum pack"
- Max 32 characters

**Octave**
- MIDI octave for playback
- Default: 0
- Range: -4 to +4

**Version**
- Drum metadata version
- Options: 2 or 3
- Default: 3 (recommended)
- Version 2: Legacy OP-1 compatibility
- Version 3: Full OP-Z features

#### 5. Export

Click **Export** button to:
1. Concatenate all slices into single AIFF
2. Apply silence trimming (if enabled)
3. Normalize audio levels
4. Inject OP-Z drum metadata
5. Download `opz-drum-pack.aif`

**Export is disabled if:**
- No slices added
- Total duration > 12 seconds
- Any slice has error status
- Processing in progress

### Advanced Features

#### Per-Slice Volume Control

1. Click volume icon on any slice
2. Vertical slider appears (0-16383)
3. Adjust to taste
4. Default: 8192 (unity gain)
5. Higher values = louder
6. Lower values = quieter

**Tip:** Use volume to balance kicks vs hi-hats

#### Per-Slice Pitch Control

1. Click pitch icon on any slice
2. Vertical slider appears (-12 to +12 semitones)
3. Adjust in 0.1 semitone increments
4. Display shows resulting note name and cents
5. Default: 0 (no pitch shift)

**Use Cases:**
- Tune kicks to song key
- Create pitch variations from single sample
- Fix out-of-tune samples

**Note:** Pitch detection is automatic for melodic samples. The display shows the detected frequency and resulting note after pitch adjustment.

#### Audio Classification

OP Done automatically analyzes each file and detects:
- **Drum hits** - Kicks, snares, hats, cymbals, percussion
- **Melodic samples** - Pitched instruments
- **Unknown** - Ambiguous or noisy samples

Classification results are used to:
- Auto-prefix file names (e.g., `kick_`, `snare_`, `hat_`)
- Detect pitch for melodic samples
- Optimize processing settings

**Accuracy:** ~85% for clean, isolated samples. May misclassify complex or layered sounds.

### Tips & Best Practices

**File Preparation:**
- Use 44.1 kHz sample rate (OP-Z native rate)
- Trim silence before import for faster processing
- Normalize levels for consistent volume
- Use mono files (stereo will be downmixed)

**Slice Organization:**
- Group similar sounds (all kicks, all snares, etc.)
- Place most-used sounds in first slots
- Leave empty slots for future additions

**Duration Management:**
- Keep individual slices short (< 1 second for drums)
- Use fade-outs to save space
- Remove long tails if not needed

**Quality:**
- Use WAV or AIFF for best quality
- Avoid MP3 if possible (lossy compression)
- 16-bit depth is sufficient (OP-Z standard)

---

## Sample Analyzer

### Overview

The Sample Analyzer lets you inspect existing OP-Z drum packs to see how they're structured. Useful for learning, debugging, or verifying your exports.

### How to Use

#### 1. Load a Pack

- Click "Select File" button
- Choose an `.aif` or `.aiff` file
- Must be OP-Z format (with APPL chunk metadata)

#### 2. View Metadata

Displays pack information:
- **Name** - Pack name
- **Octave** - MIDI octave setting
- **Version** - Drum metadata version (2 or 3)

#### 3. Inspect Waveform

Interactive waveform display shows:
- Full audio waveform
- Slice boundaries (vertical lines)
- 24 slice markers

**Interaction:**
- Click on any slice region to play it
- Zoom and pan (if implemented)

#### 4. Review Slice Data

Table shows all 24 slots:
- **Slot number** - 1-24
- **Start frame** - Beginning of slice
- **End frame** - End of slice
- **Volume** - Slice volume (0-16383)
- **Pitch** - Pitch adjustment parameter

**Empty slots** show start=0, end=0

### Use Cases

**Learning:**
- Study how official OP-Z packs are structured
- See how slices are arranged
- Understand metadata format

**Debugging:**
- Verify your exports are correct
- Check slice boundaries
- Confirm metadata values

**Reverse Engineering:**
- Extract slice timings
- Analyze volume/pitch settings
- Compare different packs

---

## Sound Creation

### Status: Experimental

The Sound Creation tool uses AI to generate synthetic sounds from text descriptions. This feature is currently experimental and requires an OpenAI API key.

### How It Works

1. Enter a text description (e.g., "Deep 808 kick", "Warm analog pad", "Metallic pluck")
2. AI generates synthesis parameters
3. Browser synthesizes audio using Web Audio API
4. Preview and download as WAV

### Requirements

- OpenAI API key (set in `.env` as `VITE_OPENAI_KEY`)
- Modern browser with Web Audio API

### Limitations

- Requires internet connection
- API costs apply
- Results vary in quality
- Not optimized for OP-Z format yet

**Note:** This feature is under development and output success may vary!

---

## Installing on OP-Z

### Prerequisites

- OP-Z synthesizer
- USB cable
- Computer with file browser

### Steps

1. **Connect OP-Z**
   - Power on OP-Z
   - Connect USB cable to computer
   - OP-Z appears as USB drive

2. **Navigate to Sample Packs Folder**
   ```
   OP-Z/
   └── sample packs/
       ├── 1-kick/
       ├── 2-snare/
       ├── 3-perc/
       └── 4-fx/
   ```

3. **Choose Track and Slot**
   - Each track (1-4) has 10 slots (01-10)
   - Example: `sample packs/1-kick/01/`

4. **Copy Your Pack**
   - Copy your exported `.aif` file into chosen slot folder
   - **One file per slot** (delete existing file if present)
   - Rename if desired (OP-Z reads any `.aif` in folder)

5. **Eject OP-Z**
   - Safely eject USB drive
   - Disconnect cable

6. **Restart OP-Z**
   - Power cycle OP-Z
   - New pack imports automatically
   - Check `import.log` if issues occur

### Track Assignments

- **Track 1 (Kick)** - Low-frequency drums, bass drums
- **Track 2 (Snare)** - Snares, claps, rimshots
- **Track 3 (Perc)** - Hi-hats, shakers, percussion
- **Track 4 (FX)** - Sound effects, samples, vocals

**Note:** These are conventions, not restrictions. Any pack can go in any track.

### Troubleshooting Import

If pack doesn't appear:

1. **Check `import.log`**
   - Located in OP-Z root directory
   - Shows errors and warnings

2. **Common Issues:**
   - File not in correct folder structure
   - Multiple `.aif` files in one slot
   - Corrupted file (re-export)
   - File too large (> 12 seconds)

3. **Verify File:**
   - Open in Sample Analyzer
   - Check metadata is present
   - Confirm 24 slices defined

---

## Troubleshooting

### "Over 12s cap" Warning

**Cause:** Total duration of all slices exceeds 12 seconds

**Solutions:**
- Remove some slices
- Trim individual files before import
- Use shorter samples
- Increase silence threshold to trim more

### "Unable to read file" Error

**Cause:** File format not supported or corrupted

**Solutions:**
- Convert to WAV using audio editor
- Check file isn't corrupted
- Try different file
- Ensure file size < 50 MB

### Export Button Disabled

**Possible Causes:**
1. No slices added → Add at least one file
2. Duration > 12s → Remove slices or trim
3. Processing in progress → Wait for completion
4. Slice has error status → Remove and re-add

### Playback Not Working

**Cause:** Browser audio context suspended

**Solutions:**
- Click anywhere on page first (browser security)
- Check browser audio permissions
- Try different browser
- Restart browser

### Waveform Not Displaying

**Cause:** Canvas rendering issue or file decode failure

**Solutions:**
- Refresh page
- Try different file
- Check browser console for errors
- Update browser

### Classification Incorrect

**Cause:** Ambiguous or complex audio

**Solutions:**
- Manually rename file (prefix is cosmetic)
- Use cleaner, isolated samples
- Classification doesn't affect export quality

### Pitch Detection Fails

**Cause:** Non-pitched or noisy sample

**Solutions:**
- Pitch detection only works for melodic samples
- Drums typically don't have detectable pitch
- Manual pitch adjustment still works

---

## FAQ

### General

**Q: Do I need to install anything?**  
A: No, OP Done runs entirely in your browser. No installation required.

**Q: Is my audio data sent to a server?**  
A: No, all processing happens locally in your browser. Files never leave your computer (except for Sound Creation feature which uses OpenAI API).

**Q: Can I use OP Done offline?**  
A: Yes, after first load. The app caches for offline use (except Sound Creation).

**Q: What browsers are supported?**  
A: Chrome, Firefox, Safari, and Edge. Must support Web Audio API and WebAssembly.

### File Formats

**Q: What audio formats are supported?**  
A: WAV, AIFF, MP3, M4A, and FLAC. WAV and AIFF recommended for best quality.

**Q: Can I use stereo files?**  
A: Yes, but they'll be downmixed to mono (OP-Z requirement).

**Q: What sample rate should I use?**  
A: 44.1 kHz (OP-Z native rate). Other rates are automatically converted.

**Q: What bit depth?**  
A: 16-bit (OP-Z standard). Higher depths are converted.

### Limitations

**Q: Why only 24 slices?**  
A: OP-Z hardware limitation. Each drum track supports exactly 24 slices.

**Q: Why 12 second limit?**  
A: OP-Z hardware limitation. Total pack duration cannot exceed 12 seconds.

**Q: Can I have more than 24 sounds?**  
A: Create multiple packs and load them into different slots (10 slots per track).

**Q: Can I edit existing OP-Z packs?**  
A: Not directly. Use Sample Analyzer to inspect, then recreate in Drum Kit Creator.

### Features

**Q: What does "silence threshold" do?**  
A: Removes quiet audio from the start of each slice. Helps fit more sounds in 12 seconds.

**Q: What's the difference between drum version 2 and 3?**  
A: Version 3 is newer OP-Z format with more features. Version 2 is for OP-1 compatibility. Use 3 unless you need OP-1 support.

**Q: Can I adjust individual slice volumes?**  
A: Yes, click the volume icon on any slice to adjust (0-16383 range).

**Q: Can I pitch shift slices?**  
A: Yes, click the pitch icon to adjust ±12 semitones in 0.1 semitone increments.

**Q: What does audio classification do?**  
A: Automatically detects if sample is a kick, snare, hat, etc. and prefixes the filename. Purely cosmetic, doesn't affect audio.

### Workflow

**Q: Can I reorder slices?**  
A: Not yet. Add files in desired order, or rename them alphabetically before import.

**Q: Can I save my project?**  
A: Not yet. Export creates final `.aif` file. To edit, start fresh with original files.

**Q: Can I preview the full pack before export?**  
A: Not yet. Preview individual slices, then export and test on OP-Z.

### OP-Z Integration

**Q: Where do I put the exported file?**  
A: `OP-Z/sample packs/<track>/<slot>/` - See [Installing on OP-Z](#installing-on-op-z)

**Q: Can I have multiple packs per slot?**  
A: No, one `.aif` file per slot. Multiple files will cause issues.

**Q: Do I need to restart OP-Z after copying?**  
A: Yes, power cycle for OP-Z to import new packs.

**Q: How do I know if import succeeded?**  
A: Check `import.log` in OP-Z root directory for errors.

**Q: Can I use these packs on OP-1?**  
A: Yes, if you use drum version 2. OP-1 and OP-Z share the same format.

### Troubleshooting

**Q: Export fails with "ffmpeg error"**  
A: Refresh page and try again. If persists, try different browser or smaller files.

**Q: Slices sound distorted on OP-Z**  
A: Reduce individual slice volumes or use normalization mode "off" to preserve dynamics.

**Q: Some slices are silent on OP-Z**  
A: Check slice boundaries in Sample Analyzer. May be too short or incorrectly trimmed.

**Q: Pack doesn't appear on OP-Z**  
A: Verify file is in correct folder structure and OP-Z was restarted. Check `import.log`.

---

## Keyboard Shortcuts

Currently none implemented. Feature request: Add shortcuts for common actions.

---

## Tips from the Community

**Layering Sounds:**
- Create multiple packs with variations
- Switch between slots during performance
- Use volume automation on OP-Z

**Organizing Packs:**
- Name packs descriptively (e.g., "808-kicks", "vinyl-snares")
- Keep source files organized by pack
- Document your settings for reproducibility

**Creative Uses:**
- Melodic samples for pitched drums
- Vocal chops as percussion
- Field recordings as textures
- Synth one-shots for electronic drums

---

## Getting Help

**Issues or Questions:**
- Check this guide first
- Review [Troubleshooting](#troubleshooting) section
- Check GitHub Issues for known problems
- Open new issue with details and browser console errors

**Feature Requests:**
- Open GitHub Issue with "Feature Request" label
- Describe use case and expected behavior

**Contributing:**
- See `docs/DEVELOPMENT.md` for developer guide
- Pull requests welcome!

---

**Last Updated:** 2025-01-13  
**Version:** 1.0
