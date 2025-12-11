import { Box, Divider, Stack } from '@mui/material';
import { Knob } from './Knob';
import { Switch } from './Switch';
import { SegmentedButton } from './SegmentedButton';
import { OscillatorControls } from './OscillatorControls';
import { NoiseControls } from './NoiseControls';
import { FMControls } from './FMControls';
import { KarplusStrongControls } from './KarplusStrongControls';
import type { SoundConfig } from '../types/soundConfig';

export interface LayerControlsProps {
  layer: SoundConfig['synthesis']['layers'][0];
  onChange: (layer: SoundConfig['synthesis']['layers'][0]) => void;
}

export function LayerControls({ layer, onChange }: LayerControlsProps) {
  // Update layer gain
  const updateGain = (gain: number) => {
    onChange({ ...layer, gain });
  };

  // Update layer envelope
  const updateEnvelope = (envelope: NonNullable<typeof layer.envelope>) => {
    onChange({ ...layer, envelope });
  };

  const toggleEnvelope = (enabled: boolean) => {
    if (enabled) {
      onChange({
        ...layer,
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 },
      });
    } else {
      onChange({ ...layer, envelope: undefined });
    }
  };

  // Update layer filter
  const updateFilter = (filter: NonNullable<typeof layer.filter>) => {
    onChange({ ...layer, filter });
  };

  const toggleFilter = (enabled: boolean) => {
    if (enabled) {
      onChange({
        ...layer,
        filter: { type: 'lowpass', frequency: 1000, q: 1 },
      });
    } else {
      onChange({ ...layer, filter: undefined });
    }
  };

  const toggleFilterEnvelope = (enabled: boolean) => {
    if (!layer.filter) return;
    
    if (enabled) {
      updateFilter({
        ...layer.filter,
        envelope: { amount: 1000, attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 },
      });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { envelope, ...rest } = layer.filter;
      updateFilter(rest as NonNullable<typeof layer.filter>);
    }
  };

  // Update saturation
  const updateSaturation = (saturation: NonNullable<typeof layer.saturation>) => {
    onChange({ ...layer, saturation });
  };

  const toggleSaturation = (enabled: boolean) => {
    if (enabled) {
      onChange({
        ...layer,
        saturation: { type: 'soft', drive: 2, mix: 0.5 },
      });
    } else {
      onChange({ ...layer, saturation: undefined });
    }
  };

  return (
    <Stack spacing={2}>
      {/* Layer gain */}
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Knob
          label="Gain"
          value={layer.gain}
          min={0}
          max={1}
          step={0.01}
          onChange={updateGain}
        />
      </Box>

      <Divider />

      {/* Type-specific controls */}
      {layer.type === 'oscillator' && (
        <OscillatorControls
          layer={layer}
          onChange={onChange as (layer: typeof layer) => void}
        />
      )}
      {layer.type === 'noise' && (
        <NoiseControls
          layer={layer}
          onChange={onChange as (layer: typeof layer) => void}
        />
      )}
      {layer.type === 'fm' && (
        <FMControls
          layer={layer}
          onChange={onChange as (layer: typeof layer) => void}
        />
      )}
      {layer.type === 'karplus-strong' && (
        <KarplusStrongControls
          layer={layer}
          onChange={onChange as (layer: typeof layer) => void}
        />
      )}

      <Divider />

      {/* Layer envelope */}
      <Box>
        <Switch
          label="Layer Envelope"
          value={!!layer.envelope}
          onChange={toggleEnvelope}
        />
        {layer.envelope && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
            <Knob
              label="Attack"
              value={layer.envelope.attack}
              min={0.001}
              max={5}
              step={0.001}
              unit=" s"
              onChange={(attack) => updateEnvelope({ ...layer.envelope!, attack })}
            />
            <Knob
              label="Decay"
              value={layer.envelope.decay}
              min={0.001}
              max={5}
              step={0.001}
              unit=" s"
              onChange={(decay) => updateEnvelope({ ...layer.envelope!, decay })}
            />
            <Knob
              label="Sustain"
              value={layer.envelope.sustain}
              min={0}
              max={1}
              step={0.01}
              onChange={(sustain) => updateEnvelope({ ...layer.envelope!, sustain })}
            />
            <Knob
              label="Release"
              value={layer.envelope.release}
              min={0.001}
              max={10}
              step={0.001}
              unit=" s"
              onChange={(release) => updateEnvelope({ ...layer.envelope!, release })}
            />
          </Box>
        )}
      </Box>

      <Divider />

      {/* Layer filter */}
      <Box>
        <Switch
          label="Layer Filter"
          value={!!layer.filter}
          onChange={toggleFilter}
        />
        {layer.filter && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <SegmentedButton
              label="Filter Type"
              value={layer.filter.type}
              options={[
                { value: 'lowpass', label: 'LP' },
                { value: 'highpass', label: 'HP' },
                { value: 'bandpass', label: 'BP' },
                { value: 'notch', label: 'Notch' },
              ]}
              onChange={(type) => updateFilter({ ...layer.filter!, type })}
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Knob
                label="Cutoff"
                value={layer.filter.frequency}
                min={20}
                max={20000}
                step={1}
                unit=" Hz"
                logarithmic
                onChange={(frequency) => updateFilter({ ...layer.filter!, frequency })}
              />
              <Knob
                label="Resonance"
                value={layer.filter.q}
                min={0.0001}
                max={100}
                step={0.01}
                onChange={(q) => updateFilter({ ...layer.filter!, q })}
              />
            </Box>
            
            {/* Filter envelope */}
            <Box>
              <Switch
                label="Filter Env"
                value={!!layer.filter.envelope}
                onChange={toggleFilterEnvelope}
              />
              {layer.filter.envelope && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                  <Knob
                    label="Amount"
                    value={layer.filter.envelope.amount}
                    min={-10000}
                    max={10000}
                    step={10}
                    unit=" Hz"
                    onChange={(amount) => updateFilter({
                      ...layer.filter!,
                      envelope: { ...layer.filter!.envelope!, amount },
                    })}
                  />
                  <Knob
                    label="Attack"
                    value={layer.filter.envelope.attack}
                    min={0.001}
                    max={5}
                    step={0.001}
                    unit=" s"
                    onChange={(attack) => updateFilter({
                      ...layer.filter!,
                      envelope: { ...layer.filter!.envelope!, attack },
                    })}
                  />
                  <Knob
                    label="Decay"
                    value={layer.filter.envelope.decay}
                    min={0.001}
                    max={5}
                    step={0.001}
                    unit=" s"
                    onChange={(decay) => updateFilter({
                      ...layer.filter!,
                      envelope: { ...layer.filter!.envelope!, decay },
                    })}
                  />
                  <Knob
                    label="Sustain"
                    value={layer.filter.envelope.sustain}
                    min={0}
                    max={1}
                    step={0.01}
                    onChange={(sustain) => updateFilter({
                      ...layer.filter!,
                      envelope: { ...layer.filter!.envelope!, sustain },
                    })}
                  />
                  <Knob
                    label="Release"
                    value={layer.filter.envelope.release}
                    min={0.001}
                    max={10}
                    step={0.001}
                    unit=" s"
                    onChange={(release) => updateFilter({
                      ...layer.filter!,
                      envelope: { ...layer.filter!.envelope!, release },
                    })}
                  />
                </Box>
              )}
            </Box>
          </Stack>
        )}
      </Box>

      <Divider />

      {/* Saturation */}
      <Box>
        <Switch
          label="Saturation"
          value={!!layer.saturation}
          onChange={toggleSaturation}
        />
        {layer.saturation && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <SegmentedButton
              label="Type"
              value={layer.saturation.type}
              options={[
                { value: 'soft', label: 'Soft' },
                { value: 'hard', label: 'Hard' },
                { value: 'tube', label: 'Tube' },
                { value: 'tape', label: 'Tape' },
              ]}
              onChange={(type) => updateSaturation({ ...layer.saturation!, type })}
            />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Knob
                label="Drive"
                value={layer.saturation.drive}
                min={0}
                max={10}
                step={0.1}
                onChange={(drive) => updateSaturation({ ...layer.saturation!, drive })}
              />
              <Knob
                label="Mix"
                value={layer.saturation.mix}
                min={0}
                max={1}
                step={0.01}
                onChange={(mix) => updateSaturation({ ...layer.saturation!, mix })}
              />
            </Box>
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
