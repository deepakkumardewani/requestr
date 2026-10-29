/** @vitest-environment happy-dom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MicButton } from "./MicButton";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
}

const w = window as unknown as Record<string, unknown>;
const rec = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];

function say(segs: Array<[string, boolean]>) {
  act(() =>
    rec().onresult?.({
      resultIndex: 0,
      results: segs.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })),
    }),
  );
}

function setup({ disabled = false }: { disabled?: boolean } = {}) {
  const onInsertText = vi.fn();
  render(<MicButton onInsertText={onInsertText} disabled={disabled} />);
  return { onInsertText };
}

beforeEach(() => {
  FakeRecognition.instances = [];
  w.SpeechRecognition = FakeRecognition;
});

afterEach(() => {
  cleanup();
  delete w.SpeechRecognition;
  delete w.webkitSpeechRecognition;
});

// The shared next-intl test mock only resolves root namespaces, so nested relay
// keys render as their key; real copy is guarded by the relayMessages parity spec.
describe("MicButton", () => {
  it("renders null when speech recognition is unsupported", () => {
    delete w.SpeechRecognition;
    setup();
    expect(screen.queryByTestId("relay-mic")).toBeNull();
  });

  it("is a non-pressed start button when idle", () => {
    setup();
    const mic = screen.getByTestId("relay-mic");
    expect(mic.getAttribute("aria-pressed")).toBe("false");
    expect(mic.getAttribute("aria-label")).toBe("start");
  });

  it("respects disabled", () => {
    setup({ disabled: true });
    expect((screen.getByTestId("relay-mic") as HTMLButtonElement).disabled).toBe(true);
  });

  it("click starts listening: pressed, stop label, pulse and status", () => {
    setup();
    fireEvent.click(screen.getByTestId("relay-mic"));
    const mic = screen.getByTestId("relay-mic");
    expect(mic.getAttribute("aria-pressed")).toBe("true");
    expect(mic.getAttribute("aria-label")).toBe("stop");
    expect(screen.getByTestId("relay-mic-pulse")).toBeTruthy();
    expect(screen.getAllByRole("status").map((n) => n.textContent)).toContain("listening");
  });

  it("hands each finalized phrase over once, and holds interim words back", () => {
    const { onInsertText } = setup();
    fireEvent.click(screen.getByTestId("relay-mic"));
    say([["wor", false]]);
    expect(onInsertText).not.toHaveBeenCalled();
    expect(screen.getByTestId("relay-mic-interim")).toHaveTextContent("wor");
    say([["world", true]]);
    expect(onInsertText).toHaveBeenCalledWith("world");
    expect(onInsertText).toHaveBeenCalledTimes(1);
  });

  it("ignores a blank transcript", () => {
    const { onInsertText } = setup();
    fireEvent.click(screen.getByTestId("relay-mic"));
    say([[" ", true]]);
    expect(onInsertText).not.toHaveBeenCalled();
  });

  it("discards the recording when the dock unmounts, as when Relay is disabled", () => {
    const onInsertText = vi.fn();
    const { unmount } = render(<MicButton onInsertText={onInsertText} />);
    fireEvent.click(screen.getByTestId("relay-mic"));
    const recognizer = rec();
    unmount();
    expect(recognizer.abort).toHaveBeenCalled();
    expect(recognizer.onresult).toBeNull();
    expect(onInsertText).not.toHaveBeenCalled();
  });

  it("clicking while listening stops the recognizer", () => {
    setup();
    fireEvent.click(screen.getByTestId("relay-mic"));
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(rec().stop).toHaveBeenCalledTimes(1);
    act(() => rec().onend?.());
    expect(screen.getByTestId("relay-mic").getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByTestId("relay-mic-pulse")).toBeNull();
  });

  it("Escape stops while listening and is ignored for other keys", () => {
    setup();
    fireEvent.click(screen.getByTestId("relay-mic"));
    fireEvent.keyDown(window, { key: "a" });
    expect(rec().stop).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(rec().stop).toHaveBeenCalledTimes(1);
  });

  it("Escape does nothing when not listening", () => {
    setup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("shows the privacy note once per session and dismisses it", () => {
    setup();
    expect(screen.queryByTestId("relay-speech-note")).toBeNull();
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(screen.getByTestId("relay-speech-note")).toBeTruthy();
    fireEvent.click(screen.getByTestId("relay-speech-note-dismiss"));
    expect(screen.queryByTestId("relay-speech-note")).toBeNull();
    fireEvent.click(screen.getByTestId("relay-mic"));
    act(() => rec().onend?.());
    fireEvent.click(screen.getByTestId("relay-mic"));
    expect(screen.queryByTestId("relay-speech-note")).toBeNull();
  });

  it("shows a translated alert on a recognizer error", () => {
    setup();
    fireEvent.click(screen.getByTestId("relay-mic"));
    act(() => rec().onerror?.({ error: "not-allowed" }));
    expect(screen.getByTestId("relay-mic-error").textContent).toBe("errors.denied");
    act(() => rec().onend?.());
    expect(screen.getByTestId("relay-mic").getAttribute("aria-pressed")).toBe("false");
  });

  it("has an accessible name via ComposerTip when idle", () => {
    setup();
    const mic = screen.getByTestId("relay-mic");
    expect(mic).toHaveAccessibleName("start");
  });

  it("has a stop accessible name when listening", () => {
    setup();
    fireEvent.click(screen.getByTestId("relay-mic"));
    const mic = screen.getByTestId("relay-mic");
    expect(mic).toHaveAccessibleName("stop");
  });
});
