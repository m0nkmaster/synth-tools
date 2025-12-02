import { Box } from '@mui/material';

export function TELogo({ size = 48 }: { size?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="6" width="3" height="12" fill="#ff6b35" />
        <rect x="7" y="4" width="3" height="16" fill="#ff6b35" />
        <rect x="12" y="8" width="3" height="8" fill="#00d4aa" />
        <rect x="17" y="2" width="3" height="20" fill="#00d4aa" />
      </svg>
      <Box
        sx={{
          fontFamily: 'monospace',
          fontWeight: 700,
          fontSize: size,
          letterSpacing: '-0.05em',
          display: 'flex',
          alignItems: 'baseline',
          gap: 0.5
        }}
      >
        <Box component="span" sx={{ color: '#ff6b35' }}>OP</Box>
        <Box component="span" sx={{ color: '#000', fontSize: '0.5em', mb: 0.5 }}>·</Box>
        <Box component="span" sx={{ color: '#00d4aa' }}>DONE</Box>
      </Box>
    </Box>
  );
}