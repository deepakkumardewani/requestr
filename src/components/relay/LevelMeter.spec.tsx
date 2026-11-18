/** @vitest-environment happy-dom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STT_LEVEL_BARS, STT_LEVEL_UPDATE_MS } from "@/lib/relay/constants";
import { LevelMeter } from "./LevelMeter";

const FFT_SIZE = 32;
const SILENCE_BYTE = 128;
const LOUD_BYTE = 255;

/** An analyser whose time-domain samples are a constant byte, which fixes the RMS. */
function makeAnalyser(byte: number) {
  const analyser = {
    fftSize: FFT_SIZE,
    getByteTimeDomainData: vi.fn((data: Uint8Array) => data.fill(byte)),
  };
  return analyser as unknown as AnalyserNode & typeof analyser;
}

const barHeights = () =>
  screen
    .getAllByTestId("relay-mic-meter-bar")
    .map((bar) => (bar as HTMLElement).style.height);

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LevelMeter", () => {
  it("renders one decorative bar per level, all at the minimum while silent", () => {
    render(<LevelMeter analyser={makeAnalyser(SILENCE_BYTE)} />);

    expect(screen.getByTestId("relay-mic-meter")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(barHeights()).toEqual(Array(STT_LEVEL_BARS).fill("15%"));
  });

  it("grows every bar to full height when the microphone is loud", () => {
    render(<LevelMeter analyser={makeAnalyser(LOUD_BYTE)} />);

    act(() => {
      vi.advanceTimersByTime(STT_LEVEL_UPDATE_MS);
    });

    expect(barHeights()).toEqual(Array(STT_LEVEL_BARS).fill("100%"));
  });

  it("stops sampling the analyser after unmount", () => {
    const analyser = makeAnalyser(SILENCE_BYTE);
    const { unmount } = render(<LevelMeter analyser={analyser} />);
    act(() => {
      vi.advanceTimersByTime(STT_LEVEL_UPDATE_MS);
    });
    const callsBeforeUnmount = analyser.getByteTimeDomainData.mock.calls.length;

    unmount();
    vi.advanceTimersByTime(STT_LEVEL_UPDATE_MS * 3);

    expect(callsBeforeUnmount).toBe(1);
    expect(analyser.getByteTimeDomainData).toHaveBeenCalledTimes(
      callsBeforeUnmount,
    );
  });
});
