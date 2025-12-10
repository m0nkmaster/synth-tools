# Contributing Guide

Code style, development workflow, and contribution guidelines.

## Development Setup

### Prerequisites

- **Bun**: Latest version (never npm/npx)
- **Git**: For version control
- **Editor**: VS Code recommended (with ESLint extension)

### Initial Setup

```bash
# Clone repository
git clone <repo-url>
cd op-done

# Install dependencies
bun install

# Run dev server
bun dev

# Open browser
open http://localhost:5173
```

## Workflow

### Before Starting Work

```bash
# Pull latest changes
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name

# Verify tests pass
bun run lint
bun test
```

### During Development

```bash
# Run dev server (auto-reload)
bun dev

# Run tests in watch mode
bun test --watch

# Check linting
bun run lint
```

### Before Committing

```bash
# Fix linting issues
bun run lint:fix

# Run all tests
bun test

# Build to verify
bun run build
```

### Committing

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add pitch detection to classification"

# Push to remote
git push origin feature/your-feature-name
```

## Code Style

### TypeScript

**Strict mode**: Enabled in `tsconfig.json`

**No `any`**:
```typescript
// Bad
function process(data: any) { ... }

// Good
function process(data: AudioBuffer) { ... }
```

**Explicit return types** (for public functions):
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

**Prefer `const`**:
```typescript
// Bad
let result = compute();

// Good
const result = compute();
```

### Naming Conventions

**Files**: camelCase
- `aiff.ts`, `classify.ts`, `useSlices.ts`

**Components**: PascalCase
- `DrumCreator.tsx`, `PitchDial.tsx`

**Functions**: camelCase
- `encodePositions()`, `buildDrumPack()`

**Constants**: UPPER_SNAKE_CASE
- `MAX_SLICES`, `SAMPLE_RATE`

**Types**: PascalCase
- `Slice`, `DrumMetadata`, `SoundConfig`

### Function Style

**Pure functions** (prefer):
```typescript
export function encodePositions(frames: number[]): number[] {
  return frames.map(f => Math.round(f * 4096));
}
```

**Arrow functions** (for callbacks):
```typescript
const removeSlice = useCallback((id: string) => {
  setSlices(prev => prev.filter(s => s.id !== id));
}, []);
```

**Async/await** (not promises):
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

### Comments

**When to comment**:
- Complex algorithms (FFT, autocorrelation)
- Non-obvious decisions (why 4096 scale?)
- Workarounds (browser bugs, API limitations)

**When NOT to comment**:
- Obvious code (`i++; // increment i`)
- Redundant descriptions (`// Get user name` above `getUserName()`)

**Good comments**:
```typescript
// OP-Z format requires frame positions scaled by 4096 for sub-frame precision
const scaled = frame * 4096;

// Parabolic interpolation for sub-sample accuracy
const offset = (y1 - y3) / (2 * a);
```

### Imports

**Order**:
1. External packages
2. Internal modules (absolute paths)
3. Relative imports
4. Types (if separate)

```typescript
// External
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { Box, Button } from '@mui/material';

// Internal
import { MAX_SLICES } from '../constants';
import { encodePositions } from '../utils/opz';

// Relative
import { probeDuration } from './metadata';

// Types
import type { Slice, DrumMetadata } from '../types';
```

**Named exports** (prefer):
```typescript
// Bad
export default function encodePositions() { ... }

// Good
export function encodePositions() { ... }
```

## Project Structure

### Adding New Features

**1. Create feature doc**:
```bash
touch docs/features/your-feature.md
```

**2. Implement core logic** (pure TS):
```bash
touch src/audio/your-feature.ts
touch src/audio/your-feature.test.ts
```

**3. Add UI** (if needed):
```bash
touch src/components/YourFeature.tsx
```

**4. Update architecture**:
```bash
# Edit docs/ARCHITECTURE.md
```

### File Placement

**Pure functions** → `src/audio/` or `src/utils/`  
**React components** → `src/components/`  
**Pages** → `src/pages/`  
**Hooks** → `src/hooks/`  
**Types** → `src/types/` or inline  
**Config** → `src/config.ts`

