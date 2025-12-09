import type { DrumMetadata } from '../types';
import { padArray } from '../utils/array';
import { encodePositions } from '../utils/opz';
import { MAX_SLICES, OPZ_DEFAULTS } from '../constants';

type ChunkInfo = {
  id: string;
  offset: number;
  size: number;
};

export type AiffParseResult = {
  chunks: ChunkInfo[];
  numFrames: number;
  formSize: number;
  sampleRate?: number;
};

function readString(buf: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...buf.slice(offset, offset + length));
}

function writeUInt32BE(buf: Uint8Array, offset: number, value: number) {
  buf[offset] = (value >>> 24) & 0xff;
  buf[offset + 1] = (value >>> 16) & 0xff;
  buf[offset + 2] = (value >>> 8) & 0xff;
  buf[offset + 3] = value & 0xff;
}

export function parseAiff(buf: Uint8Array): AiffParseResult {
  const type = readString(buf, 8, 4);
  if (readString(buf, 0, 4) !== 'FORM' || (type !== 'AIFF' && type !== 'AIFC')) {
    throw new Error('Invalid AIFF/AIFC header');
  }

  const formSize =
    (buf[4] << 24) | (buf[5] << 16) | (buf[6] << 8) | buf[7];

  const chunks: ChunkInfo[] = [];
  let pos = 12;
  const len = buf.length;

  while (pos + 8 <= len) {
    const id = readString(buf, pos, 4);
    const size =
      (buf[pos + 4] << 24) |
      (buf[pos + 5] << 16) |
      (buf[pos + 6] << 8) |
      buf[pos + 7];
    chunks.push({ id, offset: pos, size });
    pos += 8 + size;
    if (size % 2 === 1) pos += 1; // pad byte
  }

  const comm = chunks.find((c) => c.id === 'COMM');
  if (!comm) throw new Error('Missing COMM chunk');
  const view = new DataView(
    buf.buffer,
    buf.byteOffset + comm.offset,
    comm.size + 8
  );
  // COMM chunk: offset 0-3 = "COMM", 4-7 = size, 8-9 = channels, 10-13 = numFrames
  const numFrames = view.getUint32(10, false);

  // Parse sample rate from 80-bit extended float (bytes 16-25 from chunk start)
  // COMM chunk: 0-3="COMM", 4-7=size, 8-9=channels, 10-13=numFrames, 14-15=sampleSize, 16-25=sampleRate
  let sampleRate: number | undefined;
  if (comm.size >= 18) {
    const sampleRateBytes = new Uint8Array(
      buf.buffer,
      buf.byteOffset + comm.offset + 16,
      10
    );
    // IEEE 80-bit extended float: sign (1 bit) + exponent (15 bits) + mantissa (64 bits)
    const sign = (sampleRateBytes[0] & 0x80) ? -1 : 1;
    const exponent = ((sampleRateBytes[0] & 0x7f) << 8) | sampleRateBytes[1];
    const expValue = exponent - 16383; // bias

    // Extract mantissa (64 bits, stored as big-endian)
    // Mantissa is stored as an integer, representing the fractional part
    let mantissa = 0;
    for (let i = 2; i < 10; i++) {
      mantissa = mantissa * 256 + sampleRateBytes[i];
    }

    // Convert mantissa to fraction: mantissa / 2^64
    // Value = sign * (1 + mantissa/2^64) * 2^(exponent - 16383)
    if (expValue >= -1022 && expValue <= 1023 && exponent !== 0) {
      const mantissaFraction = mantissa / Math.pow(2, 64);
      sampleRate = sign * (1 + mantissaFraction) * Math.pow(2, expValue);
      // Round to nearest integer for common sample rates
      sampleRate = Math.round(sampleRate);
    } else if (exponent === 0 && mantissa === 0) {
      // Zero value
      sampleRate = 0;
    }
  }

  return { chunks, numFrames, formSize, sampleRate };
}

function buildDrumMetadataChunk(
  startFrames: number[],
  endFrames: number[],
  metadata: DrumMetadata
): Uint8Array {
  const start = padArray(startFrames, MAX_SLICES, 0);
  const end = padArray(endFrames, MAX_SLICES, 0);
  const positionsStart = encodePositions(start);
  const positionsEnd = encodePositions(end);

  const payloadObj: Record<string, unknown> = {
    drum_version: metadata.drumVersion,
    type: 'drum',
    name: metadata.name,
    octave: metadata.octave,
    pitch: padArray(metadata.pitch ?? [], MAX_SLICES, OPZ_DEFAULTS.PITCH),
    start: positionsStart,
    end: positionsEnd,
    playmode: padArray(metadata.playmode ?? [], MAX_SLICES, OPZ_DEFAULTS.PLAYMODE),
    reverse: padArray(metadata.reverse ?? [], MAX_SLICES, OPZ_DEFAULTS.REVERSE),
    volume: padArray(metadata.volume ?? [], MAX_SLICES, OPZ_DEFAULTS.VOLUME),
    dyna_env: [0, 8192, 0, 8192, 0, 0, 0, 0],
    fx_active: false,
    fx_type: 'delay',
    fx_params: new Array(8).fill(8000),
    lfo_active: false,
    lfo_type: 'tremolo',
    lfo_params: [16000, 16000, 16000, 16000, 0, 0, 0, 0]
  };

  if (metadata.drumVersion >= 3) {
    payloadObj.dyna_env = [0, 8192, 0, 0, 0, 0, 0, 0];
    payloadObj.editable = true;
    payloadObj.lfo_params = [0, 0, 0, 0, 0, 0, 0, 0];
  }

  const jsonStr = JSON.stringify(payloadObj);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const payload = new Uint8Array(4 + jsonBytes.length);
  payload.set([0x6f, 0x70, 0x2d, 0x31], 0); // 'op-1'
  payload.set(jsonBytes, 4);
  const pad = payload.length % 2 === 1 ? 1 : 0;
  const chunkSize = payload.length;

  const chunk = new Uint8Array(8 + chunkSize + pad);
  chunk.set([0x41, 0x50, 0x50, 0x4c], 0); // 'APPL'
  writeUInt32BE(chunk, 4, chunkSize);
  chunk.set(payload, 8);
  if (pad) chunk[8 + chunkSize] = 0;

  return chunk;
}

export function injectDrumMetadata(
  aiff: Uint8Array,
  startFrames: number[],
  endFrames: number[],
  metadata: DrumMetadata
): Uint8Array {
  const { chunks, formSize } = parseAiff(aiff);
  const ssndChunk = chunks.find((c) => c.id === 'SSND');
  const insertPos = ssndChunk ? ssndChunk.offset : aiff.length;

  const metadataChunk = buildDrumMetadataChunk(
    startFrames,
    endFrames,
    metadata
  );

  const result = new Uint8Array(aiff.length + metadataChunk.length);
  result.set(aiff.slice(0, insertPos), 0);
  result.set(metadataChunk, insertPos);
  result.set(aiff.slice(insertPos), insertPos + metadataChunk.length);

  const newFormSize = formSize + metadataChunk.length;
  writeUInt32BE(result, 4, newFormSize);

  return result;
}
