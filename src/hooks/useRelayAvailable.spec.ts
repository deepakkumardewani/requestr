/** @vitest-environment happy-dom */

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelayStore } from "@/stores/useRelayStore";
import { useRelayAvailable } from "./useRelayAvailable";

vi.mock("@/lib/idb", () => ({ getDB: () => null }));

beforeEach(() => {
  localStorage.clear();
  useRelayStore.setState({ enabled: true });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("useRelayAvailable", () => {
  it.each([
    { flag: "true", enabled: true, expected: true },
    { flag: "true", enabled: false, expected: false },
    { flag: "false", enabled: true, expected: false },
    { flag: "false", enabled: false, expected: false },
  ])(
    "is $expected when flag=$flag and setting enabled=$enabled",
    ({ flag, enabled, expected }) => {
      vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", flag);
      useRelayStore.setState({ enabled });
      const { result } = renderHook(() => useRelayAvailable());
      expect(result.current).toBe(expected);
    },
  );

  it("is available when the flag is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_RELAY_ENABLED", undefined);
    const { result } = renderHook(() => useRelayAvailable());
    expect(result.current).toBe(true);
  });

  it("reacts to the setting changing without a remount", () => {
    const { result } = renderHook(() => useRelayAvailable());
    expect(result.current).toBe(true);
    act(() => useRelayStore.setState({ enabled: false }));
    expect(result.current).toBe(false);
  });
});
