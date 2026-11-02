// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMicLevel } from "./useMicLevel";

const analyser = { id: "analyser" };
const stopTrack = vi.fn();
const closeContext = vi.fn().mockResolvedValue(undefined);
const getUserMedia = vi.fn();

class FakeAudioContext {
  createMediaStreamSource = () => ({ connect: vi.fn() });
  createAnalyser = () => analyser;
  close = closeContext;
}

beforeEach(() => {
  stopTrack.mockClear();
  closeContext.mockClear();
  getUserMedia.mockReset();
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  vi.stubGlobal("AudioContext", FakeAudioContext);
  Object.defineProperty(window, "AudioContext", { value: FakeAudioContext, configurable: true });
  Object.defineProperty(navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useMicLevel", () => {
  it("[success] returns an analyser while active", async () => {
    const { result } = renderHook(() => useMicLevel(true));
    await waitFor(() => expect(result.current).toBe(analyser));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it("[success] does not open the mic while inactive", () => {
    const { result } = renderHook(() => useMicLevel(false));
    expect(result.current).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("[success] releases tracks and context when it goes inactive", async () => {
    const { result, rerender } = renderHook(({ on }) => useMicLevel(on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(result.current).toBe(analyser));
    rerender({ on: false });
    expect(result.current).toBeNull();
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(closeContext).toHaveBeenCalledTimes(1);
  });

  it("[success] releases on unmount", async () => {
    const { result, unmount } = renderHook(() => useMicLevel(true));
    await waitFor(() => expect(result.current).toBe(analyser));
    unmount();
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(closeContext).toHaveBeenCalledTimes(1);
  });

  it("[success] stops a stream that resolves after unmount", async () => {
    let resolve!: (stream: unknown) => void;
    getUserMedia.mockReturnValue(new Promise((r) => { resolve = r; }));
    const { unmount } = renderHook(() => useMicLevel(true));
    unmount();
    await act(async () => resolve({ getTracks: () => [{ stop: stopTrack }] }));
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it("[invalid] a denied permission returns null without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const { result } = renderHook(() => useMicLevel(true));
    await waitFor(() => expect(warn).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("[success] falls back to webkitAudioContext when AudioContext is missing", async () => {
    Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitAudioContext", {
      value: FakeAudioContext,
      configurable: true,
    });
    const { result } = renderHook(() => useMicLevel(true));
    await waitFor(() => expect(result.current).toBe(analyser));
  });

  it("[invalid] opens nothing when no audio context exists", () => {
    Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitAudioContext", { value: undefined, configurable: true });
    const { result } = renderHook(() => useMicLevel(true));
    expect(result.current).toBeNull();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
