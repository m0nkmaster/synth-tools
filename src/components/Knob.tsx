import { Box, Stack, Typography } from '@mui/material';
import { useRef, useState, useCallback, useEffect } from 'react';

export interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  label: string;
  unit?: string;
  onChange: (value: number) => void;
  logarithmic?: boolean;
}

export function Knob({
  value,
  min,
  max,
  step = 0.01,
  label,
  unit = '',
  onChange,
  logarithmic = false,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);

  // Convert value to rotation angle (0-270 degrees)
  const valueToAngle = useCallback((val: number) => {
    const normalized = logarithmic
      ? (Math.log(val) - Math.log(min)) / (Math.log(max) - Math.log(min))
      : (val - min) / (max - min);
    return normalized * 270 - 135; // -135 to 135 degrees
  }, [min, max, logarithmic]);

  // Convert angle to value
  const angleToValue = useCallback((angle: number) => {
    const normalized = (angle + 135) / 270; // 0 to 1
    const clamped = Math.max(0, Math.min(1, normalized));
    
    if (logarithmic) {
      const logMin = Math.log(min);
      const logMax = Math.log(max);
      return Math.exp(logMin + clamped * (logMax - logMin));
    }
    
    return min + clamped * (max - min);
  }, [min, max, logarithmic]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValueRef.current = value;
  }, [value]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaY = startYRef.current - e.clientY;
    const sensitivity = 0.5;
    const currentAngle = valueToAngle(startValueRef.current);
    const newAngle = currentAngle + deltaY * sensitivity;
    const newValue = angleToValue(newAngle);
    
    // Apply step
    const steppedValue = Math.round(newValue / step) * step;
    const clampedValue = Math.max(min, Math.min(max, steppedValue));
    
    onChange(clampedValue);
  }, [isDragging, valueToAngle, angleToValue, step, min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove global mouse listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const angle = valueToAngle(value);
  const displayValue = logarithmic && value >= 1000
    ? `${(value / 1000).toFixed(1)}k`
    : value.toFixed(2);

  return (
    <Stack spacing={0.5} alignItems="center" sx={{ minWidth: 60 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'linear-gradient(145deg, #f8f8f8, #e0e0e0)',
          boxShadow: isDragging
            ? 'inset 2px 2px 4px rgba(0,0,0,0.15), inset -2px -2px 4px rgba(255,255,255,0.7)'
            : '3px 3px 6px rgba(0,0,0,0.1), -3px -3px 6px rgba(255,255,255,0.7)',
          cursor: 'ns-resize',
          position: 'relative',
          transition: 'box-shadow 0.1s',
          '&:hover': {
            boxShadow: '3px 3px 8px rgba(0,0,0,0.15), -3px -3px 8px rgba(255,255,255,0.8)',
          },
        }}
      >
        {/* Indicator line */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 2,
            height: 18,
            backgroundColor: 'primary.main',
            transformOrigin: 'top center',
            transform: `translate(-50%, 0) rotate(${angle}deg)`,
            borderRadius: 1,
          }}
        />
        {/* Center dot */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: 6,
            height: 6,
            backgroundColor: '#fff',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ fontSize: 10, fontWeight: 600 }}>
        {displayValue}{unit}
      </Typography>
    </Stack>
  );
}
