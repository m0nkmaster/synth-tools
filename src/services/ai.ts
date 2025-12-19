import type { SoundConfig } from '../types/soundConfig';
import { generateSchemaPrompt, generateBatchSchemaPrompt, generateParameterGuide, coerceSoundConfig } from '../types/soundConfig';
import { AI } from '../config';

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

// System prompt for general synthesis (/synthesizer page)
// Note: Parameter descriptions are auto-generated from BOUNDS to prevent documentation drift
const SYSTEM_PROMPT = `You are a sound synthesis expert. Generate JSON configurations for a multi-layer synthesizer.

SYNTHESIZER ARCHITECTURE:
Multi-layer additive/subtractive/FM/physical modeling synthesizer. Supports 1-8 layers per sound.

${generateParameterGuide()}

ACOUSTIC INSTRUMENT GUIDANCE:
- Grand Piano: Use karplus-strong (inharmonicity: 0.35-0.45, damping: 0.15-0.25). CRITICAL: attack: 0.005-0.015s (soft hammer strike, NOT instant pluck). Add noise layer (attack: 0.001, decay: 0.05-0.1) for hammer impact. Decay: 3-5s for rich sustain.
- Harpsichord: Fast attack (0.001s), bright oscillators or karplus-strong (inharmonicity: 0.1-0.2, damping: 0.3-0.4), short decay (1-2s)
- Electric Piano (Rhodes/Wurlitzer): FM layers (ratio: 1, 2, modulationIndex: 0.01-0.03, feedback: 0.05-0.15). Medium attack (0.002-0.005s), decay: 2-3s
- Acoustic Bass: Karplus-strong (frequency: 80-200Hz, damping: 0.3-0.5, low inharmonicity: 0.1-0.2), slow attack (0.01-0.03s)
- Synth Bass: Oscillator (sawtooth/square), sub-oscillator, low-pass filter with envelope (amount: 2000-4000Hz), slow attack (0.02-0.05s) for warmth
- Plucked Strings: Karplus-strong or fast attack (<0.002s), short decay
- Brass: Oscillators (sawtooth) with vibrato LFO (target: pitch, depth: 0.02-0.05, rate: 4-6Hz), filter sweep
- Strings: Oscillators with slow attack (0.2-0.8s), unison (3-5 voices), chorus effect

You DO NOT need to use all effects and features.

TECHNICAL SPECIFICATIONS:
${generateSchemaPrompt()}

Return raw JSON only matching the schema above. No markdown formatting.`;

// System prompt for percussive sound batch generation (/ai-kit-generator page)
// Note: Parameter descriptions are auto-generated from BOUNDS to prevent documentation drift
const BATCH_SYSTEM_PROMPT = `You are a percussive sound synthesis expert. Generate JSON configurations for drum/percussion sounds.

Return format: { "configs": [...] }

${generateParameterGuide()}

TECHNICAL NOTES FOR PERCUSSION:
- Percussive sounds are short, transient-heavy, and typically have zero sustain
- Duration constraints by category: kick (≤1s), snare (≤2s), hihat (≤0.5s), tom (≤1.5s), perc (≤2s), fx (≤2s)
- Attack times are typically very fast (0.001-0.005s) for immediate impact
- Envelope sustain is typically 0 for percussive sounds (they decay naturally)
- Filter envelopes with high Q and fast decay create transient definition
- Delay and reverb are generally avoided in drum kits to prevent timing/bleed issues

SCHEMA for each config:
${generateBatchSchemaPrompt()}

Return raw JSON only matching the schema above. No markdown formatting.`;

// Extract JSON from text that may have extra content before/after
function extractJSON(text: string): Record<string, unknown> {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Find JSON object with proper brace balancing
    const start = text.indexOf('{');
    if (start === -1) throw new Error('No valid JSON found in response');
    
    // Balance braces to find the end of the JSON object
    let depth = 0;
    let inString = false;
    let escape = false;
    
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escape = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (inString) continue;
      
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) {
          return JSON.parse(text.slice(start, i + 1));
        }
      }
    }
    
    throw new Error('No valid JSON found in response');
  }
}

