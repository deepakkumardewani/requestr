/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en/relay.json";
import fr from "../../../messages/fr/relay.json";
import ja from "../../../messages/ja/relay.json";
import { SpeechPrivacyNote } from "./SpeechPrivacyNote";

afterEach(cleanup);

describe("SpeechPrivacyNote", () => {
  it("shows the vendor-neutral note and a dismiss button", () => {
    render(<SpeechPrivacyNote onDismiss={() => undefined} />);
    const note = screen.getByTestId("relay-speech-note");
    expect(note.textContent).toContain("privacyNote");
    expect(screen.getByTestId("relay-speech-note-dismiss").textContent).toBe("dismissNote");
  });

  it("ships vendor-neutral copy in every locale", () => {
    for (const copy of [en.voice.privacyNote, fr.voice.privacyNote, ja.voice.privacyNote]) {
      expect(copy.length).toBeGreaterThan(0);
      expect(copy).not.toMatch(/google|apple|microsoft|chrome|safari|edge|firefox/i);
    }
  });

  it("calls onDismiss when dismissed and writes nothing to storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const onDismiss = vi.fn();
    render(<SpeechPrivacyNote onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId("relay-speech-note-dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});
