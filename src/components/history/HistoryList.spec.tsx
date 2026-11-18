/** @vitest-environment happy-dom */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HistoryEntry, HttpTab } from "@/types";
import { HistoryList } from "./HistoryList";

// happy-dom has no layout, so the real virtualizer renders nothing; render the
// rows the list's own rangeExtractor selects for the configured scroll position.
// Like the real virtualizer, row sizes come from the list's estimateSize.
const scrollWindow = vi.hoisted(() => ({ startIndex: 0 }));

vi.mock("@tanstack/react-virtual", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-virtual")>()),
  useVirtualizer: ({
    count,
    getItemKey,
    estimateSize,
    rangeExtractor,
    overscan,
  }: {
    count: number;
    getItemKey: (index: number) => string;
    estimateSize: (index: number) => number;
    rangeExtractor: (range: {
      startIndex: number;
      endIndex: number;
      overscan: number;
      count: number;
    }) => number[];
    overscan: number;
  }) => ({
    getTotalSize: () => count * estimateSize(0),
    getVirtualItems: () =>
      rangeExtractor({
        startIndex: scrollWindow.startIndex,
        endIndex: count - 1,
        overscan,
        count,
      }).map((index) => ({
        index,
        key: getItemKey(index),
        start: index * estimateSize(index),
      })),
    measureElement: () => undefined,
  }),
}));

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
  timestamp = 1
): HistoryEntry {
  const tab = httpTab({ url, method });
  return {
    id,
    method,
    url,
    status: 200,
    duration: 1,
    size: 1,
    timestamp,
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

// Mid-day local time, so `NOW - 2000` stays on Today and `NOW - DAY_MS` lands
// on Yesterday whatever the wall clock reads when the suite runs.
const NOW = new Date(2026, 10, 11, 15, 0).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  // Fake only Date: userEvent needs real timers (RTL's asyncWrapper hangs
  // under Vitest fake setTimeout).
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  scrollWindow.startIndex = 0;
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
      "beta.com"
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
      makeEntry(`id-${i}`, `https://x.com/${i}`)
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

  it("keeps the actions menu reachable when history is empty", () => {
    render(<HistoryList />);

    expect(screen.getByTestId("history-actions-btn")).toBeInTheDocument();
  });

  it("hides the actions menu in compact mode", () => {
    render(<HistoryList compact />);

    expect(screen.queryByTestId("history-actions-btn")).not.toBeInTheDocument();
  });

  it("clears history only after confirming the dialog", async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({
      entries: [
        makeEntry("1", "https://a.com"),
        makeEntry("2", "https://b.com"),
      ],
    });
    render(<HistoryList />);

    await user.click(screen.getByTestId("history-actions-btn"));
    await user.click(await screen.findByTestId("history-clear-all"));
    expect(await screen.findByTestId("clear-history-body")).toHaveTextContent(
      "2 history entries"
    );

    await user.click(screen.getByTestId("clear-history-cancel"));
    expect(useHistoryStore.getState().entries).toHaveLength(2);

    await user.click(screen.getByTestId("history-actions-btn"));
    await user.click(await screen.findByTestId("history-clear-all"));
    await user.click(await screen.findByTestId("clear-history-confirm"));
    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it("groups repeated runs into one row with a count and expands them inline", async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({
      entries: [
        makeEntry("a", "https://same.com", "GET", NOW),
        makeEntry("b", "https://same.com", "GET", NOW - 1000),
        makeEntry("c", "https://same.com", "GET", NOW - 2000),
      ],
    });

    render(<HistoryList />);

    expect(screen.getByTestId("history-day-header")).toHaveTextContent("Today");
    expect(screen.getByTestId("history-group-count")).toHaveTextContent("x 3");
    expect(screen.queryAllByTestId("history-run")).toHaveLength(0);

    await user.click(screen.getByTestId("history-group-toggle"));

    expect(screen.getByTestId("history-group-toggle")).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(screen.getAllByTestId("history-run")).toHaveLength(3);
  });

  it("counts only matching runs while a filter is active", () => {
    useHistoryStore.setState({
      entries: [
        makeEntry("a", "https://same.com/x", "GET", NOW),
        makeEntry("b", "https://same.com/x", "GET", NOW - 1000),
        makeEntry("c", "https://other.com", "GET", NOW - 2000),
      ],
    });

    render(<HistoryList filter="same" />);

    expect(screen.getByTestId("history-group-count")).toHaveTextContent("x 2");
    expect(screen.queryByText("other.com")).not.toBeInTheDocument();
  });

  it("labels days Today and Yesterday as separate headers", () => {
    useHistoryStore.setState({
      entries: [
        makeEntry("a", "https://a.com", "GET", NOW),
        makeEntry("b", "https://b.com", "GET", NOW - DAY_MS),
      ],
    });

    render(<HistoryList />);

    expect(
      screen.getAllByTestId("history-day-header").map((h) => h.textContent)
    ).toEqual(["Today", "Yesterday"]);
  });

  it("pins the day header of the scrolled-to day even when it is above the window", () => {
    // rows: header(Today), 5 runs, header(Yesterday), 1 run
    useHistoryStore.setState({
      entries: [
        ...Array.from({ length: 5 }, (_, i) =>
          makeEntry(`t${i}`, `https://t${i}.com`, "GET", NOW - i)
        ),
        makeEntry("y", "https://y.com", "GET", NOW - DAY_MS),
      ],
    });
    scrollWindow.startIndex = 3;

    const { container } = render(<HistoryList />);

    const indexes = Array.from(container.querySelectorAll("[data-index]")).map(
      (el) => el.getAttribute("data-index")
    );
    expect(indexes[0]).toBe("0");
    const pinned = container.querySelector('[data-index="0"]') as HTMLElement;
    expect(pinned).toHaveStyle({ position: "sticky" });
    expect(within(pinned).getByTestId("history-day-header")).toHaveTextContent(
      "Today"
    );
    const other = container.querySelector('[data-index="3"]') as HTMLElement;
    expect(other).toHaveStyle({ position: "absolute" });
  });

  it("reserves the estimated 44px per row and offsets rows by it", () => {
    useHistoryStore.setState({
      entries: [
        makeEntry("a", "https://a.com", "GET", NOW),
        makeEntry("b", "https://b.com", "GET", NOW - 1000),
      ],
    });

    const { container } = render(<HistoryList />);

    // rows: header(Today), a, b
    const spacer = screen.getByTestId("history-scroll")
      .firstElementChild as HTMLElement;
    expect(spacer).toHaveStyle({ height: "132px" });
    const third = container.querySelector('[data-index="2"]') as HTMLElement;
    expect(third).toHaveStyle({ transform: "translateY(88px)" });
  });

  it("collapses an expanded group again on a second toggle", async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({
      entries: [
        makeEntry("a", "https://same.com", "GET", NOW),
        makeEntry("b", "https://same.com", "GET", NOW - 1000),
      ],
    });
    render(<HistoryList />);

    await user.click(screen.getByTestId("history-group-toggle"));
    await user.click(screen.getByTestId("history-group-toggle"));

    expect(screen.queryAllByTestId("history-run")).toHaveLength(0);
    expect(screen.getByTestId("history-group-toggle")).toHaveAttribute(
      "aria-expanded",
      "false"
    );
  });

  it("removes the group when its last runs are deleted one by one", async () => {
    const user = userEvent.setup();
    useHistoryStore.setState({
      entries: [
        makeEntry("a", "https://same.com", "GET", NOW),
        makeEntry("b", "https://same.com", "GET", NOW - 1000),
      ],
    });
    render(<HistoryList />);

    await user.click(screen.getByTestId("history-group-toggle"));
    await user.click(screen.getAllByTestId("history-run-delete")[0]);
    // one run left: the group collapses to a plain row
    expect(screen.queryByTestId("history-group")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("history-item")).toHaveLength(1);

    await user.click(screen.getByTestId("history-item-delete"));
    expect(screen.getByText("No requests sent yet")).toBeInTheDocument();
  });
});
