# OP Done Synthesizer

## Overview

Browser-based audio synthesis engine that generates sounds from text descriptions using AI-powered parameter generation and Web Audio API.

## Architecture

```
Text Prompt → OpenAI API → SoundConfig JSON → Web Audio Graph → WAV Export
```

## Core Components

### 1. Sound Configuration (`SoundConfig`)
JSON structure defining all synthesis parameters:
- **Timing**: Duration, tempo
- **Synthesis**: Layer-based sound design (oscillators, noise, FM)
- **Envelope**: ADSR amplitude shaping
- **Filter**: Frequency filtering with optional envelope
- **LFO**: Modulation (filter/amplitude/pan)
- **Effects**: Distortion, reverb, delay, compression
- **Dynamics**: Velocity control

### 2. Synthesis Engine (`synthesizer.ts`)

**Main Function**: `synthesizeSound(config: SoundConfig): Promise<AudioBuffer>`

Uses `OfflineAudioContext` for non-realtime rendering:
1. Creates audio graph from config
2. Renders to buffer
3. Normalizes output
4. Returns `AudioBuffer` for playback/export

## Layer System

Supports multiple simultaneous sound sources:

**Oscillator Layer**
- Waveforms: sine, square, sawtooth, triangle
- Unison: Multiple detuned voices (up to 8)
- Sub-oscillator: Octave-down bass layer
- Per-layer envelope, filter, saturation

**Noise Layer**
- White noise: Full spectrum
- Pink noise: 1/f filtered (Voss-McCartney algorithm)

**FM Layer**
- Carrier + modulator oscillators
- Modulation index control
- Classic FM synthesis

## Signal Flow

```
Layer Sources → Layer Filters → Layer Saturation → Layer Gain (Envelope)
    ↓
  Mixer → Master Filter (Envelope) → Master Gain (Envelope)
    ↓
  LFO Modulation → Effects Chain → Normalization → Output
```

## Key Features

### Envelopes
- ADSR (Attack, Decay, Sustain, Release)
- Applied to amplitude and filter frequency
- Exponential curves for natural sound

### Filters
- Types: lowpass, highpass, bandpass, notch, allpass, peaking, lowshelf, highshelf
- Frequency, Q (resonance), gain controls
- Optional envelope modulation

### LFO (Low Frequency Oscillator)
- Waveforms: sine, square, sawtooth, triangle, random
- Targets: filter frequency, amplitude, stereo pan
- Delay and fade-in for evolving sounds

### Effects
- **Distortion**: Waveshaping with tanh curves
- **Reverb**: Convolution-based with decay/damping
- **Delay**: Feedback delay line
- **Compressor**: Dynamics control

### Saturation
Per-layer waveshaping:
- Soft: Smooth tanh
- Hard: Hard clipping
- Tube: Asymmetric distortion
- Tape: Gentle compression

## Processing Pipeline

1. **Layer Generation**: Create oscillators/noise sources
2. **Layer Processing**: Apply filters, saturation, envelopes
3. **Mixing**: Combine layers with gain staging
4. **Master Processing**: Global filter and envelope
5. **Modulation**: Apply LFO if configured
6. **Effects**: Process through effects chain
7. **Normalization**: Scale to 0.95 peak to prevent clipping

## Safety Features

- `safeValue()`: Validates all numeric parameters
- Clamping: Limits values to valid ranges
- Exponential ramp protection: Minimum 0.001 for zero-crossing
- Frequency bounds: 20Hz - 20kHz
- Normalization: Prevents output clipping

## Output Format

- **Sample Rate**: 44.1 kHz
- **Channels**: Mono
- **Bit Depth**: 32-bit float (internal), 16-bit export
- **Duration**: Configurable (any length)
- **Normalization**: 95% peak level

## AI Integration

OpenAI generates `SoundConfig` from text prompts:
- Analyzes sound description
- Selects appropriate synthesis method
- Configures parameters for desired sound
- Returns JSON config for synthesis engine

## Use Cases

- **Sound Design**: Generate any type of sound (drums, bass, leads, pads, FX)
- **Sample Creation**: Export to WAV for OP-Z or other samplers
- **Experimentation**: Explore synthesis parameters
- **Audio Production**: Create custom sounds for music production

## Limitations

- Mono output only
- No real-time parameter control
- Requires OpenAI API key
- Browser-based (no VST/AU)

## Technical Details

- **Engine**: Web Audio API `OfflineAudioContext`
- **Rendering**: Non-realtime (faster than realtime)
- **Buffer Size**: Sample rate × duration
- **Noise Buffer**: 2-second looped buffer
- **Waveshaper Curve**: 65536 samples
- **Max Delay**: 5 seconds

## Future Enhancements

- Real-time parameter tweaking
- Preset library
- Wavetable synthesis
- Granular synthesis
- Multi-sample export
