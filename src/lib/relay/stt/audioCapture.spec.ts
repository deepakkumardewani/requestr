// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isCaptureSupported, startCapture } from "./audioCapture";

type Fake = {
  context: ReturnType<typeof makeContext>;
  track: { stop: ReturnType<typeof vi.fn> };
};

function makeContext(sampleRate: number, withWorklet: boolean) {
  const node = {
    port: {} as { onmessage?: (e: { data: Float32Array }) => void },
    onaudioprocess: undefined as
      | undefined
      | ((e: {
          inputBuffer: { getChannelData: () => Float32Array };
        }) => void),
    disconnect: vi.fn(),
    connect: vi.fn(),
  };
  return {
    sampleRate,
    destination: {},
    node,
    close: vi.fn(() => Promise.resolve()),
    createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
    createAnalyser: vi.fn(() => ({ id: "analyser" })),
    createScriptProcessor: vi.fn(() => node),
    audioWorklet: withWorklet
      ? { addModule: vi.fn(() => Promise.resolve()) }
      : undefined,
  };
}

const w = window as unknown as Record<string, unknown>;
const original = {
  AudioContext: w.AudioContext,
  webkitAudioContext: w.webkitAudioContext,
  AudioWorkletNode: (globalThis as Record<string, unknown>).AudioWorkletNode,
};
const mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "mediaDevices",
);

function install(options: {
  worklet: boolean;
  sampleRate?: number;
  getUserMedia?: () => Promise<unknown>;
}): Fake {
  const context = makeContext(options.sampleRate ?? 16000, options.worklet);
  const track = { stop: vi.fn() };
  w.AudioContext = vi.fn(function () {
    return context;
  });
  if (options.worklet) {
    vi.stubGlobal(
      "AudioWorkletNode",
      vi.fn(function () {
        return context.node;
      }),
    );
  } else {
    vi.stubGlobal("AudioWorkletNode", undefined);
  }
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia:
        options.getUserMedia ??
        vi.fn(() => Promise.resolve({ getTracks: () => [track] })),
    },
  });
  return { context, track };
}

beforeEach(() => vi.useFakeTimers());

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  w.AudioContext = original.AudioContext;
  w.webkitAudioContext = original.webkitAudioContext;
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  } else {
    delete (navigator as unknown as Record<string, unknown>).mediaDevices;
  }
});

describe("isCaptureSupported", () => {
  it("is false without any AudioContext", () => {
    install({ worklet: true });
    w.AudioContext = undefined;
    w.webkitAudioContext = undefined;
    expect(isCaptureSupported()).toBe(false);
  });

  it("is false without getUserMedia", () => {
    install({ worklet: true });
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
    expect(isCaptureSupported()).toBe(false);
  });

  it("is true when AudioWorkletNode exists", () => {
    install({ worklet: true });
    expect(isCaptureSupported()).toBe(true);
  });

  it("falls back to createScriptProcessor when no worklet exists", () => {
    install({ worklet: false });
    const Ctor = w.AudioContext as { prototype: Record<string, unknown> };
    Ctor.prototype.createScriptProcessor = () => ({});
    expect(isCaptureSupported()).toBe(true);
  });

  it("is false with neither worklet nor script processor", () => {
    install({ worklet: false });
    expect(isCaptureSupported()).toBe(false);
  });

  it("uses webkitAudioContext when AudioContext is missing", () => {
    install({ worklet: true });
    w.webkitAudioContext = w.AudioContext;
    w.AudioContext = undefined;
    expect(isCaptureSupported()).toBe(true);
  });
});

describe("startCapture", () => {
  it("throws when Web Audio is unavailable", async () => {
    install({ worklet: true });
    w.AudioContext = undefined;
    w.webkitAudioContext = undefined;
    await expect(startCapture({ onLimit: vi.fn() })).rejects.toThrow(
      "Web Audio is not available",
    );
  });

  it("rejects with the browser error before building an audio graph", async () => {
    const denied = new DOMException("denied", "NotAllowedError");
    install({ worklet: true, getUserMedia: () => Promise.reject(denied) });
    await expect(startCapture({ onLimit: vi.fn() })).rejects.toBe(denied);
    expect(w.AudioContext).not.toHaveBeenCalled();
  });

  it("captures via the worklet and encodes a 16 kHz WAV on stop", async () => {
    const { context, track } = install({ worklet: true, sampleRate: 16000 });
    const session = await startCapture({ onLimit: vi.fn() });

    expect(context.audioWorklet?.addModule).toHaveBeenCalledWith(
      "/relay-stt-worklet.js",
    );
    expect(session.analyser).toEqual({ id: "analyser" });
    context.node.port.onmessage?.({ data: new Float32Array(8000) });
    context.node.port.onmessage?.({ data: new Float32Array(8000) });

    const result = await session.stop();
    expect(result.durationMs).toBe(1000);
    expect(result.blob.type).toBe("audio/wav");
    expect(result.blob.size).toBe(44 + 32000);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(context.node.disconnect).toHaveBeenCalledTimes(1);
  });

  it("resamples from the context rate down to 16 kHz", async () => {
    const { context } = install({ worklet: true, sampleRate: 48000 });
    const session = await startCapture({ onLimit: vi.fn() });
    context.node.port.onmessage?.({ data: new Float32Array(48000) });
    const result = await session.stop();
    expect(result.durationMs).toBe(1000);
  });

  it("falls back to a ScriptProcessor connected to the destination", async () => {
    const { context } = install({ worklet: false });
    const session = await startCapture({ onLimit: vi.fn() });

    expect(context.createScriptProcessor).toHaveBeenCalledWith(4096, 1, 1);
    expect(context.node.connect).toHaveBeenCalledWith(context.destination);
    context.node.onaudioprocess?.({
      inputBuffer: { getChannelData: () => new Float32Array(1600) },
    });
    const result = await session.stop();
    expect(result.durationMs).toBe(100);
  });

  it("falls back when AudioWorkletNode exists but audioWorklet does not", async () => {
    const { context } = install({ worklet: true });
    (context as { audioWorklet: unknown }).audioWorklet = undefined;
    await startCapture({ onLimit: vi.fn() });
    expect(context.createScriptProcessor).toHaveBeenCalled();
  });

  it("fires onLimit at 120 s and still delivers audio via stop", async () => {
    const { context } = install({ worklet: true });
    const onLimit = vi.fn();
    const session = await startCapture({ onLimit });
    context.node.port.onmessage?.({ data: new Float32Array(1600) });

    vi.advanceTimersByTime(119_999);
    expect(onLimit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLimit).toHaveBeenCalledTimes(1);

    const result = await session.stop();
    expect(result.durationMs).toBe(100);
  });

  it("abort releases resources, cancels the cap timer, and is idempotent", async () => {
    const { context, track } = install({ worklet: true });
    const onLimit = vi.fn();
    const session = await startCapture({ onLimit });

    session.abort();
    session.abort();
    vi.advanceTimersByTime(200_000);

    expect(onLimit).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it("ignores chunks that arrive after the session ended", async () => {
    const { context } = install({ worklet: true });
    const session = await startCapture({ onLimit: vi.fn() });
    session.abort();
    context.node.port.onmessage?.({ data: new Float32Array(1600) });
    const result = await session.stop();
    expect(result.durationMs).toBe(0);
  });

  it("releases the mic and rethrows when graph setup fails", async () => {
    const { context, track } = install({ worklet: true });
    const failure = new Error("module failed");
    context.audioWorklet!.addModule = vi.fn(() => Promise.reject(failure));
    await expect(startCapture({ onLimit: vi.fn() })).rejects.toBe(failure);
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
