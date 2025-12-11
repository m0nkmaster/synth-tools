import { Stack } from '@mui/material';
import { SegmentedButton } from './SegmentedButton';
import type { SoundConfig } from '../types/soundConfig';

type NoiseLayer = Extract<SoundConfig['synthesis']['layers'][0], { type: 'noise' }>;

export interface NoiseControlsProps {
  layer: NoiseLayer;
  onChange: (layer: NoiseLayer) => void;
}

export function NoiseControls({ layer, onChange }: NoiseControlsProps) {
  const noise = layer.noise!;

  const updateNoise = (updates: Partial<typeof noise>) => {
    onChange({
      ...layer,
      noise: { ...noise, ...updates },
    });
  };

  return (
    <Stack spacing={2}>
      <SegmentedButton
        label="Noise Type"
        value={noise.type}
        options={[
          { value: 'white', label: 'White' },
          { value: 'pink', label: 'Pink' },
          { value: 'brown', label: 'Brown' },
        ]}
        onChange={(type) => updateNoise({ type })}
      />
    </Stack>
  );
}
