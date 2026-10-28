/** @vitest-environment happy-dom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startTurn, syncSteps } from "@/lib/relay/timing";
import { useRelayStore } from "@/stores/useRelayStore";
import { RelayActivityIndicator } from "./RelayActivityIndicator";

vi.mock("next-intl", async () =>
  (await import("./relayIntlMock")).relayIntlMock(),
);

const START = 1_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  useRelayStore.getState().setLiveTurn({ messageId: "a1", turn: startTurn(START) });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useRelayStore.getState().setLiveTurn(null);
});

const classesOf = (el: HTMLElement) => el.className.split(/\s+/).filter(Boolean);

describe("RelayActivityIndicator", () => {
  it("is a polite status region", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("data-kind", "thinking");
  });

  it("leads with the Working header instead of the Thinking shimmer", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    expect(screen.getByTestId("relay-working-header")).toHaveTextContent("Working for 0s");
    expect(screen.queryByTestId("relay-activity-label")).toBeNull();
    expect(document.body.innerHTML).not.toContain("shine_2s");
  });

  it("ticks once per second", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByTestId("relay-working-header")).toHaveTextContent("Working for 3s");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("relay-working-header")).toHaveTextContent("Working for 1m 3s");
  });

  it("pauses on Waiting for you while a card is pending, then resumes", () => {
    render(<RelayActivityIndicator activity={null} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      const live = useRelayStore.getState().liveTurn;
      if (!live) throw new Error("no live turn");
      useRelayStore.getState().setLiveTurn({
        ...live,
        turn: syncSteps(live.turn, [{ id: "w:c1", kind: "waiting", done: false }], Date.now()),
      });
    });
    const header = screen.getByTestId("relay-working-header");
    expect(header).toHaveTextContent("Waiting for you");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(header).toHaveTextContent("Waiting for you");
    act(() => {
      const live = useRelayStore.getState().liveTurn;
      if (!live) throw new Error("no live turn");
      useRelayStore.getState().setLiveTurn({
        ...live,
        turn: syncSteps(live.turn, [{ id: "w:c1", kind: "waiting", done: true }], Date.now()),
      });
    });
    expect(header).toHaveTextContent("Working for 2s");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(header).toHaveTextContent("Working for 3s");
  });

  it("shows the step label under the header for a tool with a target name", () => {
    render(
      <RelayActivityIndicator
        activity={{ kind: "tool", toolName: "create_collection", input: { name: "Orders" } }}
      />,
    );
    expect(screen.getByRole("status")).toHaveAttribute("data-kind", "tool");
    expect(screen.getByTestId("relay-activity-label")).toHaveTextContent(
      "Orders",
    );
  });

  it("shows the generic label for an unknown tool", () => {
    render(
      <RelayActivityIndicator
        activity={{ kind: "tool", toolName: "mystery", input: {} }}
      />,
    );
    expect(screen.getByTestId("relay-activity-label")).toHaveTextContent(
      "Working",
    );
  });

  it("hides the decorative dot from assistive tech and gates its pulse on motion-safe", () => {
    render(<RelayActivityIndicator activity={{ kind: "thinking" }} />);
    const dot = screen.getByTestId("relay-working-header").firstElementChild as HTMLElement;
    expect(dot).toHaveAttribute("aria-hidden", "true");
    const classes = classesOf(dot);
    expect(classes).toContain("motion-safe:animate-pulse");
    expect(classes.filter((c) => c.includes("animate-") && !c.startsWith("motion-safe:"))).toEqual([]);
  });
});
