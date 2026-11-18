/** @vitest-environment happy-dom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useImportedHubSlugs } from "./useImportedHubSlugs";

const KEY = "requestly_imported_hub_slugs";

describe("useImportedHubSlugs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty imported slugs when storage is empty", () => {
    const { result } = renderHook(() => useImportedHubSlugs());
    expect(result.current.importedSlugs.size).toBe(0);
  });

  it("parses slugs from localStorage", () => {
    localStorage.setItem(KEY, JSON.stringify(["alpha", "beta"]));
    const { result } = renderHook(() => useImportedHubSlugs());
    expect(result.current.importedSlugs.has("alpha")).toBe(true);
    expect(result.current.importedSlugs.has("beta")).toBe(true);
  });

  it("treats malformed JSON as empty set", () => {
    localStorage.setItem(KEY, "not-json");
    const { result } = renderHook(() => useImportedHubSlugs());
    expect(result.current.importedSlugs.size).toBe(0);
  });

  it("re-reads snapshot when storage event fires (cross-tab)", () => {
    const { result } = renderHook(() => useImportedHubSlugs());
    expect(result.current.importedSlugs.has("remote")).toBe(false);

    act(() => {
      localStorage.setItem(KEY, JSON.stringify(["remote"]));
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });

    expect(result.current.importedSlugs.has("remote")).toBe(true);
  });

  it("markImported persists slug and updates hook output after sync", () => {
    const { result } = renderHook(() => useImportedHubSlugs());

    act(() => {
      result.current.markImported("new-slug");
    });

    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toContain("new-slug");
    expect(result.current.importedSlugs.has("new-slug")).toBe(true);
  });

  it("stops listening for storage events after unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useImportedHubSlugs());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "storage",
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });
});
