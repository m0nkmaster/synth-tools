const SAMPLE_RATE = 44100;
const MAX_DURATION = 6;
const MIN_DURATION = 1;
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'of', 'with', 'on', 'for', 'in', 'it', 'that', 'this', 'style', 'like', 'make', 'makes'
]);

const MODEL_DIMS = { input: 16, hidden: 24, output: 3 };

type ToneProfile = {
  baseFrequency: number;
  bodyColor: number;
  noiseAmount: number;
  shimmerAmount: number;
  spaceAmount: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  creativity: number;
  highlights: string[];
  embedding: Float32Array;
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

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function createRandom(randomFn?: () => number): () => number {
  if (randomFn) return randomFn;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buffer = new Uint32Array(1);
    return () => {
      crypto.getRandomValues(buffer);
      return buffer[0] / 0xffffffff;
    };
  }
  return Math.random;
}

function tokenize(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word && !STOP_WORDS.has(word));
}

function promptColor(prompt: string): number {
  let hash = 2166136261;
  for (let i = 0; i < prompt.length; i++) {
    hash ^= prompt.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function embedPrompt(prompt: string, creativity: number): { embedding: Float32Array; imagery: string[] } {
  const tokens = tokenize(prompt);
  const dims = MODEL_DIMS.input;
  const embedding = new Float32Array(dims);
  const imagery: string[] = [];

  if (!tokens.length) {
    embedding[0] = 0.2 + creativity * 0.5;
    return { embedding, imagery };
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const base = promptColor(token) * 2 - 1;
    const idx = (i * 3) % dims;
    embedding[idx] += base * (0.6 + creativity * 0.4);
    embedding[(idx + 1) % dims] += Math.sin(base * Math.PI) * 0.5;
    embedding[(idx + 2) % dims] += Math.cos(base * Math.PI * 0.5) * 0.4;
    if (imagery.length < 5) imagery.push(`imagery spark: ${token}`);
  }

  if (imagery.length < 5) {
    const last = tokens[tokens.length - 1];
    if (!imagery.some((item) => item.includes(last))) {
      imagery.push(`imagery spark: ${last}`);
    }
  }

  const norm = Math.max(1, Math.sqrt(embedding.reduce((acc, v) => acc + v * v, 0)));
  for (let i = 0; i < embedding.length; i++) {
    embedding[i] = (embedding[i] / norm) * (0.6 + creativity * 0.4);
  }

  return { embedding, imagery };
}

function gestureHints(prompt: string): { attackBias: number; releaseBias: number; sustainBias: number; highlights: string[] } {
  const lower = prompt.toLowerCase();
  const highlights: string[] = [];
  let attackBias = 0;
  let releaseBias = 0;
  let sustainBias = 0;

  if (lower.includes('stab') || lower.includes('hit')) {
    attackBias -= 0.02;
    releaseBias -= 0.04;
    highlights.push('punchy gesture');
  }
  if (lower.includes('drone') || lower.includes('swell') || lower.includes('bloom')) {
    attackBias += 0.03;
    sustainBias += 0.18;
    releaseBias += 0.08;
    highlights.push('long swell');
  }
  if (lower.includes('ambient') || lower.includes('wash')) {
    sustainBias += 0.06;
    releaseBias += 0.05;
  }

  return { attackBias, releaseBias, sustainBias, highlights };
}

function initWeights(length: number, seed: number, scale: number): Float32Array {
  const random = mulberry32(seed);
  const weights = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    weights[i] = (random() * 2 - 1) * scale;
  }
  return weights;
}

const MODEL_WEIGHTS = {
  Wxh: initWeights(MODEL_DIMS.input * MODEL_DIMS.hidden, 1337, 0.35),
  Whh: initWeights(MODEL_DIMS.hidden * MODEL_DIMS.hidden, 2333, 0.22),
  Why: initWeights(MODEL_DIMS.hidden * MODEL_DIMS.output, 3777, 0.28),
  bh: initWeights(MODEL_DIMS.hidden, 4661, 0.05),
  by: initWeights(MODEL_DIMS.output, 8123, 0.1)
};

type NeuralControls = {
  tone: Float32Array;
  noise: Float32Array;
  air: Float32Array;
};

function neuralStep(input: Float32Array, state: Float32Array, random: () => number): Float32Array {
  const { hidden, input: inputSize } = MODEL_DIMS;
  const next = new Float32Array(hidden);

  for (let h = 0; h < hidden; h++) {
    let sum = MODEL_WEIGHTS.bh[h] + (random() - 0.5) * 0.02;
    for (let i = 0; i < inputSize; i++) {
      sum += input[i] * MODEL_WEIGHTS.Wxh[h * inputSize + i];
    }
    for (let j = 0; j < hidden; j++) {
      sum += state[j] * MODEL_WEIGHTS.Whh[h * hidden + j];
    }
    next[h] = Math.tanh(sum);
  }

  return next;
}

function runNeuralTexture(embedding: Float32Array, frames: number, random: () => number): NeuralControls {
  const { hidden, output } = MODEL_DIMS;
  const state = new Float32Array(hidden);
  const tone = new Float32Array(frames);
  const noise = new Float32Array(frames);
  const air = new Float32Array(frames);
  const input = new Float32Array(MODEL_DIMS.input);

  for (let frame = 0; frame < frames; frame++) {
    for (let i = 0; i < embedding.length; i++) {
      const wobble = Math.sin((frame / frames) * Math.PI * (1 + i * 0.05));
      input[i] = embedding[i] + wobble * 0.05 + (random() - 0.5) * 0.01;
    }

    const nextState = neuralStep(input, state, random);
    state.set(nextState);

    for (let o = 0; o < output; o++) {
      let sum = MODEL_WEIGHTS.by[o];
      for (let h = 0; h < hidden; h++) {
        sum += state[h] * MODEL_WEIGHTS.Why[o * hidden + h];
      }
      const value = Math.tanh(sum);
      if (o === 0) tone[frame] = value;
      if (o === 1) noise[frame] = value;
      if (o === 2) air[frame] = value;
    }
  }

  return { tone, noise, air };
}

function parseDescriptors(prompt: string): { base: number; bodyColor: number; highlights: string[] } {
  const lower = prompt.toLowerCase();
  const highlights: string[] = [];
  let base = 220;
  if (lower.includes('kick')) base = 60;
  if (lower.includes('snare')) base = 170;
  if (lower.includes('bass')) base = 110;
  if (lower.includes('synth')) base = 330;
  if (lower.includes('pad')) base = 240;

  if (lower.includes('metal')) highlights.push('metal shine');
  if (lower.includes('water')) highlights.push('water ripple');
  if (lower.includes('squirrel')) highlights.push('playful imagery');

  const bodyColor = promptColor(prompt) * 2 - 1;

  return { base, bodyColor, highlights };
}

export function buildToneProfile(
  prompt: string,
  creativity: number,
  requestedDuration: number,
  randomFn?: () => number
): { profile: ToneProfile; durationSeconds: number } {
  const normalizedPrompt = prompt.trim() || 'open-textured synth hit';
  const clampedCreativity = clamp(creativity, 0, 1);
  const random = createRandom(randomFn);
  const { embedding, imagery } = embedPrompt(normalizedPrompt, clampedCreativity);
  const { base, bodyColor, highlights: descriptorHighlights } = parseDescriptors(normalizedPrompt);
  const gestures = gestureHints(normalizedPrompt);
  const colorTilt = promptColor(normalizedPrompt) - 0.5;

  const bodyWander = (random() - 0.5) * (0.4 + clampedCreativity * 0.6) + colorTilt * 0.2;
  const shimmerBend = (random() - 0.5) * (0.3 + clampedCreativity * 0.5);

  const durationSeconds = clamp(requestedDuration || 3, MIN_DURATION, MAX_DURATION);
  const attack = clamp(0.02 + clampedCreativity * 0.05 + gestures.attackBias, 0.005, 0.2);
  const decay = 0.18 + clampedCreativity * 0.24;
  const sustain = clamp(0.58 - clampedCreativity * 0.1 + gestures.sustainBias, 0.25, 0.9);
  const release = clamp(0.34 + clampedCreativity * 0.3 + gestures.releaseBias, 0.18, 1.2);

  const highlights = [
    ...descriptorHighlights,
    ...imagery,
    ...gestures.highlights,
    'neural timbre sculpting'
  ];

  const profile: ToneProfile = {
    baseFrequency: base * (1 + bodyWander * 0.4),
    bodyColor,
    noiseAmount: clamp(0.28 + Math.abs(bodyWander) * 0.25, 0.05, 0.95),
    shimmerAmount: clamp(0.18 + shimmerBend * 0.4 + clampedCreativity * 0.3, 0, 0.95),
    spaceAmount: clamp(0.22 + Math.abs(shimmerBend) * 0.25 + colorTilt * 0.15, 0, 0.95),
    attack,
    decay,
    sustain,
    release,
    creativity: clampedCreativity,
    embedding,
    highlights
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function renderNeuralSound(
  profile: ToneProfile,
  durationSeconds: number,
  sampleRate: number,
  controls: NeuralControls,
  random: () => number
): Float32Array {
  const totalSamples = Math.floor(durationSeconds * sampleRate);
  const output = new Float32Array(totalSamples);
  const frameSize = 256;
  const totalFrames = controls.tone.length;
  const reverbDelay = Math.max(1, Math.floor(sampleRate * (0.02 + profile.spaceAmount * 0.1)));
  const reverbBuffer = new Float32Array(reverbDelay);

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const framePos = (i / frameSize) % totalFrames;
    const frameIndex = Math.floor(framePos);
    const nextFrame = (frameIndex + 1) % totalFrames;
    const frameT = framePos - frameIndex;

    const tone = lerp(controls.tone[frameIndex], controls.tone[nextFrame], frameT);
    const noise = lerp(controls.noise[frameIndex], controls.noise[nextFrame], frameT);
    const air = lerp(controls.air[frameIndex], controls.air[nextFrame], frameT);

    const env = envelopeValue(t, durationSeconds, profile);
    const pitch = profile.baseFrequency * (1 + tone * 0.35 + profile.bodyColor * 0.1);
    const shimmer = Math.sin(2 * Math.PI * (4 + profile.shimmerAmount * 10) * t) * profile.shimmerAmount;
    const harmonic = Math.sin(2 * Math.PI * pitch * t + shimmer);
    const harsh = Math.sin(2 * Math.PI * pitch * 2 * t + Math.cos(t * 0.5)) * 0.4 * (0.5 + profile.shimmerAmount);
    const texturedNoise = (random() * 2 - 1) * (0.35 + noise * 0.4 + profile.noiseAmount * 0.4);
    const airy = Math.sin(2 * Math.PI * (0.7 + air * 0.5) * t) * 0.4 * (0.5 + profile.spaceAmount * 0.6);

    const dry = (harmonic + harsh + texturedNoise + airy) * env * 0.6;
    const reverbSample = reverbBuffer[i % reverbDelay];
    const wet = dry + reverbSample * (0.35 + profile.spaceAmount * 0.5);
    reverbBuffer[i % reverbDelay] = dry + reverbSample * 0.4;

    output[i] = wet;
  }

  let peak = 0;
  for (let i = 0; i < output.length; i++) {
    peak = Math.max(peak, Math.abs(output[i]));
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
  const primaryLine = `I let the embedded neural painter improvise around "${prompt}" with a ${durationSeconds.toFixed(1)}s envelope and ${Math.round(
    profile.spaceAmount * 100
  )}% space.`;
  const textureLine = `Tone leans on a ${profile.baseFrequency.toFixed(0)}Hz body, ${Math.round(profile.noiseAmount * 100)}% textured noise, and shimmer pushed by learned gesture hints.`;
  const narrativeLine = profile.highlights.find((h) => h.startsWith('imagery spark'))
    ? `Imagery cues like ${profile.highlights.filter((h) => h.startsWith('imagery spark')).map((h) => h.replace('imagery spark: ', '')).join(', ')} steered the AI toward unexpected harmonics.`
    : 'Each render is an on-device neural pass, so repeats feel like new performances while staying tied to your words.';
  return [primaryLine, textureLine, narrativeLine];
}

export function createLlmSound(
  prompt: string,
  requestedDuration: number,
  creativity: number,
  randomFn?: () => number
): LlmSound {
  const random = createRandom(randomFn);
  const { profile, durationSeconds } = buildToneProfile(prompt, creativity, requestedDuration, random);
  const frameCount = Math.max(32, Math.floor((durationSeconds * SAMPLE_RATE) / 256));
  const controls = runNeuralTexture(profile.embedding, frameCount, random);
  const samples = renderNeuralSound(profile, durationSeconds, SAMPLE_RATE, controls, random);
  const explanation = buildExplanation(prompt.trim() || 'open-textured synth hit', profile, durationSeconds);
  const highlights = profile.highlights.length ? profile.highlights : ['neural timbre sculpting'];

  return {
    samples,
    sampleRate: SAMPLE_RATE,
    durationSeconds,
    explanation,
    highlights,
    prompt: prompt.trim() || 'open-textured synth hit'
  };
}
