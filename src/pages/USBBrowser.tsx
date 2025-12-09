import { useState, useEffect } from 'react';
import {
  Alert,
  Box,
  Chip,
  Container,
  IconButton,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import RefreshIcon from '@mui/icons-material/Refresh';


const TRACKS = ['1-kick', '2-snare', '3-perc', '4-sample'];
const SLOTS = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0'));

interface SlotFile {
  name: string;
  size: number;
  isDuplicate: boolean;
}

interface SlotData {
  track: string;
  slot: string;
  file: SlotFile | null;
}

export function USBBrowser() {
  const [connected, setConnected] = useState(false);
  const [slots, setSlots] = useState<SlotData[]>([]);
  const [error, setError] = useState<string | null>(null);


  const checkConnection = async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts: { id: string; mode: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ id: 'opz', mode: 'readwrite' });
      const samplePacksHandle = await handle.getDirectoryHandle('sample packs');
      await scanSlots(samplePacksHandle);
      setConnected(true);
      setError(null);
    } catch {
      setConnected(false);
      setError('OP-Z not found at /Volumes/OP-Z');
    }
  };

  const scanSlots = async (samplePacksHandle: FileSystemDirectoryHandle) => {
    const data: SlotData[] = [];
    for (const track of TRACKS) {
      try {
        const trackHandle = await samplePacksHandle.getDirectoryHandle(track);
        for (const slot of SLOTS) {
          try {
            const slotHandle = await trackHandle.getDirectoryHandle(slot);
            let file: SlotFile | null = null;
            for await (const entry of slotHandle.values()) {
              if (entry.kind === 'file' && entry.name.endsWith('.aif')) {
                const fileHandle = await slotHandle.getFileHandle(entry.name);
                const fileData = await fileHandle.getFile();
                file = {
                  name: entry.name,
                  size: fileData.size,
                  isDuplicate: entry.name.startsWith('~')
                };
                break;
              }
            }
            data.push({ track, slot, file });
          } catch {
            data.push({ track, slot, file: null });
          }
        }
      } catch {
        for (const slot of SLOTS) {
          data.push({ track, slot, file: null });
        }
      }
    }
    setSlots(data);
  };

  const handleUpload = async (slotData: SlotData) => {
    try {
      const [fileHandle] = await (window as unknown as { showOpenFilePicker: (opts: { types: { description: string; accept: Record<string, string[]> }[]; multiple: boolean }) => Promise<FileSystemFileHandle[]> }).showOpenFilePicker({
        types: [{ description: 'AIFF Files', accept: { 'audio/aiff': ['.aif', '.aiff'] } }],
        multiple: false
      });
      const file = await fileHandle.getFile();
      const handle = await (window as unknown as { showDirectoryPicker: (opts: { id: string; mode: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ id: 'opz', mode: 'readwrite' });
      const samplePacksHandle = await handle.getDirectoryHandle('sample packs');
      const trackHandle = await samplePacksHandle.getDirectoryHandle(slotData.track);
      const slotHandle = await trackHandle.getDirectoryHandle(slotData.slot);
      const newFileHandle = await slotHandle.getFileHandle(file.name, { create: true });
      const writable = await newFileHandle.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
      await scanSlots(samplePacksHandle);
      setError(null);
    } catch {
      setError('Upload failed');
    }
  };

  const handleDelete = async (slotData: SlotData) => {
    if (!slotData.file) return;
    try {
      const handle = await (window as unknown as { showDirectoryPicker: (opts: { id: string; mode: string }) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({ id: 'opz', mode: 'readwrite' });
      const samplePacksHandle = await handle.getDirectoryHandle('sample packs');
      const trackHandle = await samplePacksHandle.getDirectoryHandle(slotData.track);
      const slotHandle = await trackHandle.getDirectoryHandle(slotData.slot);
      await slotHandle.removeEntry(slotData.file.name);
      await scanSlots(samplePacksHandle);
      setError(null);
    } catch {
      setError('Delete failed');
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', position: 'relative' }}>
      <Container maxWidth="lg" sx={{ py: 2, px: 2 }}>
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6">OP-Z USB Browser</Typography>
              <Stack direction="row" spacing={1}>
                <Chip
                  label={connected ? 'Connected' : 'Disconnected'}
                  color={connected ? 'success' : 'default'}
                  size="small"
                />
                <IconButton size="small" onClick={checkConnection}>
                  <RefreshIcon />
                </IconButton>
              </Stack>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {!connected && (
              <Alert severity="info">
                Connect OP-Z in disk mode and click refresh
              </Alert>
            )}

            {connected && (
              <Stack spacing={2}>
                {TRACKS.map((track) => (
                  <Paper key={track} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                      <FolderIcon fontSize="small" />
                      <Typography variant="subtitle2">{track}</Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {SLOTS.map((slot) => {
                        const slotData = slots.find((s) => s.track === track && s.slot === slot);
                        if (!slotData) return null;
                        return (
                          <Paper
                            key={`${track}-${slot}`}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              bgcolor: slotData.file ? '#fff' : '#fafafa',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': { borderColor: '#ff6b35' }
                            }}

                          >
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 24 }}>
                                  {slot}
                                </Typography>
                                {slotData.file ? (
                                  <>
                                    <AudioFileIcon fontSize="small" />
                                    <Typography variant="body2" noWrap>
                                      {slotData.file.name}
                                    </Typography>
                                    {slotData.file.isDuplicate && (
                                      <Chip label="Duplicate" size="small" />
                                    )}
                                    <Typography variant="caption" color="text.secondary">
                                      {(slotData.file.size / 1024 / 1024).toFixed(2)} MB
                                    </Typography>
                                  </>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">
                                    Empty
                                  </Typography>
                                )}
                              </Stack>
                              <Stack direction="row" spacing={0.5}>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpload(slotData);
                                  }}
                                >
                                  <CloudUploadIcon fontSize="small" />
                                </IconButton>
                                {slotData.file && (
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(slotData);
                                    }}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                )}
                              </Stack>
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
}
