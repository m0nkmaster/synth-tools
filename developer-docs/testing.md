# Testing Guide

Unit tests, integration tests, and testing patterns for OP Done.

## Testing Stack

- **Framework**: Vitest
- **DOM**: jsdom
- **Utilities**: @testing-library/react (future)
- **Runner**: Bun

## Commands

```bash
# Run all tests
bun test

# Watch mode
bun test --watch

# UI mode
bun run test:ui

# Coverage
bun test --coverage

# Specific file
bun test src/audio/aiff.test.ts
```

## Test Structure

### File Organization

```
src/
├── audio/
│   ├── aiff.ts
│   ├── aiff.test.ts          # Unit tests
│   ├── pack.ts
│   └── pack.test.ts
├── utils/
│   ├── opz.ts
│   └── opz.test.ts
└── hooks/
    ├── useSlices.ts
    └── useSlices.test.ts      # Hook tests
```

### Test File Template

```typescript
import { describe, it, expect } from 'vitest';
import { functionToTest } from './module';

describe('functionToTest', () => {
  it('handles basic case', () => {
    const result = functionToTest(input);
    expect(result).toBe(expected);
  });
  
  it('handles edge case', () => {
    const result = functionToTest(edgeInput);
    expect(result).toBe(edgeExpected);
  });
  
  it('throws on invalid input', () => {
    expect(() => functionToTest(invalid)).toThrow('Error message');
  });
});
```

## Unit Tests

### Pure Functions

**Example**: `src/utils/opz.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { encodePositions, decodePositions, calculateSliceBoundaries } from './opz';

describe('encodePositions', () => {
  it('scales frames by 4096', () => {
    expect(encodePositions([0, 44100])).toEqual([0, 180633600]);
  });
  
  it('clamps to MAX_POSITION', () => {
    expect(encodePositions([1000000000])).toEqual([0x7ffffffe]);
  });
  
  it('handles negative values', () => {
    expect(encodePositions([-100])).toEqual([0]);
  });
});

describe('decodePositions', () => {
  it('reverses encoding', () => {
    const frames = [0, 44100, 88200];
    const encoded = encodePositions(frames);
    const decoded = decodePositions(encoded);
    expect(decoded).toEqual(frames);
  });
});

describe('calculateSliceBoundaries', () => {
  it('computes sequential boundaries', () => {
    const sliceFrames = [44100, 44100]; // 2× 1s slices
    const totalFrames = 88200;
    const { start, end } = calculateSliceBoundaries(sliceFrames, totalFrames);
    
    expect(start[0]).toBe(0);
    expect(end[0]).toBeLessThan(start[1]);
    expect(start[1]).toBeGreaterThan(end[0]);
  });
  
  it('handles empty slots', () => {
    const sliceFrames = [44100, 0, 44100];
    const totalFrames = 88200;
    const { start, end } = calculateSliceBoundaries(sliceFrames, totalFrames);
    
    expect(start[1]).toBe(end[1]); // Empty slot
  });
});
```

### Audio Processing

**Example**: `src/audio/aiff.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseAiff, injectDrumMetadata } from './aiff';

describe('parseAiff', () => {
  it('parses valid AIFF header', () => {
    const aiff = createMockAiff({ numFrames: 44100, sampleRate: 44100 });
    const result = parseAiff(aiff);
    
    expect(result.numFrames).toBe(44100);
    expect(result.sampleRate).toBe(44100);
    expect(result.chunks).toContainEqual(
      expect.objectContaining({ id: 'COMM' })
    );
  });
  
  it('throws on invalid header', () => {
    const invalid = new Uint8Array([0, 0, 0, 0]);
    expect(() => parseAiff(invalid)).toThrow('Invalid AIFF');
  });
});

describe('injectDrumMetadata', () => {
  it('inserts APPL chunk before SSND', () => {
    const aiff = createMockAiff({ numFrames: 44100 });
    const metadata = {
      name: 'test',
      octave: 0,
      drumVersion: 3,
      pitch: [],
      playmode: [],
      reverse: [],
      volume: []
    };
    
    const result = injectDrumMetadata(aiff, [0], [44099], metadata);
    const parsed = parseAiff(result);
    
    const appl = parsed.chunks.find(c => c.id === 'APPL');
    const ssnd = parsed.chunks.find(c => c.id === 'SSND');
    
    expect(appl).toBeDefined();
    expect(ssnd).toBeDefined();
    expect(appl!.offset).toBeLessThan(ssnd!.offset);
  });
});
```

