import { useState } from 'react';
import { Box, Button, Container, TextField, Typography, Select, MenuItem, Slider } from '@mui/material';
import { synthesizeSound } from '../audio/synthesizer';
import type { SoundConfig } from '../types/soundConfig';

const PRESETS: Record<string, SoundConfig> = {
  kick: {
    synthesis: { layers: [{ type: 'oscillator', gain: 0.8, oscillator: { waveform: 'sine', frequency: 60, detune: 0 } }] },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.1, attackCurve: 'exponential', releaseCurve: 'exponential' },
    effects: {},
    spatial: { pan: 0, width: 1 },
    timing: { duration: 0.5 },
    dynamics: { velocity: 0.9, gain: 0, normalize: true },
    metadata: { name: 'Kick', category: 'kick', description: '', tags: [] }
  },
  snare: {
    synthesis: {
      layers: [
        { type: 'noise', gain: 0.6, noise: { type: 'white' }, filter: { type: 'bandpass', frequency: 3000, q: 2 } },
        { type: 'oscillator', gain: 0.5, oscillator: { waveform: 'sine', frequency: 180, detune: 0 } }
      ]
    },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.2, attackCurve: 'exponential', releaseCurve: 'exponential' },
    effects: {},
    spatial: { pan: 0, width: 1 },
    timing: { duration: 0.5 },
    dynamics: { velocity: 0.9, gain: 0, normalize: true },
    metadata: { name: 'Snare', category: 'snare', description: '', tags: [] }
  },
  bass: {
    synthesis: { layers: [{ type: 'oscillator', gain: 0.8, oscillator: { waveform: 'sawtooth', frequency: 80, detune: 0 } }] },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3, attackCurve: 'exponential', releaseCurve: 'exponential' },
    filter: { type: 'lowpass', frequency: 800, q: 2 },
    effects: {},
    spatial: { pan: 0, width: 1 },
    timing: { duration: 1 },
    dynamics: { velocity: 0.8, gain: 0, normalize: true },
    metadata: { name: 'Bass', category: 'bass', description: '', tags: [] }
  },
  delayTest: {
    synthesis: { layers: [{ type: 'noise', gain: 0.8, noise: { type: 'white' }, filter: { type: 'bandpass', frequency: 2000, q: 3 } }] },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05, attackCurve: 'exponential', releaseCurve: 'exponential' },
    effects: { delay: { time: 0.5, feedback: 0.7, mix: 0.8, sync: false, pingPong: false } },
    spatial: { pan: 0, width: 1 },
    timing: { duration: 3 },
    dynamics: { velocity: 0.9, gain: 0, normalize: true },
    metadata: { name: 'Delay Test', category: 'fx', description: '', tags: [] }
  },
  grandPiano: {
    synthesis: {
      layers: [
        { type: 'oscillator', gain: 0.7, oscillator: { waveform: 'triangle', frequency: 440, detune: 0 } },
        { type: 'oscillator', gain: 0.4, oscillator: { waveform: 'sawtooth', frequency: 440, detune: 1 } },
        { type: 'noise', gain: 0.1, noise: { type: 'pink' }, filter: { type: 'lowpass', frequency: 800, q: 1 }, envelope: { attack: 0, decay: 0.03, sustain: 0, release: 0.01 } },
        { type: 'fm', gain: 0.15, fm: { carrier: 440, modulator: 440 * 7, modulationIndex: 0.8 }, envelope: { attack: 0, decay: 0.1, sustain: 0, release: 0.1 } }
      ]
    },
    envelope: { attack: 0.005, decay: 2.0, sustain: 0, release: 0.5, attackCurve: 'exponential', releaseCurve: 'exponential' },
    filter: { type: 'lowpass', frequency: 800, q: 0.7, envelope: { amount: 2500, attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.3 } },
    effects: { reverb: { type: 'room', decay: 1.2, mix: 0.1, size: 0.6, damping: 0.5, predelay: 0.01 } },
    spatial: { pan: 0, width: 0.5 },
    timing: { duration: 2.5 },
    dynamics: { velocity: 0.8, gain: 0, normalize: true },
    metadata: { name: 'Grand Piano', category: 'other', description: 'Natural Acoustic Piano', tags: ['piano', 'keys', 'acoustic'] }
  },
  snare80s: {
    synthesis: {
      layers: [
        { type: 'noise', gain: 0.8, noise: { type: 'pink' }, filter: { type: 'lowpass', frequency: 8000, q: 0.5 } },
        { type: 'oscillator', gain: 0.6, oscillator: { waveform: 'sine', frequency: 180, detune: 0 }, envelope: { attack: 0, decay: 0.15, sustain: 0, release: 0.1 } }
      ]
    },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.2, attackCurve: 'exponential', releaseCurve: 'exponential' },
    effects: {
      reverb: { type: 'plate', decay: 3.0, mix: 0.6, size: 1.0, damping: 0.1, predelay: 0.01 },
      compressor: { threshold: -12, ratio: 4, attack: 0.001, release: 0.1, knee: 10 },
      gate: { threshold: -50, attack: 0.001, hold: 0.35, release: 0.02 }
    },
    spatial: { pan: 0, width: 0.9 },
    timing: { duration: 1.5 },
    dynamics: { velocity: 1.0, gain: 3, normalize: true },
    metadata: { name: "80's Snare", category: 'snare', description: 'Gated Reverb Snare (Phil Collins Style)', tags: ['drums', '80s', 'snare', 'gated'] }
  },
  acousticGuitar: {
    synthesis: {
      layers: [
        { type: 'karplus-strong', gain: 0.9, karplus: { frequency: 440, damping: 0.1 } },
        { type: 'noise', gain: 0.1, noise: { type: 'white' }, envelope: { attack: 0, decay: 0.01, sustain: 0, release: 0.01 }, filter: { type: 'highpass', frequency: 5000, q: 1 } }
      ]
    },
    envelope: { attack: 0.0, decay: 1.0, sustain: 0, release: 0.5, attackCurve: 'exponential', releaseCurve: 'exponential' },
    filter: { type: 'lowpass', frequency: 4000, q: 0.5 },
    effects: {
      reverb: { type: 'room', decay: 1.0, mix: 0.15, size: 0.4, damping: 0.5, predelay: 0.01 }
    },
    spatial: { pan: 0, width: 0.6 },
    timing: { duration: 2.0 },
    dynamics: { velocity: 0.85, gain: 0, normalize: true },
    metadata: { name: 'Acoustic Guitar', category: 'other', description: 'Karplus-Strong Physical Modeling', tags: ['guitar', 'plucked', 'physical-modeling'] }
  }
};

