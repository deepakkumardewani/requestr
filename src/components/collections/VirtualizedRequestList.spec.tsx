/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { RequestModel } from "@/types";
import { VirtualizedRequestList } from "./VirtualizedRequestList";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const ITEM_HEIGHT = 32;
const MAX_VISIBLE = 10;
const OVERSCAN = 5;
// Visible window plus overscan on the trailing edge (leading edge is clamped at 0).
const MAX_RENDERED_ROWS = MAX_VISIBLE + OVERSCAN;

function makeRequests(count: number): RequestModel[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `r-${i}`,
    collectionId: "col-1",
    name: `Request ${i}`,
    method: "GET" as const,
    url: "https://x.test",
    params: [],
    headers: [],
    auth: { type: "none" as const },
    body: { type: "none" as const, content: "" },
    preScript: "",
    postScript: "",
    createdAt: i,
    updatedAt: i,
  }));
}

function renderedRows() {
  return screen.queryAllByTestId("request-item");
}

beforeEach(() => {
  // happy-dom has no layout; the virtualizer measures its scroll element
  // through these, so give it the 10-row viewport the component sets.
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
    MAX_VISIBLE * ITEM_HEIGHT,
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width: 300,
    height: MAX_VISIBLE * ITEM_HEIGHT,
    top: 0,
    left: 0,
    right: 300,
    bottom: MAX_VISIBLE * ITEM_HEIGHT,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  useCollectionsStore.setState({ collections: [], requests: [] });
  useTabsStore.setState({ tabs: [], activeTabId: null });
  useSettingsStore.setState({ showHealthMonitor: false });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VirtualizedRequestList", () => {
  it("renders only a bounded window of rows for a 148-item list", () => {
    render(
      <VirtualizedRequestList
        requests={makeRequests(148)}
        activeRequestId={null}
      />,
    );

    const rows = renderedRows();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(MAX_RENDERED_ROWS);
    expect(screen.getByText("Request 0")).toBeInTheDocument();
    expect(screen.queryByText("Request 147")).not.toBeInTheDocument();
  });

  it("keeps the rendered rows bounded for a 500-item list", () => {
    render(
      <VirtualizedRequestList
        requests={makeRequests(500)}
        activeRequestId={null}
      />,
    );

    expect(renderedRows().length).toBeLessThanOrEqual(MAX_RENDERED_ROWS);
  });

  it("sizes the scroll container to the full list height capped at 10 rows", () => {
    const { rerender } = render(
      <VirtualizedRequestList
        requests={makeRequests(148)}
        activeRequestId={null}
      />,
    );
    expect(screen.getByTestId("virtualized-request-list").style.height).toBe(
      `${MAX_VISIBLE * ITEM_HEIGHT}px`,
    );

    rerender(
      <VirtualizedRequestList
        requests={makeRequests(3)}
        activeRequestId={null}
      />,
    );
    expect(screen.getByTestId("virtualized-request-list").style.height).toBe(
      `${3 * ITEM_HEIGHT}px`,
    );
  });

  it("renders nothing for an empty list", () => {
    render(<VirtualizedRequestList requests={[]} activeRequestId={null} />);

    expect(renderedRows()).toHaveLength(0);
    expect(screen.getByTestId("virtualized-request-list").style.height).toBe(
      "0px",
    );
  });

  it("marks only the active request as active", () => {
    render(
      <VirtualizedRequestList
        requests={makeRequests(30)}
        activeRequestId="r-2"
      />,
    );

    const rows = renderedRows();
    const active = rows.filter((r) => r.className.includes("bg-theme-accent"));
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveTextContent("Request 2");
  });

  describe("arrow-key navigation", () => {
    function setup(count = 30) {
      render(
        <VirtualizedRequestList
          requests={makeRequests(count)}
          activeRequestId={null}
        />,
      );
      return renderedRows();
    }

    it("ArrowDown focuses the next row", () => {
      const rows = setup();
      rows[0].focus();

      fireEvent.keyDown(rows[0], { key: "ArrowDown" });

      expect(renderedRows()[1]).toHaveFocus();
    });

    it("ArrowUp focuses the previous row", () => {
      const rows = setup();
      rows[3].focus();

      fireEvent.keyDown(rows[3], { key: "ArrowUp" });

      expect(renderedRows()[2]).toHaveFocus();
    });

    it("ArrowUp on the first row keeps focus where it is", () => {
      const rows = setup();
      rows[0].focus();

      fireEvent.keyDown(rows[0], { key: "ArrowUp" });

      expect(rows[0]).toHaveFocus();
    });

    it("ArrowDown on the last row keeps focus where it is", () => {
      const rows = setup(2);
      rows[1].focus();

      fireEvent.keyDown(rows[1], { key: "ArrowDown" });

      expect(rows[1]).toHaveFocus();
    });

    it("prevents default scrolling for handled arrow keys", () => {
      const rows = setup();
      const notCancelled = fireEvent.keyDown(rows[0], { key: "ArrowDown" });

      expect(notCancelled).toBe(false);
    });

    it("ignores non-arrow keys", () => {
      const rows = setup();
      rows[0].focus();

      const notCancelled = fireEvent.keyDown(rows[0], { key: "a" });

      expect(notCancelled).toBe(true);
      expect(rows[0]).toHaveFocus();
    });

    it("ignores arrow keys that do not originate from a row", () => {
      setup();
      const container = screen.getByTestId("virtualized-request-list");

      const notCancelled = fireEvent.keyDown(container, { key: "ArrowDown" });

      expect(notCancelled).toBe(true);
    });

    it("does not match an ancestor's data-index when moving focus", () => {
      render(
        <div data-index="0">
          <VirtualizedRequestList
            requests={makeRequests(30)}
            activeRequestId={null}
          />
        </div>,
      );
      const rows = renderedRows();
      rows[7].focus();

      fireEvent.keyDown(rows[7], { key: "ArrowDown" });

      expect(renderedRows()[8]).toHaveFocus();
    });

    describe.each(["ArrowDown", "ArrowUp"])(
      "%s inside a row's rename input",
      (key) => {
        const RENAME_ROW = 2;

        async function startRenameOnRow(index: number) {
          const requests = makeRequests(30);
          useCollectionsStore.setState({
            collections: [
              { id: "col-1", name: "API", createdAt: 1, updatedAt: 1 },
            ],
            requests,
          });
          render(
            <VirtualizedRequestList requests={requests} activeRequestId={null} />,
          );
          const user = userEvent.setup();
          const row = renderedRows()[index];
          await user.click(within(row).getByTestId("request-item-more-btn"));
          await user.click(screen.getByTestId("request-rename-btn"));
          const input = await screen.findByDisplayValue(`Request ${index}`);
          fireEvent.change(input, { target: { value: `Request ${index}X` } });
          return input;
        }

        it("keeps focus in the input and leaves the caret move to the browser", async () => {
          const input = await startRenameOnRow(RENAME_ROW);
          expect(input).toHaveFocus();

          const notCancelled = fireEvent.keyDown(input, { key });

          expect(notCancelled).toBe(true);
          expect(input).toHaveFocus();
          expect(input).toBeInTheDocument();
        });

        it("does not commit the rename through a blur", async () => {
          const input = await startRenameOnRow(RENAME_ROW);

          fireEvent.keyDown(input, { key });

          expect(
            useCollectionsStore.getState().requests[RENAME_ROW].name,
          ).toBe(`Request ${RENAME_ROW}`);
          expect(input).toHaveValue(`Request ${RENAME_ROW}X`);
        });
      },
    );
  });
});
