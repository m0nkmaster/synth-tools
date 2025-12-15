import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  Container,
  Divider,
  Grid,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DownloadIcon from '@mui/icons-material/Download';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import TuneIcon from '@mui/icons-material/Tune';
import { useSlices } from '../hooks/useSlices';
import { createDefaultMetadata, updateMetadataArray, ensureMetadataLength } from '../utils/metadata';
import { formatDuration } from '../utils/audio';
import type { Slice, DrumMetadata } from '../types';
import { buildDrumPack } from '../audio/pack';
import { semitonesToPitchParam } from '../audio/pitch';
import { MAX_SLICES, MAX_DURATION_SECONDS, MAX_SLICE_DURATION_SECONDS } from '../constants';
import { TE_COLORS } from '../theme';

function WaveformPreview({ slice, height = 24, width = 24, isDark = false }: { slice: Slice; height?: number; width?: number; isDark?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgColor = isDark ? TE_COLORS.dark.surface : TE_COLORS.light.panel;
  const waveColor = TE_COLORS.orange;
  const borderColor = isDark ? TE_COLORS.dark.border : TE_COLORS.light.border;

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
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = waveColor;
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
      .catch(() => { })
      .finally(() => {
        ac.close().catch(() => { });
      });

    return () => {
      cancelled = true;
      ac.close().catch(() => { });
    };
  }, [slice, height, width, bgColor, waveColor]);

  return <canvas ref={canvasRef} style={{ width, height, border: `1px solid ${borderColor}`, borderRadius: 2 }} />;
}

function SliceList({
  slices,
  onRemove,
  meta,
  onMetaChange,
  onPlay,
  playingId,
  onSemitonesChange,
  isDark
}: {
  slices: Slice[];
  onRemove: (id: string) => void;
  meta: { volume: number[]; pitch: number[]; reverse: number[]; playmode: number[] };
  onMetaChange: (index: number, key: 'volume' | 'pitch' | 'reverse' | 'playmode', value: number) => void;
  onPlay: (slice: Slice, semitones?: number, volume?: number) => void;
  playingId: string | null;
  onSemitonesChange: (id: string, semitones: number) => void;
  isDark: boolean;
}) {
  const [volumeModal, setVolumeModal] = useState<{ idx: number; value: number } | null>(null);
  const [pitchModal, setPitchModal] = useState<{ id: string; idx: number; value: number } | null>(null);
  const railColor = isDark ? `${TE_COLORS.orange}40` : '#ffcab8';

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
        <Paper key={slice.id} variant="outlined" sx={{ p: 1.5, transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main' } }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <WaveformPreview slice={slice} height={32} width={48} isDark={isDark} />
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
              <IconButton size="small" onClick={() => onPlay(slice, slice.semitones, meta.volume[idx])} sx={{ bgcolor: playingId === slice.id ? 'primary.main' : 'transparent' }}>
                <PlayArrowIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => onRemove(slice.id)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => setVolumeModal({ idx, value: meta.volume[idx] ?? 8192 })}>
                <VolumeUpIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => setPitchModal({ id: slice.id, idx, value: slice.semitones ?? 0 })}>
                <TuneIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40, textAlign: 'right' }}>
                {formatDuration(slice.duration)}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      ))}

      <Dialog open={!!volumeModal} onClose={() => setVolumeModal(null)}>
        <DialogTitle>Volume</DialogTitle>
        <DialogContent sx={{ width: 300, py: 4 }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h4">{volumeModal?.value ?? 8192}</Typography>
            <Slider
              orientation="vertical"
              value={volumeModal?.value ?? 8192}
              onChange={(_, v) => {
                const val = v as number;
                setVolumeModal(prev => prev ? { ...prev, value: val } : null);
                if (volumeModal) onMetaChange(volumeModal.idx, 'volume', val);
              }}
              min={0}
              max={16383}
              sx={{ height: 200, '& .MuiSlider-thumb': { color: 'primary.main' }, '& .MuiSlider-track': { color: 'primary.main' }, '& .MuiSlider-rail': { color: railColor } }}
            />
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pitchModal} onClose={() => setPitchModal(null)}>
        <DialogTitle>Pitch</DialogTitle>
        <DialogContent sx={{ width: 300, py: 4 }}>
          <Stack spacing={2} alignItems="center">
            <Typography variant="h4">{pitchModal?.value.toFixed(1) ?? '0.0'}</Typography>
            {(() => {
              if (!pitchModal) return null;
              const slice = slices.find(s => s.id === pitchModal.id);
              if (!slice?.detectedFrequency) return null;
              const targetFreq = slice.detectedFrequency * Math.pow(2, pitchModal.value / 12);
              const a4 = 440;
              const semitoneFromA4 = 12 * Math.log2(targetFreq / a4);
              const roundedSemitone = Math.round(semitoneFromA4);
              const cents = Math.round((semitoneFromA4 - roundedSemitone) * 100);
              const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
              const octave = Math.floor((roundedSemitone + 48) / 12);
              const noteIdx = ((roundedSemitone % 12) + 12) % 12;
              const note = noteNames[noteIdx] + octave;
              const centsStr = cents === 0 ? '' : cents > 0 ? ` +${cents}¢` : ` ${cents}¢`;
              return <Typography variant="body2" color="text.secondary">{note}{centsStr}</Typography>;
            })()}
            <Slider
              orientation="vertical"
              value={pitchModal?.value ?? 0}
              onChange={(_, v) => {
                const val = v as number;
                setPitchModal(prev => prev ? { ...prev, value: val } : null);
                if (pitchModal) onSemitonesChange(pitchModal.id, val);
              }}
              min={-12}
              max={12}
              step={0.1}
              marks={[{ value: -12, label: '-12' }, { value: 0, label: '0' }, { value: 12, label: '+12' }]}
              sx={{ height: 200, '& .MuiSlider-thumb': { color: 'primary.main' }, '& .MuiSlider-track': { color: 'primary.main' }, '& .MuiSlider-rail': { color: railColor } }}
            />
          </Stack>
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

