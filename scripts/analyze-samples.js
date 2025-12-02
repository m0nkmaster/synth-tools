#!/usr/bin/env node

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const SAMPLE_DIR = './docs/sample-files/One Shots';

// Simple FFT for spectral analysis
function fft(real) {
  const n = real.length;
  const imag = new Float32Array(n);
  const mag = new Float32Array(n / 2);
  
  for (let k = 0; k < n / 2; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      re += real[t] * Math.cos(angle);
      im += real[t] * Math.sin(angle);
    }
    mag[k] = Math.sqrt(re * re + im * im) / n;
  }
  return mag;
}

function analyzeWav(buffer) {
  const view = new DataView(buffer);
  
  // Parse WAV header
  const numChannels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const dataOffset = 44;
  const dataSize = view.getUint32(40, true);
  
  // Extract samples (convert to mono float32)
  const numSamples = dataSize / (bitsPerSample / 8) / numChannels;
  const samples = new Float32Array(numSamples);
  
  for (let i = 0; i < numSamples; i++) {
    let sum = 0;
    for (let ch = 0; ch < numChannels; ch++) {
      const offset = dataOffset + (i * numChannels + ch) * (bitsPerSample / 8);
      let sample = 0;
      if (bitsPerSample === 16) {
        sample = view.getInt16(offset, true) / 32768;
      } else if (bitsPerSample === 24) {
        const byte1 = view.getUint8(offset);
        const byte2 = view.getUint8(offset + 1);
        const byte3 = view.getInt8(offset + 2);
        sample = ((byte3 << 16) | (byte2 << 8) | byte1) / 8388608;
      }
      sum += sample;
    }
    samples[i] = sum / numChannels;
  }
  
  const duration = numSamples / sampleRate;
  
  // RMS energy
  const rms = Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);
  
  // Peak amplitude
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  
  // Zero crossing rate
  let zcr = 0;
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      zcr++;
    }
  }
  zcr = zcr / samples.length;
  
  // FFT analysis (use first 2048 samples)
  const fftSize = 2048;
  const fftInput = new Float32Array(fftSize);
  for (let i = 0; i < Math.min(fftSize, samples.length); i++) {
    fftInput[i] = samples[i];
  }
  const spectrum = fft(fftInput);
  
  // Spectral centroid
  let weightedSum = 0, totalMag = 0;
  for (let k = 0; k < spectrum.length; k++) {
    const freq = k * sampleRate / fftSize;
    weightedSum += freq * spectrum[k];
    totalMag += spectrum[k];
  }
  const centroid = totalMag > 0 ? weightedSum / totalMag : 0;
  
  // Band energies
  const getBandEnergy = (lowHz, highHz) => {
    const lowBin = Math.floor(lowHz * fftSize / sampleRate);
    const highBin = Math.ceil(highHz * fftSize / sampleRate);
    let bandEnergy = 0;
    for (let k = lowBin; k <= highBin && k < spectrum.length; k++) {
      bandEnergy += spectrum[k];
    }
    return totalMag > 0 ? bandEnergy / totalMag : 0;
  };
  
  const subBass = getBandEnergy(20, 60);      // Sub bass
  const bass = getBandEnergy(60, 250);        // Bass
  const lowMid = getBandEnergy(250, 500);     // Low mid
  const mid = getBandEnergy(500, 2000);       // Mid
  const highMid = getBandEnergy(2000, 6000);  // High mid
  const high = getBandEnergy(6000, 20000);    // High
  
  // Attack time (time to reach 50% of peak)
  const threshold = peak * 0.5;
  let attackSamples = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) >= threshold) {
      attackSamples = i;
      break;
    }
  }
  const attackTime = attackSamples / sampleRate;
  
  // Decay time (time from peak to 10% of peak)
  let peakIdx = 0;
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) === peak) {
      peakIdx = i;
      break;
    }
  }
  const decayThreshold = peak * 0.1;
  let decaySamples = 0;
  for (let i = peakIdx; i < samples.length; i++) {
    if (Math.abs(samples[i]) <= decayThreshold) {
      decaySamples = i - peakIdx;
      break;
    }
  }
  const decayTime = decaySamples / sampleRate;
  
  return {
    duration,
    rms,
    peak,
    zcr,
    centroid,
    subBass,
    bass,
    lowMid,
    mid,
    highMid,
    high,
    attackTime,
    decayTime
  };
}

async function main() {
  const files = await readdir(SAMPLE_DIR);
  const wavFiles = files.filter(f => f.endsWith('.wav'));
  
  const results = { kick: [], snare: [], hat: [], perc: [] };
  
  for (const file of wavFiles) {
    const buffer = await readFile(join(SAMPLE_DIR, file));
    const features = analyzeWav(buffer.buffer);
    
    let type = 'perc';
    if (file.includes('Kick')) type = 'kick';
    else if (file.includes('Snare')) type = 'snare';
    else if (file.includes('Hat')) type = 'hat';
    else if (file.includes('Perc')) type = 'perc';
    
    results[type].push({ file, ...features });
  }
  
  // Calculate averages and ranges for each type
  console.log('\n=== ANALYSIS RESULTS ===\n');
  
  for (const [type, samples] of Object.entries(results)) {
    if (samples.length === 0) continue;
    
    console.log(`\n${type.toUpperCase()} (${samples.length} samples):`);
    console.log('─'.repeat(60));
    
    const features = ['duration', 'rms', 'peak', 'zcr', 'centroid', 'subBass', 'bass', 'lowMid', 'mid', 'highMid', 'high', 'attackTime', 'decayTime'];
    
    for (const feat of features) {
      const values = samples.map(s => s[feat]);
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      console.log(`  ${feat.padEnd(12)}: avg=${avg.toFixed(4)} min=${min.toFixed(4)} max=${max.toFixed(4)}`);
    }
  }
  
  // Generate classification rules
  console.log('\n\n=== SUGGESTED CLASSIFICATION RULES ===\n');
  
  for (const [type, samples] of Object.entries(results)) {
    if (samples.length === 0) continue;
    
    const avg = (feat) => samples.reduce((sum, s) => sum + s[feat], 0) / samples.length;
    
    console.log(`${type}:`);
    console.log(`  bass: ${avg('bass').toFixed(3)}, subBass: ${avg('subBass').toFixed(3)}`);
    console.log(`  mid: ${avg('mid').toFixed(3)}, highMid: ${avg('highMid').toFixed(3)}, high: ${avg('high').toFixed(3)}`);
    console.log(`  centroid: ${avg('centroid').toFixed(0)} Hz`);
    console.log(`  duration: ${avg('duration').toFixed(3)}s, attack: ${avg('attackTime').toFixed(4)}s`);
    console.log(`  zcr: ${avg('zcr').toFixed(4)}`);
    console.log('');
  }
}

main().catch(console.error);
