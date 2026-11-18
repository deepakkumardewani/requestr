import { STT_SAMPLE_RATE } from "@/lib/relay/constants";

const WAV_HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const PCM_FORMAT = 1;
const FMT_CHUNK_BYTES = 16;
const INT16_MAX = 0x7fff;
const INT16_MIN_MAGNITUDE = 0x8000;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function writeHeader(view: DataView, dataBytes: number, rate: number): void {
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, WAV_HEADER_BYTES - 8 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, FMT_CHUNK_BYTES, true);
  view.setUint16(20, PCM_FORMAT, true);
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);
}

/** Packs float samples in [-1, 1] into a mono PCM16 WAV; out-of-range samples clip. */
export function encodeWav(samples: Float32Array, rate: number): ArrayBuffer {
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);
  writeHeader(view, dataBytes, rate);
  samples.forEach((sample, index) => {
    const clipped = Math.max(-1, Math.min(1, sample));
    const value =
      clipped < 0 ? clipped * INT16_MIN_MAGNITUDE : clipped * INT16_MAX;
    view.setInt16(WAV_HEADER_BYTES + index * BYTES_PER_SAMPLE, value, true);
  });
  return buffer;
}

/** Linear-interpolation resample to the STT rate; returns the input when rates match. */
export function resample(
  samples: Float32Array,
  fromRate: number,
  toRate: number = STT_SAMPLE_RATE,
): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const lower = Math.floor(position);
    const upper = Math.min(lower + 1, samples.length - 1);
    const weight = position - lower;
    out[i] = samples[lower] * (1 - weight) + samples[upper] * weight;
  }
  return out;
}
