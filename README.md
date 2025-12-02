# OP Done

Web UI (Vite + React + TypeScript + MUI) skeleton for building Teenage Engineering OP-Z drum sample packs.  

## Getting started
Using Bun (preferred):
1. Install dependencies (Node 18+ recommended): `bun install`
2. Run the dev server: `bun dev` (opens on http://localhost:5173)
3. Build for production: `bun run build`
4. Preview the production build: `bun run preview`

Using npm (fallback):
1. `npm install`
2. `npm run dev`
3. `npm run build`
4. `npm run preview`

## Notes
- Processing is intended to run locally in the browser (ffmpeg.wasm). Electron packaging can reuse the same UI.
- See `docs/features/op-done.md` for the feature requirements and roadmap.
