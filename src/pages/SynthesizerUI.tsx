import { useState } from 'react';
import { Box, Container, Paper, Stack, Typography, Button, Alert } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { LayerManager } from '../components/LayerManager';
import { PresetManager } from '../components/PresetManager';
import { Knob } from '../components/Knob';
import { useDefaultPreset } from '../hooks/useDefaultPreset';
import { synthesizeSound } from '../audio/synthesizer';
import type { SoundConfig } from '../types/soundConfig';

export function SynthesizerUI() {
  const defaultPreset = useDefaultPreset();
  const [config, setConfig] = useState<SoundConfig>(defaultPreset);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update layers
  const updateLayers = (layers: SoundConfig['synthesis']['layers']) => {
    setConfig({
      ...config,
      synthesis: { ...config.synthesis, layers },
    });
  };

  // Update duration
  const updateDuration = (duration: number) => {
    setConfig({
      ...config,
      timing: { ...config.timing, duration },
    });
  };

  // Load preset
  const handleLoadPreset = (loadedConfig: SoundConfig) => {
    setConfig(loadedConfig);
  };

  // Play sound
  const handlePlay = async () => {
    setPlaying(true);
    setError(null);

    try {
      const buffer = await synthesizeSound(config);
      const ctx = new AudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
      source.onended = () => {
        setPlaying(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Synthesis failed');
      setPlaying(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Synthesizer
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Professional sound design interface
          </Typography>
        </Box>

        {/* Main Layout */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
          {/* Left Column */}
          <Stack spacing={3}>
            {/* Preset Manager */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
                Presets
              </Typography>
              <PresetManager
                currentConfig={config}
                onLoadPreset={handleLoadPreset}
              />
            </Paper>

            {/* Layer Manager */}
            <Paper sx={{ p: 3 }}>
              <LayerManager
                layers={config.synthesis.layers}
                onUpdate={updateLayers}
              />
            </Paper>

            {/* Placeholder: Global Envelope */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>
                Global Envelope
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Coming soon...
              </Typography>
            </Paper>
          </Stack>

          {/* Right Column */}
          <Stack spacing={3}>
            {/* Playback Controls */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', mb: 2 }}>
                Playback
              </Typography>
              
              {error && (
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayArrowIcon />}
                    onClick={handlePlay}
                    disabled={playing}
                    sx={{ minWidth: 120 }}
                  >
                    {playing ? 'Playing...' : 'Play'}
                  </Button>
                  
                  <Knob
                    label="Duration"
                    value={config.timing.duration}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit=" s"
                    onChange={updateDuration}
                  />
                </Box>
              </Stack>
            </Paper>

            {/* Placeholder: Filter */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>
                Filter
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Coming soon...
              </Typography>
            </Paper>

            {/* Placeholder: LFO */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>
                LFO
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Coming soon...
              </Typography>
            </Paper>

            {/* Placeholder: Effects */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>
                Effects
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Coming soon...
              </Typography>
            </Paper>

            {/* Placeholder: Metadata */}
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>
                Metadata
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Coming soon...
              </Typography>
            </Paper>
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}
