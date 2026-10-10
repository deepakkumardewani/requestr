/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { SocketIOTab } from "@/types";
import { SocketIOTabs } from "./SocketIOTabs";

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

describe("SocketIOTabs", () => {
  beforeEach(() => {
    resetAll();
  });

  it("does not send when draft is empty", () => {
    useTabsStore.getState().openTab({ type: "socketio", url: "http://localhost" });
    const tabId = (useTabsStore.getState().tabs[0] as SocketIOTab).tabId;
    useConnectionStore.setState({
      connections: {
        [tabId]: { isConnected: true, isConnecting: false, error: null },
      },
    });
    const emitSpy = vi.spyOn(useConnectionStore.getState(), "emitSocketIoMessage");

    render(<SocketIOTabs tabId={tabId} />);
    fireEvent.click(screen.getByTestId("socketio-send-btn"));

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it("clears draft after send and uses blank event name as message", () => {
    useTabsStore.getState().openTab({ type: "socketio", url: "http://localhost" });
    const tabId = (useTabsStore.getState().tabs[0] as SocketIOTab).tabId;
    useConnectionStore.setState({
      connections: {
        [tabId]: { isConnected: true, isConnecting: false, error: null },
      },
    });
    const emitSpy = vi.spyOn(useConnectionStore.getState(), "emitSocketIoMessage");

    render(<SocketIOTabs tabId={tabId} />);

    fireEvent.change(screen.getByTestId("socketio-event-input"), {
      target: { value: "   " },
    });
    fireEvent.change(screen.getByTestId("ws-message-input"), {
      target: { value: "payload" },
    });
    fireEvent.click(screen.getByTestId("socketio-send-btn"));

    expect(emitSpy).toHaveBeenCalledWith(tabId, "message", "payload");
    expect(screen.getByTestId("ws-message-input")).toHaveValue("");
  });

  it("send stays disabled while connecting", () => {
    useTabsStore.getState().openTab({ type: "socketio" });
    const tabId = (useTabsStore.getState().tabs[0] as SocketIOTab).tabId;
    useConnectionStore.setState({
      connections: {
        [tabId]: { isConnected: false, isConnecting: true, error: null },
      },
    });

    render(<SocketIOTabs tabId={tabId} />);

    expect(screen.getByTestId("socketio-send-btn")).toBeDisabled();
  });

  it("emits custom event name and payload when connected", () => {
    useTabsStore.getState().openTab({ type: "socketio", url: "http://localhost" });
    const tabId = (useTabsStore.getState().tabs[0] as SocketIOTab).tabId;
    useConnectionStore.setState({
      connections: {
        [tabId]: { isConnected: true, isConnecting: false, error: null },
      },
    });
    const emitSpy = vi.spyOn(useConnectionStore.getState(), "emitSocketIoMessage");

    render(<SocketIOTabs tabId={tabId} />);

    fireEvent.change(screen.getByTestId("socketio-event-input"), {
      target: { value: "chat" },
    });
    fireEvent.change(screen.getByTestId("ws-message-input"), {
      target: { value: '{"x":1}' },
    });
    fireEvent.click(screen.getByTestId("socketio-send-btn"));

    expect(emitSpy).toHaveBeenCalledWith(tabId, "chat", '{"x":1}');
  });
});
