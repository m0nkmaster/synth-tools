# AI API Request Changes

This document compares the AI request structure before and after the API proxy refactor.

## Summary

The **prompt content sent to the AI is identical**. The only change is **where** the request is made from:

| Aspect | Before | After |
|--------|--------|-------|
| API calls from | Browser (frontend) | Server (backend proxy) |
| API keys stored in | `VITE_OPENAI_KEY`, `VITE_GEMINI_KEY` (exposed) | `OPENAI_API_KEY`, `GEMINI_API_KEY` (server-side) |
| Models | `gpt-5.2-pro`, `gemini-3-pro-preview` | `gpt-5.2-pro`, `gemini-3-pro-preview` ✓ |
| System prompt | `SYSTEM_PROMPT` from `soundConfig.ts` | Same ✓ |
| User prompt | User description + "\n\nReturn JSON." | Same ✓ |

---

## OpenAI Request Structure

### Before (Direct from Browser)

```typescript
// src/services/ai.ts (old)
const input = `${description}\n\nReturn JSON.`;

const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_KEY}`,  // ❌ Exposed in browser
  },
  body: JSON.stringify({
    model: 'gpt-5.2-pro',
    instructions: SYSTEM_PROMPT,
    input,
    text: { format: { type: 'json_object' } },
  }),
});
```

### After (Via Server Proxy)

```typescript
// src/services/ai.ts (new) - Frontend
const prompt = `${description}\n\nReturn JSON.`;
const text = await callAIProxy('openai', prompt, SYSTEM_PROMPT);

// server/ai-handler.ts - Backend
const response = await fetch('https://api.openai.com/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,  // ✓ Server-side only
  },
  body: JSON.stringify({
    model: 'gpt-5.2-pro',
    instructions: systemPrompt,  // Same SYSTEM_PROMPT
    input: prompt,               // Same user prompt
    text: { format: { type: 'json_object' } },
  }),
});
```

---

## Gemini Request Structure

### Before (Direct from Browser)

```typescript
// src/services/ai.ts (old)
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_KEY });  // ❌ Exposed

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: description,
  config: {
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: 'application/json',
  },
});
```

### After (Via Server Proxy)

```typescript
// src/services/ai.ts (new) - Frontend
const text = await callAIProxy('gemini', description, SYSTEM_PROMPT);

// server/ai-handler.ts - Backend
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });  // ✓ Server-side only

const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: prompt,              // Same user description
  config: {
    systemInstruction: systemPrompt,  // Same SYSTEM_PROMPT
    responseMimeType: 'application/json',
  },
});
```

---

## System Prompt (Unchanged)

The `SYSTEM_PROMPT` is generated from `generateSchemaPrompt()` in `soundConfig.ts` and contains the full Zod-derived schema. This is **identical** before and after:

```typescript
const SYSTEM_PROMPT = `You are a synthesizer programmer. Return a JSON synthesis config.

COMPLETE SCHEMA:
${generateSchemaPrompt()}

RULES:
- Include layer-specific object (oscillator/fm/noise/karplus) matching the layer type
- All fields except synthesis, envelope, timing, dynamics, metadata are optional
- Return raw JSON only, no markdown`;
```

---

## Response Processing Changes

The response processing was **simplified** by removing buggy manual field manipulation:

### Before

```typescript
const config = await generateWithOpenAI(description);
ensureDefaults(config);   // ❌ ~270 lines of buggy manual field manipulation
validateConfig(config);   // ❌ Manual clamping
return config;
```

**Problems with `ensureDefaults`:**
- Deleted `config.filter.envelope` (removed filter envelopes)
- Only allowed `['reverb', 'delay', 'distortion', 'compressor']` effects (removed gate, chorus, eq)
- Stripped `spatial` property (pan/width)

### After

```typescript
const parsed = extractJSON(text);
return processAIResponse(parsed);  // Uses Zod schema

function processAIResponse(data: Record<string, unknown>): SoundConfig {
  parseStringifiedObjects(data);  // Handle Gemini quirk
  return coerceSoundConfig(data); // ✓ Zod-based validation
}
```

**`coerceSoundConfig`** uses the Zod schema from `soundConfig.ts` as the single source of truth for validation and defaults.

---

## Data Flow Comparison

### Before
```
User Input → Frontend → OpenAI/Gemini API (keys exposed) → ensureDefaults (buggy) → Config
```

### After
```
User Input → Frontend → /api/ai/generate → Server → OpenAI/Gemini API → coerceSoundConfig (Zod) → Config
```

