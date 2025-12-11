import { GoogleGenAI } from '@google/genai';
import type { SoundConfig } from '../types/soundConfig';

export type AIProvider = 'openai' | 'gemini';

const SYSTEM_PROMPT = `Expert audio synthesis. Create any sound (drums, bass, leads, pads, FX, etc.) using LAYERED synthesis. Return valid JSON.

JSON schema:
{
  "synthesis": { "layers": [{"type": "noise"|"oscillator"|"fm", "gain": 0.7, "noise": {"type": "white"}, "oscillator": {"waveform": "sine", "frequency": 200, "detune": 0}, "fm": {"carrier": 200, "modulator": 400, "modulationIndex": 30}}] },
  "envelope": { "attack": 0.001, "decay": 0.2, "sustain": 0.1, "release": 0.3, "attackCurve": "exponential", "releaseCurve": "exponential" },
  "filter": { "type": "lowpass", "frequency": 2000, "q": 2 },
  "lfo": { "waveform": "sine"|"square"|"triangle"|"sawtooth"|"random", "frequency": 4, "depth": 0.7, "target": "filter"|"amplitude"|"pan", "phase": 0, "delay": 0, "fade": 0 },
  "effects": { "reverb": {"type": "room", "size": 0.7, "decay": 1.5, "damping": 0.5, "mix": 0.4, "predelay": 10}, "delay": {"time": 0.5, "feedback": 0.6, "mix": 0.5, "sync": false, "pingPong": false} },
  "spatial": { "pan": 0, "width": 1 },
  "timing": { "duration": 1.5 },
  "dynamics": { "velocity": 0.9, "gain": 0, "normalize": true },
  "metadata": { "name": "Sound", "category": "snare", "description": "", "tags": [] }
}

SOUND DESIGN RULES:
DRUMS:
- Kicks: 40-80Hz sine + sub octave, attack <2ms, decay 50-100ms, no sustain
- Snares: 180-250Hz tone + white noise (bandpass 2-4kHz), decay 150-250ms
- Hats: white/pink noise highpass >8kHz, very short decay <100ms
- Toms: 80-200Hz sine, medium decay 200-400ms

BASS:
- Sub: 40-80Hz sine/triangle, long sustain
- Mid: 80-250Hz saw/square, add filter envelope

LEADS/PADS:
- Leads: saw/square 200-2000Hz, unison 3-5 voices, filter sweep
- Pads: multiple detuned saws, slow attack >100ms, reverb

EFFECTS:
- Huge/massive/long delay: time 0.5-1.0s, feedback 0.4-0.5, mix 0.5-0.7
- Short/slapback delay: time 0.08-0.15s, feedback 0.2-0.3, mix 0.3-0.5
- CRITICAL: feedback MUST be ≤0.5 to prevent infinite echo

EXAMPLES:
Kick: {"synthesis":{"layers":[{"type":"oscillator","gain":0.8,"oscillator":{"waveform":"sine","frequency":60,"detune":0}},{"type":"oscillator","gain":0.3,"oscillator":{"waveform":"sine","frequency":30,"detune":0}}]},"envelope":{"attack":0.001,"decay":0.05,"sustain":0,"release":0.1,"attackCurve":"exponential","releaseCurve":"exponential"}}

Snare: {"synthesis":{"layers":[{"type":"noise","gain":0.6,"noise":{"type":"white"},"filter":{"type":"bandpass","frequency":3000,"q":2}},{"type":"oscillator","gain":0.5,"oscillator":{"waveform":"sine","frequency":180,"detune":0}}]},"envelope":{"attack":0.001,"decay":0.15,"sustain":0,"release":0.2,"attackCurve":"exponential","releaseCurve":"exponential"}}`;

const ITERATION_CONTEXT = `
When modifying existing config, apply MINIMAL changes to achieve the request. Return complete config with only necessary modifications.
For LFO requests: "crazy/extreme/super fast" = frequency 15-30 Hz + depth 0.8-1.0, "wobble/wub" = frequency 8-15 Hz + depth 0.7-1.0.
For delay requests: "huge/massive/long" = time 0.5-1.0s + feedback 0.4-0.5 + mix 0.5-0.7, "short/slapback" = time 0.08-0.15s + feedback 0.2-0.3. CRITICAL: feedback MUST be ≤0.5.`;

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
  if (!config.spatial) config.spatial = { pan: 0, width: 1 };
  if (!config.dynamics) config.dynamics = { velocity: 0.8, gain: 0, normalize: true };
  if (!config.metadata) config.metadata = { name: 'Generated Sound', category: 'other', description: '', tags: [] };
  if (!config.effects) config.effects = {};
  if (!config.envelope) config.envelope = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3, attackCurve: 'exponential', releaseCurve: 'exponential' };
  if (!config.envelope.attackCurve) config.envelope.attackCurve = 'exponential';
  if (!config.envelope.releaseCurve) config.envelope.releaseCurve = 'exponential';
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
