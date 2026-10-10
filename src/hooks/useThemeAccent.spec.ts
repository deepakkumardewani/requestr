/** @vitest-environment happy-dom */

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useThemeAccent } from "./useThemeAccent";

afterEach(() => {
  useSettingsStore.setState({ accentColor: undefined });
  document.documentElement.style.removeProperty("--theme-accent-r");
  document.documentElement.style.removeProperty("--theme-accent-g");
  document.documentElement.style.removeProperty("--theme-accent-b");
});

describe("useThemeAccent", () => {
  it("sets CSS variables on the document root when accentColor is defined", () => {
    useSettingsStore.setState({ accentColor: { r: 10, g: 20, b: 30 } });

    renderHook(() => useThemeAccent());

    expect(document.documentElement.style.getPropertyValue("--theme-accent-r")).toBe(
      "10",
    );
    expect(document.documentElement.style.getPropertyValue("--theme-accent-g")).toBe(
      "20",
    );
    expect(document.documentElement.style.getPropertyValue("--theme-accent-b")).toBe(
      "30",
    );
  });

  it("does not set CSS variables when accentColor is undefined", () => {
    useSettingsStore.setState({ accentColor: undefined });

    renderHook(() => useThemeAccent());

    expect(
      document.documentElement.style.getPropertyValue("--theme-accent-r"),
    ).toBe("");
  });
});
