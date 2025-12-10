# Synthesis Engine

AI-powered sound generation using Web Audio API.

## Overview

The synthesis engine generates audio from text descriptions using:
- **AI providers**: OpenAI GPT-5.1, Google Gemini 3 Pro
- **Synthesis methods**: Oscillators, noise, FM, Karplus-Strong
- **Effects**: Reverb, delay, distortion, compression, gate
- **Modulation**: LFO, envelopes, filters

## Architecture

```
Text Prompt
    ↓
AI Provider (OpenAI/Gemini)
    ↓
SoundConfig (JSON)
    ↓
synthesizeSound()
    ↓
OfflineAudioContext
    ↓
AudioBuffer
    ↓
WAV Blob
```

## SoundConfig Schema

```typescript
type SoundConfig = {
  synthesis: {
    layers: Array<{
      type: 'oscillator' | 'noise' | 'fm' | 'karplus-strong';
      gain: number;
      oscillator?: { waveform, frequency, detune, unison?, sub? };
      noise?: { type: 'white' | 'pink' | 'brown' };
      fm?: { carrier, modulator, modulationIndex };
      karplus?: { frequency, damping, pluckLocation? };
      filter?: { type, frequency, q, envelope? };
      saturation?: { type, drive, mix };
      envelope?: { attack, decay, sustain, release };
    }>;
  };
  envelope: { attack, decay, sustain, release, attackCurve?, releaseCurve? };
  filter?: { type, frequency, q, gain?, envelope? };
  lfo?: { waveform, frequency, depth, target, phase?, delay?, fade? };
  effects: {
    distortion?: { amount };
    compressor?: { threshold, ratio, attack, release, knee };
    gate?: { attack, hold, release };
    delay?: { time, feedback, mix, sync?, pingPong? };
    reverb?: { type, size, decay, damping, mix, predelay };
  };
  spatial: { pan, width };
  timing: { duration };
  dynamics: { velocity, gain, normalize };
  metadata: { name, category, description, tags };
};
```

## AI Integration

### System Prompt

Instructs AI to generate valid SoundConfig JSON with synthesis rules:

**Drums**:
- Kicks: 40-80Hz sine + sub, attack <2ms, decay 50-100ms
- Snares: 180-250Hz tone + white noise (bandpass 2-4kHz)
- Hats: white/pink noise highpass >8kHz, decay <100ms

**Bass**:
- Sub: 40-80Hz sine/triangle, long sustain
- Mid: 80-250Hz saw/square, filter envelope

**Leads/Pads**:
- Leads: saw/square 200-2000Hz, unison 3-5 voices
- Pads: detuned saws, slow attack >100ms, reverb

### Provider Abstraction

```typescript
export async function generateSoundConfig(
  description: string,
  provider: AIProvider,
  currentConfig?: SoundConfig
): Promise<SoundConfig> {
  const config = provider === 'openai'
    ? await generateWithOpenAI(description, currentConfig)
    : await generateWithGemini(description, currentConfig);
  
  ensureDefaults(config);
  validateConfig(config);
  return config;
}
```

### Iterative Refinement

```typescript
// Initial generation
const config = await generateSoundConfig("Deep 808 kick", "openai");

// Refinement
const refined = await generateSoundConfig(
  "Make it punchier with more attack",
  "openai",
  config // Pass current config
);
```

## Synthesis Methods

### Oscillators

**Types**: sine, square, sawtooth, triangle

**Unison**: Multiple detuned voices for thickness
```typescript
const unison = { voices: 3, detune: 10, spread: 0.5 };
```

**Sub-oscillator**: Octave below for bass weight
```typescript
const sub = { waveform: 'sine', octave: 1, level: 0.3 };
```

### Noise

**Types**:
- **White**: Equal energy across frequencies
- **Pink**: -3dB/octave rolloff (more natural)
- **Brown**: -6dB/octave rolloff (darker)

**Implementation**:
```typescript
// Pink noise (Paul Kellet filter)
let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
for (let i = 0; i < bufferSize; i++) {
  const white = Math.random() * 2 - 1;
  b0 = 0.99886 * b0 + white * 0.0555179;
  b1 = 0.99332 * b1 + white * 0.0750759;
  b2 = 0.96900 * b2 + white * 0.1538520;
  b3 = 0.86650 * b3 + white * 0.3104856;
  b4 = 0.55000 * b4 + white * 0.5329522;
  b5 = -0.7616 * b5 + white * -0.0168980;
  data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
  b6 = white * 0.115926;
}
```

### FM Synthesis

**Principle**: Modulate carrier frequency with modulator

```typescript
const carrier = ctx.createOscillator();
const modulator = ctx.createOscillator();
const modulatorGain = ctx.createGain();

carrier.frequency.value = 200; // Carrier freq
modulator.frequency.value = 400; // Modulator freq (2× = harmonic)
modulatorGain.gain.value = 30; // Modulation index (brightness)

modulator.connect(modulatorGain);
modulatorGain.connect(carrier.frequency); // FM!
modulator.start(0);
```

