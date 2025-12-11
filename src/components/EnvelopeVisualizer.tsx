import { Box } from '@mui/material';
import { useMemo } from 'react';

export interface EnvelopeVisualizerProps {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  duration: number;
}

export function EnvelopeVisualizer({
  attack,
  decay,
  sustain,
  release,
  duration,
}: EnvelopeVisualizerProps) {
  const path = useMemo(() => {
    const width = 200;
    const height = 80;
    const padding = 5;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    // Calculate time points
    const totalTime = attack + decay + Math.max(0, duration - attack - decay) + release;
    const timeScale = drawWidth / totalTime;

    const attackEnd = attack * timeScale;
    const decayEnd = (attack + decay) * timeScale;
    const sustainEnd = (duration) * timeScale;
    const releaseEnd = (duration + release) * timeScale;

    // Calculate y positions (inverted because SVG y increases downward)
    const bottom = drawHeight + padding;
    const top = padding;
    const sustainY = bottom - sustain * drawHeight;

    // Build path
    const points = [
      `M ${padding} ${bottom}`, // Start at bottom left
      `L ${padding + attackEnd} ${top}`, // Attack to peak
      `L ${padding + decayEnd} ${sustainY}`, // Decay to sustain
      `L ${padding + sustainEnd} ${sustainY}`, // Hold sustain
      `L ${padding + releaseEnd} ${bottom}`, // Release to bottom
    ];

    return points.join(' ');
  }, [attack, decay, sustain, release, duration]);

  return (
    <Box
      sx={{
        width: 200,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 1,
        border: '1px solid #d0d0d0',
        overflow: 'hidden',
      }}
    >
      <svg width="200" height="80" viewBox="0 0 200 80">
        <path
          d={path}
          fill="none"
          stroke="#ff6b35"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Fill area under curve */}
        <path
          d={`${path} L 200 80 L 5 80 Z`}
          fill="rgba(255, 107, 53, 0.1)"
        />
      </svg>
    </Box>
  );
}
