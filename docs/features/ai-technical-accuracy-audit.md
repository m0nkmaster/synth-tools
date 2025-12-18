# AI Technical Accuracy Audit - Dec 18, 2025

## Summary

Conducted comprehensive audit of AI system prompts and parameter documentation to ensure technical accuracy. Removed prescriptive sound design guidance in favor of precise technical specifications.

## Critical Bug Fixed

### FM Modulation Index Scaling Error

**Issue**: Documentation claimed `/10` scaling but implementation uses `/100` - a **10x discrepancy**

**Location**: `src/types/soundConfig.ts` line 58

**Before**:
```typescript
modulationIndex: { min: 0, max: 100 },  // (internally scaled /10)
```

**After**:
```typescript
modulationIndex: { min: 0, max: 100 },  // FM modulation depth. Actual Hz deviation = (value/100) × carrierFreqHz. Example: 100 @ 440Hz = 440Hz deviation
```

**Impact**: AI models were generating FM configs with modulation depths 10x lower than intended, resulting in weak/incorrect FM timbres.

## Changes Made

### 1. Fixed FM Documentation (`src/types/soundConfig.ts`)

- **Line 58**: Corrected BOUNDS comment from `/10` to `/100` with accurate formula
- **Line 577**: Updated `generateSchemaPrompt()` FM description with Hz deviation formula
- **Line 634**: Updated `generateBatchSchemaPrompt()` FM description

### 2. Enhanced BOUNDS Comments (`src/types/soundConfig.ts`)

Added technical clarity to all parameter bounds:

- **Unison spread**: "0 = mono/center, 1 = full stereo spread"
- **Karplus-Strong damping**: "0 = long sustain/ring, 1 = short pluck/decay"
- **Karplus-Strong inharmonicity**: "Stretches higher partials: 0 = pure/plucked string, 0.3-0.5 = piano-like, 1 = bell-like"
- **LFO depth**: "Modulation amount (target-dependent: pitch=cents*100, filter=freq multiplier, amplitude/pan=direct)"
- **Reverb damping**: "High frequency absorption: 0 = bright/reflective, 1 = dark/absorptive"
- **Filter Q**: "Resonance: 0.7 = flat, 1-5 = resonant peak, 10+ = self-oscillation"
- **Compressor parameters**: Added dB units and behavioral descriptions
- **Gate parameters**: Added time unit clarifications
- And more...

### 3. Rewrote AI System Prompts (`src/services/ai.ts`)

**Philosophy shift**:
- ❌ Removed: Prescriptive "use X for Y sound" guidance
- ✅ Added: Complete, precise technical descriptions
- ✅ Trust: AI models to apply their knowledge given accurate specs

**SYSTEM_PROMPT changes**:
- Removed sound design recipes
- Added detailed technical explanations of each layer type
- Clarified FM routing with `modulatesLayer`
- Explained per-layer vs global processing
- Listed effects chain order explicitly
- Provided accurate parameter behavior descriptions

**BATCH_SYSTEM_PROMPT changes**:
- Removed prescriptive category-specific recipes
- Kept only technical notes about percussion characteristics
- Removed specific parameter value recommendations
- Focused on technical constraints (duration limits, envelope behavior)

## Verification

### Technical Accuracy Verified

✅ **FM implementation**: Confirmed `/100` scaling in `synthCore.ts:192`
✅ **Karplus-Strong**: Verified damping and inharmonicity behavior
✅ **Effects chain**: Confirmed order matches implementation (EQ → Distortion → Compressor → Chorus → Delay → Reverb → Gate)
✅ **Noise types**: Verified white/pink/brown generation
✅ **All layer types**: Descriptions match implementation

### Testing

✅ **Lint**: `bun run lint` - No new errors (23 pre-existing warnings)
✅ **Tests**: `bun test` - 148 pass, 3 skip, 0 fail

## Expected Improvements

With these fixes, AI models should:

1. **Generate correct FM depths**: modIndex values will produce expected timbres
2. **Understand layer routing**: Proper use of `modulatesLayer` for FM synthesis
3. **Apply accurate parameters**: Technical descriptions enable better parameter selection
4. **Avoid misleading guidance**: No more prescriptive recipes that may not match user intent

## Files Modified

1. `src/types/soundConfig.ts` - Fixed FM scaling docs, enhanced all BOUNDS comments
2. `src/services/ai.ts` - Rewrote SYSTEM_PROMPT and BATCH_SYSTEM_PROMPT for technical accuracy

## Next Steps

Monitor AI-generated configs for:
- Appropriate FM modulation index values (should be higher now)
- Correct use of `modulatesLayer` routing
- Better parameter choices based on technical understanding
- More accurate sound recreation

