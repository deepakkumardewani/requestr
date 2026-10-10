"use client";

import { io, type Socket } from "socket.io-client";
import { create } from "zustand";
import { MAX_WS_LOG_ENTRIES } from "@/lib/constants";
import { generateId } from "@/lib/utils";
import { useTabsStore } from "@/stores/useTabsStore";

export type ConnectionState = {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
};

function isIoSocket(ref: WebSocket | Socket): ref is Socket {
  return typeof (ref as Socket).emit === "function";
}

type ConnectionStore = {
  connections: Record<string, ConnectionState>;
  connect: (tabId: string, url: string, type: "websocket" | "socketio") => void;
  disconnect: (tabId: string) => void;
  setError: (tabId: string, err: string) => void;
  sendWebSocketMessage: (tabId: string, data: string) => boolean;
  emitSocketIoMessage: (tabId: string, event: string, data: string) => boolean;
};

const socketRefs = new Map<string, WebSocket | Socket>();

const defaultState: ConnectionState = {
  isConnected: false,
  isConnecting: false,
  error: null,
};

function getConn(
  connections: Record<string, ConnectionState>,
  tabId: string,
): ConnectionState {
  return connections[tabId] ?? defaultState;
}

function formatSocketIoPayload(data: string | object | null): string {
  if (data === null) return "null";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

function appendWsLog(
  tabId: string,
  direction: "sent" | "received",
  data: string,
) {
  const { tabs, updateTabState } = useTabsStore.getState();
  const tab = tabs.find((t) => t.tabId === tabId);
  if (!tab || (tab.type !== "websocket" && tab.type !== "socketio")) return;

  const entry = {
    id: generateId(),
    direction,
    data,
    timestamp: Date.now(),
  };
  const next = [...tab.messageLog, entry];
  const capped =
    next.length > MAX_WS_LOG_ENTRIES ? next.slice(-MAX_WS_LOG_ENTRIES) : next;
  updateTabState(tabId, { messageLog: capped });
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connections: {},

  setError(tabId, err) {
    set((state) => ({
      connections: {
        ...state.connections,
        [tabId]: {
          ...getConn(state.connections, tabId),
          error: err,
          isConnecting: false,
        },
      },
    }));
  },

  connect(tabId, url, connType) {
    const prev = socketRefs.get(tabId);
    if (prev) {
      if ("disconnect" in prev && typeof prev.disconnect === "function") {
        prev.disconnect();
      } else {
        prev.close();
      }
      socketRefs.delete(tabId);
    }

    set((state) => ({
      connections: {
        ...state.connections,
        [tabId]: { isConnected: false, isConnecting: true, error: null },
      },
    }));

    if (connType === "websocket") {
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch (e) {
        get().setError(
          tabId,
          e instanceof Error ? e.message : "Failed to open WebSocket",
        );
        return;
      }

      socketRefs.set(tabId, ws);

      ws.onopen = () => {
        set((state) => ({
          connections: {
            ...state.connections,
            [tabId]: { isConnected: true, isConnecting: false, error: null },
          },
        }));
      };

      ws.onerror = () => {
        get().setError(tabId, "WebSocket error");
      };

      ws.onclose = () => {
        socketRefs.delete(tabId);
        set((state) => ({
          connections: {
            ...state.connections,
            [tabId]: {
              isConnected: false,
              isConnecting: false,
              error: getConn(state.connections, tabId).error,
            },
          },
        }));
      };

      ws.onmessage = (ev) => {
        const text = typeof ev.data === "string" ? ev.data : String(ev.data);
        appendWsLog(tabId, "received", text);
      };
      return;
    }

    const socket = io(url, { transports: ["websocket"] });
    socketRefs.set(tabId, socket);

    socket.on("connect", () => {
      set((state) => ({
        connections: {
          ...state.connections,
          [tabId]: { isConnected: true, isConnecting: false, error: null },
        },
      }));
    });

    socket.on("connect_error", (err: Error) => {
      get().setError(tabId, err.message || "Socket.IO connection error");
      socket.disconnect();
      socketRefs.delete(tabId);
    });

    socket.on("disconnect", () => {
      socketRefs.delete(tabId);
      set((state) => ({
        connections: {
          ...state.connections,
          [tabId]: {
            isConnected: false,
            isConnecting: false,
            // Keep a connect_error visible; the next connect() attempt clears it.
            error: getConn(state.connections, tabId).error,
          },
        },
      }));
    });

    socket.on("message", (payload: string | object | null) => {
      appendWsLog(tabId, "received", formatSocketIoPayload(payload));
    });
  },

  disconnect(tabId) {
    const ref = socketRefs.get(tabId);
    if (ref) {
      if ("disconnect" in ref && typeof ref.disconnect === "function") {
        ref.disconnect();
      } else {
        ref.close();
      }
      socketRefs.delete(tabId);
    }
    set((state) => ({
      connections: {
        ...state.connections,
        [tabId]: { isConnected: false, isConnecting: false, error: null },
      },
    }));
  },

  sendWebSocketMessage(tabId, data) {
    const ref = socketRefs.get(tabId);
    if (!ref || isIoSocket(ref)) return false;
    if (ref.readyState !== WebSocket.OPEN) return false;
    ref.send(data);
    appendWsLog(tabId, "sent", data);
    return true;
  },

  emitSocketIoMessage(tabId, event, data) {
    const ref = socketRefs.get(tabId);
    if (!ref || !isIoSocket(ref)) return false;
    if (!ref.connected) return false;
    ref.emit(event, data);
    appendWsLog(tabId, "sent", data);
    return true;
  },
}));
