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
import type { HttpTab } from "@/types";
import { HttpTabs } from "./HttpTabs";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("@/components/request/BodyEditor", () => ({
  BodyEditor: ({ tabId }: { tabId: string }) => (
    <div data-testid="mock-body-editor">{tabId}</div>
  ),
}));

vi.mock("@/components/request/ScriptEditor", () => ({
  ScriptEditor: ({ tabId }: { tabId: string }) => (
    <div data-testid="mock-script-editor">{tabId}</div>
  ),
}));

function resetAll() {
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useConnectionStore.setState({ connections: {} });
}

afterEach(() => {
  cleanup();
  resetAll();
});

describe("HttpTabs", () => {
  beforeEach(() => {
    resetAll();
  });

  it("default tab shows query params content", () => {
    useTabsStore.getState().openTab({ type: "http" });
    const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;

    render(<HttpTabs tabId={tabId} />);

    expect(screen.getByText("Query Params")).toBeInTheDocument();
  });

  it("switching to headers shows header table", async () => {
    useTabsStore.getState().openTab({ type: "http" });
    const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;

    render(<HttpTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("request-tab-headers"));
    await waitFor(() => {
      expect(screen.getByText("Key")).toBeInTheDocument();
      expect(screen.getByText("Value")).toBeInTheDocument();
    });
  });

  it("shows params count badge when query params enabled", () => {
    useTabsStore.getState().openTab({
      type: "http",
      params: [
        {
          id: "p1",
          key: "q",
          value: "1",
          enabled: true,
          type: "query",
        },
      ],
    });
    const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;

    render(<HttpTabs tabId={tabId} />);

    expect(screen.getByTestId("request-tab-params")).toHaveTextContent("1");
  });

  it("shows auth dirty dot when auth is not none", () => {
    useTabsStore.getState().openTab({
      type: "http",
      auth: { type: "bearer", token: "t" },
    });
    const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;

    render(<HttpTabs tabId={tabId} />);

    const authTrigger = screen.getByTestId("request-tab-auth");
    expect(authTrigger.querySelector(".rounded-full")).toBeTruthy();
  });

  it("body tab renders mocked body editor after switch", async () => {
    useTabsStore.getState().openTab({ type: "http" });
    const tabId = (useTabsStore.getState().tabs[0] as HttpTab).tabId;

    render(<HttpTabs tabId={tabId} />);

    fireEvent.click(screen.getByTestId("request-tab-body"));
    await waitFor(() =>
      expect(screen.getByTestId("mock-body-editor")).toHaveTextContent(tabId),
    );
  });
});
