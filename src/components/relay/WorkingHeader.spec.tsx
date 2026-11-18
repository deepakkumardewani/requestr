/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnTiming } from "@/lib/relay/timing";
import { useRelayStore } from "@/stores/useRelayStore";
import { WorkingHeader } from "./WorkingHeader";

vi.mock("next-intl", async () => {
  const { relayIntlMock } = await import("./relayIntlMock");
  return relayIntlMock();
});

const START = new Date("2026-01-01T00:00:00Z").getTime();

const setTurn = (turn: TurnTiming | null) =>
  act(() => {
    useRelayStore.setState({ liveTurn: turn ? { messageId: "m1", turn } : null });
  });

const running = (steps: TurnTiming["steps"] = []): TurnTiming => ({
  startedAt: START,
  status: "running",
  steps,
});

const header = () => screen.getByTestId("relay-working-header");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useRelayStore.setState({ liveTurn: null });
});

describe("WorkingHeader", () => {
  it("shows 0s when there is no live turn", () => {
    render(<WorkingHeader />);
    expect(header()).toHaveTextContent("Working for 0s");
    expect(header()).toHaveAttribute("data-waiting", "false");
  });

  it("ticks each second while working", () => {
    setTurn(running());
    render(<WorkingHeader />);
    expect(header()).toHaveTextContent("Working for 0s");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(header()).toHaveTextContent("Working for 3s");
    act(() => {
      vi.advanceTimersByTime(62_000);
    });
    expect(header()).toHaveTextContent("Working for 1m 5s");
  });

  it("pauses on a pending card and resumes without counting the wait", () => {
    setTurn(running());
    render(<WorkingHeader />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(header()).toHaveTextContent("Working for 2s");

    setTurn(running([{ id: "card", kind: "waiting", startedAt: START + 2000 }]));
    expect(header()).toHaveTextContent("Waiting for you");
    expect(header()).toHaveAttribute("data-waiting", "true");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(header()).toHaveTextContent("Waiting for you");

    setTurn(
      running([{ id: "card", kind: "waiting", startedAt: START + 2000, endedAt: START + 12_000 }]),
    );
    expect(header()).toHaveTextContent("Working for 2s");
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(header()).toHaveTextContent("Working for 5s");
  });

  it("stops its interval on unmount", () => {
    setTurn(running());
    const { unmount } = render(<WorkingHeader />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
