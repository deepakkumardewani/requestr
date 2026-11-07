/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const reducedMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useReducedMotion", () => ({ useReducedMotion: reducedMock }));

import { useHeroMotion } from "./useHeroMotion";

describe("useHeroMotion", () => {
  beforeEach(() => {
    reducedMock.mockReset();
  });

  it("allows animation when motion is not reduced", () => {
    reducedMock.mockReturnValue(false);
    const { result } = renderHook(() => useHeroMotion());
    expect(result.current).toEqual({ reduced: false, animate: true });
  });

  it("disables animation when motion is reduced", () => {
    reducedMock.mockReturnValue(true);
    const { result } = renderHook(() => useHeroMotion());
    expect(result.current).toEqual({ reduced: true, animate: false });
  });
});
