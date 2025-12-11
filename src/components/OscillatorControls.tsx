import { Box, Stack } from '@mui/material';
import { Knob } from './Knob';
import { Switch } from './Switch';
import { SegmentedButton } from './SegmentedButton';
import type { SoundConfig } from '../types/soundConfig';

type Layer = SoundConfig['synthesis']['layers'][0];
type OscillatorConfig = NonNullable<Layer['oscillator']>;

export interface OscillatorControlsProps {
  layer: Layer & { type: 'oscillator'; oscillator: OscillatorConfig };
  onChange: (layer: Layer & { type: 'oscillator'; oscillator: OscillatorConfig }) => void;
}

export function OscillatorControls({ layer, onChange }: OscillatorControlsProps) {
  const osc = layer.oscillator;

  const updateOscillator = (updates: Partial<OscillatorConfig>) => {
    onChange({
      ...layer,
      oscillator: { ...osc, ...updates },
    });
  };

  const updateUnison = (updates: Partial<NonNullable<OscillatorConfig['unison']>>) => {
    onChange({
      ...layer,
      oscillator: {
        ...osc,
        unison: { ...osc.unison, ...updates } as NonNullable<OscillatorConfig['unison']>,
      },
    });
  };

  const updateSub = (updates: Partial<NonNullable<OscillatorConfig['sub']>>) => {
    onChange({
      ...layer,
      oscillator: {
        ...osc,
        sub: { ...osc.sub, ...updates } as NonNullable<OscillatorConfig['sub']>,
      },
    });
  };

  const toggleUnison = (enabled: boolean) => {
    if (enabled) {
      updateOscillator({
        unison: { voices: 2, detune: 10, spread: 0.5 },
      });
    } else {
      updateOscillator({ unison: undefined });
    }
  };

  const toggleSub = (enabled: boolean) => {
    if (enabled) {
      updateOscillator({
        sub: { level: 0.5, octave: -1, waveform: 'sine' },
      });
    } else {
      updateOscillator({ sub: undefined });
    }
  };

  return (
    <Stack spacing={2}>
      {/* Waveform selector */}
      <SegmentedButton
        label="Waveform"
        value={osc.waveform}
        options={[
          { value: 'sine', label: 'Sine' },
          { value: 'square', label: 'Square' },
          { value: 'sawtooth', label: 'Saw' },
          { value: 'triangle', label: 'Tri' },
        ]}
        onChange={(waveform) => updateOscillator({ waveform })}
      />

      {/* Basic controls */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Knob
          label="Frequency"
          value={osc.frequency}
          min={20}
          max={20000}
          step={1}
          unit=" Hz"
          logarithmic
          onChange={(frequency) => updateOscillator({ frequency })}
        />
        <Knob
          label="Detune"
          value={osc.detune}
          min={-100}
          max={100}
          step={1}
          unit=" ¢"
          onChange={(detune) => updateOscillator({ detune })}
        />
      </Box>

      {/* Unison controls */}
      <Box>
        <Switch
          label="Unison"
          value={!!osc.unison}
          onChange={toggleUnison}
        />
        {osc.unison && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <Knob
              label="Voices"
              value={osc.unison.voices}
              min={1}
              max={8}
              step={1}
              onChange={(voices) => updateUnison({ voices: Math.round(voices) })}
            />
            <Knob
              label="Detune"
              value={osc.unison.detune}
              min={0}
              max={100}
              step={1}
              unit=" ¢"
              onChange={(detune) => updateUnison({ detune })}
            />
            <Knob
              label="Spread"
              value={osc.unison.spread}
              min={0}
              max={1}
              step={0.01}
              onChange={(spread) => updateUnison({ spread })}
            />
          </Box>
        )}
      </Box>

      {/* Sub-oscillator controls */}
      <Box>
        <Switch
          label="Sub Osc"
          value={!!osc.sub}
          onChange={toggleSub}
        />
        {osc.sub && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Knob
                label="Level"
                value={osc.sub.level}
                min={0}
                max={1}
                step={0.01}
                onChange={(level) => updateSub({ level })}
              />
              <SegmentedButton
                label="Octave"
                value={osc.sub.octave}
                options={[
                  { value: -1, label: '-1' },
                  { value: -2, label: '-2' },
                ]}
                onChange={(octave) => updateSub({ octave })}
              />
            </Box>
            <SegmentedButton
              label="Waveform"
              value={osc.sub.waveform || 'sine'}
              options={[
                { value: 'sine', label: 'Sine' },
                { value: 'square', label: 'Square' },
                { value: 'triangle', label: 'Tri' },
              ]}
              onChange={(waveform) => updateSub({ waveform })}
            />
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