// Parse stringified nested objects (Gemini sometimes returns these as strings)
function parseStringifiedObjects(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
      try {
        obj[key] = JSON.parse(value);
      } catch {
        // Keep as string if parse fails
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      parseStringifiedObjects(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      value.forEach(item => {
        if (item && typeof item === 'object') {
          parseStringifiedObjects(item as Record<string, unknown>);
        }
      });
    }
  }
}

// Process AI response and validate with Zod schema
function processAIResponse(data: Record<string, unknown>): SoundConfig {
  // Handle Gemini's quirk of stringifying nested objects
  parseStringifiedObjects(data);
  
  // Log the raw response for debugging
  console.log('[AI Response Debug] Raw data:', JSON.stringify(data, null, 2));
  
  // Use Zod schema for validation and coercion
  // Schema handles defaults (oscillator.frequency) and clamping (envelope times)
  try {
    return coerceSoundConfig(data);
  } catch (error) {
    console.error('[AI Response Error] Validation failed:', error);
    console.error('[AI Response Error] Input data:', JSON.stringify(data, null, 2));
    throw error;
  }
}

// API base URL - uses Vite proxy in development
const API_BASE = '/api';

interface AIApiResponse {
  text?: string;
  error?: string;
}

async function callAIProxy(
  provider: AIProvider,
  prompt: string,
  systemPrompt: string,
  jsonSchema?: Record<string, unknown>
): Promise<string> {
  const response = await fetch(`${API_BASE}/ai/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      provider,
      action: 'generate',
      prompt,
      systemPrompt,
      jsonSchema,
    }),
  });

  if (!response.ok) {
    const errorData: AIApiResponse = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.statusText}`);
  }

  const data: AIApiResponse = await response.json();
  if (!data.text) {
    throw new Error('No text in API response');
  }
  return data.text;
}

async function generateWithOpenAI(description: string): Promise<SoundConfig> {
  const prompt = `${description}\n\nReturn JSON.`;
  const text = await callAIProxy('openai', prompt, SYSTEM_PROMPT);
  const parsed = extractJSON(text);
  return processAIResponse(parsed);
}

async function generateWithGemini(description: string): Promise<SoundConfig> {
  const text = await callAIProxy('gemini', description, SYSTEM_PROMPT);
  const parsed = extractJSON(text.trim());
  return processAIResponse(parsed);
}

async function generateWithAnthropic(description: string): Promise<SoundConfig> {
  const prompt = `${description}\n\nReturn JSON.`;
  const text = await callAIProxy('anthropic', prompt, SYSTEM_PROMPT);
  const parsed = extractJSON(text.trim());
  return processAIResponse(parsed);
}

export async function generateSoundConfig(
  description: string,
  provider: AIProvider
): Promise<SoundConfig> {
  if (provider === 'openai') {
    return await generateWithOpenAI(description);
  } else if (provider === 'anthropic') {
    return await generateWithAnthropic(description);
  } else {
    return await generateWithGemini(description);
  }
}

// Batch generation types
export interface SoundIdea {
  name: string;
  description: string;
  category: string;
}

async function batchGenerateWithOpenAI(ideas: SoundIdea[]): Promise<SoundConfig[]> {
  const soundsList = ideas.map((idea, i) => 
    `${i + 1}. ${idea.category}: "${idea.name}" - ${idea.description}`
  ).join('\n');

  const prompt = `Generate synthesis configs for these ${ideas.length} drum sounds:\n\n${soundsList}\n\nReturn JSON: { "configs": [...] }`;
  const text = await callAIProxy('openai', prompt, BATCH_SYSTEM_PROMPT);
  
  const parsed = extractJSON(text);
  const configs = (parsed.configs || []) as Record<string, unknown>[];
  return configs
    .filter((c): c is Record<string, unknown> => c !== null && typeof c === 'object')
    .map(c => processAIResponse(c));
}

