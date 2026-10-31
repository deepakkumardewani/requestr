/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { MicButton } from "./MicButton";

const grok = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
  sttConfigured: true as boolean | null,
}));
vi.mock("@/hooks/useGrokDictation", () => ({
  useGrokDictation: () => grok.value,
}));
vi.mock("@/hooks/useSttConfigured", () => ({
  useSttConfigured: () => grok.sttConfigured,
}));
vi.mock("@/hooks/useSpeechDictation", () => ({
  useSpeechDictation: () => ({
    supported: true,
    state: "idle",
    interim: "",
    start: vi.fn(),
    stop: vi.fn(),
    error: null,
  }),
}));

const start = vi.fn();
const stop = vi.fn();
const retry = vi.fn();

function setGrok(overrides: Record<string, unknown>) {
  grok.value = {
    supported: true,
    state: "idle",
    error: null,
    limitReached: false,
    analyser: null,
    canRetry: false,
    start,
    stop,
    retry,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  grok.sttConfigured = true;
  useRelayStore.setState({ speechEngine: "grok" });
  setGrok({});
});
afterEach(cleanup);

describe("MicButton with the Grok engine", () => {
  it("starts Grok on click and shows the Grok privacy note", () => {
    render(<MicButton onInsertText={vi.fn()} />);
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("relay-speech-note").textContent).toContain("grokPrivacyNote");
  });

  it("shows the meter only while Grok records, and a second click stops", () => {
    const analyser = {
      fftSize: 32,
      getByteTimeDomainData: vi.fn(),
    } as unknown as AnalyserNode;
    setGrok({ state: "recording", analyser });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.getByTestId("relay-mic-meter")).toBeTruthy();
    expect(screen.getAllByTestId("relay-mic-meter-bar")).toHaveLength(5);
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("disables the button and shows Transcribing while uploading", () => {
    setGrok({ state: "transcribing" });
    render(<MicButton onInsertText={vi.fn()} />);
    expect((screen.getByTestId("relay-mic") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("relay-mic-transcribing").textContent).toBe("transcribing");
    expect(screen.queryByTestId("relay-mic-meter")).toBeNull();
  });

  it("shows the error with Retry that resends the kept recording", () => {
    setGrok({ state: "error", error: "unavailable", canRetry: true });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.getByTestId("relay-mic-error").textContent).toContain("grokErrors.unavailable");
    fireEvent.click(screen.getByTestId("relay-mic-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the limit notice when the recording hit the length cap", () => {
    setGrok({ limitReached: true });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.getByTestId("relay-mic-limit").textContent).toBe("limitReached");
  });

  it("hides the Grok limit notice while the browser engine is active", () => {
    grok.sttConfigured = false;
    setGrok({ limitReached: true });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.queryByTestId("relay-mic-limit")).toBeNull();
  });

  it("falls back to the browser engine when Grok is not configured", () => {
    grok.sttConfigured = false;
    render(<MicButton onInsertText={vi.fn()} />);
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(start).not.toHaveBeenCalled();
  });
});
