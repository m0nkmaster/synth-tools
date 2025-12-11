# Synthesizer UI Design Document

## Overview

The Synthesizer UI will provide a professional, hardware-inspired interface for the OP Done application's synthesis engine. It will replace the current JSON-based test harness (SynthTest.tsx) with an intuitive visual interface featuring knobs, switches, and visual feedback for all synthesis parameters.

The design follows a dual-view approach: visual controls for intuitive interaction and a synchronized JSON editor for precise adjustments. All parameter changes will be bidirectionally synchronized between the UI and JSON representation in real-time.

The UI will be built using React and Material-UI components, with custom components for hardware-style controls (knobs, switches, envelope visualizers). The existing `synthesizeSound` function and `SoundConfig` type will remain unchanged, ensuring the UI is purely a presentation layer over the existing synthesis engine.

## Architecture

### Component Hierarchy

```
SynthesizerUI (Page Component)
├── PresetManager
│   ├── PresetSelector
│   ├── PresetSaveDialog
│   └── PresetList
├── MetadataPanel
│   ├── NameInput
│   ├── CategorySelector
│   ├── DescriptionInput
│   └── TagsInput
├── SynthesisPanel
│   ├── LayerManager
│   │   ├── LayerList
│   │   ├── AddLayerButton
│   │   └── LayerControls (per layer)
│   │       ├── OscillatorControls
│   │       ├── NoiseControls
│   │       ├── FMControls
│   │       ├── KarplusStrongControls
│   │       ├── LayerEnvelopeControls
│   │       ├── LayerFilterControls
│   │       └── SaturationControls
│   └── GlobalEnvelopeControls
├── FilterPanel
│   ├── FilterTypeSelector
│   ├── FilterControls (cutoff, resonance, gain)
│   └── FilterEnvelopeControls
├── LFOPanel
│   ├── LFOWaveformSelector
│   ├── LFOControls (frequency, depth, delay, fade)
│   └── LFOTargetSelector
├── EffectsPanel
│   ├── ReverbControls
│   ├── DelayControls
│   ├── DistortionControls
│   ├── CompressorControls
│   └── GateControls
├── PlaybackPanel
│   ├── PlayButton
│   ├── DurationControl
│   └── ExportButton
└── JSONEditorPanel
    ├── JSONEditor (Monaco or CodeMirror)
    └── ValidationDisplay
```

### State Management

The application will use React's built-in state management with a single source of truth:

- **Primary State**: `SoundConfig` object stored in component state
- **Derived State**: JSON string representation for the editor
- **Synchronization**: Bidirectional updates between visual controls and JSON editor

State update flow:
1. Visual control change → Update `SoundConfig` → Serialize to JSON string
2. JSON editor change → Parse JSON → Validate → Update `SoundConfig` → Update visual controls

### Data Flow

```
User Interaction
    ↓
Visual Control / JSON Editor
    ↓
State Update Handler
    ↓
SoundConfig State
    ↓
├─→ Visual Controls (re-render)
├─→ JSON Editor (update text)
└─→ Synthesis Engine (on play/export)
```

## Components and Interfaces

### Core UI Components

#### Knob Component
```typescript
interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  onChange: (value: number) => void;
  logarithmic?: boolean;
}
```

Circular knob control with rotation gesture, value display, and optional logarithmic scaling for frequency parameters.

#### Switch Component
```typescript
interface SwitchProps {
  value: boolean;
  label: string;
  onChange: (value: boolean) => void;
}
```

Toggle switch for boolean parameters (enable/disable features).

#### SegmentedButton Component
```typescript
interface SegmentedButtonProps<T> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}
```

Multi-option selector for discrete choices (waveforms, filter types, etc.).

#### EnvelopeVisualizer Component
```typescript
interface EnvelopeVisualizerProps {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  duration: number;
}
```

SVG-based visualization of ADSR envelope curve.

### Panel Components

#### LayerControls Component
```typescript
interface LayerControlsProps {
  layer: SoundConfig['synthesis']['layers'][0];
  index: number;
  onUpdate: (index: number, layer: SoundConfig['synthesis']['layers'][0]) => void;
  onRemove: (index: number) => void;
}
```

