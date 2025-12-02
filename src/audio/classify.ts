export type SampleType = 'kick' | 'snare' | 'hihat' | 'cymbal' | 'tom' | 'clap' | 'cowbell' | 'perc' | 'synth' | 'other';

export async function classifyAudio(file: File): Promise<SampleType> {
  const ctx = new AudioContext();
  try {
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const sr = audio.sampleRate;
    
    // Spectral centroid (brightness)
    const fftSize = 2048;
    const centroid = computeCentroid(data, sr, fftSize);
    
    // RMS energy
    const rms = Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    
    // Duration
    const duration = audio.duration;
    
    // Low-frequency energy (20-150 Hz)
    const lowEnergy = computeBandEnergy(data, sr, 20, 150, fftSize);
    
    // Mid energy (150-1000 Hz)
    const midEnergy = computeBandEnergy(data, sr, 150, 1000, fftSize);
    
    // High energy (>5000 Hz)
    const highEnergy = computeBandEnergy(data, sr, 5000, sr / 2, fftSize);
    
    // Classification heuristics
    if (lowEnergy > 0.6 && duration < 0.5 && centroid < 300) return 'kick';
    if (highEnergy > 0.5 && duration < 0.2) return 'hihat';
    if (highEnergy > 0.4 && duration > 0.3) return 'cymbal';
    if (midEnergy > 0.5 && highEnergy > 0.3 && duration < 0.3) return 'snare';
    if (lowEnergy > 0.4 && midEnergy > 0.3 && duration < 0.6) return 'tom';
    if (midEnergy > 0.5 && duration < 0.15) return 'clap';
    if (centroid > 800 && centroid < 2000 && duration < 0.4) return 'cowbell';
    if (duration > 0.5 && rms > 0.1) return 'synth';
    if (duration < 0.5) return 'perc';
    
    return 'other';
  } finally {
    ctx.close();
  }
}

function computeCentroid(data: Float32Array, sr: number, fftSize: number): number {
  const spectrum = new Float32Array(fftSize / 2);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);
  
  for (let i = 0; i < Math.min(fftSize, data.length); i++) {
    real[i] = data[i];
  }
  
  // Simple magnitude spectrum
  for (let k = 0; k < fftSize / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = -2 * Math.PI * k * n / fftSize;
      re += real[n] * Math.cos(angle);
      im += real[n] * Math.sin(angle);
    }
    spectrum[k] = Math.sqrt(re * re + im * im);
  }
  
  let weightedSum = 0, totalMag = 0;
  for (let k = 0; k < spectrum.length; k++) {
    const freq = k * sr / fftSize;
    weightedSum += freq * spectrum[k];
    totalMag += spectrum[k];
  }
  
  return totalMag > 0 ? weightedSum / totalMag : 0;
}

function computeBandEnergy(data: Float32Array, sr: number, lowHz: number, highHz: number, fftSize: number): number {
  const spectrum = new Float32Array(fftSize / 2);
  const real = new Float32Array(fftSize);
  
  for (let i = 0; i < Math.min(fftSize, data.length); i++) {
    real[i] = data[i];
  }
  
  for (let k = 0; k < fftSize / 2; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < fftSize; n++) {
      const angle = -2 * Math.PI * k * n / fftSize;
      re += real[n] * Math.cos(angle);
      im += real[n] * Math.sin(angle);
    }
    spectrum[k] = Math.sqrt(re * re + im * im);
  }
  
  const lowBin = Math.floor(lowHz * fftSize / sr);
  const highBin = Math.ceil(highHz * fftSize / sr);
  
  let bandEnergy = 0, totalEnergy = 0;
  for (let k = 0; k < spectrum.length; k++) {
    const mag = spectrum[k];
    totalEnergy += mag;
    if (k >= lowBin && k <= highBin) {
      bandEnergy += mag;
    }
  }
  
  return totalEnergy > 0 ? bandEnergy / totalEnergy : 0;
}
