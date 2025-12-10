# OpenAI Responses API Migration

## Summary
Migrated from deprecated `/chat/completions` API to new `/responses` API.

## Changes

### API Endpoint
- **Before:** `https://api.openai.com/v1/chat/completions`
- **After:** `https://api.openai.com/v1/responses`

### Request Structure
- **Before:** `messages` array with `role` and `content` strings
- **After:** `input` (string or array) + `instructions` (system prompt)

### Input Format
- Simple case: `input: description` (string)
- Multi-turn: `input: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '...' }] }, ...]`

### Response Parsing
- **Before:** `data.choices[0].message.content`
- **After:** `data.output.find(item => item.type === 'message')?.content.find(c => c.type === 'output_text')?.text`

### JSON Mode
- **Before:** `response_format: { type: 'json_object' }`
- **After:** `text: { format: { type: 'json_object' } }`

## Testing
- ✅ All tests pass (`bun test`)
- ✅ Lint passes (`bun run lint`)

## File Modified
- `src/services/openai.ts`
