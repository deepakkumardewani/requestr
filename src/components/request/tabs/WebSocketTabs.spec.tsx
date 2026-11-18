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
import type { WebSocketTab } from "@/types";
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

  it("legacy tab without draft renders an empty message input", () => {
    useTabsStore.setState({
      tabs: [
        {
          tabId: "legacy",
          requestId: null,
          name: "WS",
          isDirty: false,
          type: "websocket",
          url: "wss://x",
          headers: [],
          messageLog: [],
        },
      ],
      activeTabId: "legacy",
    });

    render(<WebSocketTabs tabId="legacy" />);

    expect(screen.getByTestId("ws-message-input")).toHaveValue("");
  });

  it("typing writes the draft to the tab and it survives remount", () => {
    useTabsStore.getState().openTab({ type: "websocket" });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;
    const { unmount } = render(<WebSocketTabs tabId={tabId} />);

    fireEvent.change(screen.getByTestId("ws-message-input"), {
      target: { value: "ping" },
    });
    expect((useTabsStore.getState().tabs[0] as WebSocketTab).draft).toBe(
      "ping",
    );

    unmount();
    render(<WebSocketTabs tabId={tabId} />);
    expect(screen.getByTestId("ws-message-input")).toHaveValue("ping");
  });

  it("send forwards the draft and clears it when connected", () => {
    const sendWebSocketMessage = vi.fn(() => true);
    useTabsStore.getState().openTab({ type: "websocket", draft: "hi" });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;
    useConnectionStore.setState({
      connections: {
        [tabId]: { isConnected: true, isConnecting: false, error: null },
      },
      sendWebSocketMessage,
    });

    render(<WebSocketTabs tabId={tabId} />);
    fireEvent.click(screen.getByTestId("ws-send-btn"));

    expect(sendWebSocketMessage).toHaveBeenCalledWith(tabId, "hi");
    expect((useTabsStore.getState().tabs[0] as WebSocketTab).draft).toBe("");
  });

  it("send does nothing when the draft is empty", () => {
    const sendWebSocketMessage = vi.fn(() => true);
    useTabsStore.getState().openTab({ type: "websocket" });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;
    useConnectionStore.setState({
      connections: {
        [tabId]: { isConnected: true, isConnecting: false, error: null },
      },
      sendWebSocketMessage,
    });

    render(<WebSocketTabs tabId={tabId} />);
    fireEvent.click(screen.getByTestId("ws-send-btn"));

    expect(sendWebSocketMessage).not.toHaveBeenCalled();
  });

  it("renders nothing for a missing or non-websocket tab", () => {
    useTabsStore.getState().openTab({ type: "socketio" });
    const sioId = useTabsStore.getState().tabs[0].tabId;

    const { container: missing } = render(<WebSocketTabs tabId="nope" />);
    const { container: wrongType } = render(<WebSocketTabs tabId={sioId} />);

    expect(missing).toBeEmptyDOMElement();
    expect(wrongType).toBeEmptyDOMElement();
  });
});
