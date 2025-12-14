# OP-Z Format Specification

AIFF format requirements for OP-Z drum packs.

## Overview

OP-Z drum packs are AIFF files containing:
- Mono, 16-bit, 44.1kHz audio
- APPL metadata chunk with slice positions

## Audio Requirements

| Parameter | Value |
|-----------|-------|
| Container | AIFF |
| Channels | 1 (mono) |
| Sample rate | 44,100 Hz |
| Bit depth | 16-bit |
| Byte order | Big-endian |
| Max duration | 11.8 seconds |
| Max slices | 24 |

## File Structure

```
FORM (AIFF)
├── COMM (format description)
├── APPL (OP-Z metadata)  ← Must be before SSND
└── SSND (audio data)
```

## Chunk Details

### FORM Header

```
Offset  Size  Description
0       4     "FORM"
4       4     File size - 8 (big-endian)
8       4     "AIFF"
```

### COMM Chunk

```
Offset  Size  Description
0       4     "COMM"
4       4     Chunk size (18)
8       2     Channels (1)
10      4     Number of frames
14      2     Bits per sample (16)
16      10    Sample rate (80-bit extended float)
```

### APPL Chunk

```
Offset  Size  Description
0       4     "APPL"
4       4     Chunk size
8       4     "op-1" (signature)
12      N     JSON metadata
```

### SSND Chunk

```
Offset  Size  Description
0       4     "SSND"
4       4     Chunk size
8       4     Offset (0)
12      4     Block size (0)
16      N     Audio samples
```

## Metadata JSON

```json
{
  "drum_version": 3,
  "type": "drum",
  "name": "Pack Name",
  "octave": 0,
  "start": [0, 180416, ...],
  "end": [180415, 360831, ...],
  "pitch": [0, 0, ...],
  "playmode": [12288, 12288, ...],
  "reverse": [8192, 8192, ...],
  "volume": [8192, 8192, ...]
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| drum_version | number | 2 (OP-1) or 3 (OP-Z) |
| type | string | Always `"drum"` |
| name | string | Pack name |
| octave | number | -4 to +4 |
| start | number[24] | Slice start positions |
| end | number[24] | Slice end positions |
| pitch | number[24] | Per-slice pitch offset |
| playmode | number[24] | Playback mode |
| reverse | number[24] | Reverse flag |
| volume | number[24] | Per-slice volume |

All arrays must have exactly 24 elements.

## Position Encoding

Frame positions are scaled:

```
encoded_position = frame_number × 4058
```

**Note:** The scale factor is 4058, not 4096 as sometimes documented.

### Calculation

```typescript
// From config.ts
POSITION_SCALE: 4058
MAX_POSITION: 0x7FFFFFFE  // 2,147,483,646

// Encoding
function encodePosition(frame: number): number {
  const encoded = Math.round(frame * 4058);
  return Math.min(encoded, 0x7FFFFFFE);
}

// Decoding
function decodePosition(encoded: number): number {
  return Math.round(encoded / 4058);
}
```

## Default Values

| Parameter | Default | Notes |
|-----------|---------|-------|
| volume | 8192 | Unity gain |
| pitch | 0 | No pitch shift |
| playmode | 12288 | Play Out mode |
| reverse | 8192 | Forward playback |

### Playmode Values

| Value | Mode |
|-------|------|
| 8192 | Mono (cuts off on retrigger) |
| 12288 | Play Out (plays to completion) |

## Slice Layout

Slices are packed contiguously:

```
[Slice 0][Slice 1][Slice 2]...[Slice N]
```

- No gaps between slices in current implementation
- Empty slots have `start === end`

## Implementation

### Building APPL Chunk

```typescript
function buildApplChunk(metadata: DrumMetadata, start: number[], end: number[]): Uint8Array {
  const json = JSON.stringify({
    drum_version: metadata.drumVersion,
    type: 'drum',
    name: metadata.name,
    octave: metadata.octave,
    start: start.map(f => Math.round(f * 4058)),
    end: end.map(f => Math.round(f * 4058)),
    pitch: metadata.pitch,
    playmode: metadata.playmode,
    reverse: metadata.reverse,
    volume: metadata.volume,
  });

  const signature = new TextEncoder().encode('op-1');
  const jsonBytes = new TextEncoder().encode(json);
  const payloadSize = signature.length + jsonBytes.length;
  
  const chunk = new Uint8Array(8 + payloadSize);
  chunk.set(new TextEncoder().encode('APPL'), 0);
  // Write size as big-endian
  chunk[4] = (payloadSize >> 24) & 0xFF;
  chunk[5] = (payloadSize >> 16) & 0xFF;
  chunk[6] = (payloadSize >> 8) & 0xFF;
  chunk[7] = payloadSize & 0xFF;
  chunk.set(signature, 8);
  chunk.set(jsonBytes, 12);
  
  return chunk;
}
```

### Injecting Metadata

```typescript
function injectDrumMetadata(aiff: Uint8Array, applChunk: Uint8Array): Uint8Array {
  const { chunks, formSize } = parseAiff(aiff);
  const ssndChunk = chunks.find(c => c.id === 'SSND');
  const insertPos = ssndChunk ? ssndChunk.offset : aiff.length;

  const result = new Uint8Array(aiff.length + applChunk.length);
  result.set(aiff.slice(0, insertPos), 0);
  result.set(applChunk, insertPos);
  result.set(aiff.slice(insertPos), insertPos + applChunk.length);

  // Update FORM size
  const newSize = formSize + applChunk.length;
  result[4] = (newSize >> 24) & 0xFF;
  result[5] = (newSize >> 16) & 0xFF;
  result[6] = (newSize >> 8) & 0xFF;
  result[7] = newSize & 0xFF;

  return result;
}
```

## Validation

Before export, verify:

- [ ] Total duration ≤ 11.8 seconds
- [ ] Slice count ≤ 24
- [ ] All slices are mono, 16-bit, 44.1kHz
- [ ] Position values fit in 32-bit signed int
- [ ] All metadata arrays have 24 elements
- [ ] APPL chunk appears before SSND

## Testing

Use Sample Analyzer to verify:
- Waveform displays correctly
- Slice boundaries match expected positions
- Metadata fields parse correctly

Use [TE Drum Utility](https://teenage.engineering/apps/drum-utility) for device compatibility testing.

---

## References

### Official Resources

- **[TE Drum Utility](https://teenage.engineering/apps/drum-utility)** — Official Teenage Engineering web tool for creating OP-1/OP-Z drum packs. Supports 24 slots, 12 seconds max for OP-Z. Essential for compatibility testing.

### Community Resources

- **[teoperator](https://github.com/schollz/teoperator)** by [@schollz](https://github.com/schollz) — Go-based command-line tool for creating OP-1/OP-Z patches. The primary source for format reverse engineering. Includes detailed [write-up of the metadata format](https://schollz.com/blog/op1/).

### Format Notes

The OP-Z drum format is largely compatible with OP-1, using the `op-1` signature in the APPL chunk. Key differences:
- OP-Z uses `drum_version: 3` (OP-1 uses `2`)
- OP-Z supports stereo in some modes (drum packs are mono)
- OP-1 field supports 20 seconds stereo; OP-Z supports 12 seconds mono
