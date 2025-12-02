import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Divider,
  Grid,
  IconButton,
  Checkbox,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Toolbar,
  Typography
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SettingsIcon from '@mui/icons-material/Settings';
import theme from './theme';
import { ThemeProvider } from '@mui/material/styles';
import { useSlices } from './hooks/useSlices';
import type { Slice, DrumMetadata } from './types';
import { buildDrumPack } from './audio/pack';
import { TEBackground } from './components/TEBackground';

function formatDuration(value: number): string {
  if (!Number.isFinite(value)) return '0.0s';
  return `${value.toFixed(2)}s`;
}

function WaveformPreview({
  slice,
  height = 24,
  width = 24,
  color = '#000'
}: {
  slice: Slice;
  height?: number;
  width?: number;
  color?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas || !slice) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ac = new AudioContext();
    const blob = slice.playableBlob || slice.file;
    blob
      .arrayBuffer()
      .then((buf) => ac.decodeAudioData(buf.slice(0)))
      .then((audioBuffer) => {
        if (cancelled || !canvasRef.current) return;
        const w = width;
        const h = height;
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        const data = audioBuffer.getChannelData(0);
        const buckets = Math.floor(w / 2);
        const samplesPerBucket = Math.max(1, Math.floor(data.length / buckets));
        const mid = h / 2;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ff6b35';
        const barWidth = 1;
        for (let b = 0; b < buckets; b++) {
          const start = b * samplesPerBucket;
          const end = Math.min(start + samplesPerBucket, data.length);
          let min = 1;
          let max = -1;
          for (let i = start; i < end; i++) {
            const v = data[i];
            if (v < min) min = v;
            if (v > max) max = v;
          }
          const amp = Math.max(Math.abs(min), Math.abs(max));
          const barHeight = Math.max(1, amp * (h * 0.4));
          const x = b * 2;
          ctx.fillRect(x, mid - barHeight, barWidth, barHeight * 2);
        }
      })
      .catch(() => {})
      .finally(() => {
        ac.close().catch(() => {});
      });

    return () => {
      cancelled = true;
      ac.close().catch(() => {});
    };
  }, [slice, height, width, color]);

  return <canvas ref={canvasRef} style={{ width, height, border: '1px solid #d0d0d0', borderRadius: 2 }} />;
}

