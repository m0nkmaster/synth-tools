import { Box, Stack } from '@mui/material';
import { Knob } from './Knob';
import type { SoundConfig } from '../types/soundConfig';

type Layer = SoundConfig['synthesis']['layers'][0];
type FMLayer = Extract<Layer, { type: 'fm' }>;

export interface FMControlsProps {
  layer: FMLayer;
  onChange: (layer: FMLayer) => void;
}

export function FMControls({ layer, onChange }: FMControlsProps) {
  const fm = layer.fm!;

  const updateFM = (updates: Partial<typeof fm>) => {
    onChange({
      ...layer,
      fm: { ...fm, ...updates },
    });
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Knob
          label="Carrier"
          value={fm.carrier}
          min={20}
          max={20000}
          step={1}
          unit=" Hz"
          logarithmic
          onChange={(carrier) => updateFM({ carrier })}
        />
        <Knob
          label="Modulator"
          value={fm.modulator}
          min={20}
          max={20000}
          step={1}
          unit=" Hz"
          logarithmic
          onChange={(modulator) => updateFM({ modulator })}
        />
        <Knob
          label="Mod Index"
          value={fm.modulationIndex}
          min={0}
          max={1000}
          step={0.1}
          onChange={(modulationIndex) => updateFM({ modulationIndex })}
        />
      </Box>
    </Stack>
  );
}
