import { describe, expect, it } from "vitest";
import {
  RELAY_DEFAULT_WIDTH_VW,
  RELAY_MAX_STEPS,
  RELAY_MAX_THREADS,
  RELAY_MAX_WIDTH_CSS,
  RELAY_MAX_WIDTH_VW,
  RELAY_MIN_WIDTH_CSS,
  RELAY_MIN_WIDTH_PX,
  RELAY_MIN_WIDTH_VW,
  RELAY_MOBILE_BREAKPOINT_PX,
  RELAY_NEW_CHAT_SHORTCUTS,
  RELAY_SHORTCUTS,
  RELAY_STORAGE_KEYS,
  RELAY_WORKSPACE_ID,
} from "./constants";

describe("relay constants", () => {
  it("matches the FR-1/FR-2 dock sizing", () => {
    expect(RELAY_MIN_WIDTH_PX).toBe(320);
    expect(RELAY_MIN_WIDTH_VW).toBe(30);
    expect(RELAY_MAX_WIDTH_VW).toBe(40);
    expect(RELAY_DEFAULT_WIDTH_VW).toBe(30);
    expect(RELAY_MOBILE_BREAKPOINT_PX).toBe(768);
  });

  it("keeps the default share inside the min..max share", () => {
    expect(RELAY_DEFAULT_WIDTH_VW).toBeGreaterThanOrEqual(RELAY_MIN_WIDTH_VW);
    expect(RELAY_DEFAULT_WIDTH_VW).toBeLessThanOrEqual(RELAY_MAX_WIDTH_VW);
  });

  it("builds the CSS bounds from the numeric limits with shared px floor and vw fraction", () => {
    // min: max(320px, 30vw); max: max(320px, 40vw)
    // This literal string is used in both the dock CSS and the reserved gap; they must be identical.
    expect(RELAY_MIN_WIDTH_CSS).toBe("max(320px, 30vw)");
    expect(RELAY_MAX_WIDTH_CSS).toBe("max(320px, 40vw)");
  });

  it("namespaces storage keys with rq_relay_", () => {
    for (const key of Object.values(RELAY_STORAGE_KEYS)) {
      expect(key.startsWith("rq_relay_")).toBe(true);
    }
  });

  it("pins the workspace id and caps", () => {
    expect(RELAY_WORKSPACE_ID).toBe("local");
    expect(RELAY_MAX_THREADS).toBe(50);
    expect(RELAY_MAX_STEPS).toBe(12);
  });

  it("binds Cmd+I on Mac and Ctrl+Shift+L elsewhere (FR-30)", () => {
    expect(RELAY_SHORTCUTS.mac).toEqual({
      key: "i",
      meta: true,
      ctrl: false,
      shift: false,
    });
    expect(RELAY_SHORTCUTS.other).toEqual({
      key: "l",
      meta: false,
      ctrl: true,
      shift: true,
    });
  });

  it("binds Cmd+Shift+O on Mac and Ctrl+Shift+O elsewhere for a new chat", () => {
    expect(RELAY_NEW_CHAT_SHORTCUTS.mac).toEqual({
      key: "o",
      meta: true,
      ctrl: false,
      shift: true,
    });
    expect(RELAY_NEW_CHAT_SHORTCUTS.other).toEqual({
      key: "o",
      meta: false,
      ctrl: true,
      shift: true,
    });
  });
});
