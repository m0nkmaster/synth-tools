# AI Provider Support

## Overview

Sound Creation supports both OpenAI and Google Gemini APIs with runtime provider selection.

## Configuration

Add API keys to `.env`:

```bash
VITE_OPENAI_KEY=sk-...
VITE_GEMINI_KEY=...
```

## Usage

Toggle between providers in the UI. Both use the same synthesis prompt and JSON schema.

## Implementation

- `src/services/ai.ts`: Unified service with provider abstraction
- OpenAI: Uses `gpt-5.1` with Responses API
- Gemini: Uses `gemini-2.0-flash-exp` with thinking disabled for speed

## Models

- **OpenAI**: `gpt-5.1` (JSON mode)
- **Gemini**: `gemini-3-pro-preview` (JSON MIME type)
