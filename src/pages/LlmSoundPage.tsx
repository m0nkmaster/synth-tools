import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Chip,
  Container,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DownloadIcon from '@mui/icons-material/Download';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import { createLlmSound, encodeWav } from '../audio/llmSound';

function WaveformCanvas({ samples }: { samples: Float32Array | null }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !samples) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);

    const buckets = Math.max(1, Math.floor(width / 2));
    const samplesPerBucket = Math.max(1, Math.floor(samples.length / buckets));
    const mid = height / 2;
    ctx.fillStyle = '#ff6b35';

    for (let b = 0; b < buckets; b++) {
      const start = b * samplesPerBucket;
      const end = Math.min(start + samplesPerBucket, samples.length);
      let min = 1;
      let max = -1;
      for (let i = start; i < end; i++) {
        const v = samples[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const amp = Math.max(Math.abs(min), Math.abs(max));
      const barHeight = Math.max(1, amp * (height * 0.45));
      const x = b * 2;
      ctx.fillRect(x, mid - barHeight, 1, barHeight * 2);
    }
  }, [samples]);

  return <canvas ref={canvasRef} width={520} height={120} style={{ width: '100%', border: '1px solid #e0e0e0', borderRadius: 6 }} />;
}

type GeneratedSound = {
  wavUrl: string;
  samples: Float32Array;
  explanation: string[];
  highlights: string[];
  durationSeconds: number;
};

export function LlmSoundPage() {
  const [prompt, setPrompt] = useState('Synth stab that feels like a curious squirrel');
  const [duration, setDuration] = useState(4);
  const [creativity, setCreativity] = useState(0.45);
  const [status, setStatus] = useState<'idle' | 'generating' | 'ready'>('idle');
  const [generated, setGenerated] = useState<GeneratedSound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const durationLabel = useMemo(() => `${duration.toFixed(1)}s (max 6s)`, [duration]);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  useEffect(() => () => stopPlayback(), []);
  useEffect(() => () => {
    if (generated?.wavUrl) {
      URL.revokeObjectURL(generated.wavUrl);
    }
  }, [generated?.wavUrl]);

  const handleGenerate = async () => {
    setStatus('generating');
    stopPlayback();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const clip = createLlmSound(prompt, duration, creativity);
    const wavBytes = encodeWav(clip.samples, clip.sampleRate);
    const wavUrl = URL.createObjectURL(new Blob([wavBytes], { type: 'audio/wav' }));

    setGenerated({
      wavUrl,
      samples: clip.samples,
      explanation: clip.explanation,
      highlights: clip.highlights,
      durationSeconds: clip.durationSeconds
    });
    setStatus('ready');
  };

  const togglePlayback = () => {
    if (!generated?.wavUrl) return;
    if (isPlaying) {
      stopPlayback();
      return;
    }
    const audio = new Audio(generated.wavUrl);
    audioRef.current = audio;
    audio.onended = stopPlayback;
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  return (
    <Container maxWidth="lg" sx={{ px: 0 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <Typography variant="h6" sx={{ color: 'text.secondary', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Create sounds with LLM</Typography>
              <Typography variant="body2" color="text.secondary">
                Describe the texture you want and an on-device neural audio painter will improvise toward it. Each render is a fresh AI pass—no cached results—so you can riff with emotion and discovery while staying within six-second WAVs.
              </Typography>
            </Stack>

            <Stack spacing={2} direction={{ xs: 'column', md: 'row' }}>
              <Stack spacing={2} flex={1}>
                <TextField
                  label="Describe the sound"
                  multiline
                  minRows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  helperText="Examples: \"1980s style synth with reverb\", \"water-soaked snare with metallic ring\", \"synth stab that makes you think of a squirrel\""
                />

                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">Clip length</Typography>
                  <Slider
                    value={duration}
                    min={1}
                    max={6}
                    step={0.1}
                    onChange={(_, value) => setDuration(value as number)}
                    valueLabelDisplay="auto"
                    valueLabelFormat={() => durationLabel}
                  />
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">LLM creativity</Typography>
                  <Slider
                    value={creativity}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(_, value) => setCreativity(value as number)}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(v) => `${Math.round((v as number) * 100)}%`}
                  />
                </Stack>

                <Button
                  variant="contained"
                  onClick={handleGenerate}
                  disabled={!prompt.trim() || status === 'generating'}
                  startIcon={<GraphicEqIcon />}
                >
                  {status === 'generating' ? 'Designing...' : 'Generate sound'}
                </Button>
              </Stack>

              <Stack spacing={2} flex={1}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: '#fffaf8' }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle2">Waveform</Typography>
                    {generated ? <WaveformCanvas samples={generated.samples} /> : <Typography variant="body2" color="text.secondary">No audio yet. Generate to preview.</Typography>}
                    {status === 'generating' && <LinearProgress />}
                  </Stack>
                </Paper>

                {generated && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Button variant="contained" onClick={togglePlayback} startIcon={isPlaying ? <PauseIcon /> : <PlayArrowIcon />}>
                          {isPlaying ? 'Pause' : 'Play'}
                        </Button>
                        <Button variant="outlined" startIcon={<DownloadIcon />} component="a" href={generated.wavUrl} download="llm-sound.wav">
                          Download WAV
                        </Button>
                        <Typography variant="caption" color="text.secondary">{generated.durationSeconds.toFixed(1)}s render</Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {generated.highlights.map((tag) => (
                          <Chip key={tag} label={tag} size="small" color="primary" variant="outlined" />
                        ))}
                      </Stack>
                      <Stack spacing={1}>
                        {generated.explanation.map((line, idx) => (
                          <Typography key={idx} variant="body2" color="text.secondary">{line}</Typography>
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                )}
              </Stack>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

export default LlmSoundPage;
