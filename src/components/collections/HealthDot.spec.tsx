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

  it("renders success metrics when enough history exists for the route", () => {
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

    expect(screen.getByLabelText(/success/i)).toBeInTheDocument();
    expect(screen.getByText(/\d+%/)).toBeInTheDocument();
  });

  function seed(url: string, statuses: number[], durations?: number[]) {
    useHistoryStore.setState({
      entries: statuses.map((status, i) =>
        entry(`s-${i}`, url, { status, duration: durations?.[i] ?? 10 + i }),
      ),
    });
  }

  it("renders nothing with fewer than the minimum entries", () => {
    seed("https://few.example.com/a", [200, 200, 200, 200]);
    const { container } = render(
      <HealthDot method="GET" url="https://few.example.com/a" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("ignores history for other routes and methods", () => {
    seed("https://other.example.com/a", [200, 200, 200, 200, 200]);
    const { container } = render(
      <HealthDot method="POST" url="https://other.example.com/a" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("uses a help cursor on the trigger and describes metrics in aria-label", () => {
    seed("https://help.example.com/a", [200, 200, 200, 200, 200], [10, 20, 30, 40, 50]);
    render(<HealthDot method="GET" url="https://help.example.com/a" />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveClass("cursor-help");
    expect(trigger).toHaveAccessibleName(
      "Last 5 requests · 100% success · p50 30ms · p95 40ms · Last: 200",
    );
  });

  it.each([
    ["green", [200, 200, 200, 200, 200], "bg-emerald-400"],
    ["amber", [200, 200, 200, 200, 500], "bg-amber-400"],
    ["red", [200, 500, 500, 500, 500], "bg-red-400"],
  ])("shows a %s dot by success rate", (_n, statuses, cls) => {
    seed("https://color.example.com/a", statuses);
    render(<HealthDot method="GET" url="https://color.example.com/a" />);
    expect(screen.getByRole("button").querySelector(`.${cls}`)).not.toBeNull();
  });

  it("opens the popover with status breakdown on click", async () => {
    const user = userEvent.setup();
    seed("https://pop.example.com/a", [200, 200, 404, 500, 503]);
    render(<HealthDot method="GET" url="https://pop.example.com/a" />);
    await user.click(screen.getByRole("button"));
    expect(await screen.findByText("Request Health")).toBeInTheDocument();
    expect(screen.getByText("Response time trend")).toBeInTheDocument();
    expect(screen.getByText("Status breakdown")).toBeInTheDocument();
    expect(screen.getByText("2xx")).toBeInTheDocument();
    expect(screen.getByText("4xx")).toBeInTheDocument();
    expect(screen.getByText("5xx")).toBeInTheDocument();
  });

  it("View in History sets the history filter to the route key", async () => {
    const user = userEvent.setup();
    seed("https://pop.example.com/items/42", [200, 200, 200, 200, 200]);
    render(<HealthDot method="get" url="https://pop.example.com/items/42" />);
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("button", { name: /View in History/ }));
    expect(useUIStore.getState().historyFilter).toBe(
      "GET:https://pop.example.com/items/{id}",
    );
  });

  it("clicking the trigger does not bubble to the parent row", async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    seed("https://bubble.example.com/a", [200, 200, 200, 200, 200]);
    render(
      // biome-ignore lint/a11y/useKeyWithClickEvents: test wrapper
      <div onClick={onRowClick}>
        <HealthDot method="GET" url="https://bubble.example.com/a" />
      </div>,
    );
    await user.click(screen.getByRole("button"));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
