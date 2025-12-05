import { ensureFFmpeg } from './ffmpeg';
import { frequencyToNote, semitonesToPitchParam } from '../utils/audio';
import { PITCH, AUDIO, FORMATS } from '../config';

export async function detectPitch(file: File): Promise<{ note: string | null; frequency: number | null }> {
  try {
    const ac = new AudioContext();
    let buf = await file.arrayBuffer();
    
    // Convert AIFF with ffmpeg first
    const isAiff = FORMATS.AIFF_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
    if (isAiff) {
      try {
        const ffmpeg = await ensureFFmpeg();
        const inName = `pitch_${Date.now()}.aif`;
        const outName = `pitch_${Date.now()}.wav`;
        await ffmpeg.writeFile(inName, new Uint8Array(buf));
        await ffmpeg.exec(['-i', inName, '-f', 'wav', '-ar', String(AUDIO.SAMPLE_RATE), '-ac', String(AUDIO.CHANNELS), outName]);
        const wav = await ffmpeg.readFile(outName);
        await ffmpeg.deleteFile(inName).catch(() => {});
        await ffmpeg.deleteFile(outName).catch(() => {});
        buf = (wav as Uint8Array).buffer;
      } catch {
        // Continue with original
      }
    }
    
    const audioBuffer = await ac.decodeAudioData(buf);
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Skip initial silence
    let startIdx = 0;
    for (let i = 0; i < Math.min(data.length, sampleRate); i++) {
      if (Math.abs(data[i]) > AUDIO.RMS_THRESHOLD) {
        startIdx = i;
        break;
      }
    }
    
    const analyzeLength = Math.min(PITCH.WINDOW_SIZE, data.length - startIdx);
    if (analyzeLength < PITCH.MIN_WINDOW_SIZE) {
      ac.close();
      return { note: null, frequency: null };
    }
    
    const freq = autoCorrelate(data.slice(startIdx, startIdx + analyzeLength), sampleRate);
    ac.close();
    
    if (!freq || freq < PITCH.MIN_FREQUENCY || freq > PITCH.MAX_FREQUENCY) {
      return { note: null, frequency: null };
    }
    
    return { note: frequencyToNote(freq), frequency: freq };
  } catch {
    return { note: null, frequency: null };
  }
}

function autoCorrelate(buffer: Float32Array, sampleRate: number): number | null {
  const size = buffer.length;
  let rms = 0;
  
  for (let i = 0; i < size; i++) {
    rms += buffer[i] * buffer[i];
  }
  rms = Math.sqrt(rms / size);
  if (rms < AUDIO.RMS_THRESHOLD) return null;
  
  // Normalize
  const normalized = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    normalized[i] = buffer[i] / rms;
  }
  
  const minPeriod = Math.floor(sampleRate / PITCH.MIN_PERIOD_HZ);
  const maxPeriod = Math.floor(sampleRate / PITCH.MAX_PERIOD_HZ);
  
  let bestOffset = -1;
  let bestCorrelation = -1;
  
  for (let offset = minPeriod; offset < Math.min(maxPeriod, size / 2); offset++) {
    let sum = 0;
    for (let i = 0; i < size - offset; i++) {
      sum += normalized[i] * normalized[i + offset];
    }
    const correlation = sum / (size - offset);
    
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }
  
  if (bestCorrelation > PITCH.AUTOCORR_THRESHOLD && bestOffset > 0) {
    // Parabolic interpolation for sub-sample accuracy
    if (bestOffset > minPeriod && bestOffset < maxPeriod - 1) {
      let y1 = 0;
      const y2 = bestCorrelation;
      let y3 = 0;
      for (let i = 0; i < size - bestOffset - 1; i++) {
        y1 += normalized[i] * normalized[i + bestOffset - 1];
        y3 += normalized[i] * normalized[i + bestOffset + 1];
      }
      y1 /= (size - bestOffset - 1);
      y3 /= (size - bestOffset - 1);
      
      const a = (y1 + y3 - 2 * y2) / 2;
      if (a !== 0) {
        const parabolicOffset = (y1 - y3) / (2 * a);
        bestOffset += parabolicOffset;
      }
    }
    return sampleRate / bestOffset;
  }
  return null;
}

export function semitonesToNote(baseFreq: number | null, semitones: number): string | null {
  if (!baseFreq) return null;
  const targetFreq = baseFreq * Math.pow(2, semitones / 12);
  return frequencyToNote(targetFreq);
}

// Re-export from utils for convenience
export { frequencyToNote, semitonesToPitchParam };
