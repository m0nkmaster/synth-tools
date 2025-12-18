# FM Synthesis Guidance for AI Generation

## The Problem (Dec 18, 2025)

Gemini generated an electric piano that sounded like "hitting a bin lid" / "short bang against wood" / "~100ms hit" due to:

1. **THE GATE EFFECT** - With `hold: 0` and `release: 0.1`, the gate silenced everything after 0.1 seconds!
   - Gate is for **drums only** (gated reverb on 80s snares), not melodic instruments
   - This was the primary cause of the "short hit" sound
   
2. **Layer 2 with ratio 14, modulationIndex 0, gain 0.25** - Too loud and too long (0.3s decay), creating harsh metallic ring

3. **Wrong envelope model**: Used **medium decay + medium sustain** (decay 0.6s, sustain 0.25) instead of **long decay + low sustain**
   - releaseStart calculation: With decay 0.6s, sustain 0.25, release 2.5s, duration 4s → release starts at 1.5s
   
4. **Fundamental misunderstanding**: Electric pianos are **struck instruments that naturally decay**, not organs that sustain

## Root Cause Analysis

### What Gemini Created (Unbalanced):
```json
{
  "layers": [
    { "type": "fm", "ratio": 1, "modulationIndex": 0, "gain": 1 },        // Carrier ✓
    { "type": "fm", "ratio": 1, "modulationIndex": 22, "modulatesLayer": 0, "gain": 0 }, // Modulator ✓
    { "type": "fm", "ratio": 14, "modulationIndex": 0, "gain": 0.25, 
      "envelope": { "decay": 0.3 } }     // ❌ PROBLEM: Too loud + too long = harsh ring
  ]
}
```

**Issue**: Layer 2 outputs a pure 1820Hz sine at **gain 0.25** (too loud) with **0.3s decay** (too long), creating a harsh "bin lid" ring that dominates the sound.

### What It Should Be (Balanced):
```json
{
  "layers": [
    { "type": "fm", "ratio": 1, "modulationIndex": 0, "gain": 1 },        // Carrier
    { "type": "fm", "ratio": 1, "modulationIndex": 18, "modulatesLayer": 0, "gain": 0, 
      "envelope": { "attack": 0.001, "decay": 1.5, "sustain": 0, "release": 0.2 } }, // Modulator with decay
    { "type": "fm", "ratio": 14, "modulationIndex": 0, "gain": 0.06,      // ✓ Tine attack
      "envelope": { "attack": 0.001, "decay": 0.08, "sustain": 0, "release": 0.02 } } // Very short!
  ]
}
```

**Fix**: 
- Kept ratio-14 layer for authentic DX7 "tine" attack
- **Reduced gain from 0.25 to 0.06** (76% quieter)
- **Shortened decay from 0.3s to 0.08s** (73% shorter)
- Result: Quick metallic "tink" that adds character without dominating

## The Solution

### Updated AI System Prompt (src/services/ai.ts)

Added explicit FM recipes and pitfalls:

```
FM SYNTHESIS RECIPES (modulatesLayer routing):
- Electric Piano (DX7 style): 
  * Layer 0: FM ratio 1, modulationIndex 0, gain 1 (carrier, outputs audio)
  * Layer 1: FM ratio 1, modulationIndex 10-20, modulatesLayer 0, gain 0, 
             envelope with decay 1-2s and sustain 0 (modulator creates growl that decays)
  * Optional Layer 2: noise burst (attack 0.001s, decay 0.05s, gain 0.05) for hammer attack, 
                      NOT a high ratio FM layer
  * Add chorus (mix 0.4-0.6, depth 0.5) for authentic EP shimmer

FM PITFALLS TO AVOID:
- DON'T use high ratio FM layers (ratio >4) as direct audio output with modulationIndex 0 
  - they create harsh, thin tones
- DO use modulatesLayer for inter-layer modulation, not multiple independent FM carriers
- Modulator layers should have gain 0 (they route to modulatesLayer, not to audio output)
- Use FM envelopes to shape timbre over time (critical for realistic evolving sounds)
```

## Key Takeaways

