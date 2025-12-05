import type { SoundConfig } from '../types/soundConfig';

const SYSTEM_PROMPT = `Expert audio synthesis. Create realistic sounds using LAYERED synthesis.

JSON schema:
{
  "synthesis": { "layers": [{"type": "noise"|"oscillator"|"fm", "gain": 0.7, "noise": {"type": "white"}, "oscillator": {"waveform": "sine", "frequency": 200, "detune": 0}, "fm": {"carrier": 200, "modulator": 400, "modulationIndex": 30}}] },
  "envelope": { "attack": 0.001, "decay": 0.2, "sustain": 0.1, "release": 0.3, "attackCurve": "exponential", "releaseCurve": "exponential" },
  "filter": { "type": "lowpass", "frequency": 2000, "q": 2 },
  "lfo": { "waveform": "sine"|"square"|"triangle"|"sawtooth"|"random", "frequency": 4, "depth": 0.7, "target": "filter"|"amplitude"|"pan", "phase": 0, "delay": 0, "fade": 0 },
  "effects": { "reverb": {"type": "room", "size": 0.7, "decay": 1.5, "damping": 0.5, "mix": 0.4, "predelay": 10} },
  "spatial": { "pan": 0, "width": 1 },
  "timing": { "duration": 1.5 },
  "dynamics": { "velocity": 0.9, "gain": 0, "normalize": true },
  "metadata": { "name": "Sound", "category": "snare", "description": "", "tags": [] }
}`;

const ITERATION_CONTEXT = `
When modifying existing config, apply MINIMAL changes to achieve the request. Return complete config with only necessary modifications.
For LFO requests: "crazy/extreme/super fast" = frequency 15-30 Hz + depth 0.8-1.0, "wobble/wub" = frequency 8-15 Hz + depth 0.7-1.0.`;

export async function generateSoundConfig(
  description: string,
  currentConfig?: SoundConfig
): Promise<SoundConfig> {
  const apiKey = import.meta.env.VITE_OPENAI_KEY;
  if (!apiKey) {
    throw new Error('VITE_OPENAI_KEY environment variable not set');
  }

  const messages = currentConfig
    ? [
        { role: 'system', content: SYSTEM_PROMPT + ITERATION_CONTEXT },
        { role: 'assistant', content: JSON.stringify(currentConfig) },
        { role: 'user', content: description },
      ]
    : [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: description },
      ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.1',
      messages,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || response.statusText;
    throw new Error(`OpenAI API error: ${message}`);
  }

  const data = await response.json();
  const config = JSON.parse(data.choices[0].message.content);
  
  // Ensure required fields
  if (!config.timing) config.timing = { duration: 1 };
  if (!config.spatial) config.spatial = { pan: 0, width: 1 };
  if (!config.dynamics) config.dynamics = { velocity: 0.8, gain: 0, normalize: true };
  if (!config.metadata) config.metadata = { name: 'Generated Sound', category: 'other', description: '', tags: [] };
  if (!config.effects) config.effects = {};
  if (!config.envelope) config.envelope = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3, attackCurve: 'exponential', releaseCurve: 'exponential' };
  if (!config.envelope.attackCurve) config.envelope.attackCurve = 'exponential';
  if (!config.envelope.releaseCurve) config.envelope.releaseCurve = 'exponential';
  if (!config.synthesis?.layers) config.synthesis = { layers: [{ type: 'oscillator', gain: 1, oscillator: { waveform: 'sine', frequency: 440, detune: 0 } }] };
  
  return config;
}
