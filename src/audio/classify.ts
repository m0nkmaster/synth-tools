import type { DrumClass, SampleAnalysis, SampleType } from '../types';

const SILENCE_THRESHOLD_DB = -50;
const FFT_SIZE = 2048;

export async function classifyAudio(blob: Blob): Promise<SampleAnalysis> {
  const AudioCtx = AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));

    const mono = downmixToMono(audioBuffer);
    const normalized = normalizeBuffer(mono);
    const trimmed = trimSilence(normalized, SILENCE_THRESHOLD_DB);

    if (!trimmed.length) {
      return { type: 'unknown', confidence: 0 };
    }

    const sampleRate = audioBuffer.sampleRate;
    const durationSeconds = trimmed.length / sampleRate;
    const rms = computeRMS(trimmed);
    const spectrum = computeSpectrum(trimmed, sampleRate, FFT_SIZE);
    const spectralCentroid = computeSpectralCentroid(spectrum, sampleRate);
    const flatness = computeSpectralFlatness(spectrum);
    const bandEnergy = {
      low: computeBandEnergy(spectrum, sampleRate, 0, 200),
      mid: computeBandEnergy(spectrum, sampleRate, 200, 2000),
      high: computeBandEnergy(spectrum, sampleRate, 2000, sampleRate / 2)
    };
    const harmonicConcentration = computeHarmonicConcentration(spectrum);

    const { sampleType, confidenceBoost } = decideSampleType({
      durationSeconds,
      flatness,
      harmonicConcentration
    });

    let drumClass: DrumClass | undefined;
    let noteName: string | undefined;
    let midiNote: number | undefined;
    let confidence = Math.min(1, confidenceBoost + rms * 0.1);

    if (sampleType === 'drum_hit') {
      drumClass = classifyDrum({
        centroid: spectralCentroid,
        lowEnergy: bandEnergy.low,
        midEnergy: bandEnergy.mid,
        highEnergy: bandEnergy.high,
        durationSeconds,
        flatness
      });
      confidence = Math.min(1, confidence + flatness * 0.5 + bandDominanceScore(bandEnergy) * 0.2);
    } else if (sampleType === 'melodic') {
      const freq = detectPitch(trimmed, sampleRate);
      if (freq) {
        midiNote = Math.round(freqToMidi(freq));
        noteName = midiToNoteName(midiNote);
        confidence = Math.min(1, confidence + (1 - flatness) * 0.5 + harmonicConcentration * 0.1);
      } else {
        confidence = Math.max(0.3, confidence * 0.6);
      }
    }

    return {
      type: sampleType,
      drumClass,
      noteName,
      midiNote,
      confidence: clamp(confidence, 0, 1)
    };
  } catch (err) {
    console.warn('Unable to classify audio', err);
    return { type: 'unknown', confidence: 0 };
  } finally {
    ctx.close().catch(() => {});
  }
}

type Spectrum = {
  magnitudes: Float32Array;
  binHz: number;
};

function downmixToMono(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i];
    }
  }
  for (let i = 0; i < length; i++) {
    mono[i] /= buffer.numberOfChannels;
  }
  return mono;
}

function normalizeBuffer(data: Float32Array): Float32Array {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const v = Math.abs(data[i]);
    if (v > peak) peak = v;
  }
  if (peak === 0) return data.slice(0);
  const norm = new Float32Array(data.length);
  const scale = 1 / peak;
  for (let i = 0; i < data.length; i++) {
    norm[i] = data[i] * scale;
  }
  return norm;
}

function trimSilence(data: Float32Array, thresholdDb: number): Float32Array {
  const threshold = Math.pow(10, thresholdDb / 20);
  let start = 0;
  let end = data.length - 1;

  while (start < data.length && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;

  return data.slice(start, end + 1);
}

function computeSpectrum(buffer: Float32Array, sampleRate: number, fftSize: number): Spectrum {
  const windowed = new Float32Array(fftSize);
  const length = Math.min(fftSize, buffer.length);
  for (let i = 0; i < length; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
    windowed[i] = buffer[i] * hann;
  }

  const magnitudes = new Float32Array(fftSize / 2);
  for (let k = 0; k < fftSize / 2; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = (-2 * Math.PI * k * n) / fftSize;
      const sample = windowed[n] || 0;
      re += sample * Math.cos(angle);
      im += sample * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(re * re + im * im);
  }

  return { magnitudes, binHz: sampleRate / fftSize };
}

function computeSpectralCentroid(spectrum: Spectrum, sampleRate: number): number {
  const mags = spectrum.magnitudes;
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < mags.length; i++) {
    const freq = (i * sampleRate) / (FFT_SIZE);
    weighted += freq * mags[i];
    total += mags[i];
  }
  return total > 0 ? weighted / total : 0;
}