1. **CRITICAL: Different instruments need different envelope shapes!**
   
   **Struck/Plucked Instruments (electric piano, piano, guitar, marimba):**
   - ✅ Use **LONG DECAY (90-95% of duration)** + **LOW SUSTAIN (0.03-0.08)**
   - Example for 4s: attack 0.005s, decay 3.8s, sustain 0.05, release 0.2s
   - Creates smooth exponential fade over full duration (natural piano behavior)
   - FM modulation envelope: decay 2.5s (60-70% of duration), sustain 0.08-0.15
   
   **Sustained Instruments (pads, organs, strings, brass):**
   - ✅ Use **MEDIUM DECAY (20-40%)** + **MEDIUM-HIGH SUSTAIN (0.3-0.6)**
   - Example for 4s: attack 0.1s, decay 1s, sustain 0.4, release 1.5s
   - Sound maintains level during sustain, releases naturally
   
   **Percussive/Drums:**
   - ✅ Use **SHORT DECAY (0.05-0.3s)** + **ZERO SUSTAIN**
   - Creates clean, punchy hits
   
2. **High ratio FM layers** (ratio >4) CAN be used for attack transients, but must be carefully balanced:
   - ✅ **DO**: Use with very low gain (<0.1) and very short envelope (decay <0.1s, sustain 0) for "tine" attacks
   - ❌ **DON'T**: Use with high gain (>0.1) or long envelope (>0.2s) - creates harsh, dominating ring
   
3. **Classic FM timbres** (electric piano, bass, brass) use **1:1 or simple integer ratios** (1:2, 1:3) for the **main body**
   - Complex/high ratios (14:1) are for **attack transients only**, not sustained tones
   
4. **Modulator layers must have `gain: 0`** and route via `modulatesLayer`
   - Otherwise they output raw audio AND modulation (double contribution)
   
5. **FM envelopes are critical** for evolving timbres
   - DX7 electric piano modulator: decay 0.5-1s, **sustain 0.1-0.2** (NOT 0!), release 1-2s
   - Carrier: decay 0.5-1s, sustain 0.2-0.4, release 2-3s for natural ring-out
   
6. **Balance is everything** - Gemini's ratio-14 tine concept was correct, but:
   - Gain too high (0.25 vs 0.06) = harsh
   - Decay too long (0.3s vs 0.08s) = rings out
   - **Sustain 0 everywhere** = sound dies after 1.5s instead of ringing for full 4s duration

## Testing

- ✅ All tests pass (`bun test`)
- ✅ No new linter errors (`bun run lint`)
- ✅ Fixed example saved to `examples/epiano-fixed-181225.json`

## Files Changed

- `src/services/ai.ts` - Enhanced system prompt with FM recipes, envelope guidance by instrument type
- `examples/epiano-decay-181225.json` - Correct e-piano with long decay envelopes
- `examples/epiano-fixed-181225.json` - Intermediate version (still had envelope issues)
- `examples/epiano-proper-181225.json` - Intermediate version (still had envelope issues)
- `docs/features/fm-synthesis-guidance.md` - This document

## Envelope Timeline Comparison

**Gemini's Original (Broken - sounds like 300ms hit):**
```
Duration: 4s, Decay: 0.6s, Sustain: 0.25, Release: 2.5s
→ releaseStart = max(0.605, 4-2.5) = 1.5s

Timeline:
0.0-0.005s: Attack to peak
0.005-0.605s: Decay to 25% (0.6s)
0.605-1.5s: Hold at 25% (0.9s)
1.5-4.0s: Release to silence (2.5s) ← Sound mostly gone by 2s
```

**Fixed (Natural Decay - rings for full 4s):**
```
Duration: 4s, Decay: 3.8s, Sustain: 0.05, Release: 0.2s
→ releaseStart = max(3.805, 4-0.2) = 3.9s

Timeline:
0.0-0.005s: Attack to peak
0.005-3.805s: SMOOTH DECAY to 5% (3.8s) ← Natural exponential fade
3.805-3.9s: Brief hold at 5% (0.095s)
3.9-4.0s: Final release (0.1s)
```

## Commit Message

```
Enhance AI prompt with explicit FM synthesis guidance to prevent harsh timbres
```