### Mocking

**AudioContext**:
```typescript
import { vi } from 'vitest';

const mockAudioContext = {
  decodeAudioData: vi.fn().mockResolvedValue({
    duration: 1.0,
    numberOfChannels: 2,
    sampleRate: 44100,
    length: 44100,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(44100))
  }),
  close: vi.fn().mockResolvedValue(undefined)
};

global.AudioContext = vi.fn(() => mockAudioContext) as any;
```

**File**:
```typescript
function createMockFile(name: string, content: string = ''): File {
  return new File([content], name, { type: 'audio/wav' });
}
```

**Blob**:
```typescript
function createMockBlob(data: Uint8Array): Blob {
  return new Blob([data], { type: 'audio/aiff' });
}
```

## Integration Tests

### Full Pipeline

**Example**: `src/audio/pack.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { buildDrumPack } from './pack';
import { parseAiff } from './aiff';

describe('buildDrumPack', () => {
  beforeAll(async () => {
    // Ensure ffmpeg is loaded
    await ensureFFmpeg();
  });
  
  it('produces valid OP-Z AIFF', async () => {
    const slices = [
      { id: '1', file: createMockFile('kick.wav'), duration: 0.5, status: 'ready' as const },
      { id: '2', file: createMockFile('snare.wav'), duration: 0.3, status: 'ready' as const }
    ];
    
    const metadata = {
      name: 'test pack',
      octave: 0,
      drumVersion: 3,
      pitch: [],
      playmode: [],
      reverse: [],
      volume: []
    };
    
    const blob = await buildDrumPack(slices, { maxDuration: 12, metadata });
    const data = new Uint8Array(await blob.arrayBuffer());
    
    // Validate structure
    const parsed = parseAiff(data);
    expect(parsed.numFrames).toBeGreaterThan(0);
    expect(parsed.sampleRate).toBe(44100);
    
    // Validate metadata
    const appl = parsed.chunks.find(c => c.id === 'APPL');
    expect(appl).toBeDefined();
  }, 30000); // 30s timeout for ffmpeg
});
```

### Classification

**Example**: `src/audio/classify.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { classifyAudio } from './classify';

describe('classifyAudio', () => {
  it('classifies kick drum', async () => {
    const blob = await loadTestFile('kick.wav');
    const analysis = await classifyAudio(blob);
    
    expect(analysis.type).toBe('drum_hit');
    expect(analysis.drumClass).toBe('kick');
    expect(analysis.confidence).toBeGreaterThan(0.5);
  });
  
  it('classifies melodic sample', async () => {
    const blob = await loadTestFile('piano-c4.wav');
    const analysis = await classifyAudio(blob);
    
    expect(analysis.type).toBe('melodic');
    expect(analysis.noteName).toBe('C4');
    expect(analysis.midiNote).toBe(60);
  });
  
  it('handles unknown samples', async () => {
    const blob = await loadTestFile('noise.wav');
    const analysis = await classifyAudio(blob);
    
    expect(analysis.type).toBe('unknown');
    expect(analysis.confidence).toBeLessThan(0.5);
  });
});
```

## Hook Tests

**Example**: `src/hooks/useSlices.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSlices } from './useSlices';

describe('useSlices', () => {
  it('initializes with empty state', () => {
    const { result } = renderHook(() => useSlices());
    
    expect(result.current.slices).toEqual([]);
    expect(result.current.totalDuration).toBe(0);
    expect(result.current.isProcessing).toBe(false);
  });
  
  it('adds files', async () => {
    const { result } = renderHook(() => useSlices());
    const file = createMockFile('test.wav');
    
    await act(async () => {
      await result.current.addFiles([file]);
    });
    
    expect(result.current.slices).toHaveLength(1);
    expect(result.current.slices[0].name).toContain('test.wav');
  });
  
  it('removes slice', async () => {
    const { result } = renderHook(() => useSlices());
    const files = [createMockFile('a.wav'), createMockFile('b.wav')];
    
    await act(async () => {
      await result.current.addFiles(files);
    });
    
    const id = result.current.slices[0].id;
    
    act(() => {
      result.current.removeSlice(id);
    });
    
    expect(result.current.slices).toHaveLength(1);
  });
  
  it('computes total duration', async () => {
    const { result } = renderHook(() => useSlices());
    
    // Mock probeDuration to return fixed values
    vi.mock('../audio/metadata', () => ({
      probeDuration: vi.fn().mockResolvedValue(1.0)
    }));
    
    await act(async () => {
      await result.current.addFiles([
        createMockFile('a.wav'),
        createMockFile('b.wav')
      ]);
    });
    
    expect(result.current.totalDuration).toBe(2.0);
  });
});
```

