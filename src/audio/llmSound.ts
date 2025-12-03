const SAMPLE_RATE = 44100;
const MAX_DURATION = 6;
const MIN_DURATION = 1;

type ToneProfile = {
  baseFrequency: number;
  metallicity: number;
  noiseAmount: number;
  shimmerAmount: number;
  waterAmount: number;
  reverbMix: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  creativity: number;
  highlights: string[];
};

type LlmSound = {
  samples: Float32Array;
  sampleRate: number;
  durationSeconds: number;
  explanation: string[];
  highlights: string[];
  prompt: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashPrompt(prompt: string): number {
  let hash = 2166136261;
  for (let i = 0; i < prompt.length; i++) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function parseDescriptors(prompt: string): {
  baseFrequency: number;
  metallicity: number;
  noiseAmount: number;
  shimmerAmount: number;
  waterAmount: number;
  reverbMix: number;
  highlights: string[];
} {
  const lower = prompt.toLowerCase();
  const highlights: string[] = [];

  let baseFrequency = 220;
  if (lower.includes('kick')) {
    baseFrequency = 60;
    highlights.push('low kick fundamental');
  } else if (lower.includes('snare')) {
    baseFrequency = 180;
    highlights.push('snare-like crack');
  } else if (lower.includes('bass')) {
    baseFrequency = 110;
    highlights.push('bass foundation');
  } else if (lower.includes('synth')) {
    baseFrequency = 330;
    highlights.push('synth voice lead');
  } else if (lower.includes('pad')) {
    baseFrequency = 240;
    highlights.push('pad bed');
  }

  let metallicity = lower.includes('metal') || lower.includes('brass') ? 0.7 : 0.2;
  let noiseAmount = lower.includes('noise') || lower.includes('snare') ? 0.6 : 0.25;
  let shimmerAmount = lower.includes('reverb') || lower.includes('hall') ? 0.35 : 0.15;
  let waterAmount = lower.includes('water') ? 0.6 : 0.15;
  let reverbMix = lower.includes('reverb') ? 0.45 : 0.2;

  if (lower.includes('dry')) {
    reverbMix *= 0.35;
  }

  if (lower.includes('crisp')) {
    metallicity = clamp(metallicity + 0.2, 0, 1);
    highlights.push('crisp transient');
  }
  if (lower.includes('warm')) {
    metallicity = clamp(metallicity - 0.2, 0, 1);
    reverbMix = clamp(reverbMix - 0.05, 0, 1);
    highlights.push('warm tone');
  }
  if (lower.includes('airy')) {
    noiseAmount = clamp(noiseAmount + 0.15, 0, 1);
    highlights.push('airy layers');
  }
  if (lower.includes('analog')) {
    shimmerAmount = clamp(shimmerAmount + 0.1, 0, 1);
    highlights.push('analog wobble');
  }

  return {
    baseFrequency,
    metallicity,
    noiseAmount,
    shimmerAmount,
    waterAmount,
    reverbMix,
    highlights
  };
}

export function buildToneProfile(prompt: string, creativity: number, requestedDuration: number): { profile: ToneProfile; durationSeconds: number } {
  const normalizedPrompt = prompt.trim() || 'open-textured synth hit';
  const clampedCreativity = clamp(creativity, 0, 1);
  const descriptors = parseDescriptors(normalizedPrompt);
  const seededRandom = mulberry32(hashPrompt(normalizedPrompt));
  const drift = (seededRandom() - 0.5) * clampedCreativity;

  const durationSeconds = clamp(requestedDuration || 3, MIN_DURATION, MAX_DURATION);
  const attack = 0.02 + clampedCreativity * 0.03;
  const decay = 0.15 + clampedCreativity * 0.2;
  const sustain = 0.55 - clampedCreativity * 0.1;
  const release = 0.35 + clampedCreativity * 0.25;

  const profile: ToneProfile = {
    baseFrequency: descriptors.baseFrequency * (1 + drift * 0.5),
    metallicity: clamp(descriptors.metallicity + drift * 0.2, 0, 1),
    noiseAmount: clamp(descriptors.noiseAmount + drift * 0.1, 0.05, 0.9),
    shimmerAmount: clamp(descriptors.shimmerAmount + drift * 0.1, 0, 0.8),
    waterAmount: clamp(descriptors.waterAmount + Math.abs(drift) * 0.1, 0, 0.8),
    reverbMix: clamp(descriptors.reverbMix + Math.abs(drift) * 0.1, 0, 0.9),
    attack,
    decay,
    sustain,
    release,
    creativity: clampedCreativity,
    highlights: descriptors.highlights
  };

  return { profile, durationSeconds };
}

function envelopeValue(t: number, duration: number, profile: ToneProfile): number {
  const { attack, decay, sustain, release } = profile;
  if (t < attack) return t / attack;
  if (t < attack + decay) {
    const progress = (t - attack) / decay;
    return 1 - progress * (1 - sustain);
  }
  if (t < duration - release) return sustain;
  const releaseTime = duration - t;
  return clamp((releaseTime / release) * sustain, 0, 1);
}

function synthesizeSample(profile: ToneProfile, durationSeconds: number, sampleRate: number, seed: number): Float32Array {
  const totalSamples = Math.floor(durationSeconds * sampleRate);
  const output = new Float32Array(totalSamples);
  const random = mulberry32(seed);
  const lfoRate = 0.35 + profile.creativity * 0.6;
  const shimmerRate = 4 + profile.shimmerAmount * 10;
  const reverbDelay = Math.max(1, Math.floor(sampleRate * (0.015 + profile.reverbMix * 0.07)));
  const reverbBuffer = new Float32Array(reverbDelay).fill(0);
  const metallicSkew = profile.metallicity * 0.8 + 0.2;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const env = envelopeValue(t, durationSeconds, profile);
    const vibrato = Math.sin(2 * Math.PI * lfoRate * t) * 3 * (0.4 + profile.creativity * 0.6);
    const shimmer = Math.sin(2 * Math.PI * shimmerRate * t) * profile.shimmerAmount;
    const harmonic = 2 * ((t * profile.baseFrequency + vibrato / 12) % 1) - 1;
    const tone = (harmonic * metallicSkew + Math.sin(2 * Math.PI * profile.baseFrequency * t + vibrato)) / (1 + metallicSkew);
    const waterRipple = Math.sin(2 * Math.PI * (0.9 + profile.waterAmount * 1.7) * t + shimmer) * profile.waterAmount * 0.5;
    const noise = (random() * 2 - 1) * profile.noiseAmount * 0.7;

    const dry = (tone + noise + waterRipple) * env;
    const reverbSample = reverbBuffer[i % reverbDelay];
    const wet = dry + reverbSample * profile.reverbMix;

    reverbBuffer[i % reverbDelay] = dry + reverbSample * 0.35;
    output[i] = wet;
  }

  let peak = 0;
  for (let i = 0; i < output.length; i++) {
    const abs = Math.abs(output[i]);
    if (abs > peak) peak = abs;
  }
  const normalizer = peak > 0.99 ? 0.99 / peak : 1;
  if (normalizer !== 1) {
    for (let i = 0; i < output.length; i++) {
      output[i] *= normalizer;
    }
  }

  return output;
}

export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const data = new Uint8Array(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      data[offset + i] = str.charCodeAt(i);
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = clamp(samples[i], -1, 1);
    const intSample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

function buildExplanation(prompt: string, profile: ToneProfile, durationSeconds: number): string[] {
  const primaryLine = `I interpreted "${prompt}" as a blend of ${profile.baseFrequency.toFixed(0)}Hz body with ${Math.round(profile.noiseAmount * 100)}% noise and ${Math.round(profile.reverbMix * 100)}% space.`;
  const secondaryLine = `To capture that mood, I layered metallic overtones at ${Math.round(profile.metallicity * 100)}% intensity, water-like ripples, and a ${durationSeconds.toFixed(1)}s envelope so it breathes like a designed instrument.`;
  return [primaryLine, secondaryLine];
}

export function createLlmSound(prompt: string, requestedDuration: number, creativity: number): LlmSound {
  const { profile, durationSeconds } = buildToneProfile(prompt, creativity, requestedDuration);
  const seed = hashPrompt(prompt) ^ Math.floor(creativity * 1000);
  const samples = synthesizeSample(profile, durationSeconds, SAMPLE_RATE, seed);
  const explanation = buildExplanation(prompt.trim() || 'open-textured synth hit', profile, durationSeconds);
  const highlights = profile.highlights.length ? profile.highlights : ['layered harmonics', 'textured noise'];

  return {
    samples,
    sampleRate: SAMPLE_RATE,
    durationSeconds,
    explanation,
    highlights,
    prompt: prompt.trim() || 'open-textured synth hit'
  };
}
