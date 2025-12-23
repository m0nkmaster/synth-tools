# FM Modulation Index Bug - Dec 18, 2025

## The Problem

Minimal FM electric piano test sounded like "a cat being strangled" - harsh, dissonant, unpleasant. Even the simplest 2-operator 1:1 ratio FM config produced unusable sounds.

## Root Cause

**The modulation index values in examples and prompts were TOO HIGH**, causing aliasing and extreme frequency deviation:

### The Math:

With modIndex=12 and 440Hz carrier:
```
Modulation depth = modulationIndex × operatorFreq
                 = 12 × 440 Hz
                 = 5,280 Hz peak deviation

Carrier frequency swings: 440 ± 5,280 Hz
                        = -4,840 Hz to 5,720 Hz
```

**Negative frequencies cause aliasing!** Even the positive range creates wildly inharmonic, harsh tones.

### What DX7 Actually Uses:

Classic DX7 electric pianos use **modulationIndex 2-6**, not 10-20:
- ModIndex 2-4: Subtle warmth, gentle FM character
- ModIndex 5-6: Classic electric piano "growl"
- ModIndex 8-10: Aggressive, metallic (bells, brass)
- ModIndex 12+: **HARSH, ALIASING, UNUSABLE** (what we had)

## The Fix

### Updated Examples:

**Before (broken - modIndex 12):**
```json
{ "type": "fm", "gain": 0, "fm": { "modulationIndex": 12, "modulatesLayer": 0 } }
```

**After (working - modIndex 5):**
```json
{ "type": "fm", "gain": 0, "fm": { "modulationIndex": 5, "modulatesLayer": 0 } }
```

### Updated AI Guidance:

**In `src/services/ai.ts`:**
- Changed example from modIndex 12 → 5
- Updated guidance: "modulationIndex 3-6 (NOT higher - causes aliasing/harshness)"
- Changed prompt from "10-20" → "3-6" for electric pianos

**In `soundConfig.ts` BOUNDS comment:**
```typescript
modulationIndex: { min: 0, max: 100 },  // 0-10=subtle, 10-30=electric piano, 30-60=bells, 60+=harsh
```

Should be updated to:
```typescript
modulationIndex: { min: 0, max: 100 },  // 0-6=electric piano, 6-15=bells/brass, 15-30=aggressive, 30+=experimental
```

## Why This Matters

This was hiding behind multiple other issues (gate, envelope model, etc.), but even when those were fixed, the fundamental FM sounds were still broken because:

1. **Modulation index directly controls timbre quality**
2. **Too high = aliasing, harshness, dissonance**
3. **The AI was copying these broken values** from examples

With modIndex 5 instead of 12, FM electric pianos should now produce smooth, bell-like tones with gentle growl - the classic DX7 sound.

## Testing

Try `epiano-minimal-test.json`:
- ✅ Should sound like a smooth FM electric piano
- ✅ Bell-like initial attack
- ✅ Gentle FM "growl" that decays naturally
- ✅ NO harsh aliasing or dissonance
- ✅ NO "cat being strangled" sounds

## Implementation Notes

The FM synthesis implementation in `synthCore.ts` is **correct**:
```typescript
modulationOutput.gain.value = safeModIndex * operatorFreq;
```

This properly implements the FM formula: **Δf = I × fm**

The issue was purely that the **example values were wrong** (12 instead of 5).





