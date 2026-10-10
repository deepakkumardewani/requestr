/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HistoryEntry, HttpTab } from "@/types";
import { HistoryItem } from "./HistoryItem";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

function httpTab(partial: Partial<HttpTab> = {}): HttpTab {
  return {
    tabId: "t0",
    requestId: null,
    name: "r",
    isDirty: false,
    type: "http",
    url: "https://api.example.com/v1",
    method: "GET",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
    ...partial,
  };
}

function entry(
  id: string,
  url: string,
  overrides: Partial<HistoryEntry> = {},
): HistoryEntry {
  const method = overrides.method ?? "GET";
  const tab = httpTab({ url, method, ...overrides.request });
  return {
    id,
    method,
    url,
    status: 200,
    duration: 10,
    size: 1,
    timestamp: Date.now(),
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      duration: 10,
      size: 1,
      url,
      method,
      timestamp: Date.now(),
    },
    ...overrides,
    request: overrides.request ? { ...tab, ...overrides.request } : tab,
  };
}

describe("HistoryItem", () => {
  afterEach(() => {
    cleanup();
    useTabsStore.setState({ tabs: [], activeTabId: null });
    useHistoryStore.setState({ entries: [] });
  });

  it("opens new tab when no matching tab exists", async () => {
    const user = userEvent.setup();
    const e = entry("h1", "https://unique.test/a");

    render(<HistoryItem entry={e} />);

    await user.click(screen.getByTestId("history-item"));

    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().tabs[0]?.url).toBe("https://unique.test/a");
  });

  it("reopens history restoring headers, body, auth, and scripts from the entry", async () => {
    const user = userEvent.setup();
    const e = entry("h-restore", "https://restore.test/a", {
      method: "POST",
      request: httpTab({
        url: "https://restore.test/a",
        method: "POST",
        headers: [{ id: "h1", key: "X-Test", value: "yes", enabled: true }],
        body: { type: "json", content: '{"a":1}' },
        auth: { type: "bearer", token: "tok" },
        preScript: "console.log(1)",
        postScript: "console.log(2)",
      }),
    });

    render(<HistoryItem entry={e} />);
    await user.click(screen.getByTestId("history-item"));

    const tab = useTabsStore.getState().tabs[0] as HttpTab;
    expect(tab.headers).toEqual(e.request.headers);
    expect(tab.body).toEqual(e.request.body);
    expect(tab.auth).toEqual(e.request.auth);
    expect(tab.preScript).toBe("console.log(1)");
    expect(tab.postScript).toBe("console.log(2)");
  });

  it("reopens a recorded entry with the recorded tab type and request data", async () => {
    const user = userEvent.setup();
    const e = entry("h3", "https://typed.test/a", { method: "POST" });

    render(<HistoryItem entry={e} />);
    await user.click(screen.getByTestId("history-item"));

    const [tab] = useTabsStore.getState().tabs;
    expect(tab?.type).toBe(e.request.type);
    expect(tab?.url).toBe("https://typed.test/a");
  });

  it("reopens a failed request entry as an http tab and shows its 0 status", async () => {
    const user = userEvent.setup();
    const e = entry("h4", "https://down.test/a", {
      status: 0,
      error: { type: "network", message: "Failed to reach the proxy server" },
    });

    render(<HistoryItem entry={e} />);
    expect(screen.getByTestId("history-item-status")).toHaveTextContent("0");
    await user.click(screen.getByTestId("history-item"));

    const [tab] = useTabsStore.getState().tabs;
    expect(tab?.type).toBe("http");
    expect(tab?.url).toBe("https://down.test/a");
  });

  it("activates existing tab with same method and url", async () => {
    const user = userEvent.setup();
    useTabsStore.setState({
      tabs: [
        httpTab({
          tabId: "existing",
          url: "https://dup.test",
          method: "POST",
        }),
      ],
      activeTabId: null,
    });

    const e = entry("h2", "https://dup.test", { method: "POST" });

    render(<HistoryItem entry={e} />);

    await user.click(screen.getByTestId("history-item"));

    expect(useTabsStore.getState().tabs).toHaveLength(1);
    expect(useTabsStore.getState().activeTabId).toBe("existing");
  });

  it("delete removes entry from history store", async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({
      entries: [entry("x", "https://a.com"), entry("y", "https://b.com")],
    });

    render(<HistoryItem entry={useHistoryStore.getState().entries[0]!} />);

    await user.click(screen.getByTestId("history-item-delete"));

    expect(useHistoryStore.getState().entries.map((h) => h.id)).toEqual(["y"]);
  });
});
