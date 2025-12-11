import { Box, Stack, Typography } from '@mui/material';

export interface SegmentedButtonProps<T> {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label?: string;
}

export function SegmentedButton<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: SegmentedButtonProps<T>) {
  return (
    <Stack spacing={0.5}>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: 'uppercase' }}>
          {label}
        </Typography>
      )}
      <Box
        sx={{
          display: 'inline-flex',
          borderRadius: 1,
          overflow: 'hidden',
          border: '1px solid #d0d0d0',
          backgroundColor: '#fff',
        }}
      >
        {options.map((option, index) => (
          <Box
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            sx={{
              px: 1.5,
              py: 0.5,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              cursor: 'pointer',
              backgroundColor: value === option.value ? 'primary.main' : 'transparent',
              color: value === option.value ? '#fff' : 'text.primary',
              borderRight: index < options.length - 1 ? '1px solid #d0d0d0' : 'none',
              transition: 'all 0.2s',
              userSelect: 'none',
              '&:hover': {
                backgroundColor: value === option.value ? 'primary.dark' : 'rgba(0,0,0,0.04)',
              },
            }}
          >
            {option.label}
          </Box>
        ))}
      </Box>
    </Stack>
  );
}
