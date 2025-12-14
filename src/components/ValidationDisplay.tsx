import { Alert, Stack, Typography } from '@mui/material';
import type { ValidationResult } from '../types/soundConfig';

interface ValidationDisplayProps {
  result: ValidationResult;
}

export function ValidationDisplay({ result }: ValidationDisplayProps) {
  if (result.valid || result.errors.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1}>
      {result.errors.map((error, index) => (
        <Alert key={`error-${index}`} severity="error" sx={{ py: 0.5 }}>
          <Typography variant="body2">
            {error.path && <strong>{error.path}:</strong>} {error.message}
          </Typography>
        </Alert>
      ))}
    </Stack>
  );
}
