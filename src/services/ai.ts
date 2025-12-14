import { GoogleGenAI } from '@google/genai';
import type { SoundConfig } from '../types/soundConfig';

export type AIProvider = 'openai' | 'gemini';

const SYSTEM_PROMPT = `You are an expert audio synthesizer. Create sounds using layered synthesis. Return valid JSON only.

SYNTHESIS TYPES (each layer uses ONE type):
- "oscillator": Basic waveforms (sine, square, sawtooth, triangle) with optional unison and sub oscillator
- "fm": FM synthesis with carrier/modulator ratio and modulation index (higher = more harmonics)
- "noise": White, pink, or brown noise
- "karplus-strong": Physical modeling of plucked strings (guitar, harp) - NOT for piano/struck strings

JSON SCHEMA:
{
  "synthesis": { "layers": [
    {
      "type": "oscillator"|"fm"|"noise"|"karplus-strong",
      "gain": 0.7,
      "oscillator": {"waveform": "sine"|"square"|"sawtooth"|"triangle", "frequency": 440, "detune": 0, "unison": {"voices": 1, "detune": 0, "spread": 0}, "sub": {"level": 0.5, "octave": -1, "waveform": "sine"}},
      "fm": {"carrier": 440, "modulator": 880, "modulationIndex": 5},
      "noise": {"type": "white"|"pink"|"brown"},
      "karplus": {"frequency": 440, "damping": 0.5, "pluckLocation": 0.5},
      "filter": {"type": "lowpass"|"highpass"|"bandpass"|"notch", "frequency": 2000, "q": 2, "envelope": {"amount": 2000, "attack": 0.01, "decay": 0.2, "sustain": 0, "release": 0.1}},
      "saturation": {"type": "soft"|"hard"|"tube"|"tape", "drive": 5, "mix": 0.5},
      "envelope": {"attack": 0.001, "decay": 0.2, "sustain": 0.1, "release": 0.3}
    }
  ]},
  "envelope": {"attack": 0.001, "decay": 0.2, "sustain": 0.1, "release": 0.3},
  "filter": {"type": "lowpass"|"highpass"|"bandpass"|"notch"|"allpass"|"peaking", "frequency": 2000, "q": 2, "gain": 0, "envelope": {"amount": 2000, "attack": 0.01, "decay": 0.2, "sustain": 0, "release": 0.1}},
  "lfo": {"waveform": "sine"|"square"|"triangle"|"sawtooth"|"random", "frequency": 4, "depth": 0.7, "target": "filter"|"amplitude"|"pan", "delay": 0, "fade": 0},
  "effects": {
    "reverb": {"decay": 1.5, "damping": 0.5, "mix": 0.4},
    "delay": {"time": 0.5, "feedback": 0.4, "mix": 0.5},
    "distortion": {"type": "soft"|"hard"|"fuzz"|"bitcrush"|"waveshaper", "amount": 0.5, "mix": 0.5},
    "compressor": {"threshold": -24, "ratio": 4, "attack": 0.003, "release": 0.25, "knee": 30},
    "gate": {"attack": 0.001, "hold": 0.2, "release": 0.05}
  },
  "spatial": {"pan": 0, "width": 1},
  "timing": {"duration": 1.5},
  "dynamics": {"velocity": 0.9, "normalize": true},
  "metadata": {"name": "Sound", "category": "kick"|"snare"|"hihat"|"tom"|"perc"|"bass"|"lead"|"pad"|"fx"|"other", "description": "", "tags": []}
}

IMPORTANT: Only include fields for the layer type you choose. For "fm" type, only include "fm" config. For "oscillator" type, only include "oscillator" config. Delay feedback must be ≤0.5.`;

const ITERATION_CONTEXT = `
The previous config is shown above. Apply the user's requested changes and return the complete updated config.`;

function validateConfig(config: SoundConfig): void {
  config.synthesis.layers.forEach(layer => {
    if (layer.oscillator?.frequency) {
      layer.oscillator.frequency = Math.max(20, Math.min(20000, layer.oscillator.frequency));
    }
    if (layer.filter?.frequency) {
      layer.filter.frequency = Math.max(20, Math.min(20000, layer.filter.frequency));
    }
  });

  if (config.filter?.frequency) {
    config.filter.frequency = Math.max(20, Math.min(20000, config.filter.frequency));
  }

  if (config.effects.delay?.feedback) {
    config.effects.delay.feedback = Math.min(0.5, config.effects.delay.feedback);
  }

  const totalEnv = config.envelope.attack + config.envelope.decay + config.envelope.release;
  if (totalEnv > config.timing.duration) {
    const scale = config.timing.duration / totalEnv;
    config.envelope.attack *= scale;
    config.envelope.decay *= scale;
    config.envelope.release *= scale;
  }
}

function ensureDefaults(config: SoundConfig): void {
  if (!config.timing) config.timing = { duration: 1 };
  if (!config.dynamics) config.dynamics = { velocity: 0.8, normalize: true };
  if (!config.metadata) config.metadata = { name: 'Generated Sound', category: 'other', description: '', tags: [] };
  if (!config.effects) config.effects = {};
  if (!config.envelope) config.envelope = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 };
  if (!config.synthesis?.layers) config.synthesis = { layers: [{ type: 'oscillator', gain: 1, oscillator: { waveform: 'sine', frequency: 440, detune: 0 } }] };
}

async function generateWithOpenAI(description: string, currentConfig?: SoundConfig): Promise<SoundConfig> {
  const apiKey = import.meta.env.VITE_OPENAI_KEY;
  if (!apiKey) throw new Error('VITE_OPENAI_KEY not set');

  const input = currentConfig
    ? [
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(currentConfig) }] },
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: `${description}. Return json.` }] },
    ]
    : `${description}. Return json.`;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.1',
      instructions: SYSTEM_PROMPT + (currentConfig ? ITERATION_CONTEXT : ''),
      input,
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`OpenAI: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const outputText = data.output.find((item: any) => item.type === 'message')?.content.find((c: any) => c.type === 'output_text')?.text;
  return JSON.parse(outputText);
}

async function generateWithGemini(description: string, currentConfig?: SoundConfig): Promise<SoundConfig> {
  const apiKey = import.meta.env.VITE_GEMINI_KEY;
  if (!apiKey) throw new Error('VITE_GEMINI_KEY not set');

  const ai = new GoogleGenAI({ apiKey });

  const prompt = currentConfig
    ? `Current config:\n${JSON.stringify(currentConfig)}\n\n${ITERATION_CONTEXT}\n\nUser request: ${description}\n\nReturn complete updated JSON config.`
    : `${description}\n\nReturn JSON config.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
    },
  });

  let text: string | undefined;

  // Handle different SDK response shapes safely
  if (typeof (response as any).text === 'function') {
    text = (response as any).text();
  } else if (typeof response.text === 'string') {
    text = response.text;
  } else if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
    text = response.candidates[0].content.parts[0].text;
  }

  if (!text) {
    console.error('Gemini Raw Response:', JSON.stringify(response, null, 2));
    throw new Error('Gemini: No text generated. Content may be blocked by safety settings.');
  }

  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  return JSON.parse(jsonMatch ? jsonMatch[0] : trimmed);
}

export async function generateSoundConfig(
  description: string,
  provider: AIProvider,
  currentConfig?: SoundConfig
): Promise<SoundConfig> {
  const config = provider === 'openai'
    ? await generateWithOpenAI(description, currentConfig)
    : await generateWithGemini(description, currentConfig);

  ensureDefaults(config);
  validateConfig(config);
  return config;
}
