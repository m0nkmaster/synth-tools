# Roadmap

Planned features and improvements for future development.

## Status Legend

- 🔴 **Not Started** - Planned but no work begun
- 🟡 **In Progress** - Active development
- 🟢 **Complete** - Implemented and tested

---

## 1. Backend API for AI Services

**Status**: 🔴 Not Started

### Problem

Current architecture makes direct API calls from the browser to AI providers (OpenAI, Gemini). This has several issues:

- **CORS restrictions** - Some API endpoints don't allow browser origins
- **API key exposure** - Keys stored in browser localStorage are visible in DevTools
- **Rate limiting** - Per-user rate limits harder to enforce
- **No request auditing** - Cannot track usage or implement quotas

### Solution

Implement a lightweight backend API proxy that:

1. **Hides credentials** - API keys stored server-side in environment variables
2. **Handles CORS** - Backend makes cross-origin requests, returns to browser
3. **Enables rate limiting** - Throttle requests per session/user
4. **Adds observability** - Log requests, track usage, monitor costs

### Proposed Architecture

```
┌─────────────────────────────────────────┐
│           Browser (React)               │
│  POST /api/generate-sound               │
└──────────────────┬──────────────────────┘
                   │ HTTPS
┌──────────────────▼──────────────────────┐
│           API Proxy (Bun/Hono)          │
│  - Validate request                     │
│  - Add API key from env                 │
│  - Forward to provider                  │
│  - Return response                      │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│     AI Provider (OpenAI / Gemini)       │
└─────────────────────────────────────────┘
```

### Implementation Plan

1. Create `/api/` directory for backend routes
2. Implement Hono or Express-like router (Bun native)
3. Add endpoints:
   - `POST /api/generate-sound` - Generate SoundConfig
   - `POST /api/refine-sound` - Iterative refinement
4. Environment variables for secrets
5. Update `src/services/ai.ts` to call backend instead of providers directly
6. Add authentication (optional, session-based)

### Files to Create

- `api/index.ts` - Server entry point
- `api/routes/generate.ts` - Sound generation route
- `api/middleware/auth.ts` - Optional authentication
- `api/lib/providers.ts` - AI provider abstraction (server-side)

### Files to Modify

- `src/services/ai.ts` - Change to call `/api/` endpoints
- `package.json` - Add server scripts
- `.env.example` - Move API keys to server

---

## 2. Unified Drum Pack Creator

**Status**: 🔴 Not Started

### Problem

Current architecture splits functionality across multiple pages:

- **DrumCreator** - Upload samples manually
- **AIKitGenerator** - Generate samples with AI
- **SoundCreation** - Create individual sounds

Users must navigate between pages and manually combine workflows.

### Solution

Create a single, unified drum pack creation experience:

1. **Single page** for all drum pack creation
2. **Mixed sources** - Upload samples AND generate with AI in same session
3. **Slot-based interface** - 24 slots, fill from any source
4. **Seamless workflow** - No page navigation required

### Proposed Interface

```
┌─────────────────────────────────────────────────────────────┐
│  OP Done Drum Pack Creator                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Pack Name: [My Custom Kit_________]                        │
│                                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│  │  1  │ │  2  │ │  3  │ │  4  │ │  5  │ │  6  │  ...      │
│  │ 🥁  │ │ 🥁  │ │ 🎵  │ │     │ │     │ │     │           │
│  │Kick │ │Snare│ │ Hat │ │Empty│ │Empty│ │Empty│           │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘           │
│                                                             │
│  Selected Slot: 4                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [📁 Upload Sample] [🤖 Generate with AI] [🎹 Synth]    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Export Pack]                          Total: 3.2s / 12s   │
└─────────────────────────────────────────────────────────────┘
```

### Key Features

- **24-slot grid** - Visual representation of drum pack slots
- **Drag-and-drop** - Reorder, swap, remove samples
- **Source options per slot**:
  - Upload from file system
  - Generate with AI (text prompt)
  - Synthesize manually (open synth panel)
  - Copy from another slot
- **Bulk operations**:
  - Upload multiple files at once
  - Generate kit presets (e.g., "808 kit", "Acoustic kit")
- **Real-time validation** - Duration, format, slot count

### Implementation Plan

1. Create `src/pages/UnifiedCreator.tsx`
2. Build slot grid component with state for 24 slots
3. Integrate existing functionality:
   - `useSlices` → Adapt for slot-based model
   - AI generation → Inline panel
   - Synth engine → Modal or side panel
4. Add drag-drop between slots (react-dnd or native)
5. Migrate export logic from `DrumCreator.tsx`
6. Deprecate old pages (keep for backward compatibility)

### Files to Create

