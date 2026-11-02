/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const browser = vi.hoisted(() => ({
  supported: true,
  state: "idle",
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@/hooks/useSpeechDictation", () => ({
  useSpeechDictation: () => ({
    supported: browser.supported,
    state: browser.state,
    interim: "",
    start: browser.start,
    stop: browser.stop,
    error: null,
  }),
}));
const micLevel = vi.hoisted(() => ({
  analyser: null as unknown,
  calls: [] as boolean[],
}));
vi.mock("@/hooks/useMicLevel", () => ({
  useMicLevel: (active: boolean) => {
    micLevel.calls.push(active);
    return active ? micLevel.analyser : null;
  },
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
  browser.supported = true;
  browser.state = "idle";
  micLevel.analyser = null;
  micLevel.calls = [];
  setGrok({});
});
afterEach(cleanup);

describe("MicButton with the AI engine", () => {
  it("starts AI dictation on click and shows the AI privacy note", () => {
    render(<MicButton onInsertText={vi.fn()} />);
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("relay-speech-note").textContent).toContain("aiPrivacyNote");
  });

  it("shows the meter only while AI records, and a second click stops", () => {
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

  it("uses one stream in AI mode: the browser meter hook stays inactive", () => {
    const analyser = { fftSize: 32, getByteTimeDomainData: vi.fn() };
    setGrok({ state: "recording", analyser });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(micLevel.calls.every((active) => active === false)).toBe(true);
  });

  it("keeps AI while recording even if the status turns unconfigured", () => {
    grok.sttConfigured = false;
    setGrok({ state: "recording" });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.getByTestId("relay-mic").getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the meter in browser mode while listening", () => {
    grok.sttConfigured = false;
    browser.state = "listening";
    micLevel.analyser = { fftSize: 32, getByteTimeDomainData: vi.fn() };
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.getByTestId("relay-mic-meter")).toBeTruthy();
    expect(micLevel.calls).toContain(true);
  });

  it("hides the mic when neither engine can dictate", () => {
    grok.sttConfigured = false;
    browser.supported = false;
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.queryByTestId("relay-mic")).toBeNull();
  });

  it("shows the error with Retry that resends the kept recording", () => {
    setGrok({ state: "error", error: "unavailable", canRetry: true });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.getByTestId("relay-mic-error").textContent).toContain("aiErrors.unavailable");
    fireEvent.click(screen.getByTestId("relay-mic-retry"));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the limit notice when the recording hit the length cap", () => {
    setGrok({ limitReached: true });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.getByTestId("relay-mic-limit").textContent).toBe("limitReached");
  });

  it("hides the AI limit notice while the browser engine is active", () => {
    grok.sttConfigured = false;
    setGrok({ limitReached: true });
    render(<MicButton onInsertText={vi.fn()} />);
    expect(screen.queryByTestId("relay-mic-limit")).toBeNull();
  });

  it("falls back to the browser engine when AI transcription is not configured", () => {
    grok.sttConfigured = false;
    render(<MicButton onInsertText={vi.fn()} />);
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(start).not.toHaveBeenCalled();
  });

  it("uses the browser engine while the status is still loading", () => {
    grok.sttConfigured = null;
    render(<MicButton onInsertText={vi.fn()} />);
    const mic = screen.getByTestId("relay-mic");
    fireEvent.click(mic);
    expect(browser.start).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
  });

  it("keeps the browser engine mid-listen when the status turns AI-usable", () => {
    grok.sttConfigured = true;
    browser.state = "listening";
    const { rerender } = render(<MicButton onInsertText={vi.fn()} />);
    const mic = screen.getByTestId("relay-mic");
    expect(mic.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(mic);
    expect(browser.stop).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();

    browser.state = "idle";
    rerender(<MicButton onInsertText={vi.fn()} />);
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(start).toHaveBeenCalledTimes(1);
    expect(browser.start).not.toHaveBeenCalled();
  });

  it("shows the generic upstream-auth text with no Settings pointer", () => {
    setGrok({ state: "error", error: "upstreamAuth" });
    render(<MicButton onInsertText={vi.fn()} />);
    const error = screen.getByTestId("relay-mic-error");
    expect(error.textContent).toContain("aiErrors.upstreamAuth");
    expect(error.textContent).not.toMatch(/settings/i);
  });
});
