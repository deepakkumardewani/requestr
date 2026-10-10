"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { getDB } from "@/lib/idb";
import { generateId } from "@/lib/utils";
import { useConnectionStore } from "@/stores/useConnectionStore";
import type {
  AuthConfig,
  BodyConfig,
  HttpMethod,
  HttpTab,
  TabState,
} from "@/types";

type TabsState = {
  tabs: TabState[];
  activeTabId: string | null;
  /** true once the IDB hydration attempt (success or failure) has completed */
  hydrated: boolean;
};

type TabsActions = {
  openTab: (initial?: Partial<TabState>) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  closeTabsForRequest: (requestId: string) => void;
  closeTabsForRequests: (requestIds: string[]) => void;
  setActiveTab: (tabId: string) => void;
  updateTabState: (tabId: string, patch: Partial<TabState>) => void;
  setTabLabel: (tabId: string, group: string, color: string) => void;
  /** Move tab at `fromIndex` to `toIndex` (drag-and-drop reorder). */
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  hydrate: () => Promise<void>;
};

const DEFAULT_AUTH: AuthConfig = { type: "none" };
const DEFAULT_BODY: BodyConfig = { type: "none", content: "" };

/** Socket lifetimes are tied to their tab; call for every tab being removed. */
function disconnectSocketTabs(removed: TabState[]) {
  const { disconnect } = useConnectionStore.getState();
  for (const tab of removed) {
    if (tab.type === "websocket" || tab.type === "socketio") {
      disconnect(tab.tabId);
    }
  }
}

function normalizePersistedTab(raw: TabState): TabState {
  if (
    raw.type === "http" ||
    raw.type === "graphql" ||
    raw.type === "websocket" ||
    raw.type === "socketio"
  ) {
    return raw;
  }
  const legacy = raw as Omit<HttpTab, "type">;
  return {
    tabId: legacy.tabId,
    requestId: legacy.requestId,
    name: legacy.name,
    isDirty: legacy.isDirty,
    type: "http",
    url: legacy.url,
    headers: legacy.headers ?? [],
    method: legacy.method ?? "GET",
    params: legacy.params ?? [],
    auth: legacy.auth ?? DEFAULT_AUTH,
    body: legacy.body ?? DEFAULT_BODY,
    preScript: legacy.preScript ?? "",
    postScript: legacy.postScript ?? "",
    timeoutMs: (legacy as HttpTab).timeoutMs,
    assertions: (legacy as HttpTab).assertions ?? [],
    sslVerify: (legacy as HttpTab).sslVerify,
    followRedirects: (legacy as HttpTab).followRedirects,
    color: legacy.color,
    group: legacy.group,
  };
}

function createEmptyTab(overrides: Partial<TabState> = {}): TabState {
  const tabId = generateId();
  const requestId = overrides.requestId ?? null;

  switch (overrides.type) {
    case "graphql":
      return {
        name: "New GraphQL",
        isDirty: false,
        url: "",
        headers: [],
        query: "",
        variables: "{}",
        operationName: "",
        auth: DEFAULT_AUTH,
        ...overrides,
        tabId,
        requestId: overrides.requestId ?? requestId,
        type: "graphql",
      };
    case "websocket":
      return {
        name: "New WebSocket",
        isDirty: false,
        url: "wss://",
        headers: [],
        messageLog: [],
        ...overrides,
        tabId,
        requestId: overrides.requestId ?? requestId,
        type: "websocket",
      };
    case "socketio":
      return {
        name: "New Socket.IO",
        isDirty: false,
        url: "http://",
        headers: [],
        messageLog: [],
        ...overrides,
        tabId,
        requestId: overrides.requestId ?? requestId,
        type: "socketio",
      };
    default:
      return {
        name: "New Request",
        isDirty: false,
        url: "",
        headers: [],
        method: "GET" as HttpMethod,
        params: [],
        auth: DEFAULT_AUTH,
        body: DEFAULT_BODY,
        preScript: "",
        postScript: "",
        assertions: [],
        ...overrides,
        tabId,
        requestId: overrides.requestId ?? requestId,
        type: "http",
      };
  }
}

/**
 * Move `movedTabId` to be adjacent to any existing tabs that share `group`.
 * If no peers exist yet, the tab stays in place (it's the first in the group).
 * Peers are clustered starting at the position of the first existing peer.
 */
function groupAdjacentTabs(
  tabs: TabState[],
  movedTabId: string,
  group: string,
): TabState[] {
  const peers = tabs.filter((t) => t.tabId !== movedTabId && t.group === group);
  if (peers.length === 0) return tabs; // first tab with this group — no move needed

  // Find position of the first peer
  const firstPeerIndex = tabs.findIndex((t) => t.tabId === peers[0].tabId);
  const movedIndex = tabs.findIndex((t) => t.tabId === movedTabId);

  const result = [...tabs];
  const [tab] = result.splice(movedIndex, 1);
  // Re-compute target after splice (peer index may shift)
  const targetIndex =
    movedIndex < firstPeerIndex ? firstPeerIndex - 1 : firstPeerIndex;
  result.splice(targetIndex, 0, tab);
  return result;
}

