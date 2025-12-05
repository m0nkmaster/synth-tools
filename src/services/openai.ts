import type { SoundConfig } from '../types/soundConfig';

const SYSTEM_PROMPT = `Expert audio synthesis. Create realistic sounds using LAYERED synthesis.

RECIPES:
- 80s snare: [noise white gain:0.7] + [sine 200Hz gain:0.5] + bandpass 2kHz Q:3 + reverb decay:1.8s mix:0.5
- Kick: [sine 55Hz gain:1] + lowpass 120Hz + attack:0.001 decay:0.2 sustain:0
- Hi-hat: [noise white gain:0.6] + [sine 8kHz gain:0.3] + [sine 10.5kHz gain:0.2] + bandpass 9kHz Q:4 + attack:0.001 decay:0.08
- Crash cymbal: [noise white gain:0.5] + [sine 3.2kHz gain:0.3] + [sine 5.8kHz gain:0.25] + [sine 8.1kHz gain:0.2] + bandpass 6kHz Q:2 + reverb decay:3s mix:0.6 + attack:0.005 decay:1.2 sustain:0.3 release:2
- Ride cymbal: [noise pink gain:0.4] + [sine 2.5kHz gain:0.4] + [sine 4.8kHz gain:0.3] + bandpass 3.5kHz Q:3 + reverb decay:2s mix:0.4 + attack:0.002 decay:0.8 sustain:0.4 release:1.5
- Bass: [fm carrier:80 mod:160 index:30 gain:1] + lowpass 400Hz + distortion:0.4

JSON schema:
{
  "synthesis": { "layers": [{"type": "noise"|"oscillator"|"fm", "gain": 0.7, "noise": {"type": "white"}, "oscillator": {"waveform": "sine", "frequency": 200, "detune": 0}, "fm": {"carrier": 200, "modulator": 400, "modulationIndex": 30}}] },
  "envelope": { "attack": 0.001, "decay": 0.2, "sustain": 0.1, "release": 0.3, "attackCurve": "exponential", "releaseCurve": "exponential" },
  "filter": { "type": "lowpass", "frequency": 2000, "q": 2 },
  "effects": { "reverb": {"type": "room", "size": 0.7, "decay": 1.5, "damping": 0.5, "mix": 0.4, "predelay": 10} },
  "spatial": { "pan": 0, "width": 1 },
  "timing": { "duration": 1.5 },
  "dynamics": { "velocity": 0.9, "gain": 0, "normalize": true },
  "metadata": { "name": "Sound", "category": "snare", "description": "", "tags": [] }
}`;

export async function generateSoundConfig(
  description: string
): Promise<SoundConfig> {
  const apiKey = import.meta.env.VITE_OPENAI_KEY;
  if (!apiKey) {
    throw new Error('VITE_OPENAI_KEY environment variable not set');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5.1',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: description },
      ],
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
