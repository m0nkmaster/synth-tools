import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { SoundConfig } from '../types/soundConfig';
import {
  listPresets,
  savePreset,
  deletePreset,
  loadPreset,
  type Preset,
  PresetStorageError,
  QuotaExceededError,
} from '../utils/presets';

interface PresetManagerProps {
  currentConfig: SoundConfig;
  onLoadPreset: (config: SoundConfig) => void;
}

export function PresetManager({ currentConfig, onLoadPreset }: PresetManagerProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshPresets = () => {
    try {
      setPresets(listPresets());
      setError(null);
    } catch (err) {
      if (err instanceof PresetStorageError) {
        setError(err.message);
      } else {
        setError('Failed to load presets');
      }
    }
  };

  const handleSaveClick = () => {
    setPresetName(currentConfig.metadata.name || 'Untitled');
    setError(null);
    setSaveDialogOpen(true);
  };

  const handleSaveConfirm = () => {
    if (!presetName.trim()) return;

    try {
      savePreset(presetName, currentConfig);
      setSaveDialogOpen(false);
      setPresetName('');
      setError(null);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setError(err.message);
      } else if (err instanceof PresetStorageError) {
        setError(err.message);
      } else {
        setError('Failed to save preset');
      }
    }
  };

  const handleLoadClick = () => {
    refreshPresets();
    setLoadDialogOpen(true);
  };

  const handleLoadPreset = (id: string) => {
    try {
      const preset = loadPreset(id);
      onLoadPreset(preset.config);
      setLoadDialogOpen(false);
      setError(null);
    } catch (err) {
      if (err instanceof PresetStorageError) {
        setError(err.message);
      } else {
        setError('Failed to load preset');
      }
    }
  };

  const handleDeletePreset = (id: string) => {
    try {
      deletePreset(id);
      refreshPresets();
      setError(null);
    } catch (err) {
      if (err instanceof PresetStorageError) {
        setError(err.message);
      } else {
        setError('Failed to delete preset');
      }
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button variant="contained" onClick={handleSaveClick}>
          Save Preset
        </Button>
        <Button variant="outlined" onClick={handleLoadClick}>
          Load Preset
        </Button>
      </Box>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)}>
        <DialogTitle>Save Preset</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label="Preset Name"
            fullWidth
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveConfirm();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveConfirm} variant="contained" disabled={!presetName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Load Dialog */}
      <Dialog
        open={loadDialogOpen}
        onClose={() => setLoadDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Load Preset</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {presets.length === 0 ? (
            <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              No presets saved yet
            </Box>
          ) : (
            <List>
              {presets.map((preset) => (
                <ListItem
                  key={preset.id}
                  onClick={() => handleLoadPreset(preset.id)}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <ListItemText
                    primary={preset.name}
                    secondary={`${preset.category} • ${new Date(preset.createdAt).toLocaleDateString()}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(preset.id);
                      }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