Dynamically renders controls based on layer type, showing only relevant parameters.

#### FilterPanel Component
```typescript
interface FilterPanelProps {
  filter: SoundConfig['filter'];
  onUpdate: (filter: SoundConfig['filter']) => void;
}
```

Global filter controls with optional envelope modulation.

#### EffectsPanel Component
```typescript
interface EffectsPanelProps {
  effects: SoundConfig['effects'];
  onUpdate: (effects: SoundConfig['effects']) => void;
}
```

Collapsible sections for each effect type, showing controls only when enabled.

### JSON Editor Integration

The JSON editor will use Monaco Editor (VS Code's editor) or CodeMirror for:
- Syntax highlighting
- Real-time validation
- Error indicators
- Auto-formatting

```typescript
interface JSONEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationError: (errors: string[]) => void;
}
```

Validation will check:
1. JSON syntax validity
2. Schema compliance (all required fields present)
3. Value range constraints (e.g., frequency 20-20000 Hz)

Invalid changes will show warnings but allow editing. Values outside valid ranges will be clamped when applied to visual controls.

## Data Models

The existing `SoundConfig` type from `src/types/soundConfig.ts` will be used without modification. The UI will work directly with this type.

### Preset Storage

Presets will be stored in browser localStorage:

```typescript
interface Preset {
  id: string;
  name: string;
  category: string;
  config: SoundConfig;
  createdAt: number;
  updatedAt: number;
}

interface PresetStorage {
  presets: Preset[];
  defaultPresetId: string;
}
```

Storage key: `opDone.synth.presets`

### Default Preset

A default preset will be loaded on initialization, providing a simple sine wave oscillator as a starting point:

```typescript
const DEFAULT_PRESET: SoundConfig = {
  synthesis: {
    layers: [{
      type: 'oscillator',
      gain: 0.8,
      oscillator: {
        waveform: 'sine',
        frequency: 440,
        detune: 0,
      },
    }],
  },
  envelope: {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
  },
  effects: {},
  timing: { duration: 1.0 },
  dynamics: { velocity: 0.8, normalize: true },
  metadata: {
    name: 'Default',
    category: 'other',
    description: 'Simple sine wave',
    tags: [],
  },
};
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Parameter Clamping
*For any* numeric parameter with defined min/max bounds, when a user provides an out-of-range value, the system should clamp the value to the valid range.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 4.2, 4.3, 4.5, 6.3, 7.5, 11.2, 11.3, 11.4, 12.2, 12.3, 12.4**

### Property 2: JSON-to-UI Synchronization
*For any* valid JSON configuration change, all visual controls should update to reflect the new values from the JSON.
**Validates: Requirements 15.2**

### Property 3: UI-to-JSON Synchronization
*For any* visual control adjustment, the JSON editor should update in real-time to reflect the new configuration.
**Validates: Requirements 15.3**

### Property 4: Preset Round-Trip
*For any* valid sound configuration, saving it as a preset and then loading that preset should restore the exact same configuration.
**Validates: Requirements 8.2**

### Property 5: Layer Addition
*For any* existing configuration, adding a new layer should increase the layer count by one and the new layer should have valid default parameters for its type.
**Validates: Requirements 1.2**

### Property 6: Layer Removal
*For any* configuration with at least one layer, removing a layer should decrease the layer count by one and maintain a valid configuration.
**Validates: Requirements 1.5**

### Property 7: Tag Management
*For any* configuration, adding a tag should append it to the tags array, and removing a tag should remove only that tag while preserving others.
**Validates: Requirements 13.4, 13.5**

### Property 8: Synthesis Success
*For any* valid sound configuration, clicking play should successfully synthesize audio without throwing errors.
**Validates: Requirements 7.1**

### Property 9: Export Filename
*For any* sound configuration, the export filename should match the metadata name field.
**Validates: Requirements 14.5**

### Property 10: Invalid JSON Rejection
*For any* JSON string with invalid syntax, the system should display validation errors and prevent the invalid configuration from being applied to visual controls.
**Validates: Requirements 15.4**

### Property 11: Value Clamping on JSON Import
*For any* JSON configuration with valid syntax but out-of-range parameter values, the system should display warnings and clamp values to valid ranges when applied.
**Validates: Requirements 15.5**

### Property 12: Envelope Visualization
*For any* valid ADSR envelope parameters, the envelope visualizer should render without errors and display a curve.
**Validates: Requirements 2.5**

### Property 13: Discrete Parameter Updates
*For any* discrete parameter selection (waveform, filter type, LFO target, noise type, category), the configuration should be updated to reflect the selected value.
**Validates: Requirements 3.1, 4.1, 6.2, 6.4, 10.1, 13.2**

### Property 14: Layer Type Controls
*For any* layer type (oscillator, noise, FM, Karplus-Strong), the UI should display only the controls relevant to that layer type.
**Validates: Requirements 1.3**

### Property 15: Preset Deletion
*For any* saved preset, deleting it should remove it from storage and it should no longer appear in the preset list.
**Validates: Requirements 8.4**

## Error Handling

### Synthesis Errors
- Invalid configurations that cause `synthesizeSound` to throw errors should be caught and displayed to the user
- Error messages should be specific and actionable (e.g., "Invalid frequency value: must be between 20-20000 Hz")
- The UI should remain functional after an error (no crashes)

### JSON Validation Errors
- Syntax errors: Display line/column information from JSON parser
- Schema errors: Display which required fields are missing
- Range errors: Display which parameters are out of range and what the valid range is

### Storage Errors
- localStorage quota exceeded: Display warning and suggest deleting old presets
- localStorage unavailable: Fall back to in-memory storage with warning
- Corrupted preset data: Skip corrupted presets and log errors

### Audio Playback Errors
- AudioContext creation failure: Display browser compatibility message
- Buffer creation failure: Display memory error message
- Playback interruption: Clean up resources and reset play button state

## Testing Strategy

### Unit Testing
The UI will use Vitest and React Testing Library for unit tests:

- **Component Tests**: Test individual components (Knob, Switch, EnvelopeVisualizer) in isolation
- **Integration Tests**: Test panel components with their child components
- **State Management Tests**: Test state update handlers and synchronization logic
- **Validation Tests**: Test parameter clamping and JSON validation logic

Example unit tests:
- Knob component updates value on drag
- EnvelopeVisualizer renders correct SVG path
- Parameter clamping function clamps values correctly
- JSON validation detects syntax errors

### Property-Based Testing
The UI will use fast-check (JavaScript property-based testing library) for property tests:

- **Configuration**: Each property test will run a minimum of 100 iterations
- **Tagging**: Each property test will include a comment with the format: `**Feature: synth-ui, Property {number}: {property_text}**`
- **Generators**: Custom generators will create valid SoundConfig objects with random but valid parameters

Property tests will verify:
- Parameter clamping works for all numeric inputs
- JSON-UI synchronization works for all valid configurations
- Preset save/load round-trips preserve configurations
- Layer addition/removal maintains valid state
- All discrete parameter selections update config correctly

### Testing Framework Setup
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

### Property Test Example
```typescript
import fc from 'fast-check';

/**
 * Feature: synth-ui, Property 1: Parameter Clamping
 * For any numeric parameter with defined min/max bounds, when a user provides 
 * an out-of-range value, the system should clamp the value to the valid range.
 */
test('parameter clamping property', () => {
  fc.assert(
    fc.property(
      fc.float({ min: -1000, max: 1000 }),
      (input) => {
        const clamped = clampParameter(input, 0, 1);
        expect(clamped).toBeGreaterThanOrEqual(0);
        expect(clamped).toBeLessThanOrEqual(1);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Manual Testing
- Visual inspection of hardware-inspired aesthetic
- Interaction testing (knob dragging, hover states)
- Audio playback testing with various configurations
- Cross-browser compatibility testing
- Performance testing with complex configurations (8 layers, all effects)

