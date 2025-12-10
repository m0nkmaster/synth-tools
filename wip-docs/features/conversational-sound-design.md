# Conversational Sound Design

## Overview

Iterative sound refinement through conversation. Users can tweak generated sounds by describing changes instead of starting over.

## User Flow

1. Generate initial sound: "Deep 808 kick"
2. Review config + preview
3. Request tweak: "Make it punchier with more attack"
4. LLM receives current config + tweak request
5. Returns modified config
6. Preview changes, iterate further

## Implementation

### UI Changes

**Add to Sound Creation interface:**
- History panel showing conversation
- "Tweak this sound" input field (appears after generation)
- Previous/current config diff viewer (optional)

### API Changes

**Modify OpenAI call to include context:**

```typescript
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  config?: SoundConfig; // Attach config to assistant messages
}

// System prompt addition:
const ITERATION_CONTEXT = `
When user requests tweaks, you'll receive:
1. Current sound config (JSON)
2. User's modification request

Analyze the config and apply MINIMAL changes to achieve the request.
Return complete config with only necessary modifications.
`;
```

### Prompt Strategy

**Initial generation:**
```
User: "Deep 808 kick"
→ Full config generation
```

**Iteration:**
```
System: Current config: {layers: [...], envelope: {...}}
User: "Make it punchier with more attack"
→ Modified config (only attack/envelope changed)
```

## Technical Details

### State Management

```typescript
interface SoundCreationState {
  conversation: ConversationMessage[];
  currentConfig: SoundConfig | null;
  isIterating: boolean;
}
```

### API Call

```typescript
async function generateOrIterateSound(
  prompt: string,
  currentConfig?: SoundConfig
): Promise<SoundConfig> {
  const messages = currentConfig
    ? [
        { role: 'system', content: SYSTEM_PROMPT + ITERATION_CONTEXT },
        { role: 'assistant', content: JSON.stringify(currentConfig) },
        { role: 'user', content: prompt }
      ]
    : [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ];
  
  // Call OpenAI, parse response
}
```

## Benefits

- **Faster workflow**: No re-describing entire sound
- **Precision**: Target specific parameters
- **Learning**: See what changes affect sound
- **Natural**: Speak in audio terms ("brighter", "tighter", "fatter")

## Examples

```
Initial: "Analog bass"
→ Config generated

Tweak 1: "Add more filter resonance"
→ filter.resonance: 5 → 12

Tweak 2: "Make the envelope snappier"
→ envelope.attack: 0.01 → 0.001, decay: 0.3 → 0.15

Tweak 3: "Add slight detuning"
→ layers[0].unison.voices: 1 → 3, detune: 0 → 0.05
```

## Future Enhancements

- **Undo/redo**: Step through conversation history
- **Branch conversations**: Try multiple variations from same point
- **Compare mode**: A/B test current vs previous
- **Save conversations**: Export entire design session

## Constraints

- Keep conversation in memory (no persistence initially)
- Max 10 iterations before suggesting fresh start
- Clear conversation button to reset
