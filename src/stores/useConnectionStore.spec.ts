import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectionStore } from "./useConnectionStore";
import { useTabsStore } from "./useTabsStore";

vi.mock("@/lib/constants", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/constants")>();
  return { ...mod, MAX_WS_LOG_ENTRIES: 2 };
});

const ioMock = vi.fn();
vi.mock("socket.io-client", () => ({
  io: (...args: unknown[]) => ioMock(...args),
}));

let wsCtorThrow = false;
let lastWs: MockWebSocket | null = null;
let wsOpenAsync = true;

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;
  static closedForReconnect = 0;

  url: string;
  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;

  constructor(url: string) {
    if (wsCtorThrow) throw new Error("ws ctor fail");
    this.url = url;
    lastWs = this;
    if (wsOpenAsync) {
      queueMicrotask(() => {
        this.readyState = MockWebSocket.OPEN;
        this.onopen?.();
      });
    }
  }

  close() {
    MockWebSocket.closedForReconnect++;
    this.readyState = MockWebSocket.CLOSED;
    queueMicrotask(() => this.onclose?.());
  }

  send(_data: string) {}
}

function makeIoSocket() {
  const listeners: Record<string, Array<(...a: unknown[]) => void>> = {};
  const socket = {
    connected: false,
    on(ev: string, fn: (...a: unknown[]) => void) {
      (listeners[ev] ??= []).push(fn);
      return socket;
    },
    emit: vi.fn(),
    disconnect: vi.fn(() => {
      socket.connected = false;
      for (const fn of listeners.disconnect ?? []) fn();
    }),
    fire(ev: string, ...args: unknown[]) {
      for (const fn of listeners[ev] ?? []) fn(...args);
    },
  };
  return socket;
}

function openWsTabEmpty(tabId: string) {
  useTabsStore.setState({
    tabs: [
      {
        tabId,
        requestId: null,
        name: "WS",
        isDirty: false,
        type: "websocket",
        url: "wss://x",
        headers: [],
        messageLog: [],
      },
    ],
    activeTabId: tabId,
  });
}

function openWsTab(tabId: string) {
  useTabsStore.setState({
    tabs: [
      {
        tabId,
        requestId: null,
        name: "WS",
        isDirty: false,
        type: "websocket",
        url: "wss://x",
        headers: [],
        messageLog: [
          { id: "m0", direction: "sent", data: "a", timestamp: 1 },
          { id: "m1", direction: "sent", data: "b", timestamp: 2 },
        ],
      },
    ],
    activeTabId: tabId,
  });
}

function openSocketIoTab(tabId: string) {
  useTabsStore.setState({
    tabs: [
      {
        tabId,
        requestId: null,
        name: "IO",
        isDirty: false,
        type: "socketio",
        url: "http://x",
        headers: [],
        messageLog: [],
      },
    ],
    activeTabId: tabId,
  });
}

const TAB_IDS = ["t1", "tabIo", "tCircular", "orphan"] as const;

