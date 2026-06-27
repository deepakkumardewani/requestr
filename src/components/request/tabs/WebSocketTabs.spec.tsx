/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { SocketIOTab, WebSocketTab } from "@/types";
import { SocketIOTabs } from "./SocketIOTabs";
import { WebSocketTabs } from "./WebSocketTabs";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function resetAll() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useConnectionStore.setState({ connections: {} });
}

afterEach(() => {
  cleanup();
  resetAll();
});

describe("WebSocketTabs", () => {
  beforeEach(() => {
    resetAll();
  });

  it("messages tab shows send disabled when disconnected", () => {
    useTabsStore.getState().openTab({ type: "websocket" });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;

    render(<WebSocketTabs tabId={tabId} />);

    expect(screen.getByTestId("ws-send-btn")).toBeDisabled();
  });

  it("switching to headers shows KV header columns", async () => {
    useTabsStore.getState().openTab({ type: "websocket" });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;

    render(<WebSocketTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("request-tab-headers"));
    await waitFor(() => {
      expect(screen.getByText("Key")).toBeInTheDocument();
    });
  });

  it("clear log empties message log", () => {
    useTabsStore.getState().openTab({
      type: "websocket",
      messageLog: [
        {
          id: "m1",
          direction: "received",
          data: "hi",
          timestamp: 1,
        },
      ],
    });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;

    render(<WebSocketTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("message-log-clear-btn"));

    const t = useTabsStore.getState().tabs[0] as WebSocketTab;
    expect(t.messageLog).toEqual([]);
  });
});

describe("SocketIOTabs", () => {
  beforeEach(() => {
    resetAll();
  });

  it("send disabled when disconnected", () => {
    useTabsStore.getState().openTab({ type: "socketio" });
    const tabId = (useTabsStore.getState().tabs[0] as SocketIOTab).tabId;

    render(<SocketIOTabs tabId={tabId} />);

    expect(screen.getByTestId("socketio-send-btn")).toBeDisabled();
  });

  it("event name field updates", () => {
    useTabsStore.getState().openTab({ type: "socketio" });
    const tabId = (useTabsStore.getState().tabs[0] as SocketIOTab).tabId;

    render(<SocketIOTabs tabId={tabId} />);

    fireEvent.change(screen.getByTestId("socketio-event-input"), {
      target: { value: "custom-event" },
    });

    expect(screen.getByTestId("socketio-event-input")).toHaveValue(
      "custom-event",
    );
  });
});
