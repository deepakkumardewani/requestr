import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useUIStore } from "./useUIStore";
import { vi } from "vitest";

const initial = () => useUIStore.getState();

const localStore: Record<string, string> = {};

function mockLocalStorage() {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => localStore[k] ?? null,
    setItem: (k: string, v: string) => {
      localStore[k] = v;
    },
    removeItem: (k: string) => {
      delete localStore[k];
    },
  });
}

describe("useUIStore", () => {
  beforeEach(() => {
    mockLocalStorage();
    useUIStore.setState({
      leftPanelWidth: 280,
      splitRatio: 50,
      commandPaletteOpen: false,
      mobileSidebarOpen: false,
      historyFilter: null,
      saveModalOpen: false,
      pendingCloseTabId: null,
      pendingBulkClose: null,
      isCreatingCollection: false,
      isCreatingEnv: false,
      envManagerOpen: false,
      envManagerFocusEnvId: null,
      keyboardShortcutsOpen: false,
      chainRunLogHeight: 280,
      chainRunLogAutoOpen: true,
      chainRunLogCollapsed: true,
      chainClipboard: null,
      chainConcurrency: 4,
    });
  });

  afterEach(() => {
    for (const k of Object.keys(localStore)) delete localStore[k];
    vi.unstubAllGlobals();
  });

  it("has expected default layout and closed modals", () => {
    expect(initial().leftPanelWidth).toBe(280);
    expect(initial().splitRatio).toBe(50);
    expect(initial().commandPaletteOpen).toBe(false);
    expect(initial().historyFilter).toBeNull();
    expect(initial().saveModalOpen).toBe(false);
  });

  it("setLeftPanelWidth and setSplitRatio update layout", () => {
    useUIStore.getState().setLeftPanelWidth(320);
    useUIStore.getState().setSplitRatio(42);
    expect(useUIStore.getState().leftPanelWidth).toBe(320);
    expect(useUIStore.getState().splitRatio).toBe(42);
  });

  it("toggleCommandPalette flips command palette", () => {
    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    useUIStore.getState().toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it("setCommandPaletteOpen sets palette visibility", () => {
    useUIStore.getState().setCommandPaletteOpen(true);
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);
  });

  it("toggleMobileSidebar flips mobile sidebar", () => {
    useUIStore.getState().toggleMobileSidebar();
    expect(useUIStore.getState().mobileSidebarOpen).toBe(true);
    useUIStore.getState().toggleMobileSidebar();
    expect(useUIStore.getState().mobileSidebarOpen).toBe(false);
  });

  it("setHistoryFilter sets filter text", () => {
    useUIStore.getState().setHistoryFilter("GET");
    expect(useUIStore.getState().historyFilter).toBe("GET");
    useUIStore.getState().setHistoryFilter(null);
    expect(useUIStore.getState().historyFilter).toBeNull();
  });

  it("setSaveModalOpen controls save modal", () => {
    useUIStore.getState().setSaveModalOpen(true);
    expect(useUIStore.getState().saveModalOpen).toBe(true);
  });

  it("setPendingCloseTabId tracks tab id", () => {
    useUIStore.getState().setPendingCloseTabId("tab-1");
    expect(useUIStore.getState().pendingCloseTabId).toBe("tab-1");
  });

  it("setPendingBulkClose sets bulk close action", () => {
    useUIStore.getState().setPendingBulkClose({ kind: "all" });
    expect(useUIStore.getState().pendingBulkClose).toEqual({ kind: "all" });
    useUIStore
      .getState()
      .setPendingBulkClose({ kind: "others", keepTabId: "k" });
    expect(useUIStore.getState().pendingBulkClose).toEqual({
      kind: "others",
      keepTabId: "k",
    });
  });

  it("setIsCreatingCollection and setIsCreatingEnv toggle flags", () => {
    useUIStore.getState().setIsCreatingCollection(true);
    useUIStore.getState().setIsCreatingEnv(true);
    expect(useUIStore.getState().isCreatingCollection).toBe(true);
    expect(useUIStore.getState().isCreatingEnv).toBe(true);
  });

  it("setEnvManagerOpen sets open state and optional focus id", () => {
    useUIStore.getState().setEnvManagerOpen(true, "env-9");
    expect(useUIStore.getState().envManagerOpen).toBe(true);
    expect(useUIStore.getState().envManagerFocusEnvId).toBe("env-9");
    useUIStore.getState().setEnvManagerOpen(false);
    expect(useUIStore.getState().envManagerOpen).toBe(false);
    expect(useUIStore.getState().envManagerFocusEnvId).toBeNull();
  });

  it("setKeyboardShortcutsOpen toggles shortcuts dialog", () => {
    useUIStore.getState().setKeyboardShortcutsOpen(true);
    expect(useUIStore.getState().keyboardShortcutsOpen).toBe(true);
  });

  it("has default run-log height and auto-open preference", () => {
    expect(initial().chainRunLogHeight).toBe(280);
    expect(initial().chainRunLogAutoOpen).toBe(true);
  });

  it("setChainRunLogHeight updates and persists the height", () => {
    useUIStore.getState().setChainRunLogHeight(400);
    expect(useUIStore.getState().chainRunLogHeight).toBe(400);
    expect(localStore.rq_chain_run_log_height).toBe("400");
  });

  it("setChainRunLogHeight clamps below the minimum", () => {
    useUIStore.getState().setChainRunLogHeight(10);
    expect(useUIStore.getState().chainRunLogHeight).toBe(160);
  });

  it("setChainRunLogAutoOpen updates and persists the preference", () => {
    useUIStore.getState().setChainRunLogAutoOpen(false);
    expect(useUIStore.getState().chainRunLogAutoOpen).toBe(false);
    expect(localStore.rq_chain_run_log_auto_open).toBe("false");
  });

  it("reads the persisted height and auto-open preference back on init", async () => {
    localStore.rq_chain_run_log_height = "512";
    localStore.rq_chain_run_log_auto_open = "false";
    vi.resetModules();
    const { useUIStore: freshStore } = await import("./useUIStore");
    expect(freshStore.getState().chainRunLogHeight).toBe(512);
    expect(freshStore.getState().chainRunLogAutoOpen).toBe(false);
  });

  it("has default run-log collapsed state", () => {
    expect(initial().chainRunLogCollapsed).toBe(true);
  });

  it("setChainRunLogCollapsed updates and persists the collapsed state", () => {
    useUIStore.getState().setChainRunLogCollapsed(false);
    expect(useUIStore.getState().chainRunLogCollapsed).toBe(false);
    expect(localStore.rq_chain_run_log_collapsed).toBe("false");
  });

  it("reads the persisted collapsed state back on init", async () => {
    localStore.rq_chain_run_log_collapsed = "false";
    vi.resetModules();
    const { useUIStore: freshStore } = await import("./useUIStore");
    expect(freshStore.getState().chainRunLogCollapsed).toBe(false);
  });

  it("has null clipboard by default", () => {
    expect(initial().chainClipboard).toBeNull();
  });

  it("setChainClipboard stores a copied entry", () => {
    const entry = {
      blocks: [{ id: "b1", type: "delay", delayMs: 100 }] as never,
      edges: [] as never,
      positions: { b1: { x: 10, y: 20 } },
    };
    useUIStore.getState().setChainClipboard(entry);
    expect(useUIStore.getState().chainClipboard).toEqual(entry);
  });

  it("setChainClipboard(null) clears the clipboard", () => {
    useUIStore.getState().setChainClipboard({
      blocks: [],
      edges: [],
      positions: {},
    });
    useUIStore.getState().setChainClipboard(null);
    expect(useUIStore.getState().chainClipboard).toBeNull();
  });

  it("defaults chainConcurrency to 4 when nothing is persisted", () => {
    expect(initial().chainConcurrency).toBe(4);
  });

  it("setChainConcurrency updates and persists the value", () => {
    useUIStore.getState().setChainConcurrency(8);
    expect(useUIStore.getState().chainConcurrency).toBe(8);
    expect(localStore.rq_chain_concurrency).toBe("8");
  });

  it("setChainConcurrency clamps below 1 up to 1", () => {
    useUIStore.getState().setChainConcurrency(0);
    expect(useUIStore.getState().chainConcurrency).toBe(1);
  });

  it("setChainConcurrency clamps above 8 down to 8", () => {
    useUIStore.getState().setChainConcurrency(20);
    expect(useUIStore.getState().chainConcurrency).toBe(8);
  });

  it("setChainConcurrency rounds fractional values", () => {
    useUIStore.getState().setChainConcurrency(3.7);
    expect(useUIStore.getState().chainConcurrency).toBe(4);
  });
});
