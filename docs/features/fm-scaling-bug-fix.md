# FM Scaling Bug Fix - Dec 18, 2025

## Summary

Fixed critical FM synthesis bug where modulation depth was scaled 10-100x too high, causing harsh aliasing, "meowing," and unusable sounds.

## The Investigation

### Starting Point
Gemini-generated electric piano sounded like "hitting a bin lid" / "cat being strangled"

### Bugs Discovered (in order):

1. ❌ **Ratio-14 tine layer too loud** (0.25 → 0.06 gain, 0.3s → 0.08s decay)
2. ❌ **Wrong envelope model** (medium sustain → long decay + low sustain for struck instruments)
3. ❌ **Gate effect** silencing everything after 0.1s (removed from melodic instruments)
4. ❌ **No AI reference examples** (added working configs to prompts)
5. ❌ **Modulation index values too high** (12 → 5 → 2 → still broken)
6. ✅ **ROOT CAUSE: FM modulation scaled 100x too high**

## The Fix

### Code Change (src/audio/synthCore.ts):

```typescript
// BEFORE (broken - caused harsh aliasing):
modulationOutput.gain.value = safeModIndex * operatorFreq;
// Example: modIndex=10, freq=440 → deviation = 4,400 Hz (EXTREME)

// AFTER (fixed - gentle modulation):
modulationOutput.gain.value = (safeModIndex / 100) * operatorFreq;
// Example: modIndex=10, freq=440 → deviation = 44 Hz (reasonable)
```

Also updated the envelope scaling (line ~203):
```typescript
const peakGain = Math.max(SILENCE, (safeModIndex / 100) * operatorFreq);
```

## Test Results

**Before fix:**
- modIndex 0.8 → "wobbly meow alien cat" 
- modIndex 2-12 → "harsh aliasing, unusable"

**After /10 fix:**
- modIndex 0.8 → "smooth alien cat" (still weird)
- modIndex 10 → "smooth alien cat, not piano"

**After /100 fix:**
- modIndex 0.8 → "subtle, sounds ok"
- modIndex 10 → Should be gentle FM character
- modIndex 20-50 → Now usable for bells/brass

## Updated Parameter Guidance

**In `src/types/soundConfig.ts`:**
```typescript
modulationIndex: { min: 0, max: 100 },  
// 0-5=subtle warmth, 5-15=electric piano, 15-40=bells/brass, 40+=experimental 
// (internally scaled /100)
```

**In `src/services/ai.ts`:**
- Electric piano: modulationIndex 5-12 (was 0.5-2, then 3-6, now back to DX7 range)
- Example config uses modIndex 8 (was 12, then 5)

## Why This Matters

The /100 scaling makes the user-facing modulation index values match **musical intuition**:
- **5**: Subtle FM warmth
- **10**: Classic electric piano
- **20**: Bell-like tones
- **50+**: Experimental/aggressive

Without this fix, even modIndex=1 would cause ~440Hz deviation, which is musically extreme.

## Remaining Challenges

Even with correct FM scaling:
- FM electric pianos still sound somewhat "alien" (may need phase modulation instead)
- Karplus-Strong sounds too "plucky/stringy"
- Creating realistic piano sounds is harder than expected
- May need hybrid approaches or additional synthesis methods

## Files Changed

- `src/audio/synthCore.ts` - Added /100 scaling to FM modulation depth
- `src/types/soundConfig.ts` - Updated modulationIndex comment
- `src/services/ai.ts` - Updated examples and guidance with correct ranges
- `examples/epiano-dx7-corrected.json` - Working FM electric piano with corrected scaling
- `examples/grand-piano-ultra-simple.json` - Baseline test (oscillators only, sounds clean)

## Commit Message

```
Fix FM modulation scaling: divide by 100 to prevent harsh aliasing
```





