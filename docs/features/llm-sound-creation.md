# LLM Sound Creation Page

## Overview
- New React Router page at `/create-sound` for generating short WAV clips (≤6s) from natural-language prompts.
- Uses `createLlmSound` in `src/audio/llmSound.ts` to translate prompts into deterministic synth parameters and render WAV bytes client-side.
- Presents waveform preview, designer-style explanation paragraphs, play/pause, and WAV download.

## Usage
1. Navigate via header nav: **Create LLM Sound**.
2. Enter a prompt (e.g., “large snare with water on it”) and set clip length (1–6s) plus LLM creativity.
3. Click **Generate sound** to render; then play or download the WAV.

## Tests
Run required checks before committing:
```
bun run lint
bun test
```
