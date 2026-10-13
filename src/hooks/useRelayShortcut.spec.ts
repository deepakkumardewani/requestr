/** @vitest-environment happy-dom */

import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as platform from "@/lib/platform";
import { useRelayStore } from "@/stores/useRelayStore";
import { useRelayShortcut } from "./useRelayShortcut";

const MAC_CHORD: KeyboardEventInit = { key: "i", metaKey: true };
const OTHER_CHORD: KeyboardEventInit = {
  key: "L",
  ctrlKey: true,
  shiftKey: true,
};

function press(init: KeyboardEventInit, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function isOpen() {
  return useRelayStore.getState().open;
}

beforeEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  useRelayStore.setState({ open: false, focusRequest: 0 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useRelayShortcut on Mac", () => {
  beforeEach(() => {
    vi.spyOn(platform, "isMac").mockReturnValue(true);
  });

  it("toggles Relay on Cmd+I and claims the key", () => {
    renderHook(() => useRelayShortcut({ enabled: true }));

    const first = press(MAC_CHORD);
    expect(isOpen()).toBe(true);
    expect(first.defaultPrevented).toBe(true);

    press(MAC_CHORD);
    expect(isOpen()).toBe(false);
  });

  it("leaves Ctrl+I to the Import collection binding", () => {
    renderHook(() => useRelayShortcut({ enabled: true }));

    const event = press({ key: "i", ctrlKey: true });

    expect(isOpen()).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ["Cmd+Shift+I", { key: "i", metaKey: true, shiftKey: true }],
    ["Cmd+Alt+I", { key: "i", metaKey: true, altKey: true }],
    ["Cmd+K", { key: "k", metaKey: true }],
    ["plain I", { key: "i" }],
  ])("ignores %s", (_label, init) => {
    renderHook(() => useRelayShortcut({ enabled: true }));
    press(init);
    expect(isOpen()).toBe(false);
  });
});

describe("useRelayShortcut on other platforms", () => {
  beforeEach(() => {
    vi.spyOn(platform, "isMac").mockReturnValue(false);
  });

  it("toggles Relay on Ctrl+Shift+L", () => {
    renderHook(() => useRelayShortcut({ enabled: true }));

    press(OTHER_CHORD);
    expect(isOpen()).toBe(true);
    press(OTHER_CHORD);
    expect(isOpen()).toBe(false);
  });

  it("does not use the Mac chord", () => {
    renderHook(() => useRelayShortcut({ enabled: true }));
    press(MAC_CHORD);
    expect(isOpen()).toBe(false);
  });

  it("keeps Ctrl+I free for Import collection", () => {
    renderHook(() => useRelayShortcut({ enabled: true }));
    const event = press({ key: "i", ctrlKey: true });
    expect(isOpen()).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it("works while typing in an input", () => {
    renderHook(() => useRelayShortcut({ enabled: true }));
    const input = document.createElement("input");
    document.body.append(input);

    press(OTHER_CHORD, input);

    expect(isOpen()).toBe(true);
  });

  it.each([".cm-editor", ".monaco-editor"])(
    "yields to a code editor (%s) that binds the chord itself",
    (selector) => {
      renderHook(() => useRelayShortcut({ enabled: true }));
      const editor = document.createElement("div");
      editor.className = selector.slice(1);
      const content = document.createElement("div");
      editor.append(content);
      document.body.append(editor);

      const event = press(OTHER_CHORD, content);

      expect(isOpen()).toBe(false);
      expect(event.defaultPrevented).toBe(false);
    },
  );

  it("ignores key repeat so a held chord does not flicker the dock", () => {
    renderHook(() => useRelayShortcut({ enabled: true }));
    press(OTHER_CHORD);
    press({ ...OTHER_CHORD, repeat: true });
    expect(isOpen()).toBe(true);
  });

  it("does nothing when disabled (flag off or landing page)", () => {
    renderHook(() => useRelayShortcut({ enabled: false }));
    const event = press(OTHER_CHORD);
    expect(isOpen()).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it("stops listening once unmounted", () => {
    const { unmount } = renderHook(() => useRelayShortcut({ enabled: true }));
    unmount();
    press(OTHER_CHORD);
    expect(isOpen()).toBe(false);
  });

  it("starts listening when enabled flips on", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useRelayShortcut({ enabled }),
      { initialProps: { enabled: false } },
    );
    press(OTHER_CHORD);
    expect(isOpen()).toBe(false);

    rerender({ enabled: true });
    press(OTHER_CHORD);
    expect(isOpen()).toBe(true);
  });
});
