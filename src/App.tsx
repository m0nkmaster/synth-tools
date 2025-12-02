import { useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
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

type SliceStub = {
  id: number;
  name: string;
  duration: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
};

const initialSlices: SliceStub[] = [
  { id: 1, name: 'kick.wav', duration: '0.6s', status: 'ready' },
  { id: 2, name: 'snare.wav', duration: '0.5s', status: 'ready' },
  { id: 3, name: 'hat.wav', duration: '0.3s', status: 'processing' }
];

function SliceList({ slices }: { slices: SliceStub[] }) {
  return (
    <Stack spacing={1.5}>
      {slices.map((slice) => (
        <Paper key={slice.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Stack flex={1} spacing={0.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle1" fontWeight={600}>
                {slice.name}
              </Typography>
              <Chip
                label={slice.status === 'ready' ? 'Ready' : slice.status === 'processing' ? 'Processing' : 'Pending'}
                size="small"
                color={slice.status === 'ready' ? 'success' : slice.status === 'processing' ? 'warning' : 'default'}
                variant="filled"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Duration: {slice.duration} · Mono · 44.1kHz · 16-bit
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <IconButton size="small" aria-label="Preview slice">
              <PlayArrowIcon />
            </IconButton>
            <IconButton size="small" aria-label="Remove slice">
              <DeleteOutlineIcon />
            </IconButton>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
}

function App() {
  const [slices, setSlices] = useState<SliceStub[]>(initialSlices);
  const [isExporting, setIsExporting] = useState(false);

  const totalDuration = useMemo(
    () => slices.length ? '≈ 1.4s of 12s' : '0s of 12s',
    [slices.length]
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: '1px solid #e6e8ef' }}>
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
              OP Done — Drum Pack Builder
            </Typography>
            <IconButton color="inherit" aria-label="settings">
              <SettingsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: 2.5 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Stack spacing={2}>
                    <Typography variant="h6" fontWeight={700}>
                      Inputs
                    </Typography>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        textAlign: 'center',
                        borderStyle: 'dashed',
                        bgcolor: '#f9fbff'
                      }}
                    >
                      <CloudUploadIcon sx={{ fontSize: 36, color: 'primary.main' }} />
                      <Typography variant="body1" fontWeight={600} sx={{ mt: 1 }}>
                        Drop files here
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Up to 24 slices · wav/aiff/mp3/m4a/flac
                      </Typography>
                      <Button variant="contained" sx={{ mt: 2 }}>
                        Select files
                      </Button>
                    </Paper>

                    <Divider flexItem />

                    <Typography variant="h6" fontWeight={700}>
                      Processing
                    </Typography>
                    <TextField select size="small" label="Normalize mode" defaultValue="loudnorm">
                      <MenuItem value="loudnorm">Loudness (LUFS + limiter)</MenuItem>
                      <MenuItem value="peak">Peak + limiter</MenuItem>
                      <MenuItem value="off">Limiter only</MenuItem>
                    </TextField>
                    <TextField size="small" label="Silence threshold (dB)" defaultValue="-35" />
                    <TextField size="small" label="Max duration (s)" defaultValue="12" helperText="Device cap for drum packs" />
                  </Stack>
                </Grid>

                <Grid item xs={12} md={8}>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack spacing={0.5}>
                        <Typography variant="h6" fontWeight={700}>
                          Slices
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {totalDuration} · {slices.length} / 24 slices
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <Button variant="outlined" startIcon={<FolderOpenIcon />} color="inherit">
                          Choose slot
                        </Button>
                        <Button
                          variant="contained"
                          startIcon={<DownloadIcon />}
                          disabled={!slices.length}
                          onClick={() => setIsExporting(true)}
                        >
                          Export .aif
                        </Button>
                      </Stack>
                    </Stack>

                    <SliceList slices={slices} />

                    {isExporting && (
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Typography variant="body2" fontWeight={600} gutterBottom>
                          Exporting pack…
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
