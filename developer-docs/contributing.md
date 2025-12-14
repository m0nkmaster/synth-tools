# Contributing

Development workflow, testing, and code style.

## Setup

### Prerequisites

- **Bun** (latest) — never use npm/npx
- **Git**
- **VS Code** with ESLint extension (recommended)

### First Time

```bash
git clone <repo-url>
cd op-done
bun install
bun dev
```

Open http://localhost:5173

## Workflow

### Before Starting

```bash
git pull origin main
git checkout -b feature/your-feature
bun run lint
bun test
```

### During Development

```bash
bun dev              # Dev server
bun test --watch     # Test watcher
bun run lint         # Check issues
```

### Before Committing

```bash
bun run lint:fix     # Auto-fix
bun test             # All tests pass
bun run build        # Verify build
```

### Commit

```bash
git add .
git commit -m "feat: add feature"
git push origin feature/your-feature
```

## Code Style

### TypeScript

**Strict mode.** No `any`.

```typescript
// ❌ Bad
function process(data: any) { ... }

// ✅ Good
function process(data: AudioBuffer) { ... }
```

**Explicit return types** for exports:

```typescript
// ❌ Bad
export function encode(frames: number[]) {
  return frames.map(f => f * 4058);
}

// ✅ Good
export function encode(frames: number[]): number[] {
  return frames.map(f => f * 4058);
}
```

**Prefer `const`:**

```typescript
// ❌ Bad
let result = compute();

// ✅ Good
const result = compute();
```

### Naming

| Type | Convention | Example |
|------|------------|---------|
| Files | camelCase | `aiff.ts` |
| Components | PascalCase | `DrumCreator.tsx` |
| Functions | camelCase | `encodePositions` |
| Constants | UPPER_SNAKE | `MAX_SLICES` |
| Types | PascalCase | `SoundConfig` |

### Functions

**Pure functions** preferred:

```typescript
export function encode(frames: number[]): number[] {
  return frames.map(f => Math.round(f * 4058));
}
```

**Arrow functions** for callbacks:

```typescript
const handleClick = useCallback((id: string) => {
  setSlices(prev => prev.filter(s => s.id !== id));
}, []);
```

**async/await** not promise chains:

```typescript
// ❌ Bad
function load() {
  return fetch(url).then(r => r.json());
}

// ✅ Good
async function load() {
  const res = await fetch(url);
  return res.json();
}
```

### Imports

Order:
1. External packages
2. Internal modules
3. Relative imports
4. Types

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { Box, Button } from '@mui/material';

import { MAX_SLICES } from '../constants';

import { probeDuration } from './metadata';

import type { Slice } from '../types';
```

Named exports preferred.

### Comments

Comment:
- Complex algorithms
- Non-obvious decisions
- Workarounds

Don't comment obvious code.

```typescript
// ✅ Good
// Position scale is 4058 based on TE's actual encoding
const scaled = frame * 4058;

// ❌ Bad
// Increment counter
i++;
```

## Testing

### Stack

- **Vitest** — Test framework
- **jsdom** — DOM environment
- **Bun** — Test runner

### Commands

```bash
bun test                    # Run all
bun test --watch           # Watch mode
bun test src/audio/        # Specific directory
bun test aiff.test.ts      # Specific file
```

### Structure

```typescript
import { describe, it, expect } from 'vitest';
import { encodePositions } from './opz';

describe('encodePositions', () => {
  it('scales by 4058', () => {
    expect(encodePositions([44100])).toEqual([178960200]);
  });

  it('clamps to max position', () => {
    expect(encodePositions([1e9])).toEqual([0x7FFFFFFE]);
  });

  it('handles empty array', () => {
    expect(encodePositions([])).toEqual([]);
  });
});
```

### Coverage Targets

| Area | Target |
|------|--------|
| `src/audio/` | 80%+ |
| `src/utils/` | 80%+ |
| Hooks | 70%+ |

### Mocking

**AudioContext:**

```typescript
import { vi } from 'vitest';

global.AudioContext = vi.fn(() => ({
  decodeAudioData: vi.fn().mockResolvedValue({
    duration: 1.0,
    numberOfChannels: 2,
    sampleRate: 44100,
  }),
  close: vi.fn(),
})) as any;
```

**Files:**

```typescript
function mockFile(name: string): File {
  return new File([''], name, { type: 'audio/wav' });
}
```

## Adding Features

1. Create `docs/features/<name>.md` (optional for small features)
2. Implement in `src/audio/` or `src/utils/` (pure TS)
3. Add tests
4. Add UI in `src/components/` or `src/pages/`
5. Update docs if significant

### File Placement

| Type | Location |
|------|----------|
| Pure functions | `src/audio/`, `src/utils/` |
| Components | `src/components/` |
| Pages | `src/pages/` |
| Hooks | `src/hooks/` |
| Types | `src/types/` |
| Config | `src/config.ts` |

## Commits

### Format

```
<type>: <description>
```

### Types

| Type | Use |
|------|-----|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation |
| style | Formatting |
| refactor | Restructuring |
| perf | Performance |
| test | Tests |
| chore | Maintenance |

### Examples

```
feat: add MIDI velocity sensitivity
fix: handle empty slice array in export
docs: update format spec with correct scale
refactor: extract noise generation to separate function
```

## Pull Requests

### Checklist

- [ ] Tests pass (`bun test`)
- [ ] Lint passes (`bun run lint`)
- [ ] Build works (`bun run build`)
- [ ] Tests added for new code
- [ ] Docs updated if needed

## Common Issues

### FFmpeg Not Loading

```typescript
// Always ensure loaded before use
await ensureFFmpeg();
```

### Tests Fail in CI

- Check Bun version
- Verify dependencies
- Check for timing issues in async tests

### Lint Errors

```bash
bun run lint:fix
```

### Build Errors

- Check for TypeScript errors
- Verify all imports resolve
- Check for circular dependencies

## Debugging

### Console

```typescript
it('debugs', () => {
  console.log('Value:', result);
  expect(result).toBe(expected);
});
```

### Isolate

```typescript
it.only('runs only this', () => {
  // ...
});
```

### Skip

```typescript
it.skip('skips this', () => {
  // ...
});
```
