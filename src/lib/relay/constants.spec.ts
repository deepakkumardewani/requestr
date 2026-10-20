import { describe, expect, it } from "vitest";
import {
  RELAY_DEFAULT_WIDTH_PX,
  RELAY_MAX_STEPS,
  RELAY_MAX_THREADS,
  RELAY_MAX_WIDTH_VW,
  RELAY_MIN_WIDTH_PX,
  RELAY_MOBILE_BREAKPOINT_PX,
  RELAY_NEW_CHAT_SHORTCUTS,
  RELAY_SHORTCUTS,
  RELAY_STORAGE_KEYS,
  RELAY_WORKSPACE_ID,
} from "./constants";

describe("relay constants", () => {
  it("matches the FR-1/FR-2 dock sizing", () => {
    expect(RELAY_MIN_WIDTH_PX).toBe(320);
    expect(RELAY_MAX_WIDTH_VW).toBe(60);
    expect(RELAY_DEFAULT_WIDTH_PX).toBe(400);
    expect(RELAY_MOBILE_BREAKPOINT_PX).toBe(768);
  });

  it("keeps the default width inside the minimum", () => {
    expect(RELAY_DEFAULT_WIDTH_PX).toBeGreaterThanOrEqual(RELAY_MIN_WIDTH_PX);
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
