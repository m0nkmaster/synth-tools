# Classification System

Audio analysis, drum classification, and pitch detection algorithms.

## Overview

The classification system automatically analyzes audio samples to determine:
- **Sample type**: drum_hit, melodic, or unknown
- **Drum class**: kick, snare, hat, cymbal, or other (if drum_hit)
- **Pitch**: Note name and frequency (if melodic)
- **Confidence**: 0-1 score indicating classification certainty

## Purpose

**Auto-naming**: Prefix filenames with detected type (e.g., `kick_808.wav`)  
**Organization**: Group similar sounds together  
**Pitch display**: Show detected note for melodic samples  
**User feedback**: Confidence score indicates reliability

## Architecture

```
Audio File
    ↓
[Decode] → AudioBuffer
    ↓
[Downmix] → Mono Float32Array
    ↓
[Normalize] → Peak = 1.0
    ↓
[Trim Silence] → Remove quiet sections
    ↓
[Spectral Analysis] → Features
    ↓
[Decision Tree] → Classification
    ↓
SampleAnalysis { type, drumClass?, noteName?, confidence }
```

## Spectral Analysis

### FFT (Fast Fourier Transform)

**Purpose**: Convert time-domain audio to frequency-domain spectrum.

**Implementation**:
```typescript
function computeSpectrum(buffer: Float32Array, sampleRate: number): Spectrum {
  const fftSize = 2048;
  const windowed = new Float32Array(fftSize);
  const length = Math.min(fftSize, buffer.length);
  
  // Apply Hann window
  for (let i = 0; i < length; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
    windowed[i] = buffer[i] * hann;
  }

  // Compute DFT (naive implementation)
  const magnitudes = new Float32Array(fftSize / 2);
  for (let k = 0; k < fftSize / 2; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = (-2 * Math.PI * k * n) / fftSize;
      const sample = windowed[n] || 0;
      re += sample * Math.cos(angle);
      im += sample * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(re * re + im * im);
  }

  return { magnitudes, binHz: sampleRate / fftSize };
}
```

**Why Hann Window?**
- Reduces spectral leakage
- Smooths frequency response
- Standard for audio analysis

**FFT Size**: 2048 bins
- Frequency resolution: 44100 / 2048 ≈ 21.5 Hz per bin
- Time resolution: 2048 / 44100 ≈ 46 ms
- Trade-off: Larger FFT = better frequency resolution, worse time resolution

### Feature Extraction

#### 1. Spectral Centroid

**Definition**: Weighted average of frequencies (frequency "center of mass").

**Formula**:
```
centroid = Σ(freq[i] × magnitude[i]) / Σ(magnitude[i])
```

**Implementation**:
```typescript
function computeSpectralCentroid(spectrum: Spectrum, sampleRate: number): number {
  const mags = spectrum.magnitudes;
  const fftSize = 2048;
  let weighted = 0;
  let total = 0;
  
  for (let i = 0; i < mags.length; i++) {
    const freq = (i * sampleRate) / fftSize;
    weighted += freq * mags[i];
    total += mags[i];
  }
  return total > 0 ? weighted / total : 0;
}
```

**Interpretation**:
- Low centroid (<300 Hz): Bass-heavy (kicks, subs)
- Mid centroid (600-3000 Hz): Snares, toms
- High centroid (>4000 Hz): Hats, cymbals, bright sounds

#### 2. Band Energy

**Definition**: Proportion of energy in specific frequency bands.

**Bands**:
- Low: 0-200 Hz (bass, kick fundamentals)
- Mid: 200-2000 Hz (snare body, toms, vocals)
- High: 2000-22050 Hz (hats, cymbals, brightness)

**Implementation**:
```typescript
function computeBandEnergy(
  spectrum: Spectrum,
  sampleRate: number,
  low: number,
  high: number
): number {
  const mags = spectrum.magnitudes;
  const binHz = sampleRate / 2048;
  const lowBin = Math.max(0, Math.floor(low / binHz));
  const highBin = Math.min(mags.length - 1, Math.ceil(high / binHz));

  let band = 0;
  let total = 0;
  for (let i = 0; i < mags.length; i++) {
    const mag = mags[i];
    if (i >= lowBin && i <= highBin) band += mag * mag;
    total += mag * mag;
  }
  return total > 0 ? band / total : 0;
}
```

**Usage**:
```typescript
const bandEnergy = {
  low: computeBandEnergy(spectrum, sampleRate, 0, 200),
  mid: computeBandEnergy(spectrum, sampleRate, 200, 2000),
  high: computeBandEnergy(spectrum, sampleRate, 2000, sampleRate / 2)
};

// Kick: low > mid && low > high
// Hat: high > low && high > mid
```

