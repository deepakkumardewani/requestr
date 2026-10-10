/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import type { HistoryEntry, HttpTab } from "@/types";
import { HealthDot } from "./HealthDot";

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

const URL_UNDER_TEST = "https://metrics.example.com/api/items";

function seedHistory(total: number, successes: number, url = URL_UNDER_TEST) {
  useHistoryStore.setState({
    entries: Array.from({ length: total }, (_, i) => {
      const status = i < successes ? 200 : 500;
      return entry(`h-${i}`, url, { status, duration: 10 + i });
    }),
  });
}

function dotColorClass(): string {
  const dot = screen.getByRole("button").querySelector('[aria-hidden="true"]');
  if (!dot) throw new Error("health dot indicator not rendered");
  return dot.className;
}

describe("HealthDot", () => {
  beforeEach(() => {
    useHistoryStore.setState({ entries: [] });
    useUIStore.setState({ historyFilter: null } as Partial<
      ReturnType<typeof useUIStore.getState>
    >);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows exact success rate, p50 and last status in the trigger label for a route with enough history", () => {
    const url = "https://metrics.example.com/api/items";
    useHistoryStore.setState({
      entries: Array.from({ length: 5 }, (_, i) =>
        entry(`h-${i}`, url, {
          status: 200,
          duration: 10 + i,
          method: "GET",
        }),
      ),
    });

    render(<HealthDot method="GET" url={url} />);

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      "Last 5 requests · 100% success · p50 12ms · p95 13ms · Last: 200",
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("12ms")).toBeInTheDocument();
  });

  describe("minimum sample size", () => {
    it("renders nothing when there is no history", () => {
      const { container } = render(
        <HealthDot method="GET" url={URL_UNDER_TEST} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it("renders nothing with 4 matching entries (one below the minimum)", () => {
      seedHistory(4, 4);
      const { container } = render(
        <HealthDot method="GET" url={URL_UNDER_TEST} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it("renders the dot at exactly 5 matching entries", () => {
      seedHistory(5, 5);
      render(<HealthDot method="GET" url={URL_UNDER_TEST} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("ignores history for other routes and methods when counting the sample", () => {
      seedHistory(4, 4);
      useHistoryStore.setState({
        entries: [
          ...useHistoryStore.getState().entries,
          entry("other-url", "https://metrics.example.com/api/other"),
          entry("other-method", URL_UNDER_TEST, { method: "POST" }),
        ],
      });
      const { container } = render(
        <HealthDot method="GET" url={URL_UNDER_TEST} />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it("treats numeric path segments as the same route", () => {
      useHistoryStore.setState({
        entries: Array.from({ length: 5 }, (_, i) =>
          entry(`h-${i}`, `https://metrics.example.com/api/items/${i + 1}`),
        ),
      });
      render(
        <HealthDot method="get" url="https://metrics.example.com/api/items/99" />,
      );
      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("dot color thresholds", () => {
    it.each([
      { total: 20, ok: 20, rate: 100, color: "bg-emerald-400" },
      { total: 20, ok: 19, rate: 95, color: "bg-emerald-400" },
      { total: 50, ok: 47, rate: 94, color: "bg-amber-400" },
      { total: 5, ok: 4, rate: 80, color: "bg-amber-400" },
      { total: 19, ok: 15, rate: 79, color: "bg-red-400" },
      { total: 5, ok: 0, rate: 0, color: "bg-red-400" },
    ])(
      "uses $color at a $rate% success rate",
      ({ total, ok, rate, color }) => {
        seedHistory(total, ok);
        render(<HealthDot method="GET" url={URL_UNDER_TEST} />);

        expect(screen.getByText(`${rate}%`)).toBeInTheDocument();
        expect(dotColorClass()).toContain(color);
      },
    );

    it("counts only 2xx responses as successes", () => {
      useHistoryStore.setState({
        entries: [200, 301, 404, 500, 204].map((status, i) =>
          entry(`h-${i}`, URL_UNDER_TEST, { status }),
        ),
      });
      render(<HealthDot method="GET" url={URL_UNDER_TEST} />);
      expect(screen.getByText("40%")).toBeInTheDocument();
    });
  });

  describe("popover", () => {
    it("opens with status breakdown and exact counts when the trigger is clicked", async () => {
      const user = userEvent.setup();
      useHistoryStore.setState({
        entries: [200, 200, 200, 404, 503].map((status, i) =>
          entry(`h-${i}`, URL_UNDER_TEST, { status }),
        ),
      });
      render(<HealthDot method="GET" url={URL_UNDER_TEST} />);

      await user.click(screen.getByRole("button"));

      expect(await screen.findByText("Request Health")).toBeInTheDocument();
      expect(screen.getByText("Last 5 requests")).toBeInTheDocument();
      expect(screen.getByText(/2xx/)).toHaveTextContent("3 2xx");
      expect(screen.getByText(/4xx/)).toHaveTextContent("1 4xx");
      expect(screen.getByText(/5xx/)).toHaveTextContent("1 5xx");
    });

    it('sets the history filter to the route key when "View in History" is clicked', async () => {
      const user = userEvent.setup();
      seedHistory(5, 5);
      render(<HealthDot method="get" url={URL_UNDER_TEST} />);

      await user.click(screen.getByRole("button"));
      await user.click(
        await screen.findByRole("button", { name: /view in history/i }),
      );

      expect(useUIStore.getState().historyFilter).toBe(
        "GET:https://metrics.example.com/api/items",
      );
    });
  });
});
