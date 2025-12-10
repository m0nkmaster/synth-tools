# Navigation and Sample Analyzer

## Overview
Add horizontal navigation to support multiple tools within OP Done, starting with the existing drum kit creator and a new sample analyzer for visualizing OP-Z annotated files.

## Features

### 1. Horizontal Navigation
- **Location**: Header bar, centered or left-aligned after logo
- **Pages**:
  - "Drum Kit Creator" (existing functionality)
  - "Sample Analyzer" (new)
- **Behavior**: Client-side routing, no page reload
- **Styling**: Minimal, matches TE aesthetic

### 2. Sample Analyzer Page
- **Purpose**: Load and visualize OP-Z drum pack files
- **Input**: File upload accepting `.aif` files
- **Display**:
  - Full waveform visualization
  - Slice markers overlaid on waveform (24 positions)
  - Metadata display (name, octave, version, per-slice settings)
  - Per-slice details: start/end frames, volume, pitch, reverse, playmode

### 3. Technical Requirements
- **Router**: React Router DOM for client-side navigation
- **AIFF Parser**: Reuse existing `parseAiff` function
- **Metadata Extraction**: Parse APPL chunk, decode OP-Z JSON
- **Waveform**: Canvas-based rendering showing full audio with slice boundaries
- **Responsive**: Works on mobile and desktop

## Implementation Notes
- Keep navigation minimal (text links or tabs)
- Analyzer is read-only (no editing in v1)
- Reuse existing components where possible (TEBackground, TELogo)
- Parse `op-1` prefix in APPL chunk to extract JSON metadata
- Decode positions array (scaled by 4096) to frame numbers
