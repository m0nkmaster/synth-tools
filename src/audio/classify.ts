import type { DrumClass, SampleAnalysis, SampleType } from '../types';
import { clamp } from '../utils/array';
import { freqToMidi, midiToNoteName } from '../utils/audio';
import { downmixToMono, normalizeBuffer, trimSilence, computeRMS } from '../utils/dsp';
import { AUDIO, CLASSIFICATION, DRUM_THRESHOLDS, FREQUENCY_BANDS } from '../config';

type Spectrum = {
  magnitudes: Float32Array;
  binHz: number;
};

export async function classifyAudio(blob: Blob): Promise<SampleAnalysis> {
  const AudioCtx = AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();

  try {
    const buffer = await blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));

    const mono = downmixToMono(audioBuffer);
    const normalized = normalizeBuffer(mono);
    const trimmed = trimSilence(normalized, AUDIO.SILENCE_THRESHOLD_DB);

    if (!trimmed.length) {
      return { type: 'unknown', confidence: 0 };
    }

    const sampleRate = audioBuffer.sampleRate;
    const durationSeconds = trimmed.length / sampleRate;
    const rms = computeRMS(trimmed);
    const spectrum = computeSpectrum(trimmed, sampleRate);
    const spectralCentroid = computeSpectralCentroid(spectrum, sampleRate);
    const flatness = computeSpectralFlatness(spectrum);
    const bandEnergy = {
      low: computeBandEnergy(spectrum, sampleRate, 0, FREQUENCY_BANDS.LOW_MAX),
      mid: computeBandEnergy(spectrum, sampleRate, FREQUENCY_BANDS.MID_MIN, FREQUENCY_BANDS.MID_MAX),
      high: computeBandEnergy(spectrum, sampleRate, FREQUENCY_BANDS.HIGH_MIN, sampleRate / 2)
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
    let confidence = Math.min(1, confidenceBoost + rms * CLASSIFICATION.CONFIDENCE_RMS_FACTOR);

    if (sampleType === 'drum_hit') {
      drumClass = classifyDrum({
        centroid: spectralCentroid,
        lowEnergy: bandEnergy.low,
        midEnergy: bandEnergy.mid,
        highEnergy: bandEnergy.high,
        durationSeconds,
        flatness
      });
      confidence = Math.min(1, confidence + flatness * CLASSIFICATION.CONFIDENCE_FLATNESS_FACTOR + bandDominanceScore(bandEnergy) * CLASSIFICATION.CONFIDENCE_BAND_FACTOR);
    } else if (sampleType === 'melodic') {
      const freq = detectPitch(trimmed, sampleRate);
      if (freq) {
        midiNote = Math.round(freqToMidi(freq));
        noteName = midiToNoteName(midiNote);
        confidence = Math.min(1, confidence + (1 - flatness) * CLASSIFICATION.CONFIDENCE_FLATNESS_FACTOR + harmonicConcentration * CLASSIFICATION.CONFIDENCE_HARMONIC_FACTOR);
      } else {
        confidence = Math.max(CLASSIFICATION.CONFIDENCE_MELODIC_MIN, confidence * CLASSIFICATION.CONFIDENCE_MELODIC_PENALTY);
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

function computeSpectrum(buffer: Float32Array, sampleRate: number): Spectrum {
  const fftSize = CLASSIFICATION.FFT_SIZE;
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
  const fftSize = CLASSIFICATION.FFT_SIZE;
  let weighted = 0;
  let total = 0;
  
  for (let i = 0; i < mags.length; i++) {
    const freq = (i * sampleRate) / fftSize;
    weighted += freq * mags[i];
    total += mags[i];
  }
  return total > 0 ? weighted / total : 0;
}

function computeBandEnergy(spectrum: Spectrum, sampleRate: number, low: number, high: number): number {
  const mags = spectrum.magnitudes;
  const binHz = sampleRate / CLASSIFICATION.FFT_SIZE;
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

function decideSampleType(params: {
  durationSeconds: number;
  flatness: number;
  harmonicConcentration: number;
}): { sampleType: SampleType; confidenceBoost: number } {
  const { durationSeconds, flatness, harmonicConcentration } = params;

  const percussive = durationSeconds < CLASSIFICATION.DRUM_HIT_MAX_DURATION && flatness > CLASSIFICATION.FLATNESS_DRUM_THRESHOLD;
  const melodic = harmonicConcentration > CLASSIFICATION.HARMONIC_CONCENTRATION_THRESHOLD && flatness < CLASSIFICATION.FLATNESS_MELODIC_THRESHOLD;

  if (percussive && !melodic) {
    return { sampleType: 'drum_hit', confidenceBoost: CLASSIFICATION.CONFIDENCE_BASE };
  }

  if (melodic) {
    return { sampleType: 'melodic', confidenceBoost: CLASSIFICATION.CONFIDENCE_BASE };
  }

  if (durationSeconds < CLASSIFICATION.DRUM_HIT_EXTENDED_DURATION && flatness > CLASSIFICATION.FLATNESS_DRUM_EXTENDED) {
    return { sampleType: 'drum_hit', confidenceBoost: CLASSIFICATION.CONFIDENCE_EXTENDED };
  }

  return { sampleType: 'unknown', confidenceBoost: CLASSIFICATION.CONFIDENCE_UNKNOWN };
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

  if (lowEnergy > midEnergy && lowEnergy > highEnergy && centroid < DRUM_THRESHOLDS.KICK_CENTROID_MAX) return 'kick';
  if (highEnergy > lowEnergy && highEnergy > midEnergy && centroid > DRUM_THRESHOLDS.HAT_CENTROID_MIN && durationSeconds < DRUM_THRESHOLDS.HAT_DURATION_MAX) return 'hat';
  if (centroid > DRUM_THRESHOLDS.SNARE_CENTROID_MIN && centroid < DRUM_THRESHOLDS.SNARE_CENTROID_MAX && (midEnergy + lowEnergy) > highEnergy * DRUM_THRESHOLDS.SNARE_MID_LOW_RATIO) return 'snare';
  if (highEnergy > DRUM_THRESHOLDS.CYMBAL_HIGH_ENERGY_MIN && durationSeconds > DRUM_THRESHOLDS.CYMBAL_DURATION_MIN) return 'cymbal';

  return 'other';
}

function bandDominanceScore(bands: { low: number; mid: number; high: number }): number {
  const values = [bands.low, bands.mid, bands.high];
  const max = Math.max(...values);
  const sum = bands.low + bands.mid + bands.high + 1e-6;
  return max / sum;
}

function detectPitch(buffer: Float32Array, sampleRate: number): number | null {
  const start = Math.min(buffer.length, Math.floor(sampleRate * CLASSIFICATION.DRUM_HIT_MAX_DURATION));
  const maxWindow = Math.min(buffer.length - start, Math.floor(sampleRate * 0.8));
  const windowSize = Math.max(0, maxWindow);
  if (windowSize < sampleRate * CLASSIFICATION.DRUM_HIT_MAX_DURATION) return null;

  const window = buffer.slice(start, start + windowSize);
  const minLag = Math.floor(sampleRate / DRUM_THRESHOLDS.KICK_CENTROID_MAX);
  const maxLag = Math.floor(sampleRate / DRUM_THRESHOLDS.CYMBAL_DURATION_MIN);

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
