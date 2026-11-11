/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HistoryEntry, HttpTab } from "@/types";
import type { HistoryGroupSummaryRow } from "./groupHistory";
import { HistoryGroupRow, HistoryRunItem } from "./HistoryGroupRow";

vi.mock("@/lib/idb", () => ({ getDB: vi.fn(() => null) }));

// Fixed fixture time; no assertion reads the relative-time text.
const FIXED_TS = new Date(2026, 10, 11, 15, 0).getTime();

function makeEntry(id: string, url: string, status = 200): HistoryEntry {
  const request: HttpTab = {
    tabId: "t0",
    requestId: null,
    name: `name-${id}`,
    isDirty: false,
    type: "http",
    url,
    method: "POST",
    headers: [],
    params: [],
    auth: { type: "none" },
    body: { type: "none", content: "" },
    preScript: "",
    postScript: "",
  };
  return {
    id,
    method: "POST",
    url,
    status,
    duration: 1,
    size: 1,
    timestamp: FIXED_TS,
    request,
    response: {
      status,
      statusText: "",
      headers: {},
      body: "",
      duration: 1,
      size: 1,
      url,
      method: "POST",
      timestamp: FIXED_TS,
    },
  };
}

function makeGroup(
  latest: HistoryEntry,
  count: number
): HistoryGroupSummaryRow {
  return {
    kind: "group",
    id: "g1",
    method: "POST",
    url: latest.url,
    count,
    latest,
  };
}

afterEach(() => {
  cleanup();
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useHistoryStore.setState({ entries: [] });
});

describe("HistoryGroupRow", () => {
  it("shows the collapsed summary with count, url, method and latest status", () => {
    render(
      <HistoryGroupRow
        group={makeGroup(makeEntry("a", "https://g.test/x", 404), 3)}
        expanded={false}
        onToggle={vi.fn()}
      />
    );

    expect(screen.getByTestId("history-group-count")).toHaveTextContent("x 3");
    expect(screen.getByTestId("history-group-url")).toHaveTextContent(
      "https://g.test/x"
    );
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText(/404/)).toBeInTheDocument();
  });

  it.each([
    [false, "Show 3 runs", "false"],
    [true, "Hide 3 runs", "true"],
  ])(
    "exposes expanded=%s via aria-expanded and label",
    (expanded, label, aria) => {
      render(
        <HistoryGroupRow
          group={makeGroup(makeEntry("a", "https://g.test"), 3)}
          expanded={expanded}
          onToggle={vi.fn()}
        />
      );

      const toggle = screen.getByRole("button", { name: label });
      expect(toggle).toHaveAttribute("aria-expanded", aria);
    }
  );

  it("reports the group id when the toggle is clicked, without opening a tab", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <HistoryGroupRow
        group={makeGroup(makeEntry("a", "https://g.test"), 2)}
        expanded={false}
        onToggle={onToggle}
      />
    );

    await user.click(screen.getByTestId("history-group-toggle"));

    expect(onToggle).toHaveBeenCalledExactlyOnceWith("g1");
    expect(useTabsStore.getState().tabs).toHaveLength(0);
  });

  it("opens the latest run in a tab when the row is clicked", async () => {
    const user = userEvent.setup();
    render(
      <HistoryGroupRow
        group={makeGroup(makeEntry("a", "https://g.test/latest"), 2)}
        expanded={false}
        onToggle={vi.fn()}
      />
    );

    await user.click(screen.getByTestId("history-group-open"));

    const [tab] = useTabsStore.getState().tabs;
    expect(tab).toMatchObject({
      url: "https://g.test/latest",
      method: "POST",
      name: "name-a",
    });
  });
});

describe("HistoryRunItem", () => {
  it("restores its own request when clicked", async () => {
    const user = userEvent.setup();
    render(<HistoryRunItem entry={makeEntry("r1", "https://run.test/one")} />);

    await user.click(screen.getByTestId("history-run"));

    expect(useTabsStore.getState().tabs[0]).toMatchObject({
      url: "https://run.test/one",
    });
  });

  it("deletes only its own entry and does not open a tab", async () => {
    const user = userEvent.setup();
    const keep = makeEntry("keep", "https://run.test/k");
    const drop = makeEntry("drop", "https://run.test/d");
    useHistoryStore.setState({ entries: [keep, drop] });
    render(<HistoryRunItem entry={drop} />);

    await user.click(screen.getByRole("button", { name: "Delete this run" }));

    expect(useHistoryStore.getState().entries.map((e) => e.id)).toEqual([
      "keep",
    ]);
    expect(useTabsStore.getState().tabs).toHaveLength(0);
  });
});
