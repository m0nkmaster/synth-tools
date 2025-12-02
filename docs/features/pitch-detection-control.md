# Pitch Detection & Control

## Overview
Enhanced per-slice pitch adjustment with automatic pitch detection and dial control. Detected pitch is displayed in real-time as user adjusts the dial.

## Current Implementation
- Text input field for pitch adjustment
- No pitch detection
- No visual feedback of current pitch

## Proposed Features

### 1. Automatic Pitch Detection
**Goal**: Detect and display the fundamental frequency of each audio slice.

**Implementation**:
- Run pitch detection on slice load (autocorrelation or YIN algorithm)
- Display detected pitch as note name (e.g., "C4", "A#3", "D5")
- Handle unpitched/noise samples gracefully (show "N/A")

**Detection Parameters**:
- Frequency range: 20 Hz - 4,186 Hz (C0 - C8)
- Analysis window: First 100-500ms of slice (skip silence)

### 2. Dial Control with Real-Time Note Display
**Goal**: Adjust pitch via dial while seeing resulting note in real-time.

**UI Components**:
- **Rotary dial or slider**: -12 to +12 semitones
- **Detected note display**: Shows original pitch (e.g., "A3")
- **Current note display**: Updates in real-time as dial moves (e.g., "C4")
- **Semitone offset**: Shows adjustment (e.g., "+3 st")

**UI Layout**:
```
┌─────────────────────────────────────┐
│ Original: A3 → Current: C4          │
├─────────────────────────────────────┤
│        ┌───────┐                    │
│        │   ●   │  +3 st             │
│        └───────┘                    │
│   [-12 ========== +12]              │
└─────────────────────────────────────┘
```

**Behavior**:
- Smooth continuous adjustment (0.1 semitone increments)
- Real-time note calculation: detected pitch + semitone offset
- Double-click dial to reset to 0
- Scroll wheel support for fine adjustment

**Note Calculation**:
```typescript
// Example: A3 (220 Hz) + 3 semitones = C4 (261.63 Hz)
const targetFreq = detectedFreq * Math.pow(2, semitones / 12);
const targetNote = frequencyToNote(targetFreq); // "C4"
```

## Technical Implementation

### Pitch Detection Library
- Use `pitchy` or `aubio.js` for browser-based detection
- Run in Web Worker to avoid blocking UI
- Cache detection results per slice

### Pitch Shifting
- Already handled by OP-Z hardware (via metadata)
- Preview uses Web Audio API pitch shift node

### Data Model
```typescript
interface SlicePitch {
  detectedNote: string | null;      // "A3", "C#4", null
  detectedFrequency: number | null; // Hz
  semitoneOffset: number;            // -12 to +12
  currentNote: string | null;        // Calculated in real-time
  currentFrequency: number | null;   // Calculated in real-time
}
```

### OP-Z Metadata Mapping
- OP-Z pitch parameter: 0-16384 (8192 = no shift)
- 1 semitone ≈ 683 units
- Formula: `pitch = 8192 + (semitones * 683)`

### Frequency to Note Conversion
```typescript
function frequencyToNote(freq: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const a4 = 440;
  const semitones = 12 * Math.log2(freq / a4);
  const noteIndex = Math.round(semitones + 9) % 12;
  const octave = Math.floor((semitones + 9) / 12) + 4;
  return `${noteNames[noteIndex]}${octave}`;
}
```

## User Workflow

### Scenario: Tune Kick Drum
1. Load kick drum sample
2. App detects "A2" (110 Hz) and displays it
3. User rotates dial to +3 semitones
4. Display updates in real-time: "A2 → C3"
5. Preview and export

## Edge Cases

**No Pitch Detected**:
- Show "N/A" for original note
- Current note shows "N/A" (no calculation possible)
- Dial still functional (stores semitone offset)

**Noise/Percussion**:
- Show "Unpitched" for original note
- Current note shows "N/A"
- Dial adjusts pitch parameter anyway (may affect timbre)

**Very Short Slices** (<50ms):
- Show "Too short" for original note
- Allow dial adjustment

## Success Metrics
- <500ms detection time per slice
- Real-time note display updates (<50ms latency)
- Accurate note calculation for all semitone offsets

## Future Enhancements
- Snap-to-semitone toggle
- Batch transpose all slices
- Chromatic scale auto-assignment
