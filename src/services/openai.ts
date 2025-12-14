import type { SoundConfig } from '../types/soundConfig';

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

IMPORTANT: Only include fields for the layer type you choose. Delay feedback must be ≤0.5.`;

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
  
  const totalEnv = config.envelope.attack + config.envelope.decay + config.envelope.release;
  if (totalEnv > config.timing.duration) {
    const scale = config.timing.duration / totalEnv;
    config.envelope.attack *= scale;
    config.envelope.decay *= scale;
    config.envelope.release *= scale;
  }
}

export async function generateSoundConfig(
  description: string,
  currentConfig?: SoundConfig
): Promise<SoundConfig> {
  const apiKey = import.meta.env.VITE_OPENAI_KEY;
  if (!apiKey) {
    throw new Error('VITE_OPENAI_KEY environment variable not set');
  }

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
    const message = errorData.error?.message || response.statusText;
    throw new Error(`OpenAI API error: ${message}`);
  }

  const data = await response.json();
  const outputText = data.output.find((item: any) => item.type === 'message')?.content.find((c: any) => c.type === 'output_text')?.text;
  const config = JSON.parse(outputText);
  
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
  
  validateConfig(config);
  return config;
}