export function DrumCreator() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const {
    slices,
    addFiles,
    removeSlice,
    updateSlice,
    isProcessing,
    error,
    maxDuration,
    totalDuration,
  } = useSlices();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<DrumMetadata>(createDefaultMetadata());

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

  const handlePlay = async (slice: Slice, semitones = 0, volume?: number) => {
    try {
      if (playingId === slice.id) {
        stopAudio();
        return;
      }
      stopAudio();
      const blob = slice.playableBlob || slice.file;
      const arrayBuffer = await blob.arrayBuffer();
      const ac = new AudioContext();
      const audioBuffer = await ac.decodeAudioData(arrayBuffer);
      const source = ac.createBufferSource();
      const gainNode = ac.createGain();
      source.buffer = audioBuffer;
      source.playbackRate.value = Math.pow(2, semitones / 12);
      gainNode.gain.value = volume !== undefined ? volume / 8192 : 1;
      source.connect(gainNode);
      gainNode.connect(ac.destination);
      setPlayingId(slice.id);
      source.onended = () => {
        ac.close();
        stopAudio();
      };
      source.start();
      audioRef.current = { pause: () => source.stop(), currentTime: 0 } as any;
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
        maxDuration,
        format: 'aifc', // Use AIFF-C format like TE files
        metadata
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'opz-drum-pack.aif';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setExportError((err as Error)?.message ?? 'Export failed. Please retry.');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    setMetadata((prev) => ensureMetadataLength(prev, slices.length));
  }, [slices.length]);

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const handleMetaArrayChange = (
    index: number,
    key: 'volume' | 'pitch' | 'reverse' | 'playmode',
    value: number
  ) => {
    setMetadata((prev) => updateMetadataArray(prev, key, index, value));
  };

  const handleSemitonesChange = (id: string, semitones: number) => {
    const idx = slices.findIndex(s => s.id === id);
    if (idx === -1) return;
    updateSlice(id, { semitones });
    setMetadata(prev => updateMetadataArray(prev, 'pitch', idx, semitonesToPitchParam(semitones)));
  };

  return (
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
                    transition: 'all 0.2s',
                    '&:hover': { borderColor: 'primary.main', bgcolor: isDark ? `${TE_COLORS.orange}10` : `${TE_COLORS.orange}08` }
                  }}
                  onClick={handleSelectFiles}
                >
                  <CloudUploadIcon sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    Drop files here
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                    Up to {MAX_SLICES} slices
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
                      {formatDuration(totalDuration)} / {maxDuration}s · {slices.length} / {MAX_SLICES}
                    </Typography>
                  </Stack>
                  <Button variant="contained" size="small" disabled={disabledExport} onClick={handleExport} startIcon={<DownloadIcon />}>
                    Export
                  </Button>
                </Stack>

                {error && <Alert severity="error">{error}</Alert>}
                {overDuration && <Alert severity="warning">Over {MAX_DURATION_SECONDS}s cap. Remove or trim slices.</Alert>}
                {slices.some(s => s.duration > MAX_SLICE_DURATION_SECONDS) && (
                  <Alert severity="warning">
                    Some slices exceed {MAX_SLICE_DURATION_SECONDS}s limit. OP-Z may ignore them.
                  </Alert>
                )}
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
                  onSemitonesChange={handleSemitonesChange}
                  isDark={isDark}
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
  );
}
