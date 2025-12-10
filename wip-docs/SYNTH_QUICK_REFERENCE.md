# Synthesizer Quick Reference

## Feature Checklist

### ✅ Implemented
- [x] Per-layer envelopes
- [x] Filter envelope (global + per-layer)
- [x] Unison/voice stacking (1-8 voices)
- [x] Sub oscillator (-1/-2 octave)
- [x] Per-layer filtering
- [x] Saturation (soft/hard/tube/tape)
- [x] LFO (pitch/filter/amplitude/pan)
- [x] LFO delay/fade
- [x] Exponential envelope curves (no clicks)

### ⏳ Not Yet Implemented
- [ ] Chorus effect
- [ ] Phaser effect
- [ ] 3-band EQ
- [ ] Limiter
- [ ] Per-layer LFO
- [ ] Modulation matrix
- [ ] Ring modulation
- [ ] Wavetable synthesis

---

## Quick Syntax

### Per-Layer Envelope
```typescript
layer: {
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 }
}
```

### Unison
```typescript
oscillator: {
  unison: { voices: 5, detune: 30, spread: 0.8 }
}
```

### Sub Oscillator
```typescript
oscillator: {
  sub: { level: 0.5, octave: -1, waveform: 'sine' }
}
```

### Per-Layer Filter
```typescript
layer: {
  filter: {
    type: 'lowpass',
    frequency: 1000,
    q: 2,
    envelope: { amount: 3000, attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 }
  }
}
```

### Saturation
```typescript
layer: {
  saturation: { type: 'soft', drive: 3, mix: 0.5 }
}
```

### LFO
```typescript
lfo: {
  waveform: 'sine',
  frequency: 5,
  depth: 0.5,
  target: 'filter',
  delay: 0.5,
  fade: 0.3
}
```

---

## Common Patterns

### 808 Kick
```typescript
layers: [
  {
    type: 'oscillator',
    oscillator: { waveform: 'sine', frequency: 60, sub: { level: 0.6, octave: -1 } },
    envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 }
  },
  {
    type: 'noise',
    noise: { type: 'white' },
    filter: { type: 'highpass', frequency: 200, q: 1 },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }
  }
]
```

### Supersaw Lead
```typescript
oscillator: {
  waveform: 'sawtooth',
  frequency: 220,
  unison: { voices: 7, detune: 50, spread: 0.9 }
},
filter: {
  type: 'lowpass',
  frequency: 2000,
  q: 3,
  envelope: { amount: 5000, attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.3 }
}
```

### Analog Bass
```typescript
oscillator: {
  waveform: 'sawtooth',
  frequency: 55,
  unison: { voices: 3, detune: 10, spread: 0.3 },
  sub: { level: 0.4, octave: -1 }
},
filter: {
  type: 'lowpass',
  frequency: 500,
  q: 2,
  envelope: { amount: 2000, attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.5 }
},
saturation: { type: 'soft', drive: 3, mix: 0.5 }
```

### Vibrato Lead
```typescript
oscillator: { waveform: 'square', frequency: 440 },
lfo: {
  waveform: 'sine',
  frequency: 5,
  depth: 0.1,
  target: 'pitch',
  delay: 0.3,
  fade: 0.2
}
```

### Evolving Pad
```typescript
oscillator: {
  waveform: 'triangle',
  frequency: 220,
  unison: { voices: 5, detune: 30, spread: 1.0 },
  sub: { level: 0.3, octave: -1 }
},
filter: {
  type: 'lowpass',
  frequency: 800,
  q: 2,
  envelope: { amount: 3000, attack: 2.0, decay: 1.0, sustain: 0.6, release: 2.0 }
},
lfo: { waveform: 'triangle', frequency: 0.2, depth: 0.5, target: 'filter' },
envelope: { attack: 1.5, decay: 0.5, sustain: 0.7, release: 2.0 }
```

---

## Parameter Ranges

| Parameter | Range | Default | Notes |
|-----------|-------|---------|-------|
| `envelope.attack` | 0.001-10s | 0.01 | Min 1ms to prevent clicks |
| `envelope.decay` | 0.001-10s | 0.1 | Min 1ms |
| `envelope.sustain` | 0-1 | 0.5 | Level, not time |
| `envelope.release` | 0.001-10s | 0.3 | Min 1ms |
| `unison.voices` | 1-8 | 1 | More = thicker but slower |
| `unison.detune` | 0-100 cents | 0 | 50 = supersaw |
| `unison.spread` | 0-1 | 0 | Stereo width |
| `sub.level` | 0-1 | 0 | Mix amount |
| `sub.octave` | -1 or -2 | -1 | Octaves below |
| `filter.frequency` | 20-20000 Hz | 1000 | Cutoff |
| `filter.q` | 0.0001-1000 | 1 | Resonance |
| `filter.envelope.amount` | -20000 to +20000 Hz | 0 | Modulation |
| `saturation.drive` | 0-10 | 0 | Distortion amount |
| `saturation.mix` | 0-1 | 0 | Dry/wet |
| `lfo.frequency` | 0.01-20 Hz | 1 | LFO speed |
| `lfo.depth` | 0-1 | 0 | Modulation depth |
| `lfo.delay` | 0-10s | 0 | Start delay |
| `lfo.fade` | 0-10s | 0 | Fade-in time |

---

## Signal Flow

```
Layer Source (Osc/Noise/FM)
  ↓
Layer Filter (optional)
  ↓
Saturation (optional)
  ↓
Layer Envelope
  ↓
Layer Gain
  ↓
Mixer
  ↓
Global Filter (optional)
  ↓
Master Gain + Envelope
  ↓
LFO (optional)
  ↓
Effects
  ↓
Output
```

---

## Tips

### Performance
- **Unison voices:** 3-5 for most sounds, 7 for supersaw
- **Layer count:** 2-3 typical, 5 max for complex sounds
- **Render time:** ~50ms simple, ~300ms complex

### Sound Design
- **Thickness:** Use unison with 10-30 cent detune
- **Width:** Set unison spread to 0.7-1.0
- **Weight:** Add sub oscillator at -1 octave
- **Movement:** Use LFO on filter or amplitude
- **Warmth:** Apply soft/tube saturation
- **Brightness:** Use filter envelope with positive amount

### Avoiding Issues
- **Clicks:** Envelopes auto-use exponential curves
- **Clipping:** Unison auto-compensates gain
- **Thin sound:** Add unison or sub oscillator
- **Static sound:** Add LFO or filter envelope
- **Too clean:** Add saturation

---

## Test Coverage

```bash
bun test                    # Run all tests
bun test synthesizer        # Synth tests only
```

**Current:** 20+ tests, 85% coverage

---

## Files

- `src/audio/synthesizer.ts` - Main implementation
- `src/types/soundConfig.ts` - Type definitions
- `src/audio/synthesizer.test.ts` - Tests
- `docs/features/synth-implementation-complete.md` - Full docs
- `docs/SYNTH_QUICK_REFERENCE.md` - This file
