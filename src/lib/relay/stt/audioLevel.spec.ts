import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { levelBarsFromRms, rmsFromBytes, startLevelMeter } from "./audioLevel";

describe("rmsFromBytes", () => {
  it("is 0 for empty input", () => {
    expect(rmsFromBytes(new Uint8Array(0))).toBe(0);
  });

  it("is 0 for silence (128)", () => {
    expect(rmsFromBytes(new Uint8Array(8).fill(128))).toBe(0);
  });

  it("is 1 for minimum-byte signal", () => {
    expect(rmsFromBytes(new Uint8Array(4))).toBe(1);
  });

  it("computes RMS of a half-scale signal", () => {
    expect(rmsFromBytes(new Uint8Array([192, 64]))).toBeCloseTo(0.5);
  });
});

describe("levelBarsFromRms", () => {
  it("returns five dark bars for silence", () => {
    expect(levelBarsFromRms(0)).toEqual([0, 0, 0, 0, 0]);
  });

  it("lights every bar at and beyond full scale", () => {
    expect(levelBarsFromRms(0.3)).toEqual([1, 1, 1, 1, 1]);
    expect(levelBarsFromRms(5)).toEqual([1, 1, 1, 1, 1]);
  });

  it("lights bars proportionally at mid level", () => {
    const bars = levelBarsFromRms(0.15);
    expect(bars.slice(0, 2)).toEqual([1, 1]);
    expect(bars[2]).toBeCloseTo(0.5);
    expect(bars.slice(3)).toEqual([0, 0]);
  });

  it("honours a custom bar count", () => {
    expect(levelBarsFromRms(0.3, 3)).toEqual([1, 1, 1]);
  });
});

describe("startLevelMeter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("samples every 100 ms and stops when asked", () => {
    const analyser = {
      fftSize: 4,
      getByteTimeDomainData: vi.fn((data: Uint8Array) => data.fill(128 + 50)),
    } as unknown as AnalyserNode;
    const onLevels = vi.fn();
    const stop = startLevelMeter(analyser, onLevels);

    expect(onLevels).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onLevels).toHaveBeenCalledTimes(1);
    expect(onLevels.mock.calls[0][0]).toHaveLength(5);
    expect(onLevels.mock.calls[0][0]).toEqual([1, 1, 1, 1, 1]);

    stop();
    vi.advanceTimersByTime(500);
    expect(onLevels).toHaveBeenCalledTimes(1);
  });
});
