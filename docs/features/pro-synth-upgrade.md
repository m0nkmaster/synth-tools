# Pro-Grade Synthesizer Upgrade

## Overview

Transform OP-Done's synthesizer into a professional-grade sound design tool for **drums, melodic instruments, bass, pads, leads, and sound effects** - capable of producing sounds used by professional musicians and producers.

**Current Capability:** Already works for melodic synthesis! The architecture is sound-agnostic. This upgrade adds depth and expressiveness.

## Current State

**Working:**
- Basic oscillators (sine, square, saw, triangle)
- White/pink noise
- FM synthesis
- Single master envelope
- Basic effects (distortion, reverb, delay, compressor)
- Single filter (no envelope)

**Issues:**
- No per-layer envelopes (all layers share one envelope)
- Filter envelope defined but not implemented
- LFO system defined but not implemented
- No voice stacking/unison
- No modulation routing
- Limited timbral complexity
- Background noise/clicks from envelope discontinuities

## Goals

1. **Professional sound quality** - Clean, artifact-free audio
2. **Timbral complexity** - Rich, evolving sounds
3. **Expressive control** - Deep modulation capabilities
4. **Industry-standard features** - Match commercial synths
5. **Maintain simplicity** - Keep config intuitive

## Implementation Phases

### Phase 1: Core Synthesis (CRITICAL)

#### 1.1 Per-Layer Envelopes
**Priority:** P0 - Blocking for professional sounds

**Problem:** All layers share one master envelope, making complex timbres impossible.

**Solution:**
```typescript
layer: {
  envelope?: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    attackCurve: 'linear' | 'exponential';
    releaseCurve: 'linear' | 'exponential';
  };
}
```

**Use Cases:**
- **Drums:** Kick (sine + noise, different envelopes), snare (noise + sine)
- **Melodic:** Pluck (fast attack, no sustain), piano (medium attack/decay)
- **Pads:** Slow attack, long release, evolving layers
- **Bass:** Sub layer (long envelope) + harmonics (short envelope)

**Implementation:**
- Apply envelope to layer gain node instead of master
- Master envelope becomes optional (defaults to pass-through)
- Fallback to master envelope if layer envelope not specified

---

#### 1.2 Filter Envelope
**Priority:** P0 - Essential for movement

**Problem:** Config exists but not implemented. Static filters sound lifeless.

**Solution:**
```typescript
filter: {
  envelope?: {
    amount: number;      // -12000 to +12000 Hz
    attack: number;
    decay: number;
    sustain: number;     // 0-1 level
    release: number;
  };
}
```

**Use Cases:**
- **Bass:** Filter opens on attack, closes on release (classic analog)
- **Pluck:** Fast filter sweep down (guitar/harp emulation)
- **Pad:** Slow filter opening (evolving texture)
- **Percussion:** Sharp filter spike (tonal drums)
- **Lead:** Filter modulation for expression

**Implementation:**
- Create envelope that modulates filter.frequency
- Scale amount by filter's base frequency
- Use exponentialRampToValueAtTime for smooth curves

---

#### 1.3 Unison/Voice Stacking
**Priority:** P0 - Thickness and width

**Problem:** Single oscillator sounds thin and mono.

**Solution:**
```typescript
oscillator: {
  unison?: {
    voices: number;      // 1-8
    detune: number;      // cents spread (0-100)
    spread: number;      // stereo width 0-1
    blend: 'linear' | 'exponential';
  };
}
```

**Use Cases:**
- **Lead:** Supersaw (7 voices, 50 cent detune) for EDM leads
- **Bass:** 3 voices, 10 cent detune for analog thickness
- **Pad:** 5 voices, 30 cent detune, full spread for width
- **Strings:** 4 voices, 15 cent detune for ensemble

**Implementation:**
- Create N oscillators per layer
- Detune each by ±detune * (voice_index / voices)
- Pan each by spread * (voice_index / voices - 0.5)
- Divide gain by sqrt(voices) to prevent clipping

---

#### 1.4 Sub Oscillator
**Priority:** P1 - Bass weight

**Problem:** Kicks and bass lack low-end weight.

**Solution:**
```typescript
oscillator: {
  sub?: {
    level: number;       // 0-1 mix
    octave: -1 | -2;     // octave below
    waveform: 'sine' | 'square' | 'triangle';
  };
}
```

**Use Cases:**
- **Drums:** 808 kick (-1 octave sine), toms (-2 octave)
- **Bass:** Sub bass (-1 octave square at 0.3 level)
- **Lead:** Octave doubling for power
- **Pad:** Sub foundation for warmth

