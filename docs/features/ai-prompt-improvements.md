# AI Prompt Improvements - Dec 18, 2025

## The Problem

AI models (Gemini, GPT, Claude) were generating configs that sounded nothing like the requested instruments, even with detailed schema documentation and guidance. The synth itself is working correctly, but **the AI has no reference for what parameters produce which sounds**.

## The Root Cause

**Without working example configs, the AI is guessing.** It doesn't know:
- What modulationIndex values produce electric piano vs bell vs harsh tones
- That acoustic pianos should use Karplus-Strong, not FM
- What envelope shapes produce natural vs percussive sounds
- How loud different layers should be relative to each other

## The Solution

**Added working example configs to the system prompt** so the AI can learn by example:

### Example 1: Acoustic Grand Piano
```json
{
  "layers": [
    { "type": "noise", "gain": 0.15, ... },  // Hammer attack
    { "type": "karplus-strong", "gain": 0.85, ... }  // String resonance
  ],
  "envelope": { "attack": 0.001, "decay": 1.5, "sustain": 0.25, "release": 3 },
  "effects": { "reverb": ..., "compressor": ... }
}
```

**Key learnings:**
- Acoustic pianos use **Karplus-Strong** (physical modeling), NOT FM
- Hammer attack: short noise burst (decay 0.02s, gain 0.15)
- String body: Karplus-Strong with damping 0.35, gain 0.85
- Envelope: long decay (1.5s), medium sustain (0.25)

### Example 2: FM Electric Piano (DX7)
```json
{
  "layers": [
    { "type": "fm", "gain": 1, "fm": { "ratio": 1, "modulationIndex": 0 } },  // Carrier
    { "type": "fm", "gain": 0, "fm": { "ratio": 1, "modulationIndex": 12, "modulatesLayer": 0 } }  // Modulator
  ],
  "envelope": { "attack": 0.005, "decay": 3.5, "sustain": 0.05, "release": 0.3 },
  "effects": { "chorus": { "mix": 0.5 }, ... }
}
```

**Key learnings:**
- Electric pianos use **FM synthesis** with 1:1 ratio
- ModulationIndex 10-15 produces classic EP "growl"
- Modulator has `gain: 0` (routes to `modulatesLayer`, not audio output)
- Envelope: very long decay (3.5s), very low sustain (0.05) for natural fade
- Chorus is essential for EP shimmer

## Results

With these examples in the prompt, the AI can:
1. **See working configs** and understand parameter relationships
2. **Match patterns** to requested sounds (piano → use Karplus-Strong, E-piano → use FM 1:1)
3. **Copy proven techniques** (envelope shapes, layer balance, effect settings)
4. **Understand parameter scales** (modIndex 12 vs 60, gain 0.15 vs 0.85)

## Implementation

Added to `src/services/ai.ts` system prompt:
- 2 complete working example configs
- "KEY LEARNINGS FROM EXAMPLES" section highlighting critical insights
- Clear distinction between acoustic (Karplus-Strong) vs electric (FM) pianos

## Testing Approach

To verify AI improvements:
1. Ask for "DX7 electric piano" → should generate FM 1:1 config with modIndex 10-15
2. Ask for "acoustic grand piano" → should use Karplus-Strong, not FM
3. Check envelope shapes match instrument type (long decay for struck instruments)
4. Verify no gate on melodic instruments
5. Confirm layer balance (main layer 0.8-0.9, attack transients 0.1-0.2)

## Future Improvements

- Add more example configs (pads, brass, strings, drums)
- Include anti-examples ("DON'T do this: gate on piano, FM for acoustic piano")
- Show progression (minimal → full featured) for each instrument type
- Add audio output validation (basic FFT analysis to detect obvious errors)





