# OP-Z Drum Pack Format Specification

The definitive format reference for OP-Z/OP-1 compatible drum pack AIFF files.

## Overview

OP-Z drum packs are AIFF-C (AIFC) files containing:
- Mono, 16-bit, 44.1kHz audio (little-endian PCM)
- Metadata in an APPL chunk defining slice positions and parameters

---

## File Structure

```
FORM (AIFC)
├── FVER (version chunk)
├── COMM (format chunk)
├── APPL (OP-Z metadata chunk)  ← Must appear before SSND
└── SSND (audio data chunk)
```

Chunks must appear in this exact order.

---

## Audio Constraints

| Constraint | Value |
|------------|-------|
| Container | AIFF-C (AIFC) |
| Channels | 1 (mono) |
| Sample rate | 44,100 Hz |
| Bit depth | 16-bit |
| Encoding | Little-endian PCM (`sowt`) |
| Max duration | 12 seconds |
| Max slices | 24 |
| Max per-slice | ~4 seconds |

---

## Chunk Specifications

### FVER Chunk

```
ID:   FVER
Size: 4 bytes
Data: 0xA2805140 (2726318400)
```

Required for AIFC format.

### COMM Chunk

```
ID:   COMM
Size: 64 bytes (with compression name)

Fields:
- Channels: 1 (mono)
- Sample frames: <total frame count>
- Bits per sample: 16
- Sample rate: 44100 Hz (80-bit extended float)
- Compression type: 'sowt' (little-endian PCM)
- Compression name: "Signed integer (little-endian) linear PCM"
```

### APPL Chunk

The metadata chunk containing slice definitions.

```
ID:   APPL
Size: 4 + JSON length + 1 (null terminator)

Structure:
├── App signature: "op-1" (4 bytes ASCII)
├── JSON payload (variable length)
└── Null terminator: 0x00 (1 byte)  ← REQUIRED
```

The null terminator after the JSON is critical for TE Drum Utility compatibility.

### SSND Chunk

Standard AIFF sound data chunk.

```
ID:   SSND
Size: 8 + audio data length

Fields:
├── Offset: 0 (4 bytes)
├── Block size: 0 (4 bytes)
└── Audio samples (16-bit little-endian PCM)
```

---

## Metadata JSON Schema

Fields must appear in this exact order (TE Drum Utility is order-sensitive):

```json
{
  "drum_version": 2,
  "type": "drum",
  "name": "My Kit",
  "start": [0, 180633600, ...],
  "end": [180633599, 361267199, ...],
  "octave": 0,
  "pitch": [0, 0, 0, ...],
  "playmode": [4096, 4096, ...],
  "reverse": [8192, 8192, ...],
  "volume": [8192, 8192, ...],
  "dyna_env": [0, 8192, 0, 8192, 0, 0, 0, 0],
  "fx_active": false,
  "fx_type": "delay",
  "fx_params": [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
  "lfo_active": false,
  "lfo_type": "tremolo",
  "lfo_params": [16000, 16000, 16000, 16000, 0, 0, 0, 0]
}
```

### Array Requirements

All arrays must have exactly **24 elements**, one per slice slot.

### Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| drum_version | number | 2 (OP-1) or 3 (OP-Z) |
| type | string | Always `"drum"` |
| name | string | Pack name displayed on device |
| start | number[24] | Slice start positions (encoded) |
| end | number[24] | Slice end positions (encoded) |
| octave | number | -4 to +4, global pitch offset |
| pitch | number[24] | Per-slice pitch (0 = center) |
| playmode | number[24] | Playback mode |
| reverse | number[24] | Reverse playback |
| volume | number[24] | Per-slice volume |
| dyna_env | number[8] | Dynamic envelope |
| fx_active | boolean | Effects enabled |
| fx_type | string | Effect type name |
| fx_params | number[8] | Effect parameters |
| lfo_active | boolean | LFO enabled |
| lfo_type | string | LFO type name |
| lfo_params | number[8] | LFO parameters |

---

## Position Encoding

Frame positions are scaled by 4096:

```
encoded_position = frame_number × 4096
```

This provides sub-frame precision for pitch shifting.

### Limits

| Limit | Value |
|-------|-------|
| Maximum encoded value | 0x7FFFFFFE (2,147,483,646) |
| Scale factor | 4096 |
| Max frames at 44.1kHz | ~524,287 (~11.9 seconds) |

### Example

```typescript
// 1 second at 44.1kHz
const frameIndex = 44100;
const encoded = frameIndex * 4096; // 180,633,600
```

---

## Default Parameter Values

| Parameter | AIFF Value | AIFC Value | Notes |
|-----------|------------|------------|-------|
| pitch | 0 | 0 | Center pitch |
| playmode | 8192 | 4096 | Different for AIFF vs AIFC |
| reverse | 8192 | 8192 | Normal playback |
| volume | 8192 | 8192 | Full volume |