**Use cases**:
- Bells: High modulation index, inharmonic ratios
- Brass: Medium index, harmonic ratios
- Bass: Low index, sub-harmonic ratios

### Karplus-Strong

**Principle**: Physical modeling of plucked string

**Algorithm**:
1. Fill delay line with noise (pluck)
2. Feed output back through lowpass filter (damping)
3. Result: Decaying harmonic tone

```typescript
// Initialize ring buffer with noise
const N = Math.floor(sampleRate / frequency);
const ring = new Float32Array(N);
for (let i = 0; i < N; i++) {
  ring[i] = Math.random() * 2 - 1;
}

// Generate audio
let pointer = 0;
let prevSample = 0;
const damping = 1 - (config.damping * 0.1);

for (let i = 0; i < bufferSize; i++) {
  const val = ring[pointer];
  data[i] = val;
  
  // Lowpass filter + feedback
  const newVal = damping * 0.5 * (val + prevSample);
  ring[pointer] = newVal;
  
  prevSample = val;
  pointer = (pointer + 1) % N;
}
```

**Use cases**:
- Plucked strings (guitar, bass, harp)
- Percussion (marimba, kalimba)
- Synthetic tones

## Envelopes

### ADSR

**Stages**:
- **Attack**: 0 → Peak
- **Decay**: Peak → Sustain level
- **Sustain**: Hold at sustain level
- **Release**: Sustain → 0

```typescript
function applyEnvelope(
  param: AudioParam,
  envelope: { attack, decay, sustain, release },
  config: SoundConfig,
  peakValue: number
) {
  const { attack, decay, sustain, release } = envelope;
  const sustainLevel = Math.max(0, Math.min(1, sustain));
  const duration = config.timing.duration;
  
  const SILENCE = 0.0001; // -80dB floor
  
  param.setValueAtTime(SILENCE, 0);
  param.exponentialRampToValueAtTime(peakValue, attack);
  param.exponentialRampToValueAtTime(
    Math.max(SILENCE, peakValue * sustainLevel),
    attack + decay
  );
  param.setValueAtTime(
    Math.max(SILENCE, peakValue * sustainLevel),
    duration - release
  );
  param.exponentialRampToValueAtTime(SILENCE, duration);
}
```

**Why exponential ramps?**
- Sounds more natural (human perception is logarithmic)
- Avoids clicks (smooth transitions)

**Why -80dB floor?**
- Prevents `setValueAtTime(0)` errors
- Inaudible but non-zero

### Filter Envelope

Modulates filter cutoff frequency:

```typescript
const startFreq = baseFreq;
const peakFreq = baseFreq + amount;
const sustainFreq = baseFreq + (amount * sustainLevel);

filter.frequency.setValueAtTime(startFreq, 0);
filter.frequency.exponentialRampToValueAtTime(peakFreq, attack);
filter.frequency.exponentialRampToValueAtTime(sustainFreq, attack + decay);
filter.frequency.setValueAtTime(sustainFreq, duration - release);
filter.frequency.exponentialRampToValueAtTime(startFreq, duration);
```

**Use cases**:
- Sweeping bass (low start, high peak)
- Plucks (high start, low sustain)
- Pads (slow attack, high sustain)

## Effects

### Distortion/Saturation

**Waveshaping**: Non-linear transfer function

```typescript
const curve = new Float32Array(256);
const drive = config.drive; // 0-10
const mix = config.mix; // 0-1

for (let i = 0; i < 256; i++) {
  const x = (i - 128) / 128; // -1 to 1
  let y: number;
  
  switch (config.type) {
    case 'soft': y = Math.tanh(x * drive); break;
    case 'hard': y = Math.max(-1, Math.min(1, x * drive)); break;
    case 'tube': y = x < 0 ? Math.tanh(x * drive * 0.8) : Math.tanh(x * drive * 1.2); break;
    default: y = Math.tanh(x * drive);
  }
  
  curve[i] = x * (1 - mix) + y * mix; // Dry/wet mix
}

shaper.curve = curve;
```

### Reverb

**Convolution**: Impulse response simulation

```typescript
const length = ctx.sampleRate * config.decay; // e.g., 2s
const impulse = ctx.createBuffer(2, length, ctx.sampleRate);

for (let channel = 0; channel < 2; channel++) {
  const data = impulse.getChannelData(channel);
  for (let i = 0; i < length; i++) {
    // Random noise with exponential decay
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, config.damping * 3);
  }
}

convolver.buffer = impulse;
```

**Dry/Wet Mix**:
```typescript
input.connect(dryGain); // Dry path
dryGain.connect(output);

input.connect(reverb); // Wet path
reverb.connect(wetGain);
wetGain.connect(output);

dryGain.gain.value = 1 - mix;
wetGain.gain.value = mix;
```