function computeBandEnergy(spectrum: Spectrum, sampleRate: number, low: number, high: number): number {
  const mags = spectrum.magnitudes;
  const binHz = sampleRate / FFT_SIZE;
  const lowBin = Math.max(0, Math.floor(low / binHz));
  const highBin = Math.min(mags.length - 1, Math.ceil(high / binHz));

  let band = 0;
  let total = 0;
  for (let i = 0; i < mags.length; i++) {
    const mag = mags[i];
    if (i >= lowBin && i <= highBin) band += mag * mag;
    total += mag * mag;
  }
  return total > 0 ? band / total : 0;
}

function computeSpectralFlatness(spectrum: Spectrum): number {
  const mags = spectrum.magnitudes;
  let geo = 0;
  let arith = 0;
  const eps = 1e-12;
  for (let i = 0; i < mags.length; i++) {
    const mag = mags[i] + eps;
    geo += Math.log(mag);
    arith += mag;
  }
  geo = Math.exp(geo / mags.length);
  arith /= mags.length;
  return arith > 0 ? geo / arith : 0;
}

function computeHarmonicConcentration(spectrum: Spectrum): number {
  const mags = spectrum.magnitudes;
  let max = 0;
  let sum = 0;
  for (let i = 0; i < mags.length; i++) {
    const mag = mags[i];
    if (mag > max) max = mag;
    sum += mag;
  }
  const avg = sum / Math.max(1, mags.length);
  return avg > 0 ? max / avg : 0;
}

function computeRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return buffer.length > 0 ? Math.sqrt(sum / buffer.length) : 0;
}

function decideSampleType(params: {
  durationSeconds: number;
  flatness: number;
  harmonicConcentration: number;
}): { sampleType: SampleType; confidenceBoost: number } {
  const { durationSeconds, flatness, harmonicConcentration } = params;

  const percussive = durationSeconds < 0.5 && flatness > 0.35;
  const melodic = harmonicConcentration > 3 && flatness < 0.35;

  if (percussive && !melodic) {
    return { sampleType: 'drum_hit', confidenceBoost: 0.5 };
  }

  if (melodic) {
    return { sampleType: 'melodic', confidenceBoost: 0.5 };
  }

  if (durationSeconds < 0.9 && flatness > 0.45) {
    return { sampleType: 'drum_hit', confidenceBoost: 0.35 };
  }

  return { sampleType: 'unknown', confidenceBoost: 0.2 };
}

function classifyDrum(features: {
  centroid: number;
  lowEnergy: number;
  midEnergy: number;
  highEnergy: number;
  durationSeconds: number;
  flatness: number;
}): DrumClass {
  const { centroid, lowEnergy, midEnergy, highEnergy, durationSeconds } = features;

  if (lowEnergy > midEnergy && lowEnergy > highEnergy && centroid < 300) return 'kick';
  if (highEnergy > lowEnergy && highEnergy > midEnergy && centroid > 4000 && durationSeconds < 0.5) return 'hat';
  if (centroid > 600 && centroid < 3000 && (midEnergy + lowEnergy) > highEnergy * 0.6) return 'snare';
  if (highEnergy > 0.45 && durationSeconds > 0.5) return 'cymbal';

  return 'other';
}

function bandDominanceScore(bands: { low: number; mid: number; high: number }): number {
  const values = [bands.low, bands.mid, bands.high];
  const max = Math.max(...values);
  const sum = bands.low + bands.mid + bands.high + 1e-6;
  return max / sum;
}

function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const start = Math.min(buffer.length, Math.floor(sampleRate * 0.05));
  const maxWindow = Math.min(buffer.length - start, Math.floor(sampleRate * 0.8));
  const windowSize = Math.max(0, maxWindow);
  if (windowSize < sampleRate * 0.1) return null;

  const window = buffer.slice(start, start + windowSize);
  const minLag = Math.floor(sampleRate / 2000);
  const maxLag = Math.floor(sampleRate / 40);

  let bestLag = 0;
  let best = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < window.length - lag; i++) {
      sum += window[i] * window[i + lag];
    }
    if (sum > best) {
      best = sum;
      bestLag = lag;
    }
  }

  if (bestLag === 0 || best <= 0) return null;
  return sampleRate / bestLag;
}

function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToNoteName(midi: number): string {
  const note = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[note]}${octave}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