**Critical:** For AIFC format, `playmode` must be 4096, not 8192.

---

## Slice Placement

Slices should be contiguous with small gaps:

```
[Slice 0 audio][gap][Slice 1 audio][gap][Slice 2 audio]...
```

- Gap: ~0.1 seconds (4410 samples) prevents audio bleed
- Slices start immediately after previous gap
- Empty slots have `start === end === 0`

---

## Common Mistakes

### 1. Wrong JSON Field Order

```json
// WRONG: octave before start/end
{"drum_version":2,"type":"drum","name":"kit","octave":0,"start":[...],...}

// CORRECT: start/end before octave
{"drum_version":2,"type":"drum","name":"kit","start":[...],"end":[...],"octave":0,...}
```

### 2. Missing Null Terminator

```
// WRONG: No null byte after JSON
...0,0,0,0]}SSND...

// CORRECT: Null byte after closing brace
...0,0,0,0]}\x00SSND...
```

### 3. Wrong Playmode for AIFC

```json
// WRONG for AIFC format
"playmode": [8192, 8192, ...]

// CORRECT for AIFC format
"playmode": [4096, 4096, ...]
```

### 4. Arrays Not 24 Elements

All slice arrays must have exactly 24 elements, even if some slots are empty.

### 5. Non-Sequential Slices

Slices should be placed sequentially from the beginning of the file, not scattered.

---

## Validation Checklist

- [ ] File type is AIFC (not plain AIFF)
- [ ] FVER version is 0xA2805140
- [ ] COMM compression is `sowt`
- [ ] APPL chunk starts with `op-1`
- [ ] APPL chunk appears before SSND
- [ ] JSON field order is correct
- [ ] Null terminator after JSON
- [ ] All arrays have 24 elements
- [ ] playmode is 4096 for AIFC
- [ ] Positions encoded with × 4096
- [ ] Slices are contiguous
- [ ] Total duration ≤ 12 seconds

---

## Implementation Reference

### Building the APPL Chunk

```typescript
function buildDrumMetadataChunk(
  startFrames: number[],
  endFrames: number[],
  metadata: DrumMetadata
): Uint8Array {
  // Pad arrays to 24 elements
  const start = padArray(startFrames, 24, 0);
  const end = padArray(endFrames, 24, 0);
  
  // Encode positions (× 4096)
  const positionsStart = encodePositions(start);
  const positionsEnd = encodePositions(end);

  // Build JSON with correct field order
  const payload = JSON.stringify({
    drum_version: metadata.drumVersion,
    type: 'drum',
    name: metadata.name,
    start: positionsStart,
    end: positionsEnd,
    octave: metadata.octave,
    pitch: padArray(metadata.pitch, 24, 0),
    playmode: padArray(metadata.playmode, 24, 4096),
    reverse: padArray(metadata.reverse, 24, 8192),
    volume: padArray(metadata.volume, 24, 8192),
    dyna_env: [0, 8192, 0, 8192, 0, 0, 0, 0],
    fx_active: false,
    fx_type: 'delay',
    fx_params: [8000, 8000, 8000, 8000, 8000, 8000, 8000, 8000],
    lfo_active: false,
    lfo_type: 'tremolo',
    lfo_params: [16000, 16000, 16000, 16000, 0, 0, 0, 0]
  });

  // Build chunk: 'APPL' + size + 'op-1' + JSON + null
  const jsonBytes = new TextEncoder().encode(payload);
  const chunkSize = 4 + jsonBytes.length + 1; // op-1 + JSON + null
  
  const chunk = new Uint8Array(8 + chunkSize);
  chunk.set([0x41, 0x50, 0x50, 0x4C], 0); // 'APPL'
  writeUInt32BE(chunk, 4, chunkSize);
  chunk.set([0x6F, 0x70, 0x2D, 0x31], 8); // 'op-1'
  chunk.set(jsonBytes, 12);
  chunk[12 + jsonBytes.length] = 0x00; // null terminator
  
  return chunk;
}
```

### Position Encoding

```typescript
function encodePositions(frames: number[]): number[] {
  const MAX_POSITION = 0x7FFFFFFE;
  return frames.map(f => {
    const encoded = Math.round(f * 4096);
    return Math.max(0, Math.min(MAX_POSITION, encoded));
  });
}

function decodePositions(encoded: number[]): number[] {
  return encoded.map(p => Math.round(p / 4096));
}
```

---

## Testing Tools

- **TE Drum Utility**: https://teenage.engineering/apps/drum-utility — Official validation
- **scripts/analyze_aiff.py**: Local inspection tool
- **Sample Analyzer page**: Visual validation in OP Done

---

## Resources

- [AIFF Specification](http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html)
- [AIFC Specification](http://www-mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFC.html)
- [OP-Z Official Guide](https://teenage.engineering/guides/op-z)

