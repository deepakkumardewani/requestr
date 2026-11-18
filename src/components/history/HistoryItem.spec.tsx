/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useTabsStore } from "@/stores/useTabsStore";
import type { HistoryEntry, HttpTab } from "@/types";
import { HistoryItem } from "./HistoryItem";

vi.mock("@/lib/idb", () => ({
  getDB: vi.fn(() => null),
}));

// Fixed fixture time; no assertion reads the relative-time text.
const FIXED_TS = new Date(2026, 10, 11, 15, 0).getTime();

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
    timestamp: FIXED_TS,
    response: {
      status: 200,
      statusText: "OK",
      headers: {},
      body: "",
      duration: 10,
      size: 1,
      url,
      method,
      timestamp: FIXED_TS,
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

  it("restores each run of the same method and URL as its own tab", async () => {
    const user = userEvent.setup();
    const url = "https://orders.test/orders";
    const runs = [1, 2, 3].map((n) =>
      entry(`run${n}`, url, {
        request: httpTab({ url, name: `Orders run ${n}` }),
      })
    );

    for (const run of runs) {
      const view = render(<HistoryItem entry={run} />);
      await user.click(screen.getByTestId("history-item"));
      view.unmount();
    }

    const { tabs } = useTabsStore.getState();
    expect(tabs.map((t) => t.name)).toEqual([
      "Orders run 1",
      "Orders run 2",
      "Orders run 3",
    ]);

    render(<HistoryItem entry={runs[0]!} />);
    await user.click(screen.getByTestId("history-item"));
    expect(useTabsStore.getState().tabs).toHaveLength(3);
    expect(useTabsStore.getState().activeTabId).toBe(tabs[0]!.tabId);
  });

  it("names the opened tab after the request, falling back to the truncated URL", async () => {
    const user = userEvent.setup();
    const named = entry("n1", "https://named.test/a", {
      request: httpTab({ url: "https://named.test/a", name: "Saved name" }),
    });
    const unnamed = entry("n2", "https://unnamed.test/" + "x".repeat(60), {
      request: httpTab({
        url: "https://unnamed.test/" + "x".repeat(60),
        name: "",
      }),
    });

    const first = render(<HistoryItem entry={named} />);
    await user.click(screen.getByTestId("history-item"));
    first.unmount();
    render(<HistoryItem entry={unnamed} />);
    await user.click(screen.getByTestId("history-item"));

    const [a, b] = useTabsStore.getState().tabs;
    expect(a.name).toBe("Saved name");
    expect(b.name).not.toBe("");
    expect(b.name.length).toBeLessThan(unnamed.url.length);
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

  describe("truncation tooltip", () => {
    const TOOLTIP_DELAY_MS = 600;
    const originalScrollWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "scrollWidth"
    );

    const tooltipContent = () =>
      document.querySelector('[data-slot="tooltip-content"]');

    function stubWidths(scrollWidth: number, clientWidth: number) {
      Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
        configurable: true,
        get: () => scrollWidth,
      });
      Object.defineProperty(HTMLElement.prototype, "clientWidth", {
        configurable: true,
        get: () => clientWidth,
      });
    }

    // Fake timers step past the open delay instead of sleeping, so the
    // "no tooltip" check is a real result rather than a timing guess.
    // fireEvent, not userEvent: RTL's asyncWrapper (which userEvent awaits)
    // drains on a zero-delay timer it only auto-advances under Jest fake
    // timers, so userEvent hangs under Vitest fake timers.
    function hoverUrlPastOpenDelay() {
      const url = screen.getByTestId("history-item-url");
      fireEvent.pointerEnter(url, { pointerType: "mouse" });
      fireEvent.mouseEnter(url);
      fireEvent.mouseMove(url);
      act(() => {
        vi.advanceTimersByTime(TOOLTIP_DELAY_MS + 1);
      });
    }

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      if (originalScrollWidth) {
        Object.defineProperty(
          HTMLElement.prototype,
          "scrollWidth",
          originalScrollWidth
        );
      }
      Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    });

    it("shows the full URL in a tooltip only when the URL is cut off", () => {
      const longUrl = `https://api.example.com/${"segment/".repeat(20)}end`;
      stubWidths(500, 100);

      render(<HistoryItem entry={entry("long", longUrl)} />);
      hoverUrlPastOpenDelay();

      expect(tooltipContent()).toHaveTextContent(longUrl);
    });

    it("shows no tooltip when the URL fits", () => {
      stubWidths(100, 100);

      render(<HistoryItem entry={entry("short", "https://a.dev")} />);
      hoverUrlPastOpenDelay();

      expect(tooltipContent()).toBeNull();
    });
  });
});
