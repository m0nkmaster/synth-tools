# LLM Sound Creation Page

## Overview
- New React Router page at `/create-sound` for generating short WAV clips (≤6s) from natural-language prompts.
- Uses the embedded neural generator in `src/audio/llmSound.ts` (tiny RNN weights run on-device) to translate prompts into harmonic gestures, then renders WAV bytes client-side.
- Each render is a fresh neural pass so repeats feel improvised while staying tied to the words you provide.
- Presents waveform preview, designer-style explanation paragraphs, play/pause, and WAV download.

## Usage
1. Navigate via header nav: **Create LLM Sound**.
2. Enter a prompt (e.g., “large snare with water on it”) and set clip length (1–6s) plus LLM creativity.
3. Click **Generate sound** to render; then play or download the WAV.
   - Inventive prompts like “synth stab that makes you think of a squirrel” or “glassy chords that feel like neon fog” will influence the harmonic tilt and highlights.

## Tests
Run required checks before committing:
```
bun run lint
bun test
```