- `src/pages/UnifiedCreator.tsx` - Main page
- `src/components/SlotGrid.tsx` - 24-slot visual grid
- `src/components/SlotPanel.tsx` - Per-slot controls
- `src/components/SourcePicker.tsx` - Upload/Generate/Synth picker
- `src/hooks/useSlotGrid.ts` - Slot state management

### Files to Modify

- `src/App.tsx` - Add route, update navigation
- `src/hooks/useSlices.ts` - Adapt for slot-based model (or create new hook)

---

## 3. Advanced Synthesis Engine

**Status**: 🔴 Not Started

### Problem

Current synthesizer (`src/audio/synthesizer.ts`) has limitations:

- **Single LFO** - Only one LFO per sound
- **No FX sends** - Effects are inline, no send/return routing
- **No signal routing** - Fixed signal flow
- **No MIDI** - Cannot control from external MIDI devices
- **Limited modulation** - Only basic envelope-to-filter

### Solution

Upgrade the synthesis engine with professional features:

### 3.1 Multi-LFO System

**Current**: Single global LFO  
**Proposed**: Multiple LFOs with flexible routing

```typescript
interface LFOConfig {
  id: string;
  waveform: 'sine' | 'triangle' | 'square' | 'sawtooth' | 'random';
  frequency: number;
  depth: number;
  targets: LFOTarget[]; // Route to multiple destinations
  sync?: boolean;       // Tempo sync
  phase?: number;       // Start phase offset
}

interface LFOTarget {
  destination: 'filter' | 'amplitude' | 'pan' | 'pitch' | 'fmDepth' | 'delay' | 'reverb';
  amount: number;       // Modulation depth for this target
  layer?: string;       // Specific layer (optional)
}
```

### 3.2 FX Send/Return Architecture

**Current**: Inline effects (distortion → compressor → delay → reverb)  
**Proposed**: Parallel send/return buses

```
┌───────────────────────────────────────────────────────────┐
│  Layer 1  ──┬── Send A (0.3) ──▶ ┌─────────┐             │
│             │                     │ Reverb  │─────┐       │
│  Layer 2  ──┼── Send A (0.5) ──▶ └─────────┘     │       │
│             │                                     ▼       │
│  Layer 3  ──┼── Send B (0.7) ──▶ ┌─────────┐  ┌─────┐   │
│             │                     │  Delay  │──│ Mix │──▶│
│             │                     └─────────┘  └─────┘   │
│             │                                     ▲       │
│             └── Dry ─────────────────────────────┘       │
└───────────────────────────────────────────────────────────┘
```

```typescript
interface SendConfig {
  id: string;
  effect: EffectConfig;
  returnLevel: number;
}

interface LayerConfig {
  // ... existing fields
  sends: {
    sendId: string;
    level: number; // 0-1
  }[];
}
```

### 3.3 Signal Routing (Node Graph)

**Current**: Fixed layer → filter → VCA → effects → output  
**Proposed**: Flexible node-based routing

```typescript
interface AudioNode {
  id: string;
  type: 'oscillator' | 'noise' | 'filter' | 'vca' | 'effect' | 'mixer' | 'output';
  config: NodeConfig;
}

interface Connection {
  from: { nodeId: string; output: string };
  to: { nodeId: string; input: string };
  amount?: number; // For CV connections
}

interface NodeGraph {
  nodes: AudioNode[];
  connections: Connection[];
}
```

Visual editor for routing (future):

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   OSC    │────▶│  Filter  │────▶│   VCA    │──┐
└──────────┘     └──────────┘     └──────────┘  │
                      ▲                          │
                      │                          ▼
┌──────────┐     ┌────┴─────┐     ┌──────────┐
│   LFO    │────▶│  Mod Hub │     │  Output  │
└──────────┘     └────┬─────┘     └──────────┘
                      │                ▲
                      ▼                │
                 ┌──────────┐          │
                 │  Reverb  │──────────┘
                 └──────────┘
```

### 3.4 MIDI Support

**Current**: No MIDI  
**Proposed**: Web MIDI API integration

```typescript
interface MIDIConfig {
  enabled: boolean;
  inputDevice?: string;
  channel: number;      // 1-16, 0 = omni
  noteMapping: 'chromatic' | 'drum' | 'custom';
  ccMappings: CCMapping[];
}

