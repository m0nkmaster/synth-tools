import { Box, Slider, Stack, Typography } from '@mui/material';
import { semitonesToNote } from '../audio/pitch';

export function PitchDial({
  detectedNote,
  detectedFrequency,
  semitones,
  onChange
}: {
  detectedNote: string | null;
  detectedFrequency: number | null;
  semitones: number;
  onChange: (value: number) => void;
}) {
  const currentNote = detectedFrequency ? semitonesToNote(detectedFrequency, semitones) : null;
  
  return (
    <Stack spacing={0.5} sx={{ minWidth: 120 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
        {detectedNote || 'N/A'} → {currentNote || 'N/A'}
      </Typography>
      <Slider
        value={semitones}
        onChange={(_, v) => onChange(v as number)}
        min={-12}
        max={12}
        step={0.1}
        marks={[
          { value: -12, label: '-12' },
          { value: 0, label: '0' },
          { value: 12, label: '+12' }
        ]}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
        sx={{ 
          '& .MuiSlider-markLabel': { fontSize: 8 },
          '& .MuiSlider-valueLabel': { fontSize: 10 }
        }}
      />
    </Stack>
  );
}
