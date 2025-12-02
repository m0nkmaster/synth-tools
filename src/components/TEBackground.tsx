import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';

export function TEBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#ff6b35', '#00d9ff', '#ffbe0b', '#8338ec', '#06ffa5'];
    let frame = 0;

    const draw = () => {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const spacing = 80;
      const time = frame * 0.01;

      for (let x = 0; x < canvas.width + spacing; x += spacing) {
        for (let y = 0; y < canvas.height + spacing; y += spacing) {
          const idx = Math.floor((x + y) / spacing) % colors.length;
          ctx.strokeStyle = colors[idx];
          ctx.lineWidth = 0.5;
          ctx.globalAlpha = 0.15;

          const offset = Math.sin(time + x * 0.01 + y * 0.01) * 10;
          
          if ((x + y) % 240 < 80) {
            ctx.beginPath();
            ctx.moveTo(x, y + offset);
            ctx.lineTo(x + 40, y + 20 + offset);
            ctx.stroke();
          } else if ((x + y) % 240 < 160) {
            ctx.beginPath();
            ctx.arc(x + 20, y + 20 + offset, 3, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            ctx.strokeRect(x + 10, y + 10 + offset, 20, 20);
          }
        }
      }

      frame++;
      requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none'
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </Box>
  );
}
