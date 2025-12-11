import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock Web Audio API for tests
class MockAudioContext {
  sampleRate = 44100;
  destination = {};
  
  createGain() {
    return { 
      gain: { 
        value: 1, 
        setValueAtTime: () => {}, 
        linearRampToValueAtTime: () => {}, 
        exponentialRampToValueAtTime: () => {} 
      }, 
      connect: () => {} 
    };
  }
  
  createOscillator() {
    return {
      frequency: { value: 440 },
      detune: { value: 0 },
      type: 'sine',
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
  }
  
  createBufferSource() {
    return {
      buffer: null,
      loop: false,
      playbackRate: { value: 1 },
      connect: () => {},
      start: () => {},
      stop: () => {}
    };
  }
  
  createBiquadFilter() {
    return {
      type: 'lowpass',
      frequency: { value: 1000, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      Q: { value: 1 },
      gain: { value: 0 },
      connect: () => {}
    };
  }
  
  createWaveShaper() {
    return { curve: null, connect: () => {} };
  }
  
  createConvolver() {
    return { buffer: null, connect: () => {} };
  }
  
  createDelay() {
    return { delayTime: { value: 0 }, connect: () => {} };
  }
  
  createDynamicsCompressor() {
    return {
      threshold: { value: -24 },
      ratio: { value: 12 },
      attack: { value: 0.003 },
      release: { value: 0.25 },
      knee: { value: 30 },
      connect: () => {}
    };
  }
  
  createStereoPanner() {
    return { pan: { value: 0 }, connect: () => {} };
  }
  
  createConstantSource() {
    return { offset: { value: 0 }, connect: () => {}, start: () => {} };
  }
  
  createBuffer(channels: number, length: number, sampleRate: number) {
    const buffer = {
      numberOfChannels: channels,
      length,
      sampleRate,
      duration: length / sampleRate,
      getChannelData: () => new Float32Array(length)
    };
    return buffer;
  }
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  decodeAudioData(buffer: ArrayBuffer) {
    return Promise.resolve(this.createBuffer(1, 44100, 44100));
  }
  
  close() {
    return Promise.resolve();
  }
}

class MockOfflineAudioContext extends MockAudioContext {
  private _channels: number;
  private _length: number;
  
  constructor(channels: number, length: number, sampleRate: number) {
    super();
    this._channels = channels;
    this._length = length;
    this.sampleRate = sampleRate;
  }
  
  startRendering() {
    return Promise.resolve(this.createBuffer(this._channels, this._length, this.sampleRate));
  }
}

global.AudioContext = MockAudioContext as any;
global.OfflineAudioContext = MockOfflineAudioContext as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock as any;

// Mock Blob.arrayBuffer
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function() {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(this);
    });
  };
}
