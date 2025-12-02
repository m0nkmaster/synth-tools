export type SampleType = 'kick' | 'snare' | 'hihat' | 'cymbal' | 'tom' | 'clap' | 'cowbell' | 'perc' | 'synth' | 'other';

export async function classifyAudio(file: File): Promise<SampleType> {
  const ctx = new AudioContext();
  try {
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const sr = audio.sampleRate;
    
    const fftSize = 2048;
    const centroid = computeCentroid(data, sr, fftSize);
    const zcr = computeZCR(data);
    
    const bass = computeBandEnergy(data, sr, 60, 250, fftSize);
    const subBass = computeBandEnergy(data, sr, 20, 60, fftSize);
    const highMid = computeBandEnergy(data, sr, 2000, 6000, fftSize);
    const high = computeBandEnergy(data, sr, 6000, 20000, fftSize);
    
    // Based on analysis of sample files:
    // kick: bass=0.346, subBass=0.153, centroid=3613Hz, zcr=0.013
    // snare: bass=0.095, highMid=0.408, high=0.343, centroid=5452Hz, zcr=0.116
    // hat: high=0.792, centroid=10383Hz, zcr=0.360
    // perc: high=0.409, centroid=6111Hz, zcr=0.148
    
    if (high > 0.7 && centroid > 8000 && zcr > 0.25) return 'hihat';
    if (bass > 0.25 && subBass > 0.1 && centroid < 4500) return 'kick';
    if (highMid > 0.35 && high > 0.3 && zcr > 0.08 && centroid > 4500 && centroid < 7000) return 'snare';
    if (high > 0.35 && centroid > 5500) return 'perc';
    if (bass > 0.15 && centroid < 5000) return 'tom';
    
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

function computeZCR(data: Float32Array): number {
  let zcr = 0;
  for (let i = 1; i < data.length; i++) {
    if ((data[i] >= 0 && data[i - 1] < 0) || (data[i] < 0 && data[i - 1] >= 0)) {
      zcr++;
    }
  }
  return zcr / data.length;
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