#### 3. Spectral Flatness

**Definition**: Ratio of geometric mean to arithmetic mean of spectrum.

**Formula**:
```
flatness = (Π magnitude[i])^(1/N) / (Σ magnitude[i] / N)
```

**Implementation**:
```typescript
function computeSpectralFlatness(spectrum: Spectrum): number {
  const mags = spectrum.magnitudes;
  let geo = 0;
  let arith = 0;
  const eps = 1e-12;
  
  for (let i = 0; i < mags.length; i++) {
    const mag = mags[i] + eps;
    geo += Math.log(mag);
    arith += mag;
  }
  geo = Math.exp(geo / mags.length);
  arith /= mags.length;
  return arith > 0 ? geo / arith : 0;
}
```

**Interpretation**:
- High flatness (>0.35): Noise-like (drums, percussion)
- Low flatness (<0.35): Tonal (melodic instruments, vocals)

**Why?**
- Drums have broad, flat spectra
- Melodic sounds have harmonic peaks

#### 4. Harmonic Concentration

**Definition**: Ratio of peak magnitude to average magnitude.

**Implementation**:
```typescript
function computeHarmonicConcentration(spectrum: Spectrum): number {
  const mags = spectrum.magnitudes;
  let max = 0;
  let sum = 0;
  
  for (let i = 0; i < mags.length; i++) {
    const mag = mags[i];
    if (mag > max) max = mag;
    sum += mag;
  }
  const avg = sum / Math.max(1, mags.length);
  return avg > 0 ? max / avg : 0;
}
```

**Interpretation**:
- High concentration (>3): Strong fundamental (melodic)
- Low concentration (<3): Diffuse energy (drums, noise)

## Classification Decision Tree

### Level 1: Sample Type

```typescript
function decideSampleType(params: {
  durationSeconds: number;
  flatness: number;
  harmonicConcentration: number;
}): { sampleType: SampleType; confidenceBoost: number } {
  const { durationSeconds, flatness, harmonicConcentration } = params;

  // Percussive: Short + noisy
  const percussive = 
    durationSeconds < 0.5 && 
    flatness > 0.35;

  // Melodic: Harmonic + tonal
  const melodic = 
    harmonicConcentration > 3 && 
    flatness < 0.35;

  if (percussive && !melodic) {
    return { sampleType: 'drum_hit', confidenceBoost: 0.5 };
  }

  if (melodic) {
    return { sampleType: 'melodic', confidenceBoost: 0.5 };
  }

  // Extended drum check (longer, less noisy)
  if (durationSeconds < 0.9 && flatness > 0.45) {
    return { sampleType: 'drum_hit', confidenceBoost: 0.35 };
  }

  return { sampleType: 'unknown', confidenceBoost: 0.2 };
}
```

**Thresholds** (tunable in `src/config.ts`):
```typescript
DRUM_HIT_MAX_DURATION: 0.5,        // Typical drum hit
DRUM_HIT_EXTENDED_DURATION: 0.9,   // Longer drums (cymbals, toms)
FLATNESS_DRUM_THRESHOLD: 0.35,     // Noise threshold
FLATNESS_MELODIC_THRESHOLD: 0.35,  // Tone threshold
HARMONIC_CONCENTRATION_THRESHOLD: 3, // Harmonic strength
```

### Level 2: Drum Classification

```typescript
function classifyDrum(features: {
  centroid: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
  durationSeconds: number;
  flatness: number;
}): DrumClass {
  const { centroid, lowEnergy, midEnergy, highEnergy, durationSeconds } = features;

  // Kick: Low frequency, bass-heavy
  if (lowEnergy > midEnergy && 
      lowEnergy > highEnergy && 
      centroid < 300) {
    return 'kick';
  }

  // Hat: High frequency, short duration
  if (highEnergy > lowEnergy && 
      highEnergy > midEnergy && 
      centroid > 4000 && 
      durationSeconds < 0.5) {
    return 'hat';
  }

  // Snare: Mid frequency, balanced energy
  if (centroid > 600 && 
      centroid < 3000 && 
      (midEnergy + lowEnergy) > highEnergy * 0.6) {
    return 'snare';
  }

  // Cymbal: High frequency, long duration
  if (highEnergy > 0.45 && 
      durationSeconds > 0.5) {
    return 'cymbal';
  }

  return 'other';
}
```

