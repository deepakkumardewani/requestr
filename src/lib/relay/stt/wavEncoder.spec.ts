import { describe, expect, it } from "vitest";
import { encodeWav, resample } from "./wavEncoder";

const ascii = (view: DataView, offset: number, length: number) =>
  String.fromCharCode(
    ...Array.from({ length }, (_, i) => view.getUint8(offset + i)),
  );

describe("encodeWav", () => {
  it("writes a mono PCM16 RIFF header for the given rate", () => {
    const view = new DataView(encodeWav(new Float32Array(3), 16000));
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(28, true)).toBe(32000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getUint32(4, true)).toBe(36 + 6);
  });

  it("sizes the buffer as 44 header bytes plus 2 per sample", () => {
    expect(encodeWav(new Float32Array(10), 8000).byteLength).toBe(64);
  });

  it("returns a header-only file for empty input", () => {
    const buffer = encodeWav(new Float32Array(0), 8000);
    expect(buffer.byteLength).toBe(44);
    expect(new DataView(buffer).getUint32(40, true)).toBe(0);
  });

  it("scales samples to int16 and clips out-of-range values", () => {
    const view = new DataView(
      encodeWav(new Float32Array([0, 1, -1, 2, -3, 0.5]), 16000),
    );
    const at = (i: number) => view.getInt16(44 + i * 2, true);
    expect([at(0), at(1), at(2), at(3), at(4)]).toEqual([
      0, 32767, -32768, 32767, -32768,
    ]);
    expect(at(5)).toBe(16383);
  });
});

describe("resample", () => {
  it("returns the same array when rates match", () => {
    const input = new Float32Array([1, 2, 3]);
    expect(resample(input, 16000, 16000)).toBe(input);
  });

  it("returns empty input untouched", () => {
    const input = new Float32Array(0);
    expect(resample(input, 48000)).toBe(input);
  });

  it("downsamples 3:1 by picking every third sample", () => {
    const input = new Float32Array([0, 1, 2, 3, 4, 5]);
    expect(Array.from(resample(input, 48000, 16000))).toEqual([0, 3]);
  });

  it("interpolates linearly between neighbours", () => {
    const input = new Float32Array([0, 10, 20, 30]);
    const out = resample(input, 3, 2);
    expect(out.length).toBe(2);
    expect(out[0]).toBeCloseTo(0);
    expect(out[1]).toBeCloseTo(15);
  });

  it("upsamples and clamps the upper index at the last sample", () => {
    const out = resample(new Float32Array([0, 1]), 8000, 16000);
    expect(Array.from(out)).toEqual([0, 0.5, 1, 1]);
  });

  it("defaults the target to the 16 kHz STT rate", () => {
    expect(resample(new Float32Array(48), 48000).length).toBe(16);
  });
});
