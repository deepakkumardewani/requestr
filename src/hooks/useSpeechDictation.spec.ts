/** @vitest-environment happy-dom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useSpeechDictation } from "./useSpeechDictation";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static startError: Error | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn(() => {
    if (FakeRecognition.startError) throw FakeRecognition.startError;
  });
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
}

type Seg = [text: string, isFinal: boolean];
function emit(rec: FakeRecognition, segs: Seg[], resultIndex = 0) {
  const results = segs.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } }));
  rec.onresult?.({ resultIndex, results });
}

const w = window as unknown as Record<string, unknown>;

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.startError = null;
  useSettingsStore.setState({ locale: "en" });
});

afterEach(() => {
  cleanup();
  delete w.SpeechRecognition;
  delete w.webkitSpeechRecognition;
  vi.restoreAllMocks();
});

function setup() {
  const onTranscript = vi.fn();
  const hook = renderHook(() => useSpeechDictation({ onTranscript }));
  return { onTranscript, ...hook };
}

describe("useSpeechDictation support detection", () => {
  it("is unsupported when neither global exists", () => {
    const { result } = setup();
    expect(result.current.supported).toBe(false);
    act(() => result.current.start());
    expect(result.current.state).toBe("idle");
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("is supported with the unprefixed global", () => {
    w.SpeechRecognition = FakeRecognition;
    expect(setup().result.current.supported).toBe(true);
  });

  it("is supported with the webkit-prefixed global", () => {
    w.webkitSpeechRecognition = FakeRecognition;
    expect(setup().result.current.supported).toBe(true);
  });
});

describe("useSpeechDictation recognition", () => {
  beforeEach(() => {
    w.SpeechRecognition = FakeRecognition;
  });

  it.each([
    ["en", "en-US"],
    ["fr", "fr-FR"],
    ["ja", "ja-JP"],
  ] as const)("uses lang %s -> %s and continuous interim mode", (locale, lang) => {
    useSettingsStore.setState({ locale });
    const { result } = setup();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    expect(rec.lang).toBe(lang);
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(true);
    expect(rec.start).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe("listening");
  });

  it("streams interim text and accumulates final text", () => {
    const { result, onTranscript } = setup();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];

    act(() => emit(rec, [["hel", false]]));
    expect(result.current.interim).toBe("hel");
    expect(onTranscript).toHaveBeenLastCalledWith({ final: "", interim: "hel" });

    act(() => emit(rec, [["hello ", true], ["wor", false]]));
    expect(onTranscript).toHaveBeenLastCalledWith({ final: "hello ", interim: "wor" });
    expect(result.current.interim).toBe("wor");

    act(() => emit(rec, [["hello ", true], ["world", true]], 1));
    expect(onTranscript).toHaveBeenLastCalledWith({ final: "hello world", interim: "" });
    expect(result.current.interim).toBe("");
  });

  it("ignores a second start while listening", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => result.current.start());
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("stop() asks the recognizer to stop and end returns to idle", () => {
    const { result } = setup();
    act(() => result.current.stop());
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => emit(rec, [["hi", false]]));
    act(() => result.current.stop());
    expect(rec.stop).toHaveBeenCalledTimes(1);
    act(() => rec.onend?.());
    expect(result.current.state).toBe("idle");
    expect(result.current.interim).toBe("");
    expect(result.current.error).toBeNull();
  });

  it.each([
    ["not-allowed", "denied"],
    ["service-not-allowed", "denied"],
    ["no-speech", "noSpeech"],
    ["audio-capture", "noMic"],
    ["network", "network"],
    ["bad-grammar", "unknown"],
  ] as const)("maps recognizer error %s to %s", (code, expected) => {
    const { result } = setup();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => rec.onerror?.({ error: code }));
    expect(result.current.error).toBe(expected);
    expect(result.current.state).toBe("error");
  });

  it("goes idle after error then end, keeping the error code", () => {
    const { result } = setup();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    act(() => rec.onerror?.({ error: "network" }));
    act(() => rec.onend?.());
    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBe("network");
  });

  it("clears the previous error on a new start", () => {
    const { result } = setup();
    act(() => result.current.start());
    act(() => FakeRecognition.instances[0].onerror?.({ error: "network" }));
    act(() => result.current.start());
    expect(result.current.error).toBeNull();
    expect(result.current.state).toBe("listening");
  });

  it("an end from a replaced session does not reset the new one", () => {
    const { result } = setup();
    act(() => result.current.start());
    const first = FakeRecognition.instances[0];
    act(() => first.onerror?.({ error: "network" }));
    act(() => result.current.start());
    const second = FakeRecognition.instances[1];
    act(() => first.onend?.());
    expect(result.current.state).toBe("listening");
    act(() => second.onend?.());
    expect(result.current.state).toBe("idle");
  });

  it("reports unknown and returns to idle when start() throws", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    FakeRecognition.startError = new Error("already started");
    const { result } = setup();
    act(() => result.current.start());
    expect(result.current.state).toBe("idle");
    expect(result.current.error).toBe("unknown");
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("aborts and detaches handlers on unmount while listening", () => {
    const { result, unmount, onTranscript } = setup();
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    unmount();
    expect(rec.abort).toHaveBeenCalledTimes(1);
    expect(rec.onresult).toBeNull();
    expect(rec.onerror).toBeNull();
    expect(rec.onend).toBeNull();
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("unmounting while idle does not touch any recognizer", () => {
    const { unmount } = setup();
    unmount();
    expect(FakeRecognition.instances).toHaveLength(0);
  });
});