## Testing

### Test Coverage

**Required**:
- All pure functions in `src/audio/`
- All utility functions in `src/utils/`
- Critical hooks (`useSlices`)

**Optional**:
- UI components (future)
- Integration tests (future)

### Writing Tests

**Pattern**:
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
    expect(() => functionToTest(invalid)).toThrow();
  });
});
```

**Run tests**:
```bash
bun test
bun test --watch
bun test src/audio/aiff.test.ts
```

## Pull Requests

### Before Creating PR

- [ ] All tests pass (`bun test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Build succeeds (`bun run build`)
- [ ] Feature documented (if applicable)
- [ ] Tests added for new code

### PR Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Tested on real OP-Z device (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. **Self-review**: Check your own code first
2. **Automated checks**: CI must pass
3. **Peer review**: At least one approval
4. **Merge**: Squash and merge to main

## Commit Messages

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code restructuring (no behavior change)
- `perf`: Performance improvement
- `test`: Adding/updating tests
- `chore`: Maintenance (dependencies, config)

### Examples

**Good**:
```
feat(audio): add pitch detection to classification

Implements autocorrelation-based pitch detection for melodic samples.
Displays detected note name in slice list.

Closes #123
```

```
fix(ffmpeg): handle AIFF conversion errors

Catches decode errors and shows user-friendly message instead of crashing.
```

```
docs(architecture): update data flow diagrams

Adds synthesis pipeline diagram and updates export flow.
```

**Bad**:
```
update stuff
```

```
fix bug
```

```
WIP
```

## Code Review

### As Author

**Respond to feedback**:
- Address all comments
- Explain decisions if needed
- Update code or add comments

**Don't**:
- Take feedback personally
- Ignore comments
- Argue without reason

### As Reviewer

**Focus on**:
- Correctness (does it work?)
- Clarity (is it understandable?)
- Consistency (matches existing code?)
- Performance (any bottlenecks?)
- Security (any vulnerabilities?)

**Don't**:
- Nitpick style (linter handles this)
- Rewrite code (suggest, don't demand)
- Block on personal preference

**Feedback style**:
```
// Good
"Consider using `useMemo` here to avoid recalculation on every render."

"This could throw if `data` is null. Add a null check?"

// Bad
"This is wrong."

"You should use useMemo."
```

## Documentation

### When to Document

**Always**:
- New features (`docs/features/`)
- API changes (`docs/ARCHITECTURE.md`)
- Breaking changes (`CHANGELOG.md`)

**Sometimes**:
- Bug fixes (if non-obvious)
- Refactoring (if significant)

### Documentation Style

**Concise**: Get to the point  
**Clear**: Avoid jargon  
**Complete**: Include examples  
**Current**: Update with code changes

## Release Process

### Versioning

**Semantic Versioning** (SemVer):
- `MAJOR.MINOR.PATCH`
- `1.0.0` → `1.0.1` (patch: bug fix)
- `1.0.1` → `1.1.0` (minor: new feature)
- `1.1.0` → `2.0.0` (major: breaking change)

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in `package.json`
- [ ] Git tag created
- [ ] Build deployed

## Getting Help

### Resources

- **Documentation**: `developer-docs/`
- **Examples**: Existing code in `src/`
- **Tests**: `*.test.ts` files

### Questions

- Check documentation first
- Search existing issues
- Ask in discussions
- Create issue if needed

## Common Issues

### FFmpeg Not Loading

**Symptom**: "FFmpeg not loaded" error

**Solution**:
```typescript
await ensureFFmpeg(); // Call before using
```

### Tests Failing

**Symptom**: Tests pass locally, fail in CI

**Solution**:
- Check Node/Bun version
- Verify dependencies installed
- Check for race conditions

### Linting Errors

**Symptom**: ESLint errors on commit

**Solution**:
```bash
bun run lint:fix
```

### Build Errors

**Symptom**: `bun run build` fails

**Solution**:
- Check TypeScript errors: `bun run typecheck`
- Verify imports are correct
- Check for missing dependencies

---

**Thank you for contributing to OP Done!**
