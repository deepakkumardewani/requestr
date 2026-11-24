import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTabsStore } from "@/stores/useTabsStore";
import { ensureRequestTab } from "./ensureRequestTab";

const TIMEOUT_MS = 3000;

function resetTabs(hydrated: boolean) {
  useTabsStore.setState({ tabs: [], activeTabId: null, hydrated });
}

describe("ensureRequestTab", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens one blank tab when the hydrated workspace is empty", async () => {
    resetTabs(true);
    await ensureRequestTab(new AbortController().signal, TIMEOUT_MS);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().activeTabId).toBe(
      useTabsStore.getState().tabs[0].tabId,
    );
  });

  it("leaves existing tabs untouched", async () => {
    resetTabs(true);
    useTabsStore.getState().openTab();
    const before = useTabsStore.getState().tabs;
    await ensureRequestTab(new AbortController().signal, TIMEOUT_MS);
    expect(useTabsStore.getState().tabs).toBe(before);
  });

  it("waits for hydration before deciding", async () => {
    resetTabs(false);
    const pending = ensureRequestTab(new AbortController().signal, TIMEOUT_MS);
    useTabsStore.getState().openTab();
    useTabsStore.setState({ hydrated: true });
    await pending;
    expect(useTabsStore.getState().tabs).toHaveLength(1);
  });

  it("does nothing when hydration never finishes", async () => {
    resetTabs(false);
    const pending = ensureRequestTab(new AbortController().signal, TIMEOUT_MS);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await pending;
    expect(useTabsStore.getState().tabs).toHaveLength(0);
  });

  it("does nothing when aborted", async () => {
    resetTabs(false);
    const abort = new AbortController();
    const pending = ensureRequestTab(abort.signal, TIMEOUT_MS);
    abort.abort();
    await pending;
    useTabsStore.setState({ hydrated: true });
    expect(useTabsStore.getState().tabs).toHaveLength(0);
  });
});
