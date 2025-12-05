import { describe, it, expect } from 'vitest';
import { classifyAudio } from './classify';

// Helper to create test audio blob
async function createTestBlob(frequency: number, duration: number, sampleRate = 44100): Promise<Blob> {
  const ctx = new OfflineAudioContext(1, duration * sampleRate, sampleRate);
  const osc = ctx.createOscillator();
  osc.frequency.value = frequency;
  osc.connect(ctx.destination);
  osc.start();
  osc.stop(duration);
  
  const buffer = await ctx.startRendering();
  const wav = audioBufferToWav(buffer);
  return new Blob([wav], { type: 'audio/wav' });
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

describe('classifyAudio', () => {
  it.skip('should classify short low-frequency sound as kick', async () => {
    const blob = await createTestBlob(60, 0.3);
    const result = await classifyAudio(blob);
    expect(result.type).toBe('drum_hit');
    expect(result.drumClass).toBe('kick');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it.skip('should classify melodic sound', async () => {
    const blob = await createTestBlob(440, 1.0);
    const result = await classifyAudio(blob);
    expect(result.type).toBe('melodic');
    expect(result.noteName).toBeDefined();
    expect(result.midiNote).toBeDefined();
  });

  it('should return unknown for empty audio', async () => {
    const ctx = new OfflineAudioContext(1, 1000, 44100);
    const buffer = await ctx.startRendering();
    const wav = audioBufferToWav(buffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    
    const result = await classifyAudio(blob);
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('should have confidence between 0 and 1', async () => {
    const blob = await createTestBlob(440, 0.5);
    const result = await classifyAudio(blob);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