**Implementation:**
- Create additional oscillator at frequency / (2^octave)
- Mix with main oscillator before layer gain
- Always use sine for cleanest sub

---

### Phase 2: Modulation (HIGH PRIORITY)

#### 2.1 LFO System
**Priority:** P1 - Movement and expression

**Problem:** Config exists but not implemented. No modulation = static sounds.

**Solution:**
```typescript
lfo?: {
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'random';
  frequency: number;    // Hz (0.01-20)
  depth: number;        // 0-1
  target: 'pitch' | 'filter' | 'amplitude' | 'pan';
  phase: number;        // 0-1 start phase
  sync: boolean;        // sync to note start
  delay: number;        // seconds before LFO starts
  fade: number;         // seconds to fade in LFO
};
```

**Use Cases:**
- **Melodic:** Vibrato (sine LFO → pitch, 5Hz) for expression
- **Pad:** Slow filter sweep (triangle LFO → filter, 0.2Hz)
- **Lead:** Tremolo (sine LFO → amplitude, 4Hz)
- **Bass:** Wah effect (triangle LFO → filter, 0.5Hz)
- **FX:** Random LFO → filter for sample & hold textures

**Implementation:**
- Create LFO oscillator (or noise for random)
- Route to target parameter via gain node
- Scale depth by target's range
- Use delay/fade for expressive control

---

#### 2.2 Modulation Matrix
**Priority:** P2 - Advanced routing

**Problem:** Config exists but not implemented. Limited modulation routing.

**Solution:**
```typescript
modulation?: Array<{
  source: 'lfo' | 'envelope' | 'velocity' | 'random';
  target: 'pitch' | 'filter' | 'amplitude' | 'pan' | 'fx';
  amount: number;       // -1 to 1
  curve: 'linear' | 'exponential';
}>;
```

**Use Cases:**
- Velocity → filter: harder hits = brighter sound
- Envelope → pitch: pitch drops over time
- Random → pan: random stereo movement

**Implementation:**
- Create modulation sources as AudioParams
- Route to targets via gain nodes
- Scale by amount and target range

---

### Phase 3: Advanced Synthesis (MEDIUM PRIORITY)

#### 3.1 Per-Layer Filtering
**Priority:** P1 - Timbral control

**Problem:** Only global filter. Can't shape individual layers.

**Solution:**
```typescript
layer: {
  filter?: {
    type: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
    frequency: number;
    q: number;
    envelope?: FilterEnvelope;
  };
}
```

**Use Cases:**
- **Drums:** Noise layer highpass (2kHz) for hi-hats, sub lowpass (200Hz) for kicks
- **Bass:** Lowpass on sub layer, highpass on harmonics
- **Vocal:** Bandpass filters for formant synthesis
- **Pad:** Different filters per layer for complex timbre

**Implementation:**
- Create filter per layer before layer gain
- Apply layer-specific envelope if present
- Chain: source → layer filter → layer envelope → layer gain

---

#### 3.2 Waveshaping/Saturation
**Priority:** P2 - Harmonic richness

**Problem:** Sounds too clean, lack analog character.

**Solution:**
```typescript
layer: {
  saturation?: {
    type: 'soft' | 'hard' | 'tube' | 'tape';
    drive: number;      // 0-10
    mix: number;        // 0-1
  };
}
```

**Use Cases:**
- **Bass:** Soft saturation (drive 3) for warmth
- **Lead:** Hard saturation (drive 5) for aggression
- **Pad:** Tube saturation (drive 2) for analog character
- **Drums:** Tape saturation for vintage vibe

**Implementation:**
- Apply waveshaping before layer gain
- Different curves per type:
  - Soft: tanh(x * drive)
  - Hard: clamp(x * drive, -1, 1)
  - Tube: asymmetric curve
  - Tape: soft + high-freq rolloff

---

#### 3.3 Ring Modulation
**Priority:** P2 - Metallic tones

**Problem:** Can't create bell/metallic sounds.

**Solution:**
```typescript
layer: {
  type: 'ring';
  ring: {
    frequency: number;   // modulator frequency
    mix: number;         // 0-1 dry/wet
  };
}
```

**Use Cases:**
- **Melodic:** Bell tones (ring mod at 1.4x fundamental)
- **Percussion:** Metallic hits (inharmonic ratios)
- **FX:** Sci-fi sounds (ring mod with LFO)
- **Lead:** Aggressive digital tones

**Implementation:**
- Multiply two oscillators
- Mix with dry signal
- Use for new layer type

---

