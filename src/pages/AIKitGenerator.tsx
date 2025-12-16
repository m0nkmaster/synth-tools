/**
 * AIKitGenerator - AI-powered OP-Z drum kit generator
 * Generate complete 24-sound drum kits from text prompts
 */

import { useState, useRef, useCallback } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Grid,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { generateBatchSoundConfigsChunked, planDrumKit, type AIProvider, type SoundIdea } from '../services/ai';
import { synthesizeSound } from '../audio/synthesizer';
import { buildDrumPack } from '../audio/pack';
import type { SoundConfig } from '../types/soundConfig';
import type { Slice } from '../types';
import { OPZ } from '../config';

type GenerationPhase = 'idle' | 'planning' | 'generating' | 'synthesizing' | 'building' | 'complete' | 'error';

interface GeneratedSound {
  idea: SoundIdea;
  config: SoundConfig | null;
  buffer: AudioBuffer | null;
  status: 'pending' | 'configuring' | 'synthesizing' | 'ready' | 'error';
  error?: string;
}


const getPhaseLabel = (phase: GenerationPhase, chunkProgress?: { current: number; total: number }): string => {
  if (phase === 'generating' && chunkProgress && chunkProgress.total > 1) {
    return `Generating configs (${chunkProgress.current}/${chunkProgress.total} chunks)...`;
  }
  const labels: Record<GenerationPhase, string> = {
    idle: '',
    planning: 'Planning kit...',
    generating: 'Generating configs...',
    synthesizing: 'Synthesizing sounds...',
    building: 'Building pack...',
    complete: 'Complete',
    error: 'Error',
  };
  return labels[phase];
};

const CATEGORY_COLORS: Record<string, 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  kick: 'error',
  snare: 'warning',
  hihat: 'info',
  tom: 'secondary',
  perc: 'success',
  fx: 'primary',
};

