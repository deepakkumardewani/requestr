/** @vitest-environment happy-dom */
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CHAIN_CONCURRENCY } from "@/lib/chainConstants";
import { useUIStore } from "@/stores/useUIStore";
import { useHydrateChainPreferences } from "./useHydrateChainPreferences";

const CONCURRENCY_KEY = "rq_chain_concurrency";

describe("useHydrateChainPreferences", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.setState({ chainConcurrency: DEFAULT_CHAIN_CONCURRENCY });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("hydrates the persisted concurrency into the store after mount", () => {
    localStorage.setItem(CONCURRENCY_KEY, "7");

    renderHook(() => useHydrateChainPreferences());

    expect(useUIStore.getState().chainConcurrency).toBe(7);
  });

  it("keeps the default concurrency until the hook mounts", () => {
    localStorage.setItem(CONCURRENCY_KEY, "7");

    expect(useUIStore.getState().chainConcurrency).toBe(
      DEFAULT_CHAIN_CONCURRENCY,
    );
  });

  it("keeps the default concurrency when nothing is persisted", () => {
    renderHook(() => useHydrateChainPreferences());

    expect(useUIStore.getState().chainConcurrency).toBe(
      DEFAULT_CHAIN_CONCURRENCY,
    );
  });

  it("falls back to the default when the persisted value is corrupt", () => {
    localStorage.setItem(CONCURRENCY_KEY, "not-a-number");
    useUIStore.setState({ chainConcurrency: 2 });

    renderHook(() => useHydrateChainPreferences());

    expect(useUIStore.getState().chainConcurrency).toBe(
      DEFAULT_CHAIN_CONCURRENCY,
    );
  });

  it("clamps an out-of-range persisted concurrency to the maximum", () => {
    localStorage.setItem(CONCURRENCY_KEY, "99");

    renderHook(() => useHydrateChainPreferences());

    expect(useUIStore.getState().chainConcurrency).toBe(8);
  });

  it("hydrates once per mount, not on every re-render", () => {
    localStorage.setItem(CONCURRENCY_KEY, "6");
    const { rerender } = renderHook(() => useHydrateChainPreferences());
    useUIStore.setState({ chainConcurrency: 3 });

    rerender();

    expect(useUIStore.getState().chainConcurrency).toBe(3);
  });
});