function SliceList({
  slices,
  onRemove,
  meta,
  onMetaChange,
  onPlay,
  playingId
}: {
  slices: Slice[];
  onRemove: (id: string) => void;
  meta: { volume: number[]; pitch: number[]; reverse: number[]; playmode: number[] };
  onMetaChange: (index: number, key: 'volume' | 'pitch' | 'reverse' | 'playmode', value: number) => void;
  onPlay: (slice: Slice) => void;
  playingId: string | null;
}) {
  if (!slices.length) {
    return (
      <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">No slices added yet</Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={1}>
      {slices.map((slice, idx) => (
        <Paper key={slice.id} variant="outlined" sx={{ p: 1.5, bgcolor: '#fff', transition: 'all 0.2s', '&:hover': { borderColor: '#ff6b35' } }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <WaveformPreview slice={slice} height={32} width={48} />
              <Typography variant="body2" noWrap title={slice.name} sx={{ minWidth: 0, maxWidth: 180 }}>
                {slice.name}
              </Typography>
              <Chip
                label={slice.status === 'ready' ? 'Ready' : slice.status === 'processing' ? 'Processing' : 'Pending'}
                size="small"
                color={slice.status === 'ready' ? 'primary' : slice.status === 'processing' ? 'secondary' : 'default'}
              />
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <IconButton size="small" onClick={() => onPlay(slice)} sx={{ bgcolor: playingId === slice.id ? 'primary.main' : 'transparent' }}>
                <PlayArrowIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => onRemove(slice.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
              <Checkbox
                size="small"
                checked={(meta.reverse[idx] ?? 8192) === 0}
                onChange={(e) => onMetaChange(idx, 'reverse', e.target.checked ? 0 : 8192)}
              />
              <TextField
                size="small"
                label="Vol"
                type="number"
                inputProps={{ min: 0, max: 16383, style: { width: 60 } }}
                value={meta.volume[idx] ?? 8192}
                onChange={(e) => onMetaChange(idx, 'volume', Number(e.target.value))}
              />
              <TextField
                size="small"
                label="Pitch"
                type="number"
                inputProps={{ style: { width: 60 } }}
                value={meta.pitch[idx] ?? 0}
                onChange={(e) => onMetaChange(idx, 'pitch', Number(e.target.value))}
              />
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40, textAlign: 'right' }}>
                {formatDuration(slice.duration)}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function App() {
  const {
    slices,
    addFiles,
    removeSlice,
    isProcessing,
    error,
    normalizeMode,
    silenceThreshold,
    maxDuration,
    totalDuration,
    setNormalizeMode,
    setSilenceThreshold
  } = useSlices();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DrumMetadata>({
    name: 'op-done',
    octave: 0,
    drumVersion: 3,
    pitch: new Array(24).fill(0),
    playmode: new Array(24).fill(8192),
    reverse: new Array(24).fill(8192),
    volume: new Array(24).fill(8192)
  });

  const overDuration = useMemo(() => totalDuration > maxDuration, [totalDuration, maxDuration]);
  const disabledExport = !slices.length || overDuration || isProcessing || slices.some((s) => s.status !== 'ready');

  const handleSelectFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      await addFiles(files);
      event.target.value = '';
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      await addFiles(event.dataTransfer.files);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setPlayingId(null);
  };

  const handlePlay = async (slice: Slice) => {
    try {
      if (playingId === slice.id) {
        stopAudio();
        return;
      }
      stopAudio();
      const blob = slice.playableBlob || slice.file;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingId(slice.id);
      audio.onended = stopAudio;
      await audio.play();
    } catch (err) {
      console.error('Playback failed', err);
      stopAudio();
    }
  };

  const handleExport = async () => {
    setExportError(null);
    setIsExporting(true);
    try {
      const readySlices = slices.filter((s) => s.status === 'ready');
      if (!readySlices.length) {
        setExportError('No ready slices to export.');
        return;
      }
      const blob = await buildDrumPack(readySlices, {
        normalizeMode,
        silenceThreshold,
        maxDuration,
        metadata
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'opz-drum-pack.aif';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error(err);
      setExportError(err?.message ?? 'Export failed. Please retry.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    setMetadata((prev) => {
      const resize = (arr: number[], fill: number) => {
        const next = arr.slice(0, 24);
        while (next.length < Math.min(24, slices.length || 24)) {
          next.push(fill);
        }
        return next;
      };
      return {
        ...prev,
        pitch: resize(prev.pitch, 0),
        playmode: resize(prev.playmode, 8192),
        reverse: resize(prev.reverse, 8192),
        volume: resize(prev.volume, 8192)
      };
    });
  }, [slices.length]);

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const handleMetaArrayChange = (
    index: number,
    key: 'volume' | 'pitch' | 'reverse' | 'playmode',
    value: number
  ) => {
    setMetadata((prev) => {
      const nextArr = [...(prev[key] as number[])];
      nextArr[index] = value;
      return { ...prev, [key]: nextArr };
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <TEBackground />
      <Box sx={{ minHeight: '100vh', position: 'relative' }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar variant="dense" sx={{ minHeight: 48, px: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600 }}>
              OP-Done
            </Typography>
            <IconButton size="small" aria-label="settings">
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 2, px: 2 }}>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Stack spacing={1.5}>
                    <Typography variant="h6" sx={{ color: 'text.secondary', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Input</Typography>
                    <Paper
                      variant="outlined"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      sx={{
                        p: 3,
                        textAlign: 'center',
                        borderStyle: 'dashed',
                        cursor: 'pointer',
                        bgcolor: '#fff',
                        transition: 'all 0.2s',
                        '&:hover': { borderColor: '#ff6b35', bgcolor: '#fffaf8' }
                      }}
                      onClick={handleSelectFiles}
                    >
                      <CloudUploadIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
                      <Typography variant="body2" sx={{ mb: 0.5 }}>
                        Drop files here
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                        Up to 24 slices
                      </Typography>
                      <Button variant="contained" size="small" onClick={(e) => { e.stopPropagation(); handleSelectFiles(); }}>
                        Select Files
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".wav,.aif,.aiff,.mp3,.m4a,.flac"
                        multiple
                        hidden
                        onChange={handleFileInput}
                      />
                    </Paper>

                    <Divider flexItem />
                    <Typography variant="h6" sx={{ color: 'text.secondary', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Processing</Typography>
                    <TextField select size="small" label="Normalize" value={normalizeMode} onChange={(e) => setNormalizeMode(e.target.value as any)}>
                      <MenuItem value="loudnorm">Loudness (LUFS)</MenuItem>
                      <MenuItem value="peak">Peak</MenuItem>
                      <MenuItem value="off">Off</MenuItem>
                    </TextField>
                    <TextField size="small" label="Silence Threshold" value={silenceThreshold} onChange={(e) => setSilenceThreshold(Number(e.target.value))} />
                    <TextField size="small" label="Max Duration" value={maxDuration} disabled />
                    <Divider flexItem />
                    <Typography variant="h6" sx={{ color: 'text.secondary', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Metadata</Typography>
                    <TextField size="small" label="Name" value={metadata.name} onChange={(e) => setMetadata((prev) => ({ ...prev, name: e.target.value }))} />
                    <TextField size="small" label="Octave" type="number" value={metadata.octave} onChange={(e) => setMetadata((prev) => ({ ...prev, octave: Number(e.target.value) }))} />
                    <TextField select size="small" label="Version" value={metadata.drumVersion} onChange={(e) => setMetadata((prev) => ({ ...prev, drumVersion: Number(e.target.value) }))}>
                      <MenuItem value={2}>2</MenuItem>
                      <MenuItem value={3}>3</MenuItem>
                    </TextField>
                  </Stack>
                </Grid>

                <Grid item xs={12} md={8}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack spacing={0.5}>
                        <Typography variant="h6" sx={{ color: 'text.secondary', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Slices</Typography>
                        <Typography variant="caption" color={overDuration ? 'error.main' : 'text.secondary'}>
                          {formatDuration(totalDuration)} / {maxDuration}s · {slices.length} / 24
                        </Typography>
                      </Stack>
                      <Button variant="contained" size="small" disabled={disabledExport} onClick={handleExport} startIcon={<DownloadIcon />}>
                        Export
                      </Button>
                    </Stack>

                    {error && <Alert severity="error">{error}</Alert>}
                    {overDuration && <Alert severity="warning">Over 12s cap. Remove or trim slices.</Alert>}
                    {exportError && <Alert severity="error">{exportError}</Alert>}

                    <SliceList
                      slices={slices}
                      onRemove={removeSlice}
                      meta={{
                        volume: metadata.volume,
                        pitch: metadata.pitch,
                        reverse: metadata.reverse,
                        playmode: metadata.playmode
                      }}
                      onMetaChange={handleMetaArrayChange}
                      onPlay={handlePlay}
                      playingId={playingId}
                    />

                    {(isProcessing || isExporting) && (
                      <Paper variant="outlined" sx={{ p: 1.5 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {isExporting ? 'Exporting...' : 'Processing...'}
                        </Typography>
                        <LinearProgress />
                      </Paper>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </Paper>
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