export default function AIKitGenerator() {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<AIProvider>('gemini');
  const [phase, setPhase] = useState<GenerationPhase>('idle');
  const [kitName, setKitName] = useState('');
  const [sounds, setSounds] = useState<GeneratedSound[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 24 });
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [finalBlob, setFinalBlob] = useState<Blob | null>(null);
  const [packInfo, setPackInfo] = useState<{ sliceCount: number; totalDuration: number } | null>(null);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef(false);

  const playSound = useCallback(async (buffer: AudioBuffer) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }, []);

  const generate = async () => {
    if (!prompt.trim()) return;
    
    abortRef.current = false;
    setError(null);
    setWarnings([]);
    setFinalBlob(null);
    setPackInfo(null);
    setChunkProgress(null);
    setPhase('planning');
    setSounds([]);
    
    try {
      // Phase 1: Plan the kit (1 API call)
      const plan = await planDrumKit(prompt, provider);
      setKitName(plan.kitName || 'AI Kit');
      
      const initialSounds: GeneratedSound[] = plan.sounds.map(idea => ({
        idea,
        config: null,
        buffer: null,
        status: 'pending',
      }));
      setSounds(initialSounds);
      setProgress({ current: 0, total: plan.sounds.length });
      
      if (abortRef.current) return;
      setPhase('generating');
      
      // Phase 2: Generate configs in parallel chunks
      setSounds(prev => prev.map(s => ({ ...s, status: 'configuring' })));
      
      const result = await generateBatchSoundConfigsChunked(
        plan.sounds,
        provider,
        (completed, total) => setChunkProgress({ current: completed, total })
      );
      
      // Report any chunk errors as warnings
      if (result.errors.length > 0) {
        const errorMessages = result.errors.map(e => `Chunk ${e.chunkIndex + 1}: ${e.error}`);
        setWarnings(errorMessages);
      }
      
      // Update sounds with configs (handling nulls from failed chunks)
      setSounds(prev => prev.map((s, idx) => ({
        ...s,
        config: result.configs[idx],
        status: result.configs[idx] ? 'synthesizing' : 'error',
        error: result.configs[idx] ? undefined : 'Config generation failed',
      })));
      setProgress({ current: plan.sounds.length, total: plan.sounds.length });
      setChunkProgress(null);
      
      if (abortRef.current) return;
      setPhase('synthesizing');
      
      // Phase 3: Synthesize each sound
      const soundsWithConfigs = initialSounds.map((s, i) => ({
        ...s,
        config: result.configs[i],
      }));
      
      for (let i = 0; i < soundsWithConfigs.length; i++) {
        if (abortRef.current) return;
        
        const sound = soundsWithConfigs[i];
        if (!sound.config) continue;
        
        try {
          const buffer = await synthesizeSound(sound.config);
          setSounds(prev => prev.map((s, idx) => 
            idx === i ? { ...s, buffer, status: 'ready' } : s
          ));
        } catch (err) {
          setSounds(prev => prev.map((s, idx) => 
            idx === i ? { ...s, status: 'error', error: String(err) } : s
          ));
        }
        
        setProgress(prev => ({ ...prev, current: i + 1 }));
      }
      
      if (abortRef.current) return;
      setPhase('building');
      
      // Phase 4: Build the pack
      const finalSounds = await new Promise<GeneratedSound[]>(resolve => {
        setSounds(prev => {
          resolve(prev);
          return prev;
        });
      });
      
      const validBuffers = finalSounds.filter(s => s.buffer).map(s => s.buffer!);
      if (validBuffers.length === 0) {
        throw new Error('No sounds were generated successfully');
      }
      
      const packResult = await buildPack(validBuffers, kitName || 'AI Kit');
      setFinalBlob(packResult.blob);
      setPackInfo({ sliceCount: packResult.sliceCount, totalDuration: packResult.totalDuration });
      setPhase('complete');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  };

  const audioBufferToWavFile = (buffer: AudioBuffer, name: string): File => {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const bitsPerSample = 16;
    
    let rawMono: Float32Array;
    if (buffer.numberOfChannels === 1) {
      rawMono = buffer.getChannelData(0);
    } else {
      rawMono = new Float32Array(buffer.length);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < buffer.length; i++) {
        rawMono[i] = (left[i] + right[i]) * 0.5;
      }
    }
    
    const silenceThreshold = 0.005;
    let startSample = 0;
    for (let i = 0; i < rawMono.length; i++) {
      if (Math.abs(rawMono[i]) > silenceThreshold) {
        startSample = Math.max(0, i - 10);
        break;
      }
    }
    
    // Trim trailing silence
    let endSample = rawMono.length;
    for (let i = rawMono.length - 1; i >= startSample; i--) {
      if (Math.abs(rawMono[i]) > silenceThreshold) {
        endSample = Math.min(rawMono.length, i + 10);
        break;
      }
    }
    
    const mono = rawMono.slice(startSample, endSample);
    const numFrames = mono.length;
    
    let maxPeak = 0;
    for (let i = 0; i < mono.length; i++) {
      maxPeak = Math.max(maxPeak, Math.abs(mono[i]));
    }
    if (maxPeak > 0) {
      const scale = 0.95 / maxPeak;
      for (let i = 0; i < mono.length; i++) {
        mono[i] *= scale;
      }
    }
    
    // Apply 20ms fade-out to prevent clicks at end
    const fadeOutSamples = Math.min(Math.floor(sampleRate * 0.02), mono.length);
    for (let i = 0; i < fadeOutSamples; i++) {
      const idx = mono.length - fadeOutSamples + i;
      const fadeAmount = i / fadeOutSamples;
      mono[idx] *= 1 - fadeAmount;
    }
    // Ensure last sample is exactly zero
    if (mono.length > 0) {
      mono[mono.length - 1] = 0;
    }
    
    const bytesPerSample = bitsPerSample / 8;
    const dataSize = numFrames * numChannels * bytesPerSample;
    const wavSize = 44 + dataSize;
    
    const wavBuffer = new ArrayBuffer(wavSize);
    const view = new DataView(wavBuffer);
    
    const writeString = (v: DataView, offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        v.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, wavSize - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
    view.setUint16(32, numChannels * bytesPerSample, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);
    
    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
      const sample = Math.max(-1, Math.min(1, mono[i]));
      view.setInt16(offset, Math.round(sample * 32767), true);
      offset += 2;
    }
    
    return new File([wavBuffer], `${name}.wav`, { type: 'audio/wav' });
  };

  const getWavDuration = (file: File): number => {
    const dataBytes = file.size - 44;
    const frames = dataBytes / 2;
    return frames / 44100;
  };

  const buildPack = async (buffers: AudioBuffer[], name: string): Promise<{ blob: Blob; sliceCount: number; totalDuration: number }> => {
    const slices: Slice[] = [];
    let totalDuration = 0;
    const maxDuration = OPZ.MAX_DURATION_SECONDS;
    
    for (let i = 0; i < Math.min(buffers.length, OPZ.MAX_SLICES); i++) {
      const buffer = buffers[i];
      const sound = sounds[i];
      const soundName = sound?.idea.name || `Sound ${i + 1}`;
      const file = audioBufferToWavFile(buffer, soundName);
      const sliceDuration = getWavDuration(file);
      
      if (totalDuration + sliceDuration > maxDuration && slices.length > 0) {
        break;
      }
      
      slices.push({
        id: `slice-${i}`,
        file,
        name: soundName,
        duration: sliceDuration,
        status: 'ready',
      });
      
      totalDuration += sliceDuration;
    }
    
    const blob = await buildDrumPack(slices, {
      maxDuration: OPZ.MAX_DURATION_SECONDS,
      format: 'aifc',
      metadata: {
        name: name.slice(0, 32),
        octave: 0,
        drumVersion: 2,
        pitch: new Array(OPZ.MAX_SLICES).fill(0),
        playmode: new Array(OPZ.MAX_SLICES).fill(12288),
        reverse: new Array(OPZ.MAX_SLICES).fill(8192),
        volume: new Array(OPZ.MAX_SLICES).fill(8192),
      },
    });
    
    return { blob, sliceCount: slices.length, totalDuration };
  };

  const download = () => {
    if (!finalBlob) return;
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(kitName || 'AI_Kit').replace(/[^a-zA-Z0-9]/g, '_')}.aif`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cancel = () => {
    abortRef.current = true;
    setPhase('idle');
  };

  const isGenerating = phase !== 'idle' && phase !== 'complete' && phase !== 'error';
  const readyCount = sounds.filter(s => s.status === 'ready').length;

  return (
    <Container maxWidth="lg" sx={{ py: 2, px: 2 }}>
      <Stack spacing={2}>
        {/* Input Section */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ color: 'text.secondary', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, mb: 1.5 }}>
            Describe Your Drum Kit
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              size="small"
              value={provider}
              onChange={e => setProvider(e.target.value as AIProvider)}
              disabled={isGenerating}
              sx={{ minWidth: 100 }}
            >
              <MenuItem value="gemini">Gemini</MenuItem>
              <MenuItem value="openai">OpenAI</MenuItem>
              <MenuItem value="anthropic">Anthropic</MenuItem>
            </TextField>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g., 80s inspired kick drums, industrial metal percussion, lo-fi hip hop kit..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !isGenerating && generate()}
              disabled={isGenerating}
            />
            {isGenerating ? (
              <Button
                variant="contained"
                color="error"
                onClick={cancel}
                startIcon={<StopIcon />}
                sx={{ minWidth: 120 }}
              >
                Cancel
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={generate}
                disabled={!prompt.trim()}
                startIcon={<AutoAwesomeIcon />}
                sx={{ minWidth: 120 }}
              >
                Generate
              </Button>
            )}
          </Stack>
        </Paper>

        {/* Progress */}
        {isGenerating && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2" color="text.secondary">
                {getPhaseLabel(phase, chunkProgress ?? undefined)}
              </Typography>
              <Typography variant="body2" fontWeight={700} color="primary">
                {progress.current} / {progress.total}
              </Typography>
            </Stack>
            <LinearProgress variant="determinate" value={(progress.current / progress.total) * 100} />
          </Paper>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <Alert severity="warning">
            Some chunks failed: {warnings.join('; ')}
          </Alert>
        )}

        {/* Error */}
        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {/* Complete */}
        {phase === 'complete' && finalBlob && (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h5" color="success.main" fontWeight={700} sx={{ mb: 1 }}>
              ✓ {kitName || 'AI Kit'}
            </Typography>
            {packInfo && (
              <>
                <Typography variant="body2" sx={{ mb: 0.5 }}>
                  {packInfo.sliceCount} of {readyCount} sounds included
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  {packInfo.totalDuration.toFixed(1)}s total • Ready for OP-Z
                </Typography>
                {packInfo.sliceCount < readyCount && (
                  <Alert severity="warning" sx={{ mb: 2, justifyContent: 'center' }}>
                    Some sounds did not fit (12s limit)
                  </Alert>
                )}
              </>
            )}
            <Button
              variant="contained"
              color="success"
              onClick={download}
              startIcon={<DownloadIcon />}
              size="large"
            >
              Download .AIF
            </Button>
          </Paper>
        )}

        {/* Sound Grid */}
        {sounds.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="h6" sx={{ color: 'text.secondary', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
                Sounds
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {readyCount}/{sounds.length}
              </Typography>
            </Stack>
            <Grid container spacing={1}>
              {sounds.map((sound, idx) => (
                <Grid item xs={6} sm={4} md={3} lg={2} key={idx}>
                  <Paper
                    variant="outlined"
                    onClick={() => sound.buffer && playSound(sound.buffer)}
                    sx={{
                      p: 1.5,
                      cursor: sound.buffer ? 'pointer' : 'default',
                      transition: 'all 0.2s',
                      borderColor: sound.status === 'ready' 
                        ? 'success.main' 
                        : sound.status === 'error' 
                          ? 'error.main' 
                          : 'divider',
                      bgcolor: sound.status === 'ready'
                        ? 'success.main'
                        : sound.status === 'error'
                          ? 'error.main'
                          : 'transparent',
                      '& *': {
                        color: (sound.status === 'ready' || sound.status === 'error') ? '#fff !important' : undefined,
                      },
                      '&:hover': sound.buffer ? {
                        borderColor: 'primary.main',
                        transform: 'scale(1.02)',
                      } : {},
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                      <Chip 
                        label={sound.idea.category} 
                        size="small" 
                        color={CATEGORY_COLORS[sound.idea.category] || 'default'}
                        sx={{ 
                          height: 16, 
                          fontSize: 8,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                      <Box sx={{ fontSize: 12 }}>
                        {sound.status === 'pending' && '⏳'}
                        {sound.status === 'configuring' && '⚙️'}
                        {sound.status === 'synthesizing' && '🔊'}
                        {sound.status === 'ready' && <PlayArrowIcon sx={{ fontSize: 14 }} />}
                        {sound.status === 'error' && '❌'}
                      </Box>
                    </Stack>
                    <Typography 
                      variant="body2" 
                      fontWeight={600}
                      noWrap
                      title={sound.idea.name}
                    >
                      {sound.idea.name}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Paper>
        )}

        {/* Empty State */}
        {phase === 'idle' && sounds.length === 0 && (
          <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h2" sx={{ mb: 2, opacity: 0.5 }}>🥁</Typography>
            <Typography variant="body1" sx={{ mb: 1 }}>
              Enter a prompt above to generate a complete drum kit
            </Typography>
            <Typography variant="body2" color="text.secondary">
              24 unique sounds • OP-Z compatible • AI-powered synthesis
            </Typography>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
