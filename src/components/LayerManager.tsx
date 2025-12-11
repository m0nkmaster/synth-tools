import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useState } from 'react';
import type { SoundConfig } from '../types/soundConfig';
import { LayerControls } from './LayerControls';

export interface LayerManagerProps {
  layers: SoundConfig['synthesis']['layers'];
  onUpdate: (layers: SoundConfig['synthesis']['layers']) => void;
}

const DEFAULT_LAYERS = {
  oscillator: {
    type: 'oscillator' as const,
    gain: 0.8,
    oscillator: {
      waveform: 'sine' as const,
      frequency: 440,
      detune: 0,
    },
  },
  noise: {
    type: 'noise' as const,
    gain: 0.5,
    noise: {
      type: 'white' as const,
    },
  },
  fm: {
    type: 'fm' as const,
    gain: 0.7,
    fm: {
      carrier: 440,
      modulator: 880,
      modulationIndex: 100,
    },
  },
  'karplus-strong': {
    type: 'karplus-strong' as const,
    gain: 0.8,
    karplus: {
      frequency: 440,
      damping: 0.5,
      pluckLocation: 0.5,
    },
  },
};

export function LayerManager({ layers, onUpdate }: LayerManagerProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleAddLayer = (type: 'oscillator' | 'noise' | 'fm' | 'karplus-strong') => {
    if (layers.length >= 8) return;
    
    const newLayer = DEFAULT_LAYERS[type];
    onUpdate([...layers, newLayer]);
    setShowAddMenu(false);
  };

  const handleRemoveLayer = (index: number) => {
    onUpdate(layers.filter((_, i) => i !== index));
  };

  const handleLayerChange = (index: number, updatedLayer: SoundConfig['synthesis']['layers'][0]) => {
    const newLayers = [...layers];
    newLayers[index] = updatedLayer;
    onUpdate(newLayers);
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase' }}>
          Layers ({layers.length}/8)
        </Typography>
        <Box sx={{ position: 'relative' }}>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => setShowAddMenu(!showAddMenu)}
            disabled={layers.length >= 8}
            sx={{ fontSize: 11, textTransform: 'uppercase' }}
          >
            Add Layer
          </Button>
          {showAddMenu && (
            <Paper
              sx={{
                position: 'absolute',
                top: '100%',
                right: 0,
                mt: 0.5,
                zIndex: 10,
                minWidth: 150,
              }}
            >
              <Stack>
                <Button
                  size="small"
                  onClick={() => handleAddLayer('oscillator')}
                  sx={{ justifyContent: 'flex-start', fontSize: 11 }}
                >
                  Oscillator
                </Button>
                <Button
                  size="small"
                  onClick={() => handleAddLayer('noise')}
                  sx={{ justifyContent: 'flex-start', fontSize: 11 }}
                >
                  Noise
                </Button>
                <Button
                  size="small"
                  onClick={() => handleAddLayer('fm')}
                  sx={{ justifyContent: 'flex-start', fontSize: 11 }}
                >
                  FM
                </Button>
                <Button
                  size="small"
                  onClick={() => handleAddLayer('karplus-strong')}
                  sx={{ justifyContent: 'flex-start', fontSize: 11 }}
                >
                  Karplus-Strong
                </Button>
              </Stack>
            </Paper>
          )}
        </Box>
      </Box>

      <Stack spacing={1.5}>
        {layers.map((layer, index) => (
          <Paper
            key={index}
            sx={{
              p: 2,
              backgroundColor: '#f8f8f8',
              border: '1px solid #e0e0e0',
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                Layer {index + 1}: {layer.type}
              </Typography>
              <IconButton
                size="small"
                onClick={() => handleRemoveLayer(index)}
                sx={{ color: 'error.main' }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
            <LayerControls
              layer={layer}
              onChange={(updatedLayer) => handleLayerChange(index, updatedLayer)}
            />
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
