import { Box, Stack, Typography } from '@mui/material';

export interface SwitchProps {
  value: boolean;
  label: string;
  onChange: (value: boolean) => void;
}

export function Switch({ value, label, onChange }: SwitchProps) {
  return (
    <Stack spacing={0.5} alignItems="center" sx={{ minWidth: 60 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Box
        onClick={() => onChange(!value)}
        sx={{
          width: 40,
          height: 20,
          borderRadius: 10,
          backgroundColor: value ? 'primary.main' : '#d0d0d0',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
          '&:hover': {
            backgroundColor: value ? 'primary.dark' : '#b0b0b0',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 2,
            left: value ? 22 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'left 0.2s',
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600 }}>
        {value ? 'ON' : 'OFF'}
      </Typography>
    </Stack>
  );
}
