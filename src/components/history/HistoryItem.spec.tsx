/** @vitest-environment happy-dom */

import { cleanup, render, screen, within } from "@testing-library/react";
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
  overrides: Partial<HistoryEntry> = {}
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

  it("renders the full URL and truncates it with CSS, not JS", () => {
    const longUrl = `https://api.example.com/${"segment/".repeat(20)}end`;

    render(<HistoryItem entry={entry("long", longUrl)} />);

    const url = screen.getByTestId("history-item-url");
    expect(url).toHaveTextContent(longUrl);
    expect(url).toHaveClass("truncate");
    expect(screen.getByTestId("history-item").className).not.toContain("pr-8");
  });

  it("keeps the method and status badges unshrinkable and truncates the time line", () => {
    render(<HistoryItem entry={entry("badges", "https://a.dev/x")} />);

    const row = screen.getByTestId("history-item");
    const [methodBadge] = within(row).getAllByText("GET");
    expect(methodBadge).toHaveClass("shrink-0");
    expect(screen.getByTestId("history-item-status")).toHaveClass("shrink-0");
    const urlBlock = screen.getByTestId("history-item-url").parentElement;
    expect(urlBlock).toHaveClass("min-w-0", "flex-1");
    expect(urlBlock?.lastElementChild).toHaveClass("truncate");
  });
});
