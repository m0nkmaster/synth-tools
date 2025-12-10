# State Management

React hooks patterns, slice lifecycle, and UI state handling.

## Philosophy

OP Done uses **React hooks** for state management (no Redux/Zustand).

**Why?**
- Simpler architecture
- Fewer dependencies
- Sufficient for current scope
- Easy to understand and maintain

## State Ownership

### `useSlices` Hook

**Purpose**: Manage slice array and processing state.

**Location**: `src/hooks/useSlices.ts`

**State**:
```typescript
const [slices, setSlices] = useState<Slice[]>([]);
const [error, setError] = useState<string | null>(null);
const [isProcessing, setIsProcessing] = useState(false);
const [maxDuration] = useState(MAX_DURATION_SECONDS);
```

**Computed**:
```typescript
const totalDuration = useMemo(
  () => slices.reduce((acc, slice) => acc + slice.duration, 0),
  [slices]
);
```

**Operations**:
```typescript
addFiles(files: FileList | File[]): Promise<void>
removeSlice(id: string): void
updateSlice(id: string, updates: Partial<Slice>): void
reorder(fromIdx: number, toIdx: number): void
reset(): void
```

### Page Components

**DrumCreator**:
- Owns: Metadata state (name, octave, version)
- Owns: UI state (modals, selected slice)
- Delegates: Slice management to `useSlices`

**SampleAnalyzer**:
- Owns: Loaded pack data
- Owns: Playback state (current slice, playing)

**SoundCreation**:
- Owns: AI provider selection
- Owns: Prompt history
- Owns: Current SoundConfig
- Owns: Generated AudioBuffer

## Slice Lifecycle

### States

```typescript
type SliceStatus = 'pending' | 'processing' | 'ready' | 'error';
```

### Transitions

```
User adds file
    ↓
pending (file added to state)
    ↓
processing (async operations start)
    ├── probeDuration()
    ├── classifyAudio()
    ├── detectPitch()
    └── convertToWav() (if AIFF)
    ↓
ready (all operations complete)
    OR
error (any operation failed)
```

### Implementation

```typescript
export function useSlices() {
  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const incoming = Array.from(files);
      
      if (slices.length + incoming.length > MAX_SLICES) {
        setError(`Too many slices. Max ${MAX_SLICES} allowed.`);
        return;
      }

      setIsProcessing(true);
      const mapped: Slice[] = [];
      
      for (const file of incoming) {
        try {
          const isAiff = /\.aiff?$/i.test(file.name);
          const playableBlob = isAiff ? await convertToWav(file) : file;

          // Parallel operations
          const [duration, analysis, pitch] = await Promise.all([
            probeDuration(playableBlob),
            classifyAudio(playableBlob),
            detectPitch(file)
          ]);
          
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const ext = file.name.match(/\.[^.]+$/)?.[0] || '';
          const prefix = formatNamePrefix(analysis);
          
          mapped.push({
            id: crypto.randomUUID(),
            file,
            playableBlob: isAiff ? playableBlob : undefined,
            name: `${prefix}_${baseName}${ext}`,
            duration,
            status: 'ready',
            analysis,
            detectedNote: pitch.note,
            detectedFrequency: pitch.frequency,
            semitones: 0
          });
        } catch (err) {
          console.error(err);
          mapped.push({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            duration: 0,
            status: 'error',
            error: 'Unable to read file'
          });
        }
      }
      
      setSlices(prev => [...prev, ...mapped]);
      setIsProcessing(false);
    },
    [slices.length]
  );

  return {
    slices,
    addFiles,
    removeSlice,
    updateSlice,
    reorder,
    reset,
    isProcessing,
    error,
    maxDuration,
    totalDuration,
  };
}
```

## Immutable Updates

### Add Slice

```typescript
setSlices(prev => [...prev, newSlice]);
```

### Update Slice

```typescript
const updateSlice = useCallback((id: string, updates: Partial<Slice>) => {
  setSlices(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
}, []);
```

### Remove Slice

```typescript
const removeSlice = useCallback((id: string) => {
  setSlices(prev => prev.filter(s => s.id !== id));
}, []);
```

### Reorder Slices

```typescript
const reorder = useCallback((fromIdx: number, toIdx: number) => {
  setSlices(prev => {
    const next = [...prev];
    const [item] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, item);
    return next;
  });
}, []);
```

## Memoization

### useMemo

**Purpose**: Avoid expensive recalculations on every render.

**Example**:
```typescript
const totalDuration = useMemo(
  () => slices.reduce((acc, s) => acc + s.duration, 0),
  [slices]
);
```

**When to use**:
- Expensive computations (array operations, filtering, sorting)
- Derived state (totals, counts, filtered lists)
- Object/array creation (to prevent re-renders)

**When NOT to use**:
- Simple calculations (addition, comparison)
- Primitive values (strings, numbers, booleans)
- Already memoized values

### useCallback

**Purpose**: Stable function references to prevent child re-renders.

**Example**:
```typescript
const removeSlice = useCallback((id: string) => {
  setSlices(prev => prev.filter(s => s.id !== id));
}, []);
```

**When to use**:
- Functions passed as props to child components
- Functions in dependency arrays
- Event handlers (if child uses React.memo)

