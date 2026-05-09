/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFirstTimeUser } from "./useFirstTimeUser";

const KEY = "rq_onboarding_complete";

const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((k: string) => store[k] ?? null),
  setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
  removeItem: vi.fn((k: string) => { delete store[k]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; }),
};

beforeEach(() => {
  vi.stubGlobal("localStorage", localStorageMock);
  localStorageMock.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFirstTimeUser", () => {
  it("returns isFirstTime=true when key is absent", () => {
    const { result } = renderHook(() => useFirstTimeUser());
    expect(result.current.isFirstTime).toBe(true);
  });

  it("returns isFirstTime=false when key is already set", () => {
    store[KEY] = "true";
    const { result } = renderHook(() => useFirstTimeUser());
    expect(result.current.isFirstTime).toBe(false);
  });

  it("markComplete sets the key and flips isFirstTime to false", () => {
    const { result } = renderHook(() => useFirstTimeUser());
    expect(result.current.isFirstTime).toBe(true);
    act(() => result.current.markComplete());
    expect(store[KEY]).toBe("true");
    expect(result.current.isFirstTime).toBe(false);
  });

  it("restartTour removes the key and flips isFirstTime back to true", () => {
    store[KEY] = "true";
    const { result } = renderHook(() => useFirstTimeUser());
    expect(result.current.isFirstTime).toBe(false);
    act(() => result.current.restartTour());
    expect(store[KEY]).toBeUndefined();
    expect(result.current.isFirstTime).toBe(true);
  });
});
