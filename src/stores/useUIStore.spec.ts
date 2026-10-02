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
      pickerTab: "collections",
      snapToGrid: false,
      hintsDismissed: false,
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

  it("reads the persisted height and auto-open preference only once hydrated", async () => {
    localStore.rq_chain_run_log_height = "512";
    localStore.rq_chain_run_log_auto_open = "false";
    vi.resetModules();
    const { useUIStore: freshStore } = await import("./useUIStore");
    // Defaults on creation keep the first client render equal to the SSR HTML.
    expect(freshStore.getState().chainRunLogHeight).toBe(280);
    expect(freshStore.getState().chainRunLogAutoOpen).toBe(true);
    freshStore.getState().hydrateChainPreferences();
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

  it("reads the persisted collapsed state only once hydrated", async () => {
    localStore.rq_chain_run_log_collapsed = "false";
    vi.resetModules();
    const { useUIStore: freshStore } = await import("./useUIStore");
    expect(freshStore.getState().chainRunLogCollapsed).toBe(true);
    freshStore.getState().hydrateChainPreferences();
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

  describe("picker tab preference", () => {
    const hydrate = async () => {
      vi.resetModules();
      const { useUIStore: fresh } = await import("./useUIStore");
      fresh.getState().hydrateChainPreferences();
      return fresh.getState();
    };

    it("defaults to collections", () => {
      expect(initial().pickerTab).toBe("collections");
    });

    it("setPickerTab updates state and persists in the action", () => {
      useUIStore.getState().setPickerTab("history");
      expect(initial().pickerTab).toBe("history");
      expect(localStore.rq_chain_picker_tab).toBe("history");
    });

    it("hydrates a persisted valid tab", async () => {
      localStore.rq_chain_picker_tab = "new";
      expect((await hydrate()).pickerTab).toBe("new");
    });

    it("falls back to collections for an invalid persisted value", async () => {
      localStore.rq_chain_picker_tab = "bogus";
      expect((await hydrate()).pickerTab).toBe("collections");
    });

    it("falls back to collections and does not throw on blocked storage", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      });
      expect((await hydrate()).pickerTab).toBe("collections");
      expect(() => useUIStore.getState().setPickerTab("new")).not.toThrow();
      expect(initial().pickerTab).toBe("new");
      warn.mockRestore();
    });

    it("ignores an invalid tab passed to the setter", () => {
      useUIStore.getState().setPickerTab("bogus" as never);
      expect(initial().pickerTab).toBe("collections");
      expect(localStore.rq_chain_picker_tab).toBeUndefined();
    });
  });

  describe.each([
    ["snapToGrid", "setSnapToGrid", "rq_chain_snap_to_grid"],
    ["hintsDismissed", "setHintsDismissed", "rq_chain_hints_dismissed"],
  ] as const)("%s preference", (field, setter, key) => {
    const hydrate = async () => {
      vi.resetModules();
      const { useUIStore: fresh } = await import("./useUIStore");
      fresh.getState().hydrateChainPreferences();
      return fresh.getState();
    };

    it("defaults to false", () => {
      expect(initial()[field]).toBe(false);
    });

    it("setter updates state and persists", () => {
      useUIStore.getState()[setter](true);
      expect(initial()[field]).toBe(true);
      expect(localStore[key]).toBe("true");
    });

    it("hydrates a persisted value", async () => {
      localStore[key] = "true";
      expect((await hydrate())[field]).toBe(true);
    });

    it("treats a corrupt persisted value as false", async () => {
      localStore[key] = "garbage";
      expect((await hydrate())[field]).toBe(false);
    });

    it("falls back to false and does not throw on blocked storage", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      });
      expect((await hydrate())[field]).toBe(false);
      expect(() => useUIStore.getState()[setter](true)).not.toThrow();
      expect(initial()[field]).toBe(true);
      warn.mockRestore();
    });
  });

  describe("run-log layout preferences", () => {
    const hydrate = async () => {
      vi.resetModules();
      const { useUIStore: fresh } = await import("./useUIStore");
      fresh.getState().hydrateChainPreferences();
      return fresh.getState();
    };

    it("defaults to 288px and 0.5", () => {
      expect(initial().chainRunLogListWidth).toBe(288);
      expect(initial().chainRunLogDetailRatio).toBe(0.5);
    });

    it("setters clamp and persist", () => {
      useUIStore.getState().setChainRunLogListWidth(999);
      useUIStore.getState().setChainRunLogDetailRatio(0.1);
      expect(initial().chainRunLogListWidth).toBe(420);
      expect(initial().chainRunLogDetailRatio).toBe(0.25);
      expect(localStore.rq_chain_run_log_list_width).toBe("420");
      expect(localStore.rq_chain_run_log_detail_ratio).toBe("0.25");
    });

    it("list width setter honors the dock cap", () => {
      useUIStore.getState().setChainRunLogListWidth(400, 600);
      expect(initial().chainRunLogListWidth).toBe(300);
    });

    it("hydrates valid persisted values", async () => {
      localStore.rq_chain_run_log_list_width = "340";
      localStore.rq_chain_run_log_detail_ratio = "0.6";
      const state = await hydrate();
      expect(state.chainRunLogListWidth).toBe(340);
      expect(state.chainRunLogDetailRatio).toBe(0.6);
    });

    it("clamps out-of-range persisted values on read", async () => {
      localStore.rq_chain_run_log_list_width = "10";
      localStore.rq_chain_run_log_detail_ratio = "5";
      const state = await hydrate();
      expect(state.chainRunLogListWidth).toBe(200);
      expect(state.chainRunLogDetailRatio).toBe(0.75);
    });

    it("falls back to defaults for corrupt, NaN and empty values", async () => {
      localStore.rq_chain_run_log_list_width = "abc";
      localStore.rq_chain_run_log_detail_ratio = "";
      const state = await hydrate();
      expect(state.chainRunLogListWidth).toBe(288);
      expect(state.chainRunLogDetailRatio).toBe(0.5);
    });

    it("does not throw when storage is blocked", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      });
      const state = await hydrate();
      expect(state.chainRunLogListWidth).toBe(288);
      expect(state.chainRunLogDetailRatio).toBe(0.5);
      expect(() => state.setChainRunLogListWidth(300)).not.toThrow();
      warn.mockRestore();
    });
  });
});