## Test Utilities

### Mock Data

**`test/fixtures.ts`**:
```typescript
export function createMockAiff(options: {
  numFrames: number;
  sampleRate?: number;
}): Uint8Array {
  const { numFrames, sampleRate = 44100 } = options;
  
  // Build minimal AIFF structure
  const comm = buildCommChunk(1, numFrames, 16, sampleRate);
  const ssnd = buildSsndChunk(new Uint8Array(numFrames * 2));
  
  const formSize = 4 + comm.length + ssnd.length;
  const aiff = new Uint8Array(8 + formSize);
  
  // FORM header
  aiff.set([0x46, 0x4f, 0x52, 0x4d], 0); // 'FORM'
  writeUInt32BE(aiff, 4, formSize);
  aiff.set([0x41, 0x49, 0x46, 0x46], 8); // 'AIFF'
  
  // Chunks
  let pos = 12;
  aiff.set(comm, pos);
  pos += comm.length;
  aiff.set(ssnd, pos);
  
  return aiff;
}

export async function loadTestFile(name: string): Promise<Blob> {
  const path = `test/samples/${name}`;
  const data = await fs.readFile(path);
  return new Blob([data], { type: 'audio/wav' });
}
```

### Assertions

**Custom matchers**:
```typescript
expect.extend({
  toBeValidAiff(received: Uint8Array) {
    try {
      const parsed = parseAiff(received);
      return {
        pass: parsed.numFrames > 0 && parsed.sampleRate === 44100,
        message: () => 'Expected valid AIFF'
      };
    } catch {
      return {
        pass: false,
        message: () => 'Expected valid AIFF'
      };
    }
  }
});

// Usage
expect(aiffData).toBeValidAiff();
```

## Coverage

### Target

- **Core modules** (`src/audio/`, `src/utils/`): 80%+
- **Hooks**: 70%+
- **Components**: 50%+ (future)

### Running

```bash
bun test --coverage
```

### Viewing

```bash
open coverage/index.html
```

## CI/CD

### GitHub Actions

**`.github/workflows/ci.yml`**:
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run lint
      - run: bun test
      - run: bun run build
```

## Best Practices

### Test Naming

**Good**:
- `it('encodes positions with 4096 scale', ...)`
- `it('throws on invalid AIFF header', ...)`
- `it('computes total duration from slices', ...)`

**Bad**:
- `it('works', ...)`
- `it('test 1', ...)`
- `it('should do something', ...)`

### Test Organization

**Group related tests**:
```typescript
describe('encodePositions', () => {
  describe('scaling', () => {
    it('multiplies by 4096', ...);
    it('rounds to nearest integer', ...);
  });
  
  describe('clamping', () => {
    it('clamps to MAX_POSITION', ...);
    it('clamps negative to 0', ...);
  });
});
```

### Test Independence

**Each test should**:
- Set up its own data
- Not depend on other tests
- Clean up after itself

**Bad**:
```typescript
let sharedData: any;

it('test 1', () => {
  sharedData = { ... };
});

it('test 2', () => {
  // Depends on test 1!
  expect(sharedData).toBeDefined();
});
```

**Good**:
```typescript
it('test 1', () => {
  const data = { ... };
  expect(data).toBeDefined();
});

it('test 2', () => {
  const data = { ... };
  expect(data).toBeDefined();
});
```

### Async Tests

**Always await**:
```typescript
it('processes file', async () => {
  const result = await processFile(file);
  expect(result).toBeDefined();
});
```

**Set timeout for slow tests**:
```typescript
it('builds pack', async () => {
  // ...
}, 30000); // 30s timeout
```

## Debugging Tests

### Console Logs

```typescript
it('debugs issue', () => {
  const result = functionToTest(input);
  console.log('Result:', result);
  expect(result).toBe(expected);
});
```

### Breakpoints

```typescript
it('debugs with breakpoint', () => {
  debugger; // Pause here
  const result = functionToTest(input);
  expect(result).toBe(expected);
});
```

### Isolate Test

```typescript
it.only('runs only this test', () => {
  // ...
});
```

### Skip Test

```typescript
it.skip('skips this test', () => {
  // ...
});
```

---

**Next**: [Contributing](./contributing.md)
