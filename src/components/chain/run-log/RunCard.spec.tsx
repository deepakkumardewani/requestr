/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunSummary } from "@/lib/chainRunHistory";

const cardBodyRender = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${Object.values(values).join(",")})` : key,
  useFormatter: () => ({
    relativeTime: (date: number, now: number) =>
      `${Math.round((now - date) / 1000)}s ago`,
    dateTime: (date: number) => `ABS:${date}`,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    render,
    children,
  }: {
    render: React.ReactElement<Record<string, unknown>>;
    children: React.ReactNode;
  }) => <render.type {...render.props}>{children}</render.type>,
  TooltipContent: () => null,
}));

// Called once per RunCard body render, so it counts card re-renders (not the
// context-driven re-renders of the nested RelativeTime).
vi.mock("@/lib/chainRunSummary", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/chainRunSummary")>();
  return {
    ...actual,
    getRunStatusDisplay: (
      ...args: Parameters<typeof actual.getRunStatusDisplay>
    ) => {
      cardBodyRender();
      return actual.getRunStatusDisplay(...args);
    },
  };
});

import { RelativeNowProvider } from "@/components/chain/RelativeNowProvider";
import { RunCard } from "./RunCard";

const NOW = 1_000_000;

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: "r1",
    chainId: "c1",
    startedAt: NOW - 5000,
    finishedAt: NOW - 3800,
    status: "passed",
    trigger: "full",
    counts: { passed: 3, failed: 0, skipped: 0, aborted: 0 },
    bytes: 1,
    schemaVersion: 1,
    steps: [],
    ...overrides,
  } as RunSummary;
}

function renderCard(
  run: RunSummary,
  props: Partial<React.ComponentProps<typeof RunCard>> = {}
) {
  return render(
    <RelativeNowProvider>
      <RunCard run={run} selected={false} onSelect={vi.fn()} {...props} />
    </RelativeNowProvider>
  );
}

describe("RunCard", () => {
  afterEach(() => {
    cleanup();
    cardBodyRender.mockClear();
  });

  it("renders trigger label, counts, relative time and duration", () => {
    renderCard(makeRun());
    expect(screen.getByText("runLogTriggerFull")).toBeInTheDocument();
    expect(screen.getByText("runLogCountPassed(3)")).toBeInTheDocument();
    expect(screen.getByText(/s ago$/)).toBeInTheDocument();
    expect(screen.getByRole("option")).toHaveTextContent("1.2s");
  });

  it("joins non-zero count words and omits zero buckets", () => {
    renderCard(
      makeRun({ counts: { passed: 2, failed: 1, skipped: 0, aborted: 0 } })
    );
    expect(
      screen.getByText("runLogCountPassed(2), runLogCountFailed(1)")
    ).toBeInTheDocument();
  });

  it("names the anchor node for anchored runs and sets a truncating title", () => {
    renderCard(makeRun({ trigger: "fromHere", anchorNodeId: "n1" }), {
      anchorLabel: "Login",
    });
    const label = screen.getByText("runLogTriggerFromHere(Login)");
    expect(label).toHaveAttribute("title", "runLogTriggerFromHere(Login)");
    expect(label.className).toContain("truncate");
    expect(label.className).toContain("whitespace-nowrap");
  });

  it("falls back to the deleted-node label when the anchor is gone", () => {
    renderCard(makeRun({ trigger: "single", anchorNodeId: "gone" }));
    expect(screen.getByText("runLogDeletedNode")).toBeInTheDocument();
  });

  it("shows 'No steps recorded' for a finished run with zero steps", () => {
    renderCard(
      makeRun({ counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 } })
    );
    expect(screen.getByText("runLogZeroSteps")).toBeInTheDocument();
  });

  it("shows a stopped bucket for aborted-only runs", () => {
    renderCard(
      makeRun({
        counts: { passed: 0, failed: 0, skipped: 0, aborted: 2 },
      })
    );
    expect(screen.getByText("runLogCountStopped(2)")).toBeInTheDocument();
    expect(
      screen.getByText("runLogCollapsedStatusStopped")
    ).toBeInTheDocument();
  });

  it("selected state sets aria, fill and a status-colored indicator", () => {
    renderCard(makeRun({ status: "failed" }), { selected: true });
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-selected", "true");
    expect(option).toHaveAttribute("aria-current", "true");
    expect(option.className).toContain("bg-accent");
    expect(screen.getByTestId("run-card-indicator").className).toContain(
      "bg-destructive"
    );
  });

  it("unselected state has no indicator or aria-current", () => {
    renderCard(makeRun());
    const option = screen.getByRole("option");
    expect(option).toHaveAttribute("aria-selected", "false");
    expect(option).not.toHaveAttribute("aria-current");
    expect(screen.queryByTestId("run-card-indicator")).toBeNull();
  });

  it("live run shows a spinner, running label, no duration and no menu", () => {
    const { container } = renderCard(
      makeRun({
        status: "running",
        finishedAt: undefined,
        counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
      }),
      { menu: <button>menu</button> }
    );
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.getByText("runLogLiveLabel")).toBeInTheDocument();
    expect(screen.queryByText("runLogZeroSteps")).toBeNull();
    expect(screen.queryByText("menu")).toBeNull();
    expect(screen.getByRole("option")).not.toHaveTextContent("ms");
  });

  it("renders the menu slot for finished runs, revealed on hover/focus/touch", () => {
    renderCard(makeRun(), { menu: <button>menu</button> });
    const wrapper = screen.getByTestId("run-card-menu");
    expect(wrapper).toContainElement(screen.getByText("menu"));
    expect(wrapper.className).toContain("group-hover:opacity-100");
    expect(wrapper.className).toContain("group-focus-within:opacity-100");
    expect(wrapper.className).toContain("[@media(hover:none)]:opacity-100");
  });

  it("calls onSelect with the run id on click", () => {
    const onSelect = vi.fn();
    renderCard(makeRun(), { onSelect });
    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("r1");
  });

  describe("memoization under a shared tick", () => {
    const TICK_MS = 30_000;

    function Cards({
      runs,
      selectedId,
      onSelect,
    }: {
      runs: RunSummary[];
      selectedId?: string;
      onSelect: () => void;
    }) {
      return (
        <RelativeNowProvider>
          {runs.map((r) => (
            <RunCard
              key={r.id}
              run={r}
              selected={r.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </RelativeNowProvider>
      );
    }

    it("a tick updates every time label without re-rendering any card body", () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
      try {
        vi.setSystemTime(NOW);
        const runs = ["a", "b", "c"].map((id) => makeRun({ id }));
        render(<Cards runs={runs} onSelect={vi.fn()} />);
        expect(screen.getAllByText("5s ago")).toHaveLength(3);
        expect(cardBodyRender).toHaveBeenCalledTimes(3);

        act(() => {
          vi.advanceTimersByTime(TICK_MS);
        });

        expect(screen.getAllByText("35s ago")).toHaveLength(3);
        expect(cardBodyRender).toHaveBeenCalledTimes(3);
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      } finally {
        setIntervalSpy.mockRestore();
        vi.useRealTimers();
      }
    });

    it("re-renders only the card whose run or selection changed", () => {
      const onSelect = vi.fn();
      const [a, b] = [makeRun({ id: "a" }), makeRun({ id: "b" })];
      const { rerender } = render(<Cards runs={[a, b]} onSelect={onSelect} />);
      expect(cardBodyRender).toHaveBeenCalledTimes(2);

      rerender(<Cards runs={[a, b]} onSelect={onSelect} />);
      expect(cardBodyRender).toHaveBeenCalledTimes(2);

      rerender(<Cards runs={[a, b]} selectedId="a" onSelect={onSelect} />);
      expect(cardBodyRender).toHaveBeenCalledTimes(3);

      rerender(
        <Cards runs={[{ ...a }, b]} selectedId="a" onSelect={onSelect} />
      );
      expect(cardBodyRender).toHaveBeenCalledTimes(4);
    });
  });
});
