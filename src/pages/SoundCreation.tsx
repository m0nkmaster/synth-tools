import { useState, useEffect, useRef } from 'react';
import { Box, Button, TextField, Typography, Paper, CircularProgress, Alert, Chip, ToggleButton, ToggleButtonGroup, FormControlLabel, Switch } from '@mui/material';
import { generateSoundConfig, type AIProvider } from '../services/ai';
import { synthesizeSound } from '../audio/synthesizer';
import type { SoundConfig } from '../types/soundConfig';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  config?: SoundConfig;
}

export function SoundCreation() {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<SoundConfig | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [provider, setProvider] = useState<AIProvider>('gemini');

  const [midiEnabled, setMidiEnabled] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<Map<number, AudioBufferSourceNode>>(new Map());
  const gainNodesRef = useRef<Map<number, GainNode>>(new Map());

  // Store latest state in ref to avoid re-binding MIDI listeners
  const stateRef = useRef({ audioBuffer: null as AudioBuffer | null, config: null as SoundConfig | null, loopEnabled: false });
  useEffect(() => {
    stateRef.current = { audioBuffer, config, loopEnabled };
  }, [audioBuffer, config, loopEnabled]);

  const getAudioContext = () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  };

  // Stable stopNote function
  const stopNote = (midiNote: number) => {
    const source = activeSourcesRef.current.get(midiNote);
    const gainNode = gainNodesRef.current.get(midiNote);

    if (source && gainNode) {
      const ctx = getAudioContext();
      const releaseTime = 0.05;
      try {
        gainNode.gain.cancelScheduledValues(ctx.currentTime);
        gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + releaseTime);
        source.stop(ctx.currentTime + releaseTime);
      } catch {
        // Source might have already stopped
      }

      // We do NOT delete here immediately to allow the fade out?
      // Actually, if we delete here, subsequent calls to stopNote (if any) won't work, which is fine.
      // But we must mostly rely on onended to clean up eventually? 
      // No, we can delete here to prevent double-stops. The source will run for releaseTime then stop.
      // onended will fire then.

      // Better to leave cleanup to onended?
      // If we delete here, and playNote happens immediately after...
      // playNote sets new source.
      // onended of OLD source fires.

      // Let's keep deletion here but ensure onended is safe.
      activeSourcesRef.current.delete(midiNote);
      gainNodesRef.current.delete(midiNote);
    }
  };

  // Stable playNote function reading from ref
  const playNote = (midiNote: number, velocity: number) => {
    const { audioBuffer, config, loopEnabled } = stateRef.current;
    if (!audioBuffer) return;

    const ctx = getAudioContext();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    stopNote(midiNote);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    let rootFreq = 440;
    if (config?.synthesis?.layers?.[0]?.oscillator?.frequency) {
      rootFreq = config.synthesis.layers[0].oscillator.frequency;
    }

    // f = 440 * 2^((d-69)/12)
    const rootKey = 69 + 12 * Math.log2(rootFreq / 440);
    const playbackRate = Math.pow(2, (midiNote - rootKey) / 12);
    source.playbackRate.value = playbackRate;

    const gainNode = ctx.createGain();
    const velocityGain = velocity / 127;
    gainNode.gain.setValueAtTime(velocityGain, ctx.currentTime);

    source.loop = loopEnabled;
    if (loopEnabled && config?.envelope) {
      const { attack, decay, release } = config.envelope;
      const duration = config.timing.duration;

      const loopStart = attack + decay;
      const loopEnd = Math.max(loopStart + 0.1, duration - release);

      if (loopEnd > loopStart && loopEnd <= audioBuffer.duration) {
        source.loopStart = loopStart;
        source.loopEnd = loopEnd;
      }
    }

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start();

    activeSourcesRef.current.set(midiNote, source);
    gainNodesRef.current.set(midiNote, gainNode);
    // Clean up when done naturally
    source.onended = () => {
      if (activeSourcesRef.current.get(midiNote) === source) {
        activeSourcesRef.current.delete(midiNote);
        gainNodesRef.current.delete(midiNote);
      }
    };
  };

  // Keep references to handlers for MIDI effect
  const playNoteRef = useRef(playNote);
  const stopNoteRef = useRef(stopNote);
  useEffect(() => {
    playNoteRef.current = playNote;
    stopNoteRef.current = stopNote;
  });

  useEffect(() => {
    let access: any = null;

    const onMIDIMessage = (event: any) => {
      // Parse MIDI message
      const [status, note, velocity] = event.data;
      const command = status & 0xf0;

      if (command === 0x90 && velocity > 0) { // Note On
        playNoteRef.current(note, velocity);
      } else if (command === 0x80 || (command === 0x90 && velocity === 0)) { // Note Off
        stopNoteRef.current(note);
      }
    };

    const initMIDI = async () => {
      try {
        if ((navigator as any).requestMIDIAccess) {
          access = await (navigator as any).requestMIDIAccess();
          setMidiEnabled(true);

          for (const input of access.inputs.values()) {
            input.onmidimessage = onMIDIMessage;
          }

          access.onstatechange = (e: any) => {
            if (e.port.type === 'input' && e.port.state === 'connected') {
              e.port.onmidimessage = onMIDIMessage;
            }
          };
        }
      } catch (err) {
        console.warn('MIDI not supported or denied', err);
        setMidiEnabled(false);
      }
    };

    initMIDI();

    return () => {
      if (access) {
        for (const input of access.inputs.values()) {
          input.onmidimessage = null;
        }
        access.onstatechange = null;
      }
      // Stop all active notes
      activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch { /* ignore if already stopped */ }
      });
      activeSourcesRef.current.clear();
      gainNodesRef.current.clear();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []); // Run once on mount

  // Auto-set loop enabled based on category
  useEffect(() => {
    if (config) {
      const percussive = ['kick', 'snare', 'hihat', 'tom', 'perc', 'fx'];
      setLoopEnabled(!percussive.includes(config.metadata.category));
    }
  }, [config]);

  const handleGenerate = async () => {
    if (!description) {
      setError('Description required');
      return;
    }

    if (conversation.length >= 20) {
      setError('Max 10 iterations reached. Clear conversation to start fresh.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const generatedConfig = await generateSoundConfig(description, provider, config || undefined);
      setConfig(generatedConfig);

      const buffer = await synthesizeSound(generatedConfig);
      setAudioBuffer(buffer);

      setConversation(prev => [
        ...prev,
        { role: 'user', content: description },
        { role: 'assistant', content: 'Generated', config: generatedConfig },
      ]);
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setConversation([]);
    setConfig(null);
    setAudioBuffer(null);
    setDescription('');
    setError('');
  };

  const handlePlay = () => {
    // Play middle C (or A4 actually, since no shift)
    playNote(69, 100);
  };

  const handleDownload = () => {
    if (!audioBuffer || !config) return;

    const wav = audioBufferToWav(audioBuffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.metadata.name}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4">AI Sound Synthesis</Typography>
          {midiEnabled && (
            <Chip label="MIDI Active" color="success" size="small" variant="outlined" />
          )}
          {midiEnabled && (
            <FormControlLabel
              control={<Switch size="small" checked={loopEnabled} onChange={(e) => setLoopEnabled(e.target.checked)} />}
              label="Loop / Gate"
              sx={{ ml: 1 }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <ToggleButtonGroup
            value={provider}
            exclusive
            onChange={(_, val) => val && setProvider(val)}
            size="small"
          >
            <ToggleButton value="openai">OpenAI</ToggleButton>
            <ToggleButton value="gemini">Gemini</ToggleButton>
          </ToggleButtonGroup>
          {conversation.length > 0 && (
            <Button variant="outlined" size="small" onClick={handleClear}>
              Clear
            </Button>
          )}
        </Box>
      </Box>

      {conversation.length > 0 && (
        <Paper sx={{ p: 2, mb: 3, maxHeight: 200, overflow: 'auto' }}>
          <Typography variant="subtitle2" gutterBottom>Conversation</Typography>
          {conversation.map((msg, i) => (
            <Box key={i} sx={{ mb: 1 }}>
              <Chip
                label={msg.role === 'user' ? msg.content : 'Generated'}
                size="small"
                color={msg.role === 'user' ? 'primary' : 'success'}
              />
            </Box>
          ))}
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label={config ? 'Tweak the sound' : 'Describe the sound'}
          placeholder={config ? 'e.g., Make it punchier with more attack' : 'e.g., Deep 808 kick, Warm analog pad, Metallic pluck, Ethereal choir'}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleGenerate();
            }
          }}
          sx={{ mb: 2 }}
        />

        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={loading || !description}
        >
          {loading ? <CircularProgress size={24} /> : (config ? 'Tweak Sound' : 'Generate Sound')}
        </Button>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {config && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {config.metadata.name}
            <Chip label={`Iteration ${conversation.length / 2}`} size="small" sx={{ ml: 2 }} />
          </Typography>
          <Box sx={{ mb: 2, maxHeight: 400, overflow: 'auto', bgcolor: '#1e1e1e', p: 2, borderRadius: 1 }}>
            <pre style={{ margin: 0, color: '#d4d4d4', fontSize: 12 }}>
              {JSON.stringify(config, null, 2)}
            </pre>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={handlePlay} disabled={!audioBuffer}>
              Play
            </Button>
            <Button variant="outlined" onClick={handleDownload} disabled={!audioBuffer}>
              Download WAV
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length * buffer.numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, buffer.numberOfChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * buffer.numberOfChannels * 2, true);
  view.setUint16(32, buffer.numberOfChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length, true);

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}
