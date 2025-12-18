import type { SoundConfig } from '../types/soundConfig';
import { generateSchemaPrompt, generateBatchSchemaPrompt, coerceSoundConfig } from '../types/soundConfig';
import { AI } from '../config';

export type AIProvider = 'openai' | 'gemini' | 'anthropic';

// System prompt for general synthesis (/synthesizer page)
const SYSTEM_PROMPT = `You are a sound synthesis expert. Generate JSON configurations for a multi-layer synthesizer.

SYNTHESIZER ARCHITECTURE:
Multi-layer additive/subtractive/FM/physical modeling synthesizer. Supports 1-8 layers per sound.

LAYER TYPES:
- oscillator: Generates periodic waveforms (sine, square, sawtooth, triangle). Features:
  * unison: Multiple detuned voices (1-8 voices, detune in cents, stereo spread 0-1)
  * sub: Sub-oscillator 1 or 2 octaves below (level 0-1, waveform sine/square/triangle)
  * pitchEnvelope: ADSR envelope modulating pitch in cents (±4800 cents = ±4 octaves)

- noise: Generates white, pink, or brown noise for transients and textures.

- fm: FM synthesis operator. Technical details:
  * ratio: Frequency multiplier relative to base pitch (0.5-16)
  * modulationIndex: FM depth where Hz deviation = (value/100) × carrierFreqHz. Example: value=100 @ 440Hz = 440Hz deviation
  * feedback: Self-modulation amount (0-1). Values >0.3 produce metallic tones, >0.7 harsh/noisy tones
  * modulatesLayer: Optional. When set to another FM layer's index, routes modulation to that layer's frequency input instead of audio output. Layers with modulatesLayer set should have gain=0
  * envelope: Optional ADSR envelope modulating FM depth over time

- karplus-strong: Physical modeling for plucked/struck strings. Technical details:
  * frequency: Base frequency in Hz (20-2000)
  * damping: Decay rate (0=long sustain/ring, 1=short pluck/fast decay)
  * inharmonicity: Stretches higher partials (0=pure harmonics/plucked string, 0.3-0.5=piano-like, 1=bell-like)

PER-LAYER PROCESSING:
- gain: Layer volume (0-1)
- envelope: Optional ADSR envelope for layer amplitude
- filter: Optional filter (lowpass/highpass/bandpass/notch) with frequency, Q (resonance), and optional envelope
- saturation: Optional waveshaping (soft/hard/tube/tape) with drive (0-10) and mix (0-1)

GLOBAL PROCESSING:
- envelope: Master ADSR envelope (always applied)
- filter: Optional global filter (lowpass/highpass/bandpass/notch/allpass/peaking) with frequency, Q, optional gain (for peaking), and optional envelope
- lfo: Optional low-frequency oscillator modulating pitch/filter/amplitude/pan with waveform, frequency, depth, optional delay and fade

EFFECTS CHAIN ORDER (applied in sequence):
EQ → Distortion → Compressor → Chorus → Delay → Reverb → Gate

TECHNICAL SPECIFICATIONS:
${generateSchemaPrompt()}

Return raw JSON only matching the schema above. No markdown formatting.`;

// System prompt for percussive sound batch generation (/ai-kit-generator page)
const BATCH_SYSTEM_PROMPT = `You are a percussive sound synthesis expert. Generate JSON configurations for drum/percussion sounds.

Return format: { "configs": [...] }

SCHEMA for each config:
${generateBatchSchemaPrompt()}

TECHNICAL NOTES FOR PERCUSSION:
- Percussive sounds are short, transient-heavy, and typically have zero sustain
- Duration constraints by category: kick (≤1s), snare (≤2s), hihat (≤0.5s), tom (≤1.5s), perc (≤2s), fx (≤2s)
- Attack times are typically very fast (0.001-0.005s) for immediate impact
- Envelope sustain is typically 0 for percussive sounds (they decay naturally)
- Filter envelopes with high Q and fast decay create transient definition
- Delay and reverb are generally avoided in drum kits to prevent timing/bleed issues

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
  
  // Use Zod schema for validation and coercion
  // Schema handles defaults (oscillator.frequency) and clamping (envelope times)
  return coerceSoundConfig(data);
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