**Thresholds** (tunable in `src/config.ts`):
```typescript
KICK_CENTROID_MAX: 300,           // Max frequency for kick
SNARE_CENTROID_MIN: 600,          // Min frequency for snare
SNARE_CENTROID_MAX: 3000,         // Max frequency for snare
SNARE_MID_LOW_RATIO: 0.6,         // Mid+Low vs High ratio
HAT_CENTROID_MIN: 4000,           // Min frequency for hat
HAT_DURATION_MAX: 0.5,            // Max duration for hat
CYMBAL_HIGH_ENERGY_MIN: 0.45,    // Min high energy for cymbal
CYMBAL_DURATION_MIN: 0.5,         // Min duration for cymbal
```

## Confidence Scoring

### Base Confidence

```typescript
let confidence = 0.5; // Start at 50%
```

### Boosts

**RMS (Loudness)**:
```typescript
confidence += rms * 0.1; // Louder = more confident
```

**Band Dominance**:
```typescript
const bandDominanceScore = (bands: { low: number; mid: number; high: number }): number => {
  const values = [bands.low, bands.mid, bands.high];
  const max = Math.max(...values);
  const sum = bands.low + bands.mid + bands.high + 1e-6;
  return max / sum; // 0.33 = balanced, 1.0 = single band dominant
};

confidence += bandDominanceScore(bandEnergy) * 0.2;
```

**Flatness** (for drums):
```typescript
if (sampleType === 'drum_hit') {
  confidence += flatness * 0.5; // Noisier = more confident
}
```

**Harmonicity** (for melodic):
```typescript
if (sampleType === 'melodic') {
  confidence += (1 - flatness) * 0.5; // More tonal = more confident
  confidence += harmonicConcentration * 0.1; // Stronger harmonics = more confident
}
```

### Penalties

**No pitch detected** (for melodic):
```typescript
if (sampleType === 'melodic' && !freq) {
  confidence = Math.max(0.3, confidence * 0.6);
}
```

### Clamping

```typescript
confidence = clamp(confidence, 0, 1);
```

### Interpretation

- **0.0-0.3**: Low confidence (likely misclassified)
- **0.3-0.6**: Medium confidence (reasonable guess)
- **0.6-0.8**: High confidence (likely correct)
- **0.8-1.0**: Very high confidence (almost certain)

## Pitch Detection

### Algorithm: Autocorrelation

**Purpose**: Find the fundamental frequency of a periodic signal.

**Principle**: A periodic signal correlates with itself at lag = period.

**Steps**:
1. Compute RMS (reject if too quiet)
2. Normalize buffer
3. Compute autocorrelation for each lag
4. Find lag with maximum correlation
5. Refine with parabolic interpolation
6. Convert lag to frequency: `freq = sampleRate / lag`

### Implementation

```typescript
function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  const size = buffer.length;
  
  // 1. Compute RMS
  let rms = 0;
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return null; // Too quiet
  
  // 2. Normalize
  const normalized = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    normalized[i] = buffer[i] / rms;
  }
  
  // 3. Autocorrelation
  const minPeriod = Math.floor(sampleRate / 1000); // 1000 Hz max
  const maxPeriod = Math.floor(sampleRate / 50);   // 50 Hz min
  
  let bestOffset = -1;
  let bestCorrelation = -1;
  
  for (let offset = minPeriod; offset < Math.min(maxPeriod, size / 2); offset++) {
    let sum = 0;
    for (let i = 0; i < size - offset; i++) {
      sum += normalized[i] * normalized[i + offset];
    }
    const correlation = sum / (size - offset);
    
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  
  // 4. Parabolic interpolation
  if (bestCorrelation > 0.1 && bestOffset > minPeriod && bestOffset < maxPeriod - 1) {
    let y1 = 0;
    const y2 = bestCorrelation;
    let y3 = 0;
    
    for (let i = 0; i < size - bestOffset - 1; i++) {
      y1 += normalized[i] * normalized[i + bestOffset - 1];
      y3 += normalized[i] * normalized[i + bestOffset + 1];
    }
    y1 /= (size - bestOffset - 1);
    y3 /= (size - bestOffset - 1);
    
    const a = (y1 + y3 - 2 * y2) / 2;
    if (a !== 0) {
      const parabolicOffset = (y1 - y3) / (2 * a);
      bestOffset += parabolicOffset;
    }
  }
  
  // 5. Convert to frequency
  return bestCorrelation > 0.1 ? sampleRate / bestOffset : null;
}
```

### Why Parabolic Interpolation?

**Problem**: Discrete lag values give coarse frequency estimates.

**Solution**: Fit parabola to 3 points around peak, find true maximum.