### Delay

**Feedback Loop**:
```typescript
const delay = ctx.createDelay(2.0); // Max 2s
delay.delayTime.value = config.time; // e.g., 0.5s

const feedback = ctx.createGain();
feedback.gain.value = config.feedback; // e.g., 0.6

const filter = ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 4000; // Dampen repeats

input.connect(delay);
delay.connect(filter);
filter.connect(feedback);
feedback.connect(delay); // Feedback loop!

filter.connect(wetGain);
wetGain.connect(output);
```

### Compressor

**Dynamic range reduction**:
```typescript
const comp = ctx.createDynamicsCompressor();
comp.threshold.value = -24; // dB
comp.ratio.value = 12; // 12:1
comp.attack.value = 0.003; // 3ms
comp.release.value = 0.25; // 250ms
comp.knee.value = 30; // Soft knee
```

### Gate

**Gated reverb** (80s snare effect):
```typescript
const envelope = ctx.createGain();
envelope.gain.setValueAtTime(0, 0);
envelope.gain.linearRampToValueAtTime(1, attack); // Open
envelope.gain.setValueAtTime(1, attack + hold); // Hold
envelope.gain.linearRampToValueAtTime(0, attack + hold + release); // Close

input.connect(envelope);
envelope.connect(output);
```

## LFO (Low Frequency Oscillator)

**Modulation targets**:
- **Filter**: Wah-wah, wobble bass
- **Amplitude**: Tremolo
- **Pan**: Auto-pan

```typescript
const lfo = ctx.createOscillator();
lfo.type = config.waveform; // sine, square, triangle, sawtooth, random
lfo.frequency.value = config.frequency; // e.g., 4 Hz

const lfoGain = ctx.createGain();
lfoGain.gain.value = 0;

// Fade in
if (config.delay > 0) {
  lfoGain.gain.setValueAtTime(0, config.delay);
  lfoGain.gain.linearRampToValueAtTime(1, config.delay + config.fade);
}

lfo.connect(lfoGain);

// Route to target
switch (config.target) {
  case 'filter':
    const filterGain = ctx.createGain();
    filterGain.gain.value = filter.frequency.value * config.depth;
    lfoGain.connect(filterGain);
    filterGain.connect(filter.frequency);
    break;
    
  case 'amplitude':
    const ampGain = ctx.createGain();
    ampGain.gain.value = config.depth;
    lfoGain.connect(ampGain);
    ampGain.connect(output.gain);
    break;
}

lfo.start(0);
```

## Effects Tail

**Problem**: Reverb/delay continue after note ends.

**Solution**: Extend render duration to capture tail.

```typescript
function calculateEffectsTail(config: SoundConfig): number {
  let tail = 0;

  if (config.effects?.reverb) {
    tail = Math.max(tail, config.effects.reverb.decay);
  }

  if (config.effects?.delay) {
    const { time = 0.25, feedback = 0.3 } = config.effects.delay;
    // Estimate t60: feedback^n < 0.001
    const repeats = -3 / Math.log10(Math.max(0.01, feedback));
    const delayTail = repeats * time;
    tail = Math.max(tail, Math.min(10, delayTail)); // Cap at 10s
  }

  return tail > 0 ? tail + 0.1 : 0.1; // Safety buffer
}

const totalDuration = config.timing.duration + calculateEffectsTail(config);
```

## Validation

```typescript
function validateConfig(config: SoundConfig): void {
  // Clamp frequencies
  config.synthesis.layers.forEach(layer => {
    if (layer.oscillator?.frequency) {
      layer.oscillator.frequency = Math.max(20, Math.min(20000, layer.oscillator.frequency));
    }
  });

  // Ensure envelope fits duration
  const totalEnv = config.envelope.attack + config.envelope.decay + config.envelope.release;
  if (totalEnv > config.timing.duration) {
    const scale = config.timing.duration / totalEnv;
    config.envelope.attack *= scale;
    config.envelope.decay *= scale;
    config.envelope.release *= scale;
  }
}
```

## Testing

```typescript
describe('synthesizeSound', () => {
  it('generates 808 kick', async () => {
    const config: SoundConfig = {
      synthesis: {
        layers: [{
          type: 'oscillator',
          gain: 0.8,
          oscillator: { waveform: 'sine', frequency: 60, detune: 0 }
        }]
      },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.1 },
      timing: { duration: 0.5 },
      dynamics: { velocity: 0.9, gain: 0, normalize: true }
    };
    
    const buffer = await synthesizeSound(config);
    expect(buffer.duration).toBeCloseTo(0.5, 1);
    expect(buffer.numberOfChannels).toBe(2);
  });
});
```

---

**Next**: [State Management](./state-management.md)