interface CCMapping {
  cc: number;           // 0-127
  target: string;       // Parameter path (e.g., "filter.cutoff")
  min: number;
  max: number;
}
```

Features:
- Note input triggers synthesis
- CC to parameter mapping
- Program change for preset switching
- MPE support (future)

### Implementation Plan

**Phase 1: Multi-LFO**
1. Update `SoundConfig` type with LFO array
2. Modify `synthesizer.ts` to create multiple LFO nodes
3. Implement routing to multiple targets
4. Update UI with multi-LFO controls

**Phase 2: FX Sends**
1. Add send bus types to `SoundConfig`
2. Create send/return audio graph in synthesizer
3. Add per-layer send controls
4. Update effects panel UI

**Phase 3: Node Graph**
1. Define node/connection types
2. Implement graph evaluation in synthesizer
3. Create visual node editor component
4. Add preset save/load for graphs

**Phase 4: MIDI**
1. Add MIDI types
2. Implement Web MIDI API wrapper
3. Create MIDI settings UI
4. Add CC learning mode

### Files to Create

- `src/audio/lfo.ts` - Multi-LFO system
- `src/audio/sends.ts` - Send/return routing
- `src/audio/nodeGraph.ts` - Node graph evaluation
- `src/audio/midi.ts` - MIDI integration
- `src/components/NodeEditor.tsx` - Visual routing (future)
- `src/components/MIDISettings.tsx` - MIDI configuration

### Files to Modify

- `src/types/soundConfig.ts` - Extended types
- `src/audio/synthesizer.ts` - Core synthesis changes
- `src/pages/SynthesizerUI.tsx` - UI updates

---

## 4. Unified UI Design System

**Status**: 🔴 Not Started

### Problem

Current UI has inconsistencies across pages:

- **Different layouts** - Each page has unique structure
- **Inconsistent spacing** - Margins/padding vary
- **Mixed component styles** - Some use MUI, some custom
- **No design tokens** - Colors/fonts hardcoded in places
- **Theme switching** - Only partial dark/light support

### Solution

Implement a unified design system:

### 4.1 Design Tokens

```typescript
// src/design/tokens.ts
export const tokens = {
  // Spacing scale (4px base)
  space: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  
  // Typography
  typography: {
    fontFamily: {
      mono: '"JetBrains Mono", monospace',
      sans: '"Inter", sans-serif',
    },
    fontSize: {
      xs: '10px',
      sm: '12px',
      md: '14px',
      lg: '16px',
      xl: '20px',
      xxl: '24px',
    },
  },
  
  // Colors (TE-inspired)
  colors: {
    primary: '#FF6B00',    // TE Orange
    secondary: '#00D4AA',  // Teal accent
    background: {
      dark: '#0A0A0A',
      medium: '#1A1A1A',
      light: '#2A2A2A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#888888',
      disabled: '#444444',
    },
  },
  
  // Border radius
  radius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
};
```

### 4.2 Layout System

Consistent page structure:

```tsx
// Every page follows this structure
<PageContainer>
  <PageHeader title="Drum Creator" />
  <PageContent>
    <Sidebar>
      {/* Controls, settings */}
    </Sidebar>
    <MainArea>
      {/* Primary content */}
    </MainArea>
  </PageContent>
  <PageFooter>
    {/* Actions, status */}
  </PageFooter>
</PageContainer>
```

### 4.3 Component Library

Standardized components:

- **Buttons**: Primary, Secondary, Ghost, Icon
- **Inputs**: Text, Number, Slider, Knob, Toggle
- **Panels**: Card, Modal, Drawer, Tooltip
- **Feedback**: Toast, Progress, Skeleton, Error
- **Data**: Table, List, Grid, Chip

### 4.4 Theme System

Complete light/dark theme support:

```typescript
interface Theme {
  mode: 'light' | 'dark';
  colors: ColorTokens;
  spacing: SpacingTokens;
  typography: TypographyTokens;
  shadows: ShadowTokens;
  transitions: TransitionTokens;
}

// Context provider
<ThemeProvider theme={currentTheme}>
  <App />
</ThemeProvider>
```

### Implementation Plan

1. Create design tokens file
2. Build base layout components
3. Audit existing components for inconsistencies
4. Create standardized component variants
5. Migrate pages to new layout system
6. Add theme toggle with full coverage
7. Document in Storybook (optional)

### Files to Create

- `src/design/tokens.ts` - Design tokens
- `src/design/theme.ts` - Theme definitions
- `src/components/layout/PageContainer.tsx`
- `src/components/layout/PageHeader.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/components/primitives/Button.tsx` - Unified button
- `src/components/primitives/Input.tsx` - Unified input
- `src/components/primitives/Panel.tsx` - Card/modal base

### Files to Modify

- `src/theme.ts` - Integrate with design tokens
- `src/context/ThemeContext.tsx` - Full theme switching
- All page components - Migrate to new layout

---

## Priority Order

1. **Backend API** - Security concern, blocks public deployment
2. **Unified Drum Creator** - Core UX improvement
3. **Unified UI** - Consistency, polish
4. **Advanced Synthesis** - Power user features

## Dependencies

```
Backend API ──────────────────────────────────────▶ Public Deploy
                                                        │
Unified Drum Creator ────────────────────────────────────┤
                                                        │
Unified UI ─────────────────────────────────────────────┤
                                                        ▼
Advanced Synthesis ──────────────────────────────▶ Power Users
```

---

**Last Updated**: December 2025  
**Status**: Planning
