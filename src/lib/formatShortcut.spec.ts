import { afterEach, describe, expect, it, vi } from "vitest";
import { formatShortcut, formatShortcutByAction } from "./formatShortcut";

const isMacMock = vi.hoisted(() => vi.fn<() => boolean>());
vi.mock("@/lib/platform", () => ({ isMac: isMacMock }));

afterEach(() => {
  vi.unstubAllEnvs();
  isMacMock.mockReset();
});

describe("formatShortcutByAction", () => {
  it.each([true, false])("renders New tab as Ctrl+T when isMac is %s", (mac) => {
    isMacMock.mockReturnValue(mac);
    expect(formatShortcutByAction("newTab")).toBe("Ctrl+T");
  });

  it("renders a mod shortcut as Cmd on Mac and Ctrl elsewhere", () => {
    isMacMock.mockReturnValue(true);
    expect(formatShortcutByAction("saveCurrent")).toBe("⌘+S");
    isMacMock.mockReturnValue(false);
    expect(formatShortcutByAction("saveCurrent")).toBe("Ctrl+S");
  });

  it("keeps Shift between the modifier and key for ctrlOnly chords", () => {
    isMacMock.mockReturnValue(true);
    expect(formatShortcutByAction("closeAllTabs")).toBe("Ctrl+Shift+W");
  });

  it("renders the Relay toggle chord per platform", () => {
    isMacMock.mockReturnValue(true);
    expect(formatShortcutByAction("relayToggle")).toBe("⌘+I");
    isMacMock.mockReturnValue(false);
    expect(formatShortcutByAction("relayToggle")).toBe("Ctrl+Shift+L");
  });

  it("renders a no-modifier binding as the bare key", () => {
    isMacMock.mockReturnValue(false);
    expect(formatShortcutByAction("chainAutoLayout")).toBe("L");
  });

  it("throws for an unknown action key", () => {
    isMacMock.mockReturnValue(false);
    expect(() => formatShortcutByAction("noSuchAction")).toThrow(
      "Unknown shortcut action: noSuchAction",
    );
  });
});

describe("formatShortcut", () => {
  it("uses Ctrl for a ctrlOnly entry even on Mac", () => {
    isMacMock.mockReturnValue(true);
    expect(formatShortcut({ actionKey: "x", key: "N", ctrlOnly: true })).toBe(
      "Ctrl+N",
    );
  });

  it("uses the platform modifier for a plain entry", () => {
    isMacMock.mockReturnValue(true);
    expect(formatShortcut({ actionKey: "x", key: "K" })).toBe("⌘+K");
    isMacMock.mockReturnValue(false);
    expect(formatShortcut({ actionKey: "x", key: "K" })).toBe("Ctrl+K");
  });
});