export default function SynthTest() {
  const [config, setConfig] = useState<SoundConfig>(PRESETS.kick);
  const [configJson, setConfigJson] = useState(JSON.stringify(PRESETS.kick, null, 2));
  const [playing, setPlaying] = useState(false);
  const [delayTime, setDelayTime] = useState(0.5);
  const [delayFeedback, setDelayFeedback] = useState(0.6);
  const [delayMix, setDelayMix] = useState(0.5);

  const loadPreset = (name: string) => {
    const preset = PRESETS[name];
    setConfig(preset);
    setConfigJson(JSON.stringify(preset, null, 2));
  };

  const updateFromJson = () => {
    try {
      const parsed = JSON.parse(configJson);
      setConfig(parsed);
    } catch {
      alert('Invalid JSON');
    }
  };

  const updateDelay = () => {
    const updated = {
      ...config,
      effects: {
        ...config.effects,
        delay: { time: delayTime, feedback: delayFeedback, mix: delayMix, sync: false, pingPong: false }
      }
    };
    setConfig(updated);
    setConfigJson(JSON.stringify(updated, null, 2));
  };

  const play = async () => {
    setPlaying(true);
    try {
      const buffer = await synthesizeSound(config);
      const ctx = new AudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      source.onended = () => setPlaying(false);
    } catch (err) {
      alert(`Error: ${err}`);
      setPlaying(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>Synthesis Test Harness</Typography>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Select value="" onChange={(e) => loadPreset(e.target.value)} displayEmpty sx={{ minWidth: 150 }}>
          <MenuItem value="" disabled>Load Preset</MenuItem>
          <MenuItem value="kick">Kick</MenuItem>
          <MenuItem value="snare">Snare</MenuItem>
          <MenuItem value="bass">Bass</MenuItem>
          <MenuItem value="delayTest">Delay Test</MenuItem>
          <MenuItem value="grandPiano">Grand Piano</MenuItem>
          <MenuItem value="snare80s">80's Snare</MenuItem>
          <MenuItem value="acousticGuitar">Acoustic Guitar</MenuItem>
        </Select>
        <Button variant="contained" onClick={play} disabled={playing}>
          {playing ? 'Playing...' : 'Play'}
        </Button>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>Delay Controls</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography>Time: {delayTime.toFixed(2)}s</Typography>
            <Slider value={delayTime} onChange={(_, v) => setDelayTime(v as number)} min={0} max={2} step={0.01} />
          </Box>
          <Box>
            <Typography>Feedback: {delayFeedback.toFixed(2)}</Typography>
            <Slider value={delayFeedback} onChange={(_, v) => setDelayFeedback(v as number)} min={0} max={0.9} step={0.01} />
          </Box>
          <Box>
            <Typography>Mix: {delayMix.toFixed(2)}</Typography>
            <Slider value={delayMix} onChange={(_, v) => setDelayMix(v as number)} min={0} max={1} step={0.01} />
          </Box>
          <Button variant="outlined" onClick={updateDelay}>Apply Delay</Button>
        </Box>
      </Box>

      <Box>
        <Typography variant="h6" gutterBottom>Config JSON</Typography>
        <TextField
          multiline
          fullWidth
          rows={20}
          value={configJson}
          onChange={(e) => setConfigJson(e.target.value)}
          sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
        />
        <Button variant="outlined" onClick={updateFromJson} sx={{ mt: 1 }}>
          Update from JSON
        </Button>
      </Box>
    </Container>
  );
}
