# AI Sound Creation

## Overview

LLM-powered sound synthesis using comprehensive audio configuration and Web Audio API.

## Flow

1. User describes sound (text)
2. OpenAI generates SoundConfig JSON
3. Synthesizer renders audio from config
4. User plays/downloads result

## SoundConfig Schema

Comprehensive audio synthesis parameters:

- **Synthesis**: oscillator, noise, FM, granular
- **Envelope**: ADSR with curve types
- **Filter**: 6 types with envelope
- **LFO**: modulation routing
- **Effects**: distortion, reverb, delay, chorus, phaser, compressor
- **Spatial**: pan, stereo width
- **Timing**: duration, fades, tempo sync
- **Dynamics**: velocity, gain, normalization
- **Modulation**: matrix for complex routing

## Implementation

- `src/types/soundConfig.ts` - Type definitions
- `src/services/openai.ts` - LLM integration
- `src/audio/synthesizer.ts` - Web Audio rendering
- `src/pages/SoundCreation.tsx` - UI

## Examples

**Kick drum**: "Deep 808 kick with subtle distortion"
**Snare**: "Tight snare with reverb tail"
**Synth**: "Warm pad with slow LFO and chorus"
**FX**: "Metallic riser with delay feedback"
