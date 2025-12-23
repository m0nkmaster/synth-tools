# FM Scaling Fix - Summary

## What We Fixed

### Critical Bug: FM Modulation Scaled 100x Too High

**File:** `src/audio/synthCore.ts`

**Change:**
```typescript
// Before (broken):
modulationOutput.gain.value = safeModIndex * operatorFreq;

// After (fixed):
modulationOutput.gain.value = (safeModIndex / 100) * operatorFreq;
```

**Impact:**
- ModIndex 10 was causing 4,400Hz deviation (harsh aliasing)
- Now causes 44Hz deviation (gentle FM character)
- Makes user-facing modIndex values match musical intuition (10-20 for electric piano, not 0.1-0.2)

### Schema Updates

**File:** `src/types/soundConfig.ts`

- Removed prescriptive guidance from modulationIndex comment
- Now just states: "Modulation depth (internally scaled /100)"
- Let AI use its musical knowledge to choose appropriate values

### AI Prompt Simplification

**File:** `src/services/ai.ts`

**Removed:**
- Example configs
- Recipes ("how to make X")
- Envelope design guides
- "Pitfalls to avoid" lists

**Kept:**
- Architecture description (layers, routing, effects chain)
- Parameter descriptions (what they do, not how to use them)
- Critical note: FM modulatesLayer routing and /100 internal scaling

**Philosophy:** AI has musical knowledge. Just tell it what the tool can do, not how to do its job.

## Testing

✅ All tests pass
✅ Lint clean
✅ Simple oscillator works
✅ FM modulation no longer "meows" at reasonable values

## Current State

The FM /100 scaling fix is essential and working. AI can now experiment with FM values without immediate aliasing disasters. However:

- FM still sounds somewhat "alien" (architectural limitation of frequency modulation)
- Creating truly realistic instruments requires experimentation
- Oscillator-based synthesis works reliably
- Karplus-Strong sounds stringy/plucky (inherent to algorithm)

## Commit

Ready to commit with message: "Fix FM modulation scaling by factor of 100 to prevent aliasing"