#### 3.4 Wavetable Synthesis
**Priority:** P3 - Advanced timbres

**Problem:** Limited to basic waveforms.

**Solution:**
```typescript
layer: {
  type: 'wavetable';
  wavetable: {
    table: Float32Array[];  // array of waveforms
    position: number;       // 0-1 position in table
    interpolation: 'linear' | 'cubic';
  };
}
```

**Use Cases:**
- **Pad:** Evolving textures (morph through wavetable)
- **Bass:** Complex waveforms for modern bass
- **Lead:** Digital/EDM sounds
- **FX:** Morphing textures and transitions

**Implementation:**
- Store wavetable as array of PeriodicWaves
- Interpolate between adjacent waves
- Use LFO to modulate position

---

### Phase 4: Effects (MEDIUM PRIORITY)

#### 4.1 Chorus
**Priority:** P1 - Width and movement

**Problem:** Config exists but not implemented.

**Solution:**
```typescript
effects: {
  chorus?: {
    rate: number;        // Hz (0.1-10)
    depth: number;       // 0-1
    mix: number;         // 0-1
    voices: number;      // 1-8
    stereo: boolean;     // stereo spread
  };
}
```

**Implementation:**
- Create multiple delay lines
- Modulate delay time with LFO
- Pan voices across stereo field
- Mix with dry signal

---

#### 4.2 Phaser
**Priority:** P1 - Movement

**Problem:** Config exists but not implemented.

**Solution:**
```typescript
effects: {
  phaser?: {
    rate: number;        // Hz
    depth: number;       // 0-1
    feedback: number;    // 0-1
    stages: number;      // 2-12 (even numbers)
    mix: number;         // 0-1
  };
}
```

**Implementation:**
- Create chain of allpass filters
- Modulate filter frequencies with LFO
- Add feedback path
- Mix with dry signal

---

#### 4.3 EQ
**Priority:** P1 - Tone shaping

**Problem:** No EQ for final sound shaping.

**Solution:**
```typescript
effects: {
  eq?: {
    low: { gain: number; freq: number };      // shelf
    mid: { gain: number; freq: number; q: number };  // peak
    high: { gain: number; freq: number };     // shelf
  };
}
```

**Implementation:**
- Create 3 biquad filters
- Low: lowshelf at ~100Hz
- Mid: peaking at ~1kHz
- High: highshelf at ~8kHz

---

#### 4.4 Limiter
**Priority:** P2 - Loudness

**Problem:** No final limiter, sounds can clip.

**Solution:**
```typescript
effects: {
  limiter?: {
    threshold: number;   // dB
    release: number;     // seconds
    ceiling: number;     // dB (max output)
  };
}
```

**Implementation:**
- Use DynamicsCompressor with high ratio
- Set threshold near 0dB
- Fast attack, medium release
- Apply as final stage

---

### Phase 5: Quality & Polish (LOW PRIORITY)

#### 5.1 Oversampling
**Priority:** P2 - Alias reduction

**Problem:** Aliasing in FM and distortion.

**Solution:**
- Render at 2x or 4x sample rate
- Downsample with anti-alias filter
- Apply to distortion and FM only

---

#### 5.2 Stereo Processing
**Priority:** P2 - Width control

**Solution:**
```typescript
spatial: {
  pan: number;         // -1 to 1
  width: number;       // 0-2 (0=mono, 1=normal, 2=wide)
  haas: number;        // 0-30ms delay for width
};
```

**Implementation:**
- Mid/side processing for width
- Haas effect for perceived width
- Maintain mono compatibility

---

#### 5.3 Noise Types
**Priority:** P3 - More noise colors

**Solution:**
```typescript
noise: {
  type: 'white' | 'pink' | 'brown' | 'blue' | 'violet';
}
```

**Implementation:**
- Brown: integrate white noise
- Blue: differentiate white noise
- Violet: differentiate blue noise

---

## Implementation Order

### Sprint 1: Core Synthesis (Week 1)
1. Per-layer envelopes
2. Filter envelope
3. Fix envelope clicks (exponential ramps)
4. Tests for envelope system

### Sprint 2: Thickness (Week 2)
1. Unison/voice stacking
2. Sub oscillator
3. Per-layer filtering
4. Tests for voice system

### Sprint 3: Modulation (Week 3)
1. LFO system (all targets)
2. LFO delay/fade
3. Velocity sensitivity
4. Tests for modulation

### Sprint 4: Effects (Week 4)
1. Chorus implementation
2. Phaser implementation
3. EQ (3-band)
4. Tests for effects

