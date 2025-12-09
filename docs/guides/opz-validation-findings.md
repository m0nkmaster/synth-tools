# OP-Z Drum Pack Validation Findings

## Issue: broken.aif Not Working on OP-Z

### Root Cause
**JSON field order matters.** The OP-Z firmware expects **alphabetically sorted JSON keys** in the APPL chunk metadata.

### Evidence

#### Working Files (all have alphabetical key order):
- `ModKicks1.aif` (drum_version: 3) - **WORKS**
- `subkicks-7289.aif` (drum_version: 1) - **WORKS**
- All other files in `valid-samplepacks/` - **WORK**

#### Broken File:
- `broken.aif` (drum_version: 3) - **FAILS**

### Key Order Comparison

**Broken (custom order):**
```json
{
  "drum_version": 3,
  "type": "drum",
  "name": "op-done",
  "octave": 0,
  "pitch": [...],
  "start": [...],
  "end": [...],
  ...
}
```

**Working (alphabetical order):**
```json
{
  "drum_version": 3,
  "dyna_env": [...],
  "editable": true,
  "end": [...],
  "fx_active": false,
  "fx_params": [...],
  ...
}
```

## Valid Configurations by Version

### drum_version: 1 (Most Common)
```json
{
  "dyna_env": [0, 8192, 0, 8192, 0, 0, 0, 0],
  "lfo_params": [16000, 16000, 16000, 16000, 0, 0, 0, 0]
}
```

### drum_version: 2 (Rare)
```json
{
  "dyna_env": [0, 8192, 0, 0, 0, 0, 0, 0],
  "lfo_params": [16000, 0, 0, 16000, 0, 0, 0, 0]
}
```

### drum_version: 3 (Requires alphabetical keys)
```json
{
  "dyna_env": [0, 8192, 0, 0, 0, 0, 0, 0],
  "editable": true,
  "lfo_params": [0, 0, 0, 0, 0, 0, 0, 0]
}
```

## Fix Required

In `src/audio/aiff.ts`, the `buildDrumMetadataChunk` function must:
1. Build the object with all fields in alphabetical order
2. Use `JSON.stringify()` which preserves insertion order
3. Never modify the object after initial creation

### Current Bug
```typescript
const payloadObj: Record<string, unknown> = {
  drum_version: metadata.drumVersion,  // Wrong order
  type: 'drum',
  name: metadata.name,
  // ...
};

if (metadata.drumVersion >= 3) {
  payloadObj.dyna_env = [0, 8192, 0, 0, 0, 0, 0, 0];  // Modifying after creation
  payloadObj.editable = true;
}
```

### Required Fix
Build object once with correct alphabetical order based on version.
