import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Container, Paper, Stack, Typography, Box, useTheme } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { parseAiff } from '../audio/aiff';
import { decodePositions } from '../utils/opz';
import { ensureFFmpeg } from '../audio/ffmpeg';
import { TE_COLORS } from '../theme';

type ParsedMetadata = {
  name: string;
  octave: number;
  drumVersion: number;
  start: number[];
  end: number[];
  volume: number[];
  pitch: number[];
  reverse: number[];
  playmode: number[];
};

export function SampleAnalyzer() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ParsedMetadata | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [originalNumFrames, setOriginalNumFrames] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setFile(selectedFile);
    
    try {
      const buf = await selectedFile.arrayBuffer();
      const uint8 = new Uint8Array(buf);
      const { chunks, numFrames: aiffNumFrames } = parseAiff(uint8);
      
      const applChunk = chunks.find(c => c.id === 'APPL');
      if (!applChunk) throw new Error('No APPL chunk found');
      
      const applData = uint8.slice(applChunk.offset + 8, applChunk.offset + 8 + applChunk.size);
      const text = new TextDecoder().decode(applData);
      if (!text.startsWith('op-1')) throw new Error('Invalid APPL chunk format');
      // Find the end of the JSON (first closing brace at depth 0)
      const jsonText = text.slice(4);
      // Remove any trailing null bytes or garbage
      const cleanJson = jsonText.replace(/\0.*$/, '').trim();
      let json;
      try {
        json = JSON.parse(cleanJson);
      } catch (e) {
        console.error('JSON parse error. Raw text:', jsonText);
        console.error('Cleaned text:', cleanJson);
        throw new Error(`Invalid JSON in APPL chunk: ${(e as Error).message}`);
      }
      const startFrames = decodePositions(json.start);
      const endFrames = decodePositions(json.end);
      
      setMetadata({
        name: json.name,
        octave: json.octave,
        drumVersion: json.drum_version,
        start: startFrames,
        end: endFrames,
        volume: json.volume,
        pitch: json.pitch,
        reverse: json.reverse,
        playmode: json.playmode
      });
      
      const ffmpeg = await ensureFFmpeg();
      await ffmpeg.writeFile('input.aif', uint8);
      // Always convert to 44100 Hz (OP-Z standard)
      const targetSampleRate = 44100;
      await ffmpeg.exec(['-i', 'input.aif', '-ar', String(targetSampleRate), '-f', 'wav', 'output.wav']);
      const wavData = await ffmpeg.readFile('output.wav');
      await ffmpeg.deleteFile('input.aif');
      await ffmpeg.deleteFile('output.wav');
      
      const ac = new AudioContext({ sampleRate: targetSampleRate });
      const wavArray = wavData as Uint8Array;
      const audio = await ac.decodeAudioData(wavArray.buffer.slice(0) as ArrayBuffer);
      
      // Positions are stored as frame indices relative to the original AIFF file's frame count
      // Use the original frame count for position calculation, not the decoded buffer length
      // This accounts for any slight differences due to resampling or padding
      setAudioBuffer(audio);
      setOriginalNumFrames(aiffNumFrames);
      ac.close();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const playSlice = (idx: number) => {
    if (!audioBuffer || !metadata) return;
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    const start = metadata.start[idx];
    const end = metadata.end[idx];
    if (start === 0 && end === 0) return;
    const ac = new AudioContext();
    const source = ac.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ac.destination);
    const startTime = start / audioBuffer.sampleRate;
    const duration = (end - start + 1) / audioBuffer.sampleRate;
    source.start(0, startTime, duration);
    audioSourceRef.current = source;
    source.onended = () => ac.close();
  };

  // Theme-aware canvas colors
  const canvasBgColor = isDark ? TE_COLORS.dark.surface : TE_COLORS.light.panel;
  const waveColor = TE_COLORS.orange;
  const strokeColor = isDark ? TE_COLORS.dark.text : TE_COLORS.light.text;

  useEffect(() => {
    if (!audioBuffer || !canvasRef.current || !metadata) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const w = canvas.width;
    const h = canvas.height;
    const data = audioBuffer.getChannelData(0);
    // Use original frame count for BOTH waveform and markers to ensure alignment
    // The metadata positions are relative to the original AIFF frame count
    const frameCount = originalNumFrames ?? data.length;
    // Scale factor to map audio buffer samples to original frame positions
    const bufferToFrameScale = frameCount / data.length;
    
    ctx.fillStyle = canvasBgColor;
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = waveColor;
    const mid = h / 2;
    const samplesPerPixel = frameCount / w; // Use frameCount for consistent scaling
    for (let x = 0; x < w; x++) {
      // Map pixel position to frame position, then to buffer position
      const frameStart = Math.floor(x * samplesPerPixel);
      const frameEnd = Math.floor((x + 1) * samplesPerPixel);
      const bufferStart = Math.floor(frameStart / bufferToFrameScale);
      const bufferEnd = Math.floor(frameEnd / bufferToFrameScale);
      let min = 1, max = -1;
      for (let i = bufferStart; i < bufferEnd && i < data.length; i++) {
        const v = data[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const amp = Math.max(Math.abs(min), Math.abs(max));
      const barHeight = amp * (h * 0.4);
      ctx.fillRect(x, mid - barHeight, 1, barHeight * 2);
    }
    
    // Draw slice boundaries
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < metadata.start.length; i++) {
      if (metadata.start[i] === 0 && metadata.end[i] === 0) continue;
      const start = metadata.start[i];
      const end = metadata.end[i];
      
      // Positions are frame indices relative to original AIFF frame count
      // Draw start line
      const startX = Math.round((start / frameCount) * w);
      ctx.beginPath();
      ctx.moveTo(startX + 0.5, 0);
      ctx.lineTo(startX + 0.5, h);
      ctx.stroke();
      
      // Draw end line
      const endX = Math.round((end / frameCount) * w);
      ctx.beginPath();
      ctx.moveTo(endX + 0.5, 0);
      ctx.lineTo(endX + 0.5, h);
      ctx.stroke();
    }
    
    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      // Convert click position to frame using original frame count
      const clickFrame = (x / rect.width) * frameCount;
      for (let i = 0; i < metadata.start.length; i++) {
        if (metadata.start[i] === 0 && metadata.end[i] === 0) continue;
        const start = metadata.start[i];
        const end = metadata.end[i];
        if (clickFrame >= start && clickFrame <= end) {
          playSlice(i);
          break;
        }
      }
    };
    
    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [audioBuffer, metadata, originalNumFrames, canvasBgColor, waveColor, strokeColor]);

  return (
    <Container maxWidth="lg" sx={{ py: 2, px: 2 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>Load OP-Z Drum Pack</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select an .aif file with OP-Z metadata
          </Typography>
          <Button variant="contained" onClick={() => fileInputRef.current?.click()}>
            Select File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".aif,.aiff"
            hidden
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
          />
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        {file && metadata && (
          <>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Metadata</Typography>
              <Stack spacing={1}>
                <Typography variant="body2"><strong>Name:</strong> {metadata.name}</Typography>
                <Typography variant="body2"><strong>Octave:</strong> {metadata.octave}</Typography>
                <Typography variant="body2"><strong>Version:</strong> {metadata.drumVersion}</Typography>
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Waveform</Typography>
              <Box sx={{ width: '100%', overflow: 'auto' }}>
                <canvas ref={canvasRef} width={1200} height={200} style={{ width: '100%', height: 200, cursor: 'pointer' }} />
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Slices</Typography>
              <Stack spacing={1}>
                {metadata.start.map((start, idx) => {
                  const end = metadata.end[idx];
                  if (start === 0 && end === 0) return null;
                  return (
                    <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" spacing={2}>
                        <Typography variant="body2" sx={{ minWidth: 60 }}><strong>#{idx + 1}</strong></Typography>
                        <Typography variant="body2">Start: {start}</Typography>
                        <Typography variant="body2">End: {end}</Typography>
                        <Typography variant="body2">Vol: {metadata.volume[idx]}</Typography>
                        <Typography variant="body2">Pitch: {metadata.pitch[idx]}</Typography>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