describe("useConnectionStore", () => {
  beforeEach(() => {
    wsCtorThrow = false;
    wsOpenAsync = true;
    lastWs = null;
    MockWebSocket.closedForReconnect = 0;
    for (const id of TAB_IDS) {
      useConnectionStore.getState().disconnect(id);
    }
    useTabsStore.setState({ tabs: [], activeTabId: null });
    useConnectionStore.setState({ connections: {} });
    ioMock.mockReset();
    vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("setError stores message and clears connecting", () => {
    useConnectionStore.getState().setError("t1", "oops");
    expect(useConnectionStore.getState().connections.t1).toEqual({
      error: "oops",
      isConnecting: false,
      isConnected: false,
    });
  });

  it("WebSocket connect opens and updates state", async () => {
    useConnectionStore.getState().connect("t1", "wss://h", "websocket");
    expect(useConnectionStore.getState().connections.t1.isConnecting).toBe(
      true,
    );
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections.t1.isConnected).toBe(
        true,
      ),
    );
    expect(useConnectionStore.getState().connections.t1.isConnecting).toBe(
      false,
    );
  });

  it("WebSocket constructor error calls setError", () => {
    wsCtorThrow = true;
    useConnectionStore.getState().connect("t1", "wss://h", "websocket");
    expect(useConnectionStore.getState().connections.t1.error).toBe(
      "ws ctor fail",
    );
  });

  it("WebSocket onerror surfaces error", async () => {
    wsOpenAsync = false;
    useConnectionStore.getState().connect("t1", "wss://h", "websocket");
    await Promise.resolve();
    lastWs!.onerror?.();
    expect(useConnectionStore.getState().connections.t1.error).toBe(
      "WebSocket error",
    );
  });

  it("WebSocket onmessage appends log with cap", async () => {
    openWsTab("t1");
    useConnectionStore.getState().connect("t1", "wss://h", "websocket");
    await vi.waitFor(() => lastWs?.onmessage);
    lastWs!.onmessage!({ data: "third" });
    const log = (
      useTabsStore.getState().tabs[0] as { messageLog: { data: string }[] }
    ).messageLog;
    expect(log.map((e) => e.data)).toEqual(["b", "third"]);
  });

  it("second connect closes previous WebSocket", async () => {
    useConnectionStore.getState().connect("t1", "wss://a", "websocket");
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections.t1.isConnected).toBe(
        true,
      ),
    );
    const prevClosedBefore = MockWebSocket.closedForReconnect;
    useConnectionStore.getState().connect("t1", "wss://b", "websocket");
    expect(MockWebSocket.closedForReconnect).toBeGreaterThan(prevClosedBefore);
  });

  it("sendWebSocketMessage returns false when not open", async () => {
    wsOpenAsync = false;
    useConnectionStore.getState().connect("t1", "wss://h", "websocket");
    await Promise.resolve();
    expect(useConnectionStore.getState().sendWebSocketMessage("t1", "x")).toBe(
      false,
    );
  });

  it("sendWebSocketMessage sends when open", async () => {
    openWsTabEmpty("t1");
    useConnectionStore.getState().connect("t1", "wss://h", "websocket");
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections.t1.isConnected).toBe(
        true,
      ),
    );
    expect(
      useConnectionStore.getState().sendWebSocketMessage("t1", "payload"),
    ).toBe(true);
    const log = (
      useTabsStore.getState().tabs[0] as {
        messageLog: { direction: string; data: string }[];
      }
    ).messageLog;
    expect(
      log.some((e) => e.direction === "sent" && e.data === "payload"),
    ).toBe(true);
  });

  it("emitSocketIoMessage sends when connected", async () => {
    const sock = makeIoSocket();
    ioMock.mockImplementation(() => {
      queueMicrotask(() => {
        sock.connected = true;
        sock.fire("connect");
      });
      return sock;
    });
    openSocketIoTab("t1");
    useConnectionStore.getState().connect("t1", "http://h", "socketio");
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections.t1.isConnected).toBe(
        true,
      ),
    );
    expect(
      useConnectionStore.getState().emitSocketIoMessage("t1", "ev", "d"),
    ).toBe(true);
    expect(sock.emit).toHaveBeenCalledWith("ev", "d");
  });

  it("emitSocketIoMessage returns false when socket not connected", async () => {
    const sock = makeIoSocket();
    ioMock.mockReturnValue(sock);
    useConnectionStore.getState().connect("t1", "http://h", "socketio");
    await Promise.resolve();
    expect(
      useConnectionStore.getState().emitSocketIoMessage("t1", "ev", "d"),
    ).toBe(false);
  });

  it("socket.io connect_error disconnects and retains the error after the disconnect handler", async () => {
    const sock = makeIoSocket();
    ioMock.mockImplementation(() => {
      queueMicrotask(() => sock.fire("connect_error", new Error("fail io")));
      return sock;
    });
    useConnectionStore.getState().connect("t1", "http://h", "socketio");
    await vi.waitFor(() => expect(sock.disconnect).toHaveBeenCalled());
    expect(useConnectionStore.getState().connections.t1).toEqual({
      isConnected: false,
      isConnecting: false,
      error: "fail io",
    });
  });

  it("socket.io next connect attempt clears the retained connect_error", () => {
    const failing = makeIoSocket();
    const next = makeIoSocket();
    ioMock.mockImplementationOnce(() => failing).mockImplementationOnce(() => next);
    useConnectionStore.getState().connect("t1", "http://h", "socketio");
    failing.fire("connect_error", new Error("fail io"));
    expect(useConnectionStore.getState().connections.t1.error).toBe("fail io");
    useConnectionStore.getState().connect("t1", "http://h", "socketio");
    expect(useConnectionStore.getState().connections.t1.error).toBeNull();
  });

  it("socket.io message formats JSON object and null", async () => {
    const sock = makeIoSocket();
    ioMock.mockImplementation(() => {
      queueMicrotask(() => {
        sock.connected = true;
        sock.fire("connect");
      });
      return sock;
    });
    const tabId = "tabIo";
    openSocketIoTab(tabId);
    useConnectionStore.getState().connect(tabId, "http://h", "socketio");
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections[tabId].isConnected).toBe(
        true,
      ),
    );
    sock.fire("message", { ok: true });
    sock.fire("message", null);
    const log = (
      useTabsStore.getState().tabs[0] as {
        messageLog: { direction: string; data: string }[];
      }
    ).messageLog;
    expect(log.map((e) => e.data)).toContain('{"ok":true}');
    expect(log.map((e) => e.data)).toContain("null");
  });

  it("socket.io message uses String fallback when JSON.stringify throws", async () => {
    const sock = makeIoSocket();
    ioMock.mockImplementation(() => {
      queueMicrotask(() => {
        sock.connected = true;
        sock.fire("connect");
      });
      return sock;
    });
    openSocketIoTab("tCircular");
    useConnectionStore.getState().connect("tCircular", "http://h", "socketio");
    await vi.waitFor(() =>
      expect(
        useConnectionStore.getState().connections.tCircular.isConnected,
      ).toBe(true),
    );
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    sock.fire("message", circular);
    const log = (
      useTabsStore.getState().tabs[0] as { messageLog: { data: string }[] }
    ).messageLog;
    expect(log[log.length - 1].data).toBe("[object Object]");
  });

  it("disconnect clears state and closes socket", async () => {
    useConnectionStore.getState().connect("t1", "wss://a", "websocket");
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections.t1.isConnected).toBe(
        true,
      ),
    );
    const closeSpy = vi.spyOn(lastWs!, "close");
    useConnectionStore.getState().disconnect("t1");
    expect(closeSpy).toHaveBeenCalled();
    expect(useConnectionStore.getState().connections.t1).toEqual({
      isConnected: false,
      isConnecting: false,
      error: null,
    });
    closeSpy.mockRestore();
  });

  it("socket.io disconnect handler resets connection", async () => {
    const sock = makeIoSocket();
    ioMock.mockImplementation(() => {
      queueMicrotask(() => {
        sock.connected = true;
        sock.fire("connect");
      });
      return sock;
    });
    useConnectionStore.getState().connect("t1", "http://h", "socketio");
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections.t1.isConnected).toBe(
        true,
      ),
    );
    sock.fire("disconnect");
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections.t1.isConnected).toBe(
        false,
      ),
    );
    expect(useConnectionStore.getState().connections.t1.error).toBeNull();
  });

  it("sendWebSocketMessage returns false for Socket.IO ref", async () => {
    const sock = makeIoSocket();
    ioMock.mockImplementation(() => {
      queueMicrotask(() => {
        sock.connected = true;
        sock.fire("connect");
      });
      return sock;
    });
    openSocketIoTab("t1");
    useConnectionStore.getState().connect("t1", "http://h", "socketio");
    await vi.waitFor(() =>
      expect(useConnectionStore.getState().connections.t1.isConnected).toBe(
        true,
      ),
    );
    expect(useConnectionStore.getState().sendWebSocketMessage("t1", "x")).toBe(
      false,
    );
  });

  it("emitSocketIoMessage returns false when tab has no socket ref", () => {
    openSocketIoTab("orphan");
    expect(
      useConnectionStore.getState().emitSocketIoMessage("orphan", "e", "d"),
    ).toBe(false);
  });
});