### Sprint 5: Advanced (Week 5)
1. Per-layer saturation
2. Ring modulation
3. Modulation matrix
4. Tests for advanced features

### Sprint 6: Polish (Week 6)
1. Limiter
2. Stereo processing
3. Performance optimization
4. Documentation

---

## Success Metrics

### Audio Quality
- [ ] No clicks/pops in envelopes
- [ ] No aliasing in FM synthesis
- [ ] Clean noise generation
- [ ] Proper normalization

### Feature Completeness
- [ ] All config options implemented
- [ ] All effects working
- [ ] LFO routing functional
- [ ] Modulation matrix working

### Professional Capability
- [ ] **Drums:** 808 kicks, snares, hi-hats, toms, percussion
- [ ] **Bass:** Sub bass, analog bass, modern bass, reese bass
- [ ] **Melodic:** Plucks, bells, pianos, strings, brass
- [ ] **Pads:** Evolving pads, ambient textures, string pads
- [ ] **Leads:** Supersaw, analog leads, digital leads
- [ ] **FX:** Risers, impacts, sweeps, atmospheres

### Code Quality
- [ ] 80%+ test coverage
- [ ] All magic numbers eliminated
- [ ] Pure functions for DSP
- [ ] Performance: <100ms render time

---

## Technical Considerations

### Performance
- Offline rendering allows complex processing
- Target: <500ms for 12s render
- Optimize: reuse nodes, minimize allocations

### Compatibility
- Web Audio API only (no external libs)
- Works in all modern browsers
- No worker threads needed (offline context)

### Maintainability
- Pure functions for DSP algorithms
- Centralized config constants
- Comprehensive test coverage
- Clear documentation

---

## Config Migration

### Backward Compatibility
- All existing configs continue to work
- New features are optional
- Sensible defaults for all new params

### Default Values
```typescript
// Layer envelope: falls back to master
layer.envelope = undefined

// Unison: single voice (no change)
oscillator.unison = { voices: 1, detune: 0, spread: 0 }

// Sub: disabled
oscillator.sub = undefined

// LFO: disabled
lfo = undefined

// Per-layer filter: disabled
layer.filter = undefined
```

---

## Testing Strategy

### Unit Tests
- Envelope generation (attack, decay, sustain, release)
- LFO waveform generation
- Unison voice calculation
- Filter coefficient calculation
- Effect parameter validation

### Integration Tests
- Full synthesis pipeline
- Effect chain processing
- Modulation routing
- Multi-layer rendering

### Audio Tests
- Frequency analysis (FFT)
- Peak detection
- Noise floor measurement
- Harmonic content analysis

---

## Documentation Updates

### User Guide
- Sound design tutorials
- Preset examples
- Parameter explanations
- Troubleshooting

### API Reference
- Complete SoundConfig schema
- Parameter ranges
- Default values
- Use case examples

### Architecture
- Signal flow diagrams
- DSP algorithm explanations
- Performance characteristics
- Browser compatibility

---

## Future Enhancements (Post-MVP)

### Advanced Features
- Granular synthesis
- Formant filtering
- Vocoder
- Spectral processing

### Presets
- Factory preset library
- Preset import/export
- Preset browser
- Randomization

### UI Improvements
- Visual envelope editor
- Waveform display
- Spectrum analyzer
- Modulation visualization

---

## Questions to Resolve

1. **Wavetable format:** Use PeriodicWave or raw samples?
2. **Oversampling:** 2x or 4x? Trade-off with render time?
3. **LFO sync:** Sync to what? (no tempo in one-shot mode)
4. **Modulation depth:** Linear or exponential scaling?
5. **Voice allocation:** Max voices per layer? (performance)

---

## Risk Assessment

### High Risk
- **Performance:** Too many voices = slow render
  - Mitigation: Voice limit, optimization
- **Complexity:** Too many params = confusing
  - Mitigation: Good defaults, presets

### Medium Risk
- **Browser compat:** Some features may not work everywhere
  - Mitigation: Feature detection, fallbacks
- **Audio quality:** Aliasing, artifacts
  - Mitigation: Oversampling, proper filtering

### Low Risk
- **Backward compat:** Breaking existing sounds
  - Mitigation: Careful defaults, migration guide

---

## Conclusion

This upgrade transforms OP-Done from a basic drum synth into a professional sound design tool. The phased approach ensures steady progress while maintaining code quality and backward compatibility.

**Estimated Timeline:** 6 weeks
**Estimated Effort:** ~120 hours
**Priority:** High (enables pro-level sound creation)

Ready to begin implementation with Sprint 1: Core Synthesis.