**Benefit**: Sub-sample accuracy (e.g., 440.2 Hz instead of 440 Hz).

### Frequency Range

**Min**: 50 Hz (maxPeriod = sampleRate / 50)  
**Max**: 1000 Hz (minPeriod = sampleRate / 1000)

**Why?**
- Below 50 Hz: Unreliable (too few cycles in window)
- Above 1000 Hz: Better algorithms exist (YIN, HPS)

**Extended Range** (in config):
```typescript
PITCH: {
  MIN_FREQUENCY: 20,
  MAX_FREQUENCY: 4186, // C8
  MIN_PERIOD_HZ: 1000,
  MAX_PERIOD_HZ: 50,
}
```

### Frequency → Note Conversion

```typescript
export const freqToMidi = (freq: number): number =>
  69 + 12 * Math.log2(freq / 440);

export const midiToNoteName = (midi: number): string => {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const note = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[note]}${octave}`;
};

export const frequencyToNote = (freq: number): string =>
  midiToNoteName(Math.round(freqToMidi(freq)));
```

**Example**:
- 440 Hz → MIDI 69 → A4
- 261.63 Hz → MIDI 60 → C4
- 880 Hz → MIDI 81 → A5

## Tuning the Classifier

### Process

1. **Collect test samples**: Diverse library of labeled samples
2. **Run classification**: `bun test src/audio/classify.test.ts`
3. **Analyze errors**: Which samples are misclassified?
4. **Adjust thresholds**: Edit `src/config.ts`
5. **Re-test**: Iterate until accuracy is acceptable

### Common Issues

**Kicks classified as toms**:
- Lower `KICK_CENTROID_MAX` (e.g., 250 Hz)
- Increase low band weight

**Snares classified as other**:
- Widen `SNARE_CENTROID_MIN/MAX` range
- Adjust `SNARE_MID_LOW_RATIO`

**Hats classified as cymbals**:
- Lower `HAT_DURATION_MAX` (e.g., 0.3s)
- Increase `HAT_CENTROID_MIN` (e.g., 5000 Hz)

**Melodic samples classified as unknown**:
- Lower `HARMONIC_CONCENTRATION_THRESHOLD` (e.g., 2.5)
- Adjust `FLATNESS_MELODIC_THRESHOLD`

### Test Suite

```typescript
describe('classifyAudio', () => {
  it('classifies kick drum', async () => {
    const blob = await loadTestFile('kick.wav');
    const analysis = await classifyAudio(blob);
    expect(analysis.type).toBe('drum_hit');
    expect(analysis.drumClass).toBe('kick');
    expect(analysis.confidence).toBeGreaterThan(0.6);
  });
  
  it('classifies melodic sample with pitch', async () => {
    const blob = await loadTestFile('piano-c4.wav');
    const analysis = await classifyAudio(blob);
    expect(analysis.type).toBe('melodic');
    expect(analysis.noteName).toBe('C4');
    expect(analysis.midiNote).toBe(60);
  });
});
```

## Limitations

### Classification

**Polyphonic audio**: Only works on monophonic samples  
**Layered sounds**: May misclassify (e.g., kick + clap)  
**Processed samples**: Heavy effects can confuse classifier  
**Edge cases**: Ambiguous sounds (e.g., 808 bass vs kick)

### Pitch Detection

**Polyphonic**: Cannot detect multiple pitches  
**Inharmonic**: Fails on bells, metallic sounds  
**Noisy**: Fails on distorted or noisy samples  
**Octave errors**: May detect wrong octave (2× or 0.5× freq)

### Confidence

**Not calibrated**: Confidence is relative, not absolute probability  
**Overconfident**: May report high confidence on misclassifications  
**Underconfident**: May report low confidence on correct classifications

## Future Improvements

### Machine Learning

**Approach**: Train neural network on labeled dataset  
**Benefits**: Higher accuracy, fewer manual thresholds  
**Challenges**: Requires large dataset, training infrastructure

### Advanced Pitch Detection

**YIN Algorithm**: More robust than autocorrelation  
**HPS (Harmonic Product Spectrum)**: Better for high frequencies  
**Cepstrum**: Better for inharmonic sounds

### Multi-Label Classification

**Current**: Single label per sample  
**Future**: Multiple labels (e.g., "kick + clap", "snare + reverb")

### User Feedback Loop

**Approach**: Let users correct misclassifications  
**Benefits**: Improve classifier over time  
**Implementation**: Store corrections, retrain periodically

---

**Next**: [Synthesis Engine](./synthesis.md)
