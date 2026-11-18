/** @vitest-environment happy-dom */

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useToggleSet } from "./useToggleSet";

describe("useToggleSet", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useToggleSet());
    expect(result.current.has("a")).toBe(false);
  });

  it("toggles a key on and off", () => {
    const { result } = renderHook(() => useToggleSet());
    act(() => result.current.toggle("a"));
    expect(result.current.has("a")).toBe(true);
    act(() => result.current.toggle("a"));
    expect(result.current.has("a")).toBe(false);
  });

  it("tracks keys independently and clears them all", () => {
    const { result } = renderHook(() => useToggleSet());
    act(() => {
      result.current.toggle("a");
      result.current.toggle("b");
    });
    expect(result.current.has("a") && result.current.has("b")).toBe(true);
    act(() => result.current.clear());
    expect(result.current.has("a") || result.current.has("b")).toBe(false);
  });

  it("keeps toggle and clear callbacks referentially stable", () => {
    const { result } = renderHook(() => useToggleSet());
    const { toggle, clear } = result.current;
    act(() => result.current.toggle("a"));
    expect(result.current.toggle).toBe(toggle);
    expect(result.current.clear).toBe(clear);
  });
});
