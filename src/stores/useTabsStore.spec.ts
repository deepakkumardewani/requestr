import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDB } from "@/lib/idb";
import type {
  GraphQLTab,
  HttpTab,
  SocketIOTab,
  TabState,
  WebSocketTab,
} from "@/types";
import { useTabsStore } from "./useTabsStore";

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(),
}));

const httpTabFixture: Omit<HttpTab, "tabId"> = {
  requestId: "r1",
  name: "API",
  isDirty: false,
  type: "http",
  url: "https://api.example.com",
  headers: [],
  method: "POST",
  params: [],
  auth: { type: "none" },
  body: { type: "json", content: "{}" },
  preScript: "",
  postScript: "",
};

function resetTabsStore() {
  useTabsStore.setState({ tabs: [], activeTabId: null, hydrated: false });
}

function mockDbWithTabs(tabsReturn: TabState[]) {
  return {
    getAll: vi.fn(async (store: string) => {
      if (store === "tabs") return tabsReturn;
      return [];
    }),
    transaction: vi.fn(() => {
      const store = {
        clear: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
      };
      return {
        store,
        done: Promise.resolve(),
      };
    }),
  };
}

describe("useTabsStore", () => {
  beforeEach(() => {
    resetTabsStore();
    vi.mocked(getDB).mockReturnValue(null);
    vi.clearAllMocks();
  });

  it("opens HTTP tab and sets active", () => {
    useTabsStore.getState().openTab(httpTabFixture);
    const { tabs, activeTabId } = useTabsStore.getState();
    expect(tabs).toHaveLength(1);
    expect(activeTabId).toBe(tabs[0].tabId);
    expect(tabs[0].type).toBe("http");
    expect((tabs[0] as HttpTab).method).toBe("POST");
  });

  it("opens GraphQL tab with defaults", () => {
    useTabsStore.getState().openTab({ type: "graphql", name: "GQL" });
    const tab = useTabsStore.getState().tabs[0] as GraphQLTab;
    expect(tab.type).toBe("graphql");
    expect(tab.query).toBe("");
    expect(tab.variables).toBe("{}");
  });

  it("opens WebSocket tab with wss default URL", () => {
    useTabsStore.getState().openTab({ type: "websocket" });
    const tab = useTabsStore.getState().tabs[0] as WebSocketTab;
    expect(tab.type).toBe("websocket");
    expect(tab.url).toBe("wss://");
    expect(tab.messageLog).toEqual([]);
  });

  it("opens Socket.IO tab", () => {
    useTabsStore.getState().openTab({ type: "socketio" });
    const tab = useTabsStore.getState().tabs[0] as SocketIOTab;
    expect(tab.type).toBe("socketio");
    expect(tab.url).toBe("http://");
  });

  it("setActiveTab updates only active id", () => {
    useTabsStore.getState().openTab();
    useTabsStore.getState().openTab();
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().setActiveTab(a.tabId);
    expect(useTabsStore.getState().activeTabId).toBe(a.tabId);
    useTabsStore.getState().setActiveTab(b.tabId);
    expect(useTabsStore.getState().activeTabId).toBe(b.tabId);
  });

  it("closeTab activates neighbor when closing active", () => {
    useTabsStore.getState().openTab({ name: "1" });
    useTabsStore.getState().openTab({ name: "2" });
    useTabsStore.getState().openTab({ name: "3" });
    const tabs = useTabsStore.getState().tabs;
    useTabsStore.getState().setActiveTab(tabs[1].tabId);
    useTabsStore.getState().closeTab(tabs[1].tabId);
    const { activeTabId, tabs: left } = useTabsStore.getState();
    expect(left).toHaveLength(2);
    expect(activeTabId).toBe(tabs[2].tabId);
  });

  it("closeTab activates previous when closing last tab", () => {
    useTabsStore.getState().openTab({ name: "1" });
    useTabsStore.getState().openTab({ name: "2" });
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().setActiveTab(b.tabId);
    useTabsStore.getState().closeTab(b.tabId);
    expect(useTabsStore.getState().activeTabId).toBe(a.tabId);
  });

  it("closeOtherTabs keeps one tab", () => {
    useTabsStore.getState().openTab({ name: "1" });
    useTabsStore.getState().openTab({ name: "2" });
    const keep = useTabsStore.getState().tabs[0].tabId;
    useTabsStore.getState().closeOtherTabs(keep);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().activeTabId).toBe(keep);
  });

  it("closeAllTabs clears state", () => {
    useTabsStore.getState().openTab();
    useTabsStore.getState().closeAllTabs();
    expect(useTabsStore.getState().tabs).toEqual([]);
    expect(useTabsStore.getState().activeTabId).toBeNull();
  });

  it("closeTabsForRequest removes matching tabs", () => {
    useTabsStore.getState().openTab({ requestId: "r1", name: "a" });
    useTabsStore.getState().openTab({ requestId: "r2", name: "b" });
    useTabsStore.getState().closeTabsForRequest("r1");
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].requestId).toBe("r2");
  });

  it("closeTabsForRequests removes tabs for any listed request id", () => {
    useTabsStore.getState().openTab({ requestId: "r1" });
    useTabsStore.getState().openTab({ requestId: "r2" });
    useTabsStore.getState().openTab({ requestId: "r3" });
    useTabsStore.getState().closeTabsForRequests(["r1", "r3"]);
    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0].requestId).toBe("r2");
  });

  it("updateTabState marks dirty and merges patch", () => {
    useTabsStore.getState().openTab({ name: "n" });
    const id = useTabsStore.getState().tabs[0].tabId;
    useTabsStore.getState().updateTabState(id, { name: "x" });
    const tab = useTabsStore.getState().tabs[0] as HttpTab;
    expect(tab.name).toBe("x");
    expect(tab.isDirty).toBe(true);
  });

  it("hydrate early-returns when getDB is null", async () => {
    await useTabsStore.getState().hydrate();
    expect(useTabsStore.getState().tabs).toEqual([]);
    expect(useTabsStore.getState().hydrated).toBe(true);
  });

  it("hydrate loads tabs and sets first active", async () => {
    const gql: GraphQLTab = {
      tabId: "g1",
      requestId: null,
      name: "G",
      isDirty: false,
      type: "graphql",
      url: "",
      headers: [],
      query: "{}",
      variables: "{}",
      operationName: "",
      auth: { type: "none" },
    };
    const db = mockDbWithTabs([gql]);
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useTabsStore.getState().hydrate();

    expect(db.getAll).toHaveBeenCalledWith("tabs");
    expect(useTabsStore.getState().tabs[0]).toEqual(gql);
    expect(useTabsStore.getState().activeTabId).toBe("g1");
    expect(useTabsStore.getState().hydrated).toBe(true);
  });

  it("hydrate normalizes legacy HTTP tab shape", async () => {
    const legacy = {
      tabId: "leg",
      requestId: null,
      name: "L",
      isDirty: false,
      url: "/old",
      headers: [{ id: "h", key: "k", value: "v", enabled: true }],
      method: "PUT",
      params: [],
      auth: { type: "none" as const },
      body: { type: "text" as const, content: "x" },
      preScript: "p",
      postScript: "q",
    };
    const db = mockDbWithTabs([legacy as never as TabState]);
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useTabsStore.getState().hydrate();

    const tab = useTabsStore.getState().tabs[0] as HttpTab;
    expect(tab.type).toBe("http");
    expect(tab.method).toBe("PUT");
    expect(tab.url).toBe("/old");
  });

  it("hydrate clears state when no saved tabs", async () => {
    const db = mockDbWithTabs([]);
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useTabsStore.getState().hydrate();

    expect(useTabsStore.getState().tabs).toEqual([]);
    expect(useTabsStore.getState().activeTabId).toBeNull();
    expect(useTabsStore.getState().hydrated).toBe(true);
  });

  it("hydrate shows toast and clears on failure", async () => {
    const db = {
      getAll: vi.fn().mockRejectedValue(new Error("idb fail")),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    await useTabsStore.getState().hydrate();

    expect(toast.error).toHaveBeenCalled();
    expect(useTabsStore.getState().tabs).toEqual([]);
    expect(useTabsStore.getState().hydrated).toBe(true);
  });

  it("openTab persists every tab (including draft) to the tabs store", async () => {
    const put = vi.fn().mockResolvedValue(undefined);
    const db = {
      transaction: vi.fn(() => ({
        store: { clear: vi.fn().mockResolvedValue(undefined), put },
        done: Promise.resolve(),
      })),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useTabsStore
      .getState()
      .openTab({ type: "websocket", draft: "persist-me" } as Partial<TabState>);

    await vi.waitFor(() => expect(put).toHaveBeenCalledTimes(1));
    expect(put.mock.calls[0][0]).toMatchObject({
      type: "websocket",
      draft: "persist-me",
    });
  });

  it("hydrate does not overwrite tabs opened while it was in flight", async () => {
    const saved: WebSocketTab = {
      tabId: "old",
      requestId: null,
      name: "Old",
      isDirty: false,
      type: "websocket",
      url: "wss://old",
      headers: [],
      messageLog: [],
    };
    const db = mockDbWithTabs([saved]);
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    const pending = useTabsStore.getState().hydrate();
    useTabsStore.getState().openTab({ name: "fresh" });
    await pending;

    const { tabs, hydrated } = useTabsStore.getState();
    expect(tabs.map((t) => t.name)).toEqual(["fresh"]);
    expect(hydrated).toBe(true);
  });

  it("persist failure shows toast when DB returns and transaction fails", async () => {
    const badTx = {
      store: {
        clear: vi.fn().mockRejectedValue(new Error("clear fail")),
        put: vi.fn(),
      },
      done: Promise.resolve(),
    };
    const db = {
      transaction: vi.fn(() => badTx),
    };
    vi.mocked(getDB).mockReturnValue(Promise.resolve(db as never));

    useTabsStore.getState().openTab();

    await vi.waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to save tabs", {
        description: "clear fail",
      }),
    );
  });

  it("closeTab clears state when closing the last tab", () => {
    useTabsStore.getState().openTab({ name: "only" });
    const [tab] = useTabsStore.getState().tabs;
    useTabsStore.getState().closeTab(tab.tabId);
    expect(useTabsStore.getState().tabs).toEqual([]);
    expect(useTabsStore.getState().activeTabId).toBeNull();
  });

  it("closeTabsForRequest activates neighbor when closing active tab's request", () => {
    useTabsStore.getState().openTab({ requestId: "r1", name: "a" });
    useTabsStore.getState().openTab({ requestId: "r1", name: "b" });
    useTabsStore.getState().openTab({ requestId: "r2", name: "c" });
    const tabs = useTabsStore.getState().tabs;
    useTabsStore.getState().setActiveTab(tabs[0].tabId);
    useTabsStore.getState().closeTabsForRequest("r1");
    const state = useTabsStore.getState();
    expect(state.tabs).toHaveLength(1);
    expect(state.activeTabId).toBe(tabs[2].tabId);
  });

  it("setTabLabel updates group and color", () => {
    useTabsStore.getState().openTab({ name: "t" });
    const id = useTabsStore.getState().tabs[0].tabId;
    useTabsStore.getState().setTabLabel(id, "Auth", "#ff0000");
    const tab = useTabsStore.getState().tabs[0];
    expect(tab.group).toBe("Auth");
    expect(tab.color).toBe("#ff0000");
  });

  it("setTabLabel clears group and color when empty", () => {
    useTabsStore.getState().openTab({ name: "t" });
    const id = useTabsStore.getState().tabs[0].tabId;
    useTabsStore.getState().setTabLabel(id, "Auth", "#ff0000");
    useTabsStore.getState().setTabLabel(id, "", "");
    const tab = useTabsStore.getState().tabs[0];
    expect(tab.group).toBeUndefined();
    expect(tab.color).toBeUndefined();
  });

  it("setTabLabel groups adjacent tabs with same label", () => {
    useTabsStore.getState().openTab({ name: "1" });
    useTabsStore.getState().openTab({ name: "2" });
    useTabsStore.getState().openTab({ name: "3" });
    const [a, b] = useTabsStore.getState().tabs;
    useTabsStore.getState().setTabLabel(a.tabId, "GroupA", "");
    useTabsStore.getState().setTabLabel(b.tabId, "GroupA", "");
    const { tabs } = useTabsStore.getState();
    const groupIds = tabs.filter((t) => t.group === "GroupA").map((t) => t.tabId);
    expect(groupIds).toHaveLength(2);
  });

  it("reorderTabs swaps tab positions", () => {
    useTabsStore.getState().openTab({ name: "a" });
    useTabsStore.getState().openTab({ name: "b" });
    useTabsStore.getState().openTab({ name: "c" });
    const before = useTabsStore.getState().tabs.map((t) => t.name);
    expect(before).toEqual(["a", "b", "c"]);
    useTabsStore.getState().reorderTabs(0, 2);
    const after = useTabsStore.getState().tabs.map((t) => t.name);
    expect(after).toEqual(["b", "c", "a"]);
  });

  it("hydrate keeps old WebSocket and Socket.IO tabs without draft/eventName empty", async () => {
    const ws: WebSocketTab = {
      tabId: "w1",
      requestId: null,
      name: "WS",
      isDirty: false,
      type: "websocket",
      url: "wss://echo.example.com",
      headers: [],
      messageLog: [],
    };
    const sio: SocketIOTab = {
      tabId: "s1",
      requestId: null,
      name: "SIO",
      isDirty: false,
      type: "socketio",
      url: "http://localhost:3333",
      headers: [],
      messageLog: [],
    };
    vi.mocked(getDB).mockReturnValue(
      Promise.resolve(mockDbWithTabs([ws, sio]) as never),
    );

    await useTabsStore.getState().hydrate();

    const [loadedWs, loadedSio] = useTabsStore.getState().tabs as [
      WebSocketTab,
      SocketIOTab,
    ];
    expect(loadedWs.type).toBe("websocket");
    expect(loadedWs.draft).toBeUndefined();
    expect(loadedSio.type).toBe("socketio");
    expect(loadedSio.draft).toBeUndefined();
    expect(loadedSio.eventName).toBeUndefined();
  });

  it("hydrate restores persisted draft and eventName", async () => {
    const sio: SocketIOTab = {
      tabId: "s1",
      requestId: null,
      name: "SIO",
      isDirty: false,
      type: "socketio",
      url: "http://localhost:3333",
      headers: [],
      messageLog: [],
      draft: '{"a":1}',
      eventName: "chat",
    };
    vi.mocked(getDB).mockReturnValue(
      Promise.resolve(mockDbWithTabs([sio]) as never),
    );

    await useTabsStore.getState().hydrate();

    expect(useTabsStore.getState().tabs[0]).toEqual(sio);
  });

  it("openTab seeds WebSocket and Socket.IO draft/eventName from initial values", () => {
    useTabsStore
      .getState()
      .openTab({ type: "websocket", draft: "hello" } as Partial<TabState>);
    useTabsStore.getState().openTab({
      type: "socketio",
      draft: "{}",
      eventName: "ping",
    } as Partial<TabState>);

    const [ws, sio] = useTabsStore.getState().tabs as [
      WebSocketTab,
      SocketIOTab,
    ];
    expect(ws.draft).toBe("hello");
    expect(sio.draft).toBe("{}");
    expect(sio.eventName).toBe("ping");
  });

  it("updateTabState writes draft/eventName and they survive switching active tab", () => {
    useTabsStore.getState().openTab({ type: "websocket" });
    useTabsStore.getState().openTab({ type: "socketio" });
    const [ws, sio] = useTabsStore.getState().tabs;

    useTabsStore.getState().updateTabState(ws.tabId, { draft: "ws-draft" });
    useTabsStore
      .getState()
      .updateTabState(sio.tabId, { draft: "sio-draft", eventName: "evt" });
    useTabsStore.getState().setActiveTab(ws.tabId);
    useTabsStore.getState().setActiveTab(sio.tabId);

    const [wsAfter, sioAfter] = useTabsStore.getState().tabs as [
      WebSocketTab,
      SocketIOTab,
    ];
    expect(wsAfter.draft).toBe("ws-draft");
    expect(wsAfter.isDirty).toBe(true);
    expect(sioAfter.draft).toBe("sio-draft");
    expect(sioAfter.eventName).toBe("evt");
  });

  it("reorderTabs is no-op when fromIndex equals toIndex", () => {
    useTabsStore.getState().openTab({ name: "a" });
    useTabsStore.getState().openTab({ name: "b" });
    const before = useTabsStore.getState().tabs.map((t) => t.name);
    useTabsStore.getState().reorderTabs(0, 0);
    expect(useTabsStore.getState().tabs.map((t) => t.name)).toEqual(before);
  });
});