**When NOT to use**:
- Functions only used in current component
- Functions that change frequently anyway

## Form State

### Controlled Components

```typescript
const [name, setName] = useState('drum pack');
const [octave, setOctave] = useState(0);
const [drumVersion, setDrumVersion] = useState(3);

<TextField
  value={name}
  onChange={(e) => setName(e.target.value)}
/>

<Select
  value={octave}
  onChange={(e) => setOctave(Number(e.target.value))}
>
  {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map(o => (
    <MenuItem key={o} value={o}>{o}</MenuItem>
  ))}
</Select>
```

### Validation

```typescript
const isValid = useMemo(() => {
  return (
    slices.length > 0 &&
    slices.length <= MAX_SLICES &&
    totalDuration <= maxDuration &&
    slices.every(s => s.status === 'ready') &&
    !isProcessing
  );
}, [slices, totalDuration, maxDuration, isProcessing]);

<Button disabled={!isValid} onClick={handleExport}>
  Export
</Button>
```

## Modal State

### Pattern

```typescript
const [modalOpen, setModalOpen] = useState(false);
const [selectedSlice, setSelectedSlice] = useState<Slice | null>(null);

const openModal = (slice: Slice) => {
  setSelectedSlice(slice);
  setModalOpen(true);
};

const closeModal = () => {
  setModalOpen(false);
  setSelectedSlice(null);
};

<Dialog open={modalOpen} onClose={closeModal}>
  {selectedSlice && (
    <PitchControl
      slice={selectedSlice}
      onUpdate={(semitones) => updateSlice(selectedSlice.id, { semitones })}
    />
  )}
</Dialog>
```

## Async State

### Loading States

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleExport = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const blob = await buildDrumPack(slices, options);
    downloadBlob(blob, 'opz-drum-pack.aif');
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Export failed');
  } finally {
    setLoading(false);
  }
};
```

### Cancellation

```typescript
useEffect(() => {
  let cancelled = false;
  
  const loadData = async () => {
    const data = await fetchData();
    if (!cancelled) {
      setData(data);
    }
  };
  
  loadData();
  
  return () => {
    cancelled = true;
  };
}, []);
```

## Context (Future)

### When to Use

**Current**: No context (props drilling is manageable)

**Future**: Consider context for:
- Theme settings (dark mode, colors)
- User preferences (default octave, normalization mode)
- Global modals (error dialogs, confirmations)

### Example

```typescript
const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  
  return (
    <SettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}
```

## Performance Patterns

### React.memo

**Purpose**: Prevent re-renders when props haven't changed.

```typescript
const SliceItem = React.memo(({ slice, onRemove, onUpdate }: Props) => {
  return (
    <Box>
      <Typography>{slice.name}</Typography>
      <IconButton onClick={() => onRemove(slice.id)}>
        <DeleteIcon />
      </IconButton>
    </Box>
  );
});
```

**When to use**:
- List items (SliceItem, WaveformPreview)
- Heavy components (charts, visualizations)
- Components that receive stable props

### Lazy Loading

```typescript
const SoundCreation = lazy(() => import('./pages/SoundCreation'));

<Suspense fallback={<CircularProgress />}>
  <SoundCreation />
</Suspense>
```

### Debouncing

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage
const [prompt, setPrompt] = useState('');
const debouncedPrompt = useDebounce(prompt, 500);

useEffect(() => {
  if (debouncedPrompt) {
    generateSound(debouncedPrompt);
  }
}, [debouncedPrompt]);
```

## Testing State

### Unit Tests

```typescript
import { renderHook, act } from '@testing-library/react';
import { useSlices } from './useSlices';

describe('useSlices', () => {
  it('adds files', async () => {
    const { result } = renderHook(() => useSlices());
    
    const file = new File([''], 'test.wav', { type: 'audio/wav' });
    
    await act(async () => {
      await result.current.addFiles([file]);
    });
    
    expect(result.current.slices).toHaveLength(1);
    expect(result.current.slices[0].name).toContain('test.wav');
  });
  
  it('removes slice', () => {
    const { result } = renderHook(() => useSlices());
    
    act(() => {
      result.current.addFiles([file1, file2]);
    });
    
    const id = result.current.slices[0].id;
    
    act(() => {
      result.current.removeSlice(id);
    });
    
    expect(result.current.slices).toHaveLength(1);
  });
});
```

## Common Patterns

### Conditional Rendering

```typescript
{isProcessing && <CircularProgress />}
{error && <Alert severity="error">{error}</Alert>}
{slices.length === 0 && <Typography>No slices added</Typography>}
{slices.length > 0 && <SliceList slices={slices} />}
```

### List Rendering

```typescript
{slices.map((slice, index) => (
  <SliceItem
    key={slice.id}
    slice={slice}
    index={index}
    onRemove={removeSlice}
    onUpdate={updateSlice}
  />
))}
```

### Conditional Styling

```typescript
<Box
  sx={{
    color: totalDuration > maxDuration ? 'error.main' : 'text.primary',
    fontWeight: isProcessing ? 'normal' : 'bold',
  }}
>
  {formatDuration(totalDuration)} / {formatDuration(maxDuration)}
</Box>
```

---

**Next**: [Testing Guide](./testing.md)