async function batchGenerateWithGemini(ideas: SoundIdea[]): Promise<SoundConfig[]> {
  const soundsList = ideas.map((idea, i) => 
    `${i + 1}. ${idea.category}: "${idea.name}" - ${idea.description}`
  ).join('\n');

  const prompt = `Generate synthesis configs for these ${ideas.length} drum sounds:\n\n${soundsList}`;
  const text = await callAIProxy('gemini', prompt, BATCH_SYSTEM_PROMPT);

  const parsed = extractJSON(text.trim());
  const configs = (parsed.configs || []) as Record<string, unknown>[];
  return configs
    .filter((c): c is Record<string, unknown> => c !== null && typeof c === 'object')
    .map(c => processAIResponse(c));
}

async function batchGenerateWithAnthropic(ideas: SoundIdea[]): Promise<SoundConfig[]> {
  const soundsList = ideas.map((idea, i) => 
    `${i + 1}. ${idea.category}: "${idea.name}" - ${idea.description}`
  ).join('\n');

  const prompt = `Generate synthesis configs for these ${ideas.length} drum sounds:\n\n${soundsList}\n\nReturn JSON: { "configs": [...] }`;
  const text = await callAIProxy('anthropic', prompt, BATCH_SYSTEM_PROMPT);

  const parsed = extractJSON(text.trim());
  const configs = (parsed.configs || []) as Record<string, unknown>[];
  return configs
    .filter((c): c is Record<string, unknown> => c !== null && typeof c === 'object')
    .map(c => processAIResponse(c));
}

// Category-specific max durations - reasonable limits while keeping sounds punchy
const CATEGORY_MAX_DURATIONS: Record<string, number> = {
  kick: 1,
  snare: 2,
  hihat: 0.5,
  tom: 1.5,
  perc: 2.0,
  fx: 2.0,
};

// Enforce punchy parameters for percussion
function enforcePunchyDefaults(config: SoundConfig, category: string): void {
  // Force very fast attack for all percussion
  if (config.envelope.attack > 0.008) {
    config.envelope.attack = 0.003;
  }
  
  // Force zero sustain for all drums (except fx which can have some)
  if (['kick', 'snare', 'hihat', 'tom', 'perc'].includes(category)) {
    config.envelope.sustain = 0;
  }
  
  // Ensure short release to prevent mud
  const maxRelease = category === 'fx' ? 0.2 : 0.1;
  if (config.envelope.release > maxRelease) {
    config.envelope.release = maxRelease;
  }
  
  // Ensure short decay for tight sounds
  const maxDecay: Record<string, number> = {
    kick: 0.15,
    snare: 0.12,
    hihat: 0.08,
    tom: 0.2,
    perc: 0.1,
    fx: 0.3,
  };
  if (config.envelope.decay > (maxDecay[category] || 0.15)) {
    config.envelope.decay = maxDecay[category] || 0.15;
  }
  
  // Fix compressor to preserve transients (slow attack)
  if (config.effects?.compressor) {
    if (config.effects.compressor.attack < 0.03) {
      config.effects.compressor.attack = 0.06;
    }
    if (config.effects.compressor.release > 0.15) {
      config.effects.compressor.release = 0.08;
    }
  }
  
  // Remove reverb/delay for percussion (causes bleed)
  if (config.effects?.reverb) {
    delete (config.effects as Record<string, unknown>).reverb;
  }
  if (config.effects?.delay) {
    delete (config.effects as Record<string, unknown>).delay;
  }
  
  // Ensure layers have sensible envelopes too
  config.synthesis.layers.forEach(layer => {
    if (layer.envelope) {
      if (layer.envelope.attack > 0.01) layer.envelope.attack = 0.003;
      if (layer.envelope.sustain > 0) layer.envelope.sustain = 0;
      if (layer.envelope.release > maxRelease) layer.envelope.release = maxRelease * 0.8;
    }
  });
}

