/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HistoryEntry, HttpTab } from "@/types";
import { HistoryList } from "./HistoryList";

function httpTab(partial: Partial<HttpTab> = {}): HttpTab {
  return {
    tabId: "t0",
    requestId: null,
    name: "r",
    isDirty: false,
    type: "http",
    url: "https://api.example.com",
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

function makeEntry(
  id: string,
  url: string,
  method: HistoryEntry["method"] = "GET",
): HistoryEntry {
  const tab = httpTab({ url, method });
  return {
    id,
    method,
    url,
    status: 200,
    duration: 1,
    size: 1,
    timestamp: 1,
    request: tab,
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      duration: 1,
      size: 1,
      url,
      method,
      timestamp: 1,
    },
  };
}

afterEach(() => {
  cleanup();
  useHistoryStore.setState({ entries: [] });
  useUIStore.setState({ historyFilter: null });
});

describe("HistoryList", () => {
  it("shows empty state when there is no history", () => {
    render(<HistoryList />);

    expect(screen.getByText("No requests sent yet")).toBeInTheDocument();
  });

  it("renders history items when entries exist", () => {
    useHistoryStore.setState({
      entries: [
        makeEntry("1", "https://one.com"),
        makeEntry("2", "https://two.com"),
      ],
    });

    render(<HistoryList />);

    expect(screen.getAllByTestId("history-item")).toHaveLength(2);
  });

  it("filters by url substring from filter prop", () => {
    useHistoryStore.setState({
      entries: [
        makeEntry("1", "https://alpha.com"),
        makeEntry("2", "https://beta.com"),
      ],
    });

    render(<HistoryList filter="beta" />);

    expect(screen.getAllByTestId("history-item")).toHaveLength(1);
    expect(screen.getByTestId("history-item-url")).toHaveTextContent(
      "beta.com",
    );
  });

  it("uses UI store history filter when filter prop omitted", () => {
    useUIStore.setState({ historyFilter: "gamma" });
    useHistoryStore.setState({
      entries: [
        makeEntry("1", "https://gamma.example/x"),
        makeEntry("2", "https://other.com"),
      ],
    });

    render(<HistoryList />);

    expect(screen.getAllByTestId("history-item")).toHaveLength(1);
  });

  it("compact mode shows at most 20 entries", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      makeEntry(`id-${i}`, `https://x.com/${i}`),
    );
    useHistoryStore.setState({ entries: many });

    render(<HistoryList compact />);

    expect(screen.getAllByTestId("history-item")).toHaveLength(20);
  });

  it("shows no matches when filter excludes all", () => {
    useHistoryStore.setState({
      entries: [makeEntry("1", "https://a.com")],
    });

    render(<HistoryList filter="zzz" />);

    expect(screen.getByText("No matches")).toBeInTheDocument();
  });
});
