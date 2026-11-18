/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import type { HistoryEntry } from "@/types";
import { HistoryList } from "./HistoryList";
import { PickerProvider, usePickerSelectedIds } from "./PickerContext";

const entry = (id: string, url: string, timestamp: number) =>
  ({ id, url, timestamp, method: "GET" }) as HistoryEntry;

function Selected() {
  return <output data-testid="sel">{[...usePickerSelectedIds()].join(",")}</output>;
}

function renderList(inChain: string[] = []) {
  const onAddIds = vi.fn();
  const onShowOnCanvas = vi.fn();
  render(
    <PickerProvider>
      <HistoryList
        inChainIds={new Set(inChain)}
        onAddIds={onAddIds}
        onShowOnCanvas={onShowOnCanvas}
      />
      <Selected />
    </PickerProvider>,
  );
  return { onAddIds, onShowOnCanvas };
}

describe("HistoryList", () => {
  // The virtualizer needs layout; a fixed-size viewport keeps the rendered window real.
  beforeEach(() => {
    useHistoryStore.setState({ entries: [] });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(600);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the empty state without crashing for 0 entries", () => {
    renderList();
    expect(screen.getByTestId("picker-history-empty").textContent).toContain(
      "No history yet",
    );
    expect(screen.queryByTestId("picker-tree")).toBeNull();
  });

  it("renders day headers, deduped named rows", () => {
    const now = Date.now();
    useHistoryStore.setState({
      entries: [
        entry("a", "https://a.test/v1/users/42", now),
        entry("a2", "https://a.test/v1/users/42", now - 1000),
        entry("b", "https://a.test/orders", now - 2 * 24 * 60 * 60 * 1000),
      ],
    });
    renderList();
    expect(screen.getByTestId("picker-header-day:Today")).toBeTruthy();
    expect(screen.getByText("users/42")).toBeTruthy();
    expect(screen.queryByTestId("picker-row-a2")).toBeNull();
    expect(screen.getByTestId("picker-row-b")).toBeTruthy();
  });

  it("selects a row through the shared selection state", () => {
    useHistoryStore.setState({ entries: [entry("a", "https://a.test/x", Date.now())] });
    renderList();
    fireEvent.click(screen.getByTestId("picker-row-a"));
    expect(screen.getByTestId("sel").textContent).toBe("a");
  });

  it("marks entries already on the canvas as in chain", () => {
    useHistoryStore.setState({ entries: [entry("a", "https://a.test/x", Date.now())] });
    renderList(["a"]);
    expect(screen.getByTestId("picker-row-a").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByTestId("picker-show-on-canvas-a")).toBeTruthy();
  });

  it("shows no-results when the search matches nothing", () => {
    useHistoryStore.setState({ entries: [entry("a", "https://a.test/x", Date.now())] });
    renderList();
    fireEvent.change(screen.getByTestId("picker-search"), { target: { value: "zzzz" } });
    expect(screen.getByTestId("picker-no-results")).toBeTruthy();
  });
});
