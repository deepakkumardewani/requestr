/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectionStore } from "@/stores/useConnectionStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { WebSocketTab } from "@/types";
import { ConnectButton } from "./ConnectButton";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function resetAll() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useConnectionStore.setState({ connections: {} });
  useEnvironmentsStore.setState({
    environments: [],
    activeEnvId: null,
    hydrated: true,
  });
}

afterEach(() => {
  cleanup();
  resetAll();
});

describe("ConnectButton", () => {
  beforeEach(() => {
    resetAll();
  });

  it("disables Connect when the resolved URL is empty", () => {
    useTabsStore.getState().openTab({ type: "websocket", url: "   " });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;

    render(<ConnectButton tabId={tabId} type="websocket" />);

    expect(screen.getByTestId("connect-btn")).toBeDisabled();
  });

  it("shows Connecting spinner while connection is in progress", () => {
    useTabsStore.getState().openTab({ type: "websocket", url: "wss://x" });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;
    useConnectionStore.setState({
      connections: {
        [tabId]: { isConnected: false, isConnecting: true, error: null },
      },
    });

    render(<ConnectButton tabId={tabId} type="websocket" />);

    expect(screen.getByTestId("connect-btn")).toBeDisabled();
    expect(screen.getByTestId("connect-btn")).toHaveTextContent("Connecting");
  });

  it("shows Disconnect when connected", () => {
    useTabsStore.getState().openTab({ type: "websocket", url: "wss://x" });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;
    useConnectionStore.setState({
      connections: {
        [tabId]: { isConnected: true, isConnecting: false, error: null },
      },
    });

    render(<ConnectButton tabId={tabId} type="websocket" />);

    expect(screen.getByTestId("disconnect-btn")).toHaveTextContent("Disconnect");
  });

  it("resolves environment variables in the tab URL before connect", () => {
    useEnvironmentsStore.setState({
      environments: [
        {
          id: "env1",
          name: "Dev",
          variables: [
            {
              id: "v1",
              key: "host",
              initialValue: "wss://resolved",
              currentValue: "wss://resolved",
              isSecret: false,
            },
          ],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      activeEnvId: "env1",
      hydrated: true,
    });
    useTabsStore.getState().openTab({
      type: "websocket",
      url: "{{host}}/socket",
    });
    const tabId = (useTabsStore.getState().tabs[0] as WebSocketTab).tabId;
    const connectSpy = vi.spyOn(useConnectionStore.getState(), "connect");

    render(<ConnectButton tabId={tabId} type="websocket" />);
    fireEvent.click(screen.getByTestId("connect-btn"));

    expect(connectSpy).toHaveBeenCalledWith(
      tabId,
      "wss://resolved/socket",
      "websocket",
    );
  });
});