async function persistTabs(tabs: TabState[]) {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    const tx = instance.transaction("tabs", "readwrite");
    await tx.store.clear();
    for (const tab of tabs) {
      await tx.store.put(tab);
    }
    await tx.done;
  } catch (error) {
    toast.error("Failed to save tabs", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export const useTabsStore = create<TabsState & TabsActions>((set, get) => ({
  tabs: [],
  activeTabId: null,
  hydrated: false,

  openTab(initial) {
    const newTab = createEmptyTab(initial);
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.tabId,
    }));
    persistTabs(get().tabs);
  },

  closeTab(tabId) {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.tabId === tabId);
    const remaining = tabs.filter((t) => t.tabId !== tabId);
    disconnectSocketTabs(tabs.filter((t) => t.tabId === tabId));

    let nextActiveId: string | null = activeTabId;
    if (activeTabId === tabId) {
      nextActiveId = remaining[idx]?.tabId ?? remaining[idx - 1]?.tabId ?? null;
    }

    if (remaining.length === 0) {
      set({ tabs: [], activeTabId: null });
      persistTabs([]);
      return;
    }

    set({ tabs: remaining, activeTabId: nextActiveId });
    persistTabs(remaining);
  },

  closeOtherTabs(tabId) {
    const { tabs } = get();
    const remaining = tabs.filter((t) => t.tabId === tabId);
    disconnectSocketTabs(tabs.filter((t) => t.tabId !== tabId));
    const nextActiveId = remaining[0]?.tabId ?? null;
    set({ tabs: remaining, activeTabId: nextActiveId });
    persistTabs(remaining);
  },

  closeAllTabs() {
    disconnectSocketTabs(get().tabs);
    set({ tabs: [], activeTabId: null });
    persistTabs([]);
  },

  closeTabsForRequest(requestId) {
    const { tabs, activeTabId } = get();
    const remaining = tabs.filter((t) => t.requestId !== requestId);
    disconnectSocketTabs(tabs.filter((t) => t.requestId === requestId));
    const nextActiveId =
      remaining.find((t) => t.tabId === activeTabId)?.tabId ??
      remaining[0]?.tabId ??
      null;
    set({ tabs: remaining, activeTabId: nextActiveId });
    persistTabs(remaining);
  },

  closeTabsForRequests(requestIds) {
    const idSet = new Set(requestIds);
    const { tabs, activeTabId } = get();
    const remaining = tabs.filter(
      (t) => !t.requestId || !idSet.has(t.requestId),
    );
    disconnectSocketTabs(tabs.filter((t) => !remaining.includes(t)));
    const nextActiveId =
      remaining.find((t) => t.tabId === activeTabId)?.tabId ??
      remaining[0]?.tabId ??
      null;
    set({ tabs: remaining, activeTabId: nextActiveId });
    persistTabs(remaining);
  },

  setActiveTab(tabId) {
    set({ activeTabId: tabId });
  },

  updateTabState(tabId, patch) {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.tabId === tabId ? ({ ...t, isDirty: true, ...patch } as TabState) : t,
      ),
    }));
    // No persistence here — tabs are only written to DB on explicit Save
    // (and on open/close to maintain the tab list across reloads).
  },

  setTabLabel(tabId, group, color) {
    set((state) => {
      // Update label fields first
      const labeled = state.tabs.map((t) =>
        t.tabId === tabId
          ? ({
              ...t,
              group: group || undefined,
              color: color || undefined,
            } as TabState)
          : t,
      );

      // If a group name was set, move this tab adjacent to other group members
      const tabs = group ? groupAdjacentTabs(labeled, tabId, group) : labeled;
      persistTabs(tabs);
      return { tabs };
    });
  },

  reorderTabs(fromIndex, toIndex) {
    set((state) => {
      if (fromIndex === toIndex) return state;
      const tabs = [...state.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      persistTabs(tabs);
      return { tabs };
    });
  },

  async hydrate() {
    // Snapshot the tabs array reference. If a user action (e.g. openTab)
    // mutates the store while this async hydration is in flight, `tabs`
    // will be a new array and we must not clobber that newer state with
    // whatever was last persisted to IDB.
    const tabsBeforeHydration = get().tabs;
    const db = getDB();
    if (!db) {
      set({ hydrated: true });
      return;
    }
    try {
      const instance = await db;
      const saved = await instance.getAll("tabs");
      if (get().tabs !== tabsBeforeHydration) {
        set({ hydrated: true });
        return;
      }
      if (saved.length > 0) {
        const tabs = saved.map((t) => normalizePersistedTab(t as TabState));
        set({ tabs, activeTabId: tabs[0].tabId, hydrated: true });
      } else {
        set({ tabs: [], activeTabId: null, hydrated: true });
      }
    } catch (error) {
      toast.error("Failed to load tabs", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      set({ hydrated: true });
    }
  },
}));
