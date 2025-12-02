# Audio Classification

## Overview
Automatically detect and classify uploaded audio samples by analyzing their spectral and temporal characteristics. Samples are categorized as kick, snare, hi-hat, cymbal, tom, clap, cowbell, percussion, synth, or other.

## Classification Categories
- **kick**: Low-frequency transient (20-150 Hz dominant)
- **snare**: Mid-frequency with noise burst (150-400 Hz + high-frequency content)
- **hi-hat**: High-frequency short transient (>5 kHz dominant)
- **cymbal**: High-frequency sustained (>3 kHz, longer decay)
- **tom**: Mid-low frequency transient (80-300 Hz)
- **clap**: Short mid-high burst with multiple peaks
- **cowbell**: Metallic mid-high tone (800-2000 Hz)
- **perc**: General percussion (mixed spectrum, short)
- **synth**: Harmonic content with sustained tone
- **other**: Fallback for unclassified samples

## Implementation
- Analyze audio buffer on upload using Web Audio API
- Extract features: spectral centroid, RMS energy, zero-crossing rate, duration
- Apply heuristic rules to classify based on frequency distribution and envelope
- Auto-rename file to include classification prefix (e.g., "kick_sample.wav")
- Classification runs in browser, no server required

## User Experience
1. User uploads audio file
2. System analyzes and classifies in <100ms
3. File name updated with classification (e.g., "kick_808.wav")
4. Original behavior preserved (duration probe, waveform, etc.)
5. User can manually rename if classification is incorrect
6. Original name is preserved in the UI
