import { STT_LEVEL_BARS, STT_LEVEL_UPDATE_MS } from "@/lib/relay/constants";

/** Speech RMS rarely exceeds this, so it maps to a full bar. */
const FULL_SCALE_RMS = 0.3;
const BYTE_CENTER = 128;
const BYTE_RANGE = 128;

/** Root-mean-square of time-domain bytes (128 = silence), in 0..1. */
export function rmsFromBytes(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let sum = 0;
  for (const byte of data) {
    const centered = (byte - BYTE_CENTER) / BYTE_RANGE;
    sum += centered * centered;
  }
  return Math.sqrt(sum / data.length);
}

/** Bar levels in 0..1: bar i lights up proportionally once the RMS passes its step. */
export function levelBarsFromRms(
  rms: number,
  bars: number = STT_LEVEL_BARS,
): number[] {
  const scaled = Math.min(1, rms / FULL_SCALE_RMS) * bars;
  return Array.from({ length: bars }, (_, index) =>
    Math.max(0, Math.min(1, scaled - index)),
  );
}

/** Samples the analyser every STT_LEVEL_UPDATE_MS; returns a stop function. */
export function startLevelMeter(
  analyser: AnalyserNode,
  onLevels: (levels: number[]) => void,
): () => void {
  const data = new Uint8Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(data);
    onLevels(levelBarsFromRms(rmsFromBytes(data)));
  }, STT_LEVEL_UPDATE_MS);
  return () => clearInterval(timer);
}
