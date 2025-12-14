# Contributing

Development workflow, code style, and testing guide.

## Setup

### Prerequisites

- **Bun** (latest version) — never use npm/npx
- **Git** for version control
- **VS Code** recommended with ESLint extension

### Initial Setup

```bash
git clone <repo-url>
cd op-done
bun install
bun dev        # http://localhost:5173
```

---

## Development Workflow

### Before Starting

```bash
git pull origin main
git checkout -b feature/your-feature
bun run lint
bun test
```

### During Development

```bash
bun dev              # Dev server with hot reload
bun test --watch     # Watch mode
bun run lint         # Check issues
```

### Before Committing

```bash
bun run lint:fix     # Auto-fix issues
bun test             # All tests pass
bun run build        # Verify build
```

### Commit

```bash
git add .
git commit -m "feat: add pitch detection"
git push origin feature/your-feature
```

---

## Code Style

### TypeScript

**Strict mode enabled.** No `any` types.

```typescript
// Bad
function process(data: any) { ... }

// Good
function process(data: AudioBuffer) { ... }
```

**Explicit return types** for public functions:

```typescript
// Bad
export function encodePositions(frames: number[]) {
  return frames.map(f => f * 4096);
}

// Good
export function encodePositions(frames: number[]): number[] {
  return frames.map(f => f * 4096);
}
```

**Prefer `const`:**

```typescript
// Bad
let result = compute();

// Good
const result = compute();
```

### Naming

| Type | Convention | Example |
|------|------------|---------|
| Files | camelCase | `aiff.ts`, `useSlices.ts` |
| Components | PascalCase | `DrumCreator.tsx` |
| Functions | camelCase | `encodePositions()` |
| Constants | UPPER_SNAKE | `MAX_SLICES` |
| Types | PascalCase | `DrumMetadata` |

### Functions

**Pure functions** (prefer):
```typescript
export function encodePositions(frames: number[]): number[] {
  return frames.map(f => Math.round(f * 4096));
}
```

**Arrow functions** for callbacks:
```typescript
const removeSlice = useCallback((id: string) => {
  setSlices(prev => prev.filter(s => s.id !== id));
}, []);
```

**Async/await** (not promise chains):
```typescript
// Bad
function loadData() {
  return fetch(url).then(r => r.json());
}

// Good
async function loadData() {
  const response = await fetch(url);
  return response.json();
}
```

### Imports

Order:
1. External packages
2. Internal modules (absolute paths)
3. Relative imports
4. Types

```typescript
// External
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { Box, Button } from '@mui/material';

// Internal
import { MAX_SLICES } from '../constants';

// Relative
import { probeDuration } from './metadata';

// Types
import type { Slice } from '../types';
```

**Named exports** preferred over default exports.

### Comments

Comment when:
- Complex algorithms (FFT, autocorrelation)
- Non-obvious decisions (why 4096 scale?)
- Workarounds (browser bugs)

Don't comment:
- Obvious code
- Redundant descriptions

```typescript
// Good
// OP-Z format requires frame positions scaled by 4096 for sub-frame precision
const scaled = frame * 4096;

// Bad
// Increment i
i++;
```

---

## Project Structure

### Adding Features

1. **Document first**: Create `docs/features/<name>.md`
2. **Implement core logic**: Pure TS in `src/audio/` or `src/utils/`
3. **Add tests**: `<module>.test.ts` alongside module
4. **Add UI**: Component in `src/components/` or page in `src/pages/`
5. **Update architecture**: If significant structural change

### File Placement

| Type | Location |
|------|----------|
| Pure functions | `src/audio/` or `src/utils/` |
| React components | `src/components/` |
| Pages | `src/pages/` |
| Hooks | `src/hooks/` |
| Types | `src/types/` or inline |
| Config | `src/config.ts` |

---

## Testing

### Stack

- **Framework**: Vitest
- **DOM**: jsdom
- **Runner**: Bun

### Commands

```bash
bun test                       # Run all
bun test --watch              # Watch mode
bun test src/audio/aiff.test.ts  # Single file
bun test --coverage           # Coverage report
```

### Test Structure

```typescript
import { describe, it, expect } from 'vitest';
import { encodePositions } from './opz';

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
```

### Coverage Targets

| Area | Target |
|------|--------|
| `src/audio/` | 80%+ |
| `src/utils/` | 80%+ |
| Hooks | 70%+ |
| Components | 50%+ (future) |

### Mocking

**AudioContext:**
```typescript
import { vi } from 'vitest';

const mockAudioContext = {
  decodeAudioData: vi.fn().mockResolvedValue({
    duration: 1.0,
    numberOfChannels: 2,
    sampleRate: 44100,
  }),
  close: vi.fn().mockResolvedValue(undefined)
};

global.AudioContext = vi.fn(() => mockAudioContext) as any;
```

**Files:**
```typescript
function createMockFile(name: string): File {
  return new File([''], name, { type: 'audio/wav' });
}
```

### Best Practices

**Naming:**
```typescript
// Good
it('encodes positions with 4096 scale', ...);
it('throws on invalid AIFF header', ...);

// Bad
it('works', ...);
it('test 1', ...);
```

**Independence:** Each test sets up its own data, doesn't depend on other tests.

**Async:** Always await, set timeout for slow tests:
```typescript
it('builds pack', async () => {
  // ...
}, 30000);
```

---

## Pull Requests

### Checklist

- [ ] All tests pass (`bun test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] Tests added for new code
- [ ] Documentation updated (if applicable)

### PR Template

```markdown
## Description
Brief description of changes.

## Type
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Tested on real OP-Z (if applicable)
```

---

## Commit Messages

### Format

```
<type>(<scope>): <subject>
```

### Types

| Type | Use |
|------|-----|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation only |
| style | Formatting (no logic change) |
| refactor | Restructuring (no behavior change) |
| perf | Performance improvement |
| test | Adding/updating tests |
| chore | Maintenance (deps, config) |

### Examples

```
feat(audio): add pitch detection to classification
fix(ffmpeg): handle AIFF conversion errors
docs(architecture): update data flow diagrams
```

---

## Common Issues

### FFmpeg Not Loading

```typescript
// Always call before using
await ensureFFmpeg();
```

### Tests Failing in CI

- Check Bun version matches
- Verify all dependencies installed
- Check for race conditions in async tests

### Linting Errors

```bash
bun run lint:fix
```

### Build Errors

```bash
# Check TypeScript
bun run typecheck

# Verify imports
# Check for missing dependencies
```

---

## Debugging

### Console Logs

```typescript
it('debugs issue', () => {
  const result = functionToTest(input);
  console.log('Result:', result);
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

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