export async function generateBatchSoundConfigs(
  ideas: SoundIdea[],
  provider: AIProvider
): Promise<SoundConfig[]> {
  let configs: SoundConfig[];
  if (provider === 'openai') {
    configs = await batchGenerateWithOpenAI(ideas);
  } else if (provider === 'anthropic') {
    configs = await batchGenerateWithAnthropic(ideas);
  } else {
    configs = await batchGenerateWithGemini(ideas);
  }

  // Apply percussion-specific tweaks
  return configs.map((config, i) => {
    const category = ideas[i].category;
    
    // Sync metadata with ideas
    config.metadata.name = ideas[i].name;
    config.metadata.category = category as SoundConfig['metadata']['category'];
    config.metadata.description = ideas[i].description;
    
    // Category-aware duration clamping
    const maxDur = CATEGORY_MAX_DURATIONS[category] || 0.2;
    config.timing.duration = Math.max(0.05, Math.min(config.timing.duration, maxDur));
    
    // Enforce punchy, clean sound design for percussion
    enforcePunchyDefaults(config, category);
    
    return config;
  });
}

// Chunked parallel generation for faster kit creation
export interface ChunkedGenerationResult {
  configs: (SoundConfig | null)[];
  errors: Array<{ chunkIndex: number; error: string }>;
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function generateBatchSoundConfigsChunked(
  ideas: SoundIdea[],
  provider: AIProvider,
  onChunkComplete?: (completedCount: number, totalChunks: number) => void
): Promise<ChunkedGenerationResult> {
  const chunkSize = AI.BATCH_CHUNK_SIZE;
  const chunks = chunkArray(ideas, chunkSize);
  const totalChunks = chunks.length;
  let completedCount = 0;

  // Fire all chunk requests in parallel
  const results = await Promise.allSettled(
    chunks.map(async (chunk, chunkIndex) => {
      const configs = await generateBatchSoundConfigs(chunk, provider);
      completedCount++;
      onChunkComplete?.(completedCount, totalChunks);
      return { chunkIndex, configs };
    })
  );

  // Reconstruct configs array in original order, handling failures
  const allConfigs: (SoundConfig | null)[] = new Array(ideas.length).fill(null);
  const errors: Array<{ chunkIndex: number; error: string }> = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      const { chunkIndex, configs } = result.value;
      const startIdx = chunkIndex * chunkSize;
      configs.forEach((config, i) => {
        allConfigs[startIdx + i] = config;
      });
    } else {
      // Find which chunk failed by checking which indices are still null
      const failedChunkIndex = results.indexOf(result);
      errors.push({
        chunkIndex: failedChunkIndex,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
    }
  }

  return { configs: allConfigs, errors };
}

// Kit planning schema
const KIT_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    kitName: { type: 'string' },
    sounds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', enum: ['kick', 'snare', 'hihat', 'tom', 'perc', 'fx'] },
        },
        required: ['name', 'description', 'category'],
      },
    },
  },
  required: ['kitName', 'sounds'],
};

// System prompt for kit planning
const KIT_PLANNER_PROMPT = `You are a sound designer specializing in percussive and rhythmic sounds. You create sample packs for producers across all genres.

Design a collection of exactly 24 sounds based on the user's theme. This could be a full drum kit, or a focused collection (all kicks, all cymbals, all textures, etc.) - follow what the user asks for. Each sound must be under 4 seconds. The total of all sounds must be under 12 seconds - plan for ~0.4-0.5s per sound on average.`;

export interface KitPlan {
  kitName: string;
  sounds: SoundIdea[];
}

export async function planDrumKit(
  userPrompt: string,
  provider: AIProvider
): Promise<KitPlan> {
  // OpenAI and Anthropic need explicit JSON instruction, Gemini uses schema
  const prompt = provider === 'gemini'
    ? userPrompt
    : `${userPrompt}\n\nReturn JSON.`;
  
  const text = await callAIProxy(
    provider, 
    prompt, 
    KIT_PLANNER_PROMPT,
    provider === 'gemini' ? KIT_PLAN_JSON_SCHEMA : undefined
  );

  const parsed = extractJSON(text.trim());
  return { 
    kitName: parsed.kitName as string, 
    sounds: (parsed.sounds as SoundIdea[]).slice(0, 24) 
  };
}
