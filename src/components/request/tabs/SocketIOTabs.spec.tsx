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
import type { SocketIOTab } from "@/types";
import { SocketIOTabs } from "./SocketIOTabs";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

const CONNECTED = { isConnected: true, isConnecting: false, error: null };

function resetAll() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useConnectionStore.setState({ connections: {} });
}

function openSocketIOTab(initial: Partial<SocketIOTab> = {}): string {
  useTabsStore.getState().openTab({ type: "socketio", ...initial });
  return useTabsStore.getState().tabs[0].tabId;
}

function currentTab(): SocketIOTab {
  return useTabsStore.getState().tabs[0] as SocketIOTab;
}

beforeEach(resetAll);

afterEach(() => {
  cleanup();
  resetAll();
});

describe("SocketIOTabs", () => {
  it("send is disabled when disconnected", () => {
    const tabId = openSocketIOTab();
    render(<SocketIOTabs tabId={tabId} />);
    expect(screen.getByTestId("socketio-send-btn")).toBeDisabled();
  });

  it("legacy tab without eventName/draft shows 'message' and an empty payload", () => {
    useTabsStore.setState({
      tabs: [
        {
          tabId: "legacy",
          requestId: null,
          name: "SIO",
          isDirty: false,
          type: "socketio",
          url: "http://x",
          headers: [],
          messageLog: [],
        },
      ],
      activeTabId: "legacy",
    });

    render(<SocketIOTabs tabId="legacy" />);

    expect(screen.getByTestId("socketio-event-input")).toHaveValue("message");
    expect(screen.getByTestId("ws-message-input")).toHaveValue("");
  });

  it("shows the persisted eventName and draft", () => {
    const tabId = openSocketIOTab({ eventName: "chat", draft: "payload" });
    render(<SocketIOTabs tabId={tabId} />);
    expect(screen.getByTestId("socketio-event-input")).toHaveValue("chat");
    expect(screen.getByTestId("ws-message-input")).toHaveValue("payload");
  });

  it("editing the event name and payload writes to the tab and survives remount", () => {
    const tabId = openSocketIOTab();
    const { unmount } = render(<SocketIOTabs tabId={tabId} />);

    fireEvent.change(screen.getByTestId("socketio-event-input"), {
      target: { value: "custom-event" },
    });
    fireEvent.change(screen.getByTestId("ws-message-input"), {
      target: { value: "{}" },
    });

    expect(currentTab().eventName).toBe("custom-event");
    expect(currentTab().draft).toBe("{}");

    unmount();
    render(<SocketIOTabs tabId={tabId} />);
    expect(screen.getByTestId("socketio-event-input")).toHaveValue(
      "custom-event",
    );
    expect(screen.getByTestId("ws-message-input")).toHaveValue("{}");
  });

  it("send emits the trimmed event name with the draft, then clears the draft", () => {
    const emitSocketIoMessage = vi.fn(() => true);
    const tabId = openSocketIOTab({ eventName: "  chat  ", draft: "hello" });
    useConnectionStore.setState({
      connections: { [tabId]: CONNECTED },
      emitSocketIoMessage,
    });

    render(<SocketIOTabs tabId={tabId} />);
    fireEvent.click(screen.getByTestId("socketio-send-btn"));

    expect(emitSocketIoMessage).toHaveBeenCalledWith(tabId, "chat", "hello");
    expect(currentTab().draft).toBe("");
  });

  it("send falls back to 'message' when the event name is blank", () => {
    const emitSocketIoMessage = vi.fn(() => true);
    const tabId = openSocketIOTab({ eventName: "   ", draft: "x" });
    useConnectionStore.setState({
      connections: { [tabId]: CONNECTED },
      emitSocketIoMessage,
    });

    render(<SocketIOTabs tabId={tabId} />);
    fireEvent.click(screen.getByTestId("socketio-send-btn"));

    expect(emitSocketIoMessage).toHaveBeenCalledWith(tabId, "message", "x");
  });

  it("clear log empties the message log", () => {
    const tabId = openSocketIOTab({
      messageLog: [
        { id: "m1", direction: "received", data: "hi", timestamp: 1 },
      ],
    });
    render(<SocketIOTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("message-log-clear-btn"));

    expect(currentTab().messageLog).toEqual([]);
  });

  it("switching to headers shows the key/value editor", async () => {
    const tabId = openSocketIOTab();
    render(<SocketIOTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("request-tab-headers"));

    await waitFor(() => {
      expect(screen.getByText("Key")).toBeInTheDocument();
    });
  });

  it("renders nothing for a missing or non-socketio tab", () => {
    useTabsStore.getState().openTab({ type: "websocket" });
    const wsId = useTabsStore.getState().tabs[0].tabId;

    const { container: missing } = render(<SocketIOTabs tabId="nope" />);
    const { container: wrongType } = render(<SocketIOTabs tabId={wsId} />);

    expect(missing).toBeEmptyDOMElement();
    expect(wrongType).toBeEmptyDOMElement();
  });
});
