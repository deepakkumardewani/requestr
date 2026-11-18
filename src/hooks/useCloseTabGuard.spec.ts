/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HttpTab } from "@/types";
import { useCloseTabGuard } from "./useCloseTabGuard";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function httpTab(overrides: Partial<HttpTab>): HttpTab {
  return {
    tabId: "t1",
    requestId: null,
    name: "R",
    isDirty: false,
    type: "http",
    url: "https://x.test",
    method: "GET",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    ...overrides,
  };
}

function resetStores() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useUIStore.setState({
    pendingCloseTabId: null,
    pendingBulkClose: null,
  });
}

describe("useCloseTabGuard", () => {
  beforeEach(() => {
    vi.mocked(getDB).mockReturnValue(null);
    resetStores();
    useSettingsStore.setState({ confirmCloseUnsavedTabs: true });
    vi.clearAllMocks();
  });

  it("closes clean tab immediately without pending UI state", () => {
    const tab = httpTab({ tabId: "a", isDirty: false });
    useTabsStore.setState({ tabs: [tab], activeTabId: "a" });
    const { result } = renderHook(() => useCloseTabGuard());

    result.current.handleCloseTab(tab);

    expect(useTabsStore.getState().tabs).toHaveLength(0);
    expect(useUIStore.getState().pendingCloseTabId).toBeNull();
    expect(useUIStore.getState().pendingBulkClose).toBeNull();
  });

  it("sets pending close id when tab is dirty", () => {
    const tab = httpTab({ tabId: "dirty", isDirty: true });
    useTabsStore.setState({ tabs: [tab], activeTabId: "dirty" });
    const { result } = renderHook(() => useCloseTabGuard());

    result.current.handleCloseTab(tab);

    expect(useUIStore.getState().pendingCloseTabId).toBe("dirty");
    expect(useTabsStore.getState().tabs).toHaveLength(1);
  });

  it("closes other tabs when none are dirty", () => {
    const a = httpTab({ tabId: "a" });
    const b = httpTab({ tabId: "b" });
    useTabsStore.setState({ tabs: [a, b], activeTabId: "a" });
    const { result } = renderHook(() => useCloseTabGuard());

    result.current.handleCloseOthers("a");

    expect(useTabsStore.getState().tabs.map((t) => t.tabId)).toEqual(["a"]);
    expect(useUIStore.getState().pendingBulkClose).toBeNull();
  });

  it("sets pending bulk close for others when another tab is dirty", () => {
    const clean = httpTab({ tabId: "keep" });
    const dirty = httpTab({ tabId: "other", isDirty: true });
    useTabsStore.setState({ tabs: [clean, dirty], activeTabId: "keep" });
    const { result } = renderHook(() => useCloseTabGuard());

    result.current.handleCloseOthers("keep");

    expect(useUIStore.getState().pendingBulkClose).toEqual({
      kind: "others",
      keepTabId: "keep",
    });
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it("closes all tabs when none are dirty", () => {
    useTabsStore.setState({
      tabs: [httpTab({ tabId: "x" }), httpTab({ tabId: "y" })],
      activeTabId: "x",
    });
    const { result } = renderHook(() => useCloseTabGuard());

    result.current.handleCloseAll();

    expect(useTabsStore.getState().tabs).toHaveLength(0);
    expect(useUIStore.getState().pendingBulkClose).toBeNull();
  });

  it("sets pending bulk close for all when any tab is dirty", () => {
    useTabsStore.setState({
      tabs: [httpTab({ tabId: "x", isDirty: true }), httpTab({ tabId: "y" })],
      activeTabId: "x",
    });
    const { result } = renderHook(() => useCloseTabGuard());

    result.current.handleCloseAll();

    expect(useUIStore.getState().pendingBulkClose).toEqual({ kind: "all" });
    expect(useTabsStore.getState().tabs).toHaveLength(2);
  });

  it("closes dirty tabs without a prompt when confirmation is off", () => {
    useSettingsStore.setState({ confirmCloseUnsavedTabs: false });
    const a = httpTab({ tabId: "a", isDirty: true });
    const b = httpTab({ tabId: "b", isDirty: true });
    const c = httpTab({ tabId: "c", isDirty: true });
    useTabsStore.setState({ tabs: [a, b, c], activeTabId: "a" });
    const { result } = renderHook(() => useCloseTabGuard());

    result.current.handleCloseTab(c);
    expect(useTabsStore.getState().tabs).toHaveLength(2);
    result.current.handleCloseOthers("a");
    expect(useTabsStore.getState().tabs.map((t) => t.tabId)).toEqual(["a"]);
    result.current.handleCloseAll();

    expect(useTabsStore.getState().tabs).toHaveLength(0);
    expect(useUIStore.getState().pendingCloseTabId).toBeNull();
    expect(useUIStore.getState().pendingBulkClose).toBeNull();
  });
});
