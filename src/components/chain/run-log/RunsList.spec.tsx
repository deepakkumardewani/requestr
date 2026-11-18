/** @vitest-environment happy-dom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RELATIVE_NOW_TICK_MS } from "@/hooks/useRelativeNow";
import type { RunSummary } from "@/lib/chainRunHistory";
import { RUN_DELETE_UNDO_MS, useChainRunStore } from "@/stores/useChainRunStore";
import { RunsList } from "./RunsList";

const cardRenders = vi.hoisted(() => vi.fn());

// Counts real RunCard renders: the wrapper re-renders only when props change,
// the same condition under which the memoized RunCard would.
vi.mock("./RunCard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./RunCard")>();
  const { memo, createElement } = await import("react");
  return {
    ...actual,
    RunCard: memo((props: React.ComponentProps<typeof actual.RunCard>) => {
      cardRenders(props.run.id);
      return createElement(actual.RunCard, props);
    }),
  };
});

const toastMock = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);
vi.mock("sonner", () => ({ toast: toastMock }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: "run-1",
    chainId: "chain-1",
    startedAt: Date.now() - 5000,
    finishedAt: Date.now(),
    status: "passed",
    trigger: "full",
    counts: { passed: 5, failed: 1, skipped: 2, aborted: 0 },
    bytes: 100,
    schemaVersion: 1,
    steps: [],
    ...overrides,
  };
}

type Props = Partial<React.ComponentProps<typeof RunsList>>;

function renderList(props: Props = {}) {
  const handlers = {
    onSelectRun: vi.fn(),
    onRerun: vi.fn(),
    onDeleteRun: vi.fn(),
      };
  render(
    <RunsList
      runs={[]}
      activeRun={null}
      selectedRunId={null}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function threeRuns() {
  const now = Date.now();
  return [
    makeRun({ id: "a", startedAt: now - 3000 }),
    makeRun({ id: "b", startedAt: now - 2000 }),
    makeRun({ id: "c", startedAt: now - 1000 }),
  ];
}

const optionButton = (id: string) =>
  within(
    screen
      .getAllByRole("option")
      .find((o) => o.getAttribute("data-run-id") === id) as HTMLElement,
  ).getAllByRole("button")[0];

describe("RunsList states", () => {
  it("renders a loading skeleton while runsLoading is true, never the empty state", () => {
    renderList({ runsLoading: true });
    expect(screen.getByTestId("run-log-empty-loading")).toBeInTheDocument();
    expect(
      screen.queryByText("No runs yet. Press ⌘↩ to run the chain."),
    ).not.toBeInTheDocument();
  });

  it("renders a retry row when runsError is set, never the empty state", async () => {
    const user = userEvent.setup();
    const onRetryLoad = vi.fn();
    renderList({ runsError: "Database unavailable", onRetryLoad });
    expect(
      screen.getByText("Couldn't load run history: Database unavailable"),
    ).toBeInTheDocument();
    await user.click(screen.getByText("Retry"));
    expect(onRetryLoad).toHaveBeenCalled();
  });

  it("renders the noRuns empty state with an enabled Run flow button", async () => {
    const user = userEvent.setup();
    const onRunFlow = vi.fn();
    renderList({ onRunFlow });
    expect(screen.getByText("No runs yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run flow" }));
    expect(onRunFlow).toHaveBeenCalledTimes(1);
  });

  it("disables Run flow with the blocker tooltip when the run is blocked", () => {
    renderList({ runBlockReason: "empty" });
    const button = screen.getByRole("button", { name: "Run flow" });
    expect(button).toBeDisabled();
    expect(button.parentElement?.getAttribute("title")).toBeTruthy();
  });

  it("has no Clear all button; the panel header owns it", () => {
    renderList({ runs: [makeRun()] });
    expect(screen.queryByText("Clear all runs")).not.toBeInTheDocument();
  });
});

describe("RunsList listbox", () => {
  it("is a named listbox of options, newest first", () => {
    renderList({ runs: threeRuns() });
    expect(screen.getByRole("listbox", { name: "Run Log" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("option").map((o) => o.getAttribute("data-run-id")),
    ).toEqual(["c", "b", "a"]);
  });

  it("pins the live run at the top with no row menu", () => {
    const live = makeRun({
      id: "live",
      status: "running",
      startedAt: Date.now() - 10_000,
      finishedAt: undefined,
    });
    renderList({ runs: [makeRun({ id: "newer" })], activeRun: live });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute(
      "data-run-id",
      "live",
    );
    const liveOption = screen.getAllByRole("option")[0];
    expect(within(liveOption).queryByLabelText("Run options")).toBeNull();
  });

  it("calls onSelectRun when a row is clicked", () => {
    const { onSelectRun } = renderList({ runs: [makeRun()] });
    fireEvent.click(optionButton("run-1"));
    expect(onSelectRun).toHaveBeenCalledWith("run-1");
  });

  it("never nests the row menu button inside another button", () => {
    renderList({ runs: [makeRun()] });
    const menu = screen.getByLabelText("Run options");
    expect(menu.parentElement?.closest("button")).toBeNull();
  });

  it("keeps every row a fixed height so 50 runs scroll without layout shift", () => {
    const now = Date.now();
    const runs = Array.from({ length: 50 }, (_, i) =>
      makeRun({ id: `r${i}`, startedAt: now - i * 1000 }),
    );
    renderList({ runs });
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(50);
    for (const option of options) expect(option).toHaveClass("h-14");
    expect(screen.getByRole("listbox")).toHaveClass("overflow-y-auto");
  });
});

describe("RunsList keyboard map", () => {
  it("ArrowDown / ArrowUp move focus and clamp at the ends", async () => {
    const user = userEvent.setup();
    renderList({ runs: threeRuns() });
    optionButton("c").focus();
    await user.keyboard("{ArrowUp}");
    expect(optionButton("c")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(optionButton("b")).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(optionButton("a")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(optionButton("b")).toHaveFocus();
  });

  it("Home and End jump to the first and last row", async () => {
    const user = userEvent.setup();
    renderList({ runs: threeRuns() });
    optionButton("b").focus();
    await user.keyboard("{End}");
    expect(optionButton("a")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(optionButton("c")).toHaveFocus();
  });

  it("Enter selects the focused row", async () => {
    const user = userEvent.setup();
    const { onSelectRun } = renderList({ runs: threeRuns() });
    optionButton("b").focus();
    await user.keyboard("{Enter}");
    expect(onSelectRun).toHaveBeenCalledWith("b");
  });

  it("Delete removes the focused run, shows an Undo toast and focuses a neighbour", async () => {
    const user = userEvent.setup();
    const { onDeleteRun } = renderList({ runs: threeRuns() });
    optionButton("b").focus();
    await user.keyboard("{Delete}");
    expect(onDeleteRun).toHaveBeenCalledWith("b");
    expect(optionButton("a")).toHaveFocus();
    expect(toastMock).toHaveBeenCalledWith(
      "Run deleted",
      expect.objectContaining({
        duration: RUN_DELETE_UNDO_MS,
        action: expect.objectContaining({ label: "Undo" }),
      }),
    );
  });

  it("Delete does nothing on the live run", async () => {
    const user = userEvent.setup();
    const live = makeRun({ id: "live", status: "running", finishedAt: undefined });
    const { onDeleteRun } = renderList({ activeRun: live });
    optionButton("live").focus();
    await user.keyboard("{Delete}");
    expect(onDeleteRun).not.toHaveBeenCalled();
  });

  it("the Undo toast action restores the run through the store", async () => {
    const user = userEvent.setup();
    const undoDeleteRun = vi.fn();
    useChainRunStore.setState({ undoDeleteRun });
    renderList({ runs: threeRuns() });
    optionButton("c").focus();
    await user.keyboard("{Delete}");
    const [, options] = toastMock.mock.calls[0];
    options.action.onClick();
    expect(undoDeleteRun).toHaveBeenCalledWith("c");
  });
});

describe("RunsList row menu", () => {
  it("Re-run calls onRerun and returns focus to the top row once the live run appears", async () => {
    const user = userEvent.setup();
    const run = makeRun();
    const onRerun = vi.fn();
    const props = {
      runs: [run],
      selectedRunId: null,
      onSelectRun: vi.fn(),
      onRerun,
      onDeleteRun: vi.fn(),
          };
    const { rerender } = render(<RunsList activeRun={null} {...props} />);
    await user.click(screen.getByLabelText("Run options"));
    await user.click(screen.getByText("Re-run same subset"));
    expect(onRerun).toHaveBeenCalledWith(run);

    const live = makeRun({ id: "live", status: "running", finishedAt: undefined });
    rerender(<RunsList activeRun={live} {...props} />);
    expect(optionButton("live")).toHaveFocus();
  });

  it("disables Re-run with the reason when the anchor node is gone", async () => {
    const user = userEvent.setup();
    const { onRerun } = renderList({
      runs: [makeRun({ trigger: "fromHere", anchorNodeId: "gone" })],
      nodeLabels: { other: "Other" },
    });
    await user.click(screen.getByLabelText("Run options"));
    const item = screen.getByRole("menuitem", { name: "Re-run same subset" });
    expect(item).toHaveAttribute("aria-disabled", "true");
    await user.click(item);
    expect(onRerun).not.toHaveBeenCalled();
    expect(
      screen.getByTitle("Can't re-run: the starting node was deleted"),
    ).toBeInTheDocument();
  });

  it("enables Re-run when the anchor node still exists and labels the card", async () => {
    const user = userEvent.setup();
    const { onRerun } = renderList({
      runs: [makeRun({ trigger: "fromHere", anchorNodeId: "n1" })],
      nodeLabels: { n1: "Login" },
    });
    expect(screen.getByText('From "Login"')).toBeInTheDocument();
    await user.click(screen.getByLabelText("Run options"));
    await user.click(screen.getByText("Re-run same subset"));
    expect(onRerun).toHaveBeenCalled();
  });

  it("Copy run summary writes the summary to the clipboard and toasts", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    renderList({ runs: [makeRun()] });
    await user.click(screen.getByLabelText("Run options"));
    await user.click(screen.getByText("Copy run summary"));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/^Full run · 8 steps · 5 passed, 1 failed, 2 skipped/),
    );
    await vi.waitFor(() =>
      expect(toastMock.success).toHaveBeenCalledWith("Copied"),
    );
  });

  it("Delete run from the menu deletes instantly with an Undo toast", async () => {
    const user = userEvent.setup();
    const { onDeleteRun } = renderList({ runs: [makeRun()] });
    await user.click(screen.getByLabelText("Run options"));
    await user.click(screen.getByText("Delete run"));
    expect(onDeleteRun).toHaveBeenCalledWith("run-1");
    expect(toastMock).toHaveBeenCalledWith("Run deleted", expect.anything());
  });
});

describe("RunsList performance guard (RUNLOG-24, PERF-1, PERF-3)", () => {
  const manyRuns = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      makeRun({ id: `r${i}`, startedAt: Date.now() - i * 1000 }),
    );

  it("does not re-render RunCards when the relative-time tick fires", () => {
    vi.useFakeTimers();
    renderList({ runs: threeRuns() });
    const initialRenders = cardRenders.mock.calls.length;
    expect(initialRenders).toBe(3);

    act(() => {
      vi.advanceTimersByTime(RELATIVE_NOW_TICK_MS * 2);
    });
    expect(cardRenders).toHaveBeenCalledTimes(initialRenders);
  });

  it("owns one interval regardless of how many runs are listed", () => {
    vi.useFakeTimers();
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    renderList({ runs: manyRuns(40) });
    expect(screen.getAllByRole("option")).toHaveLength(40);
    expect(intervalSpy).toHaveBeenCalledTimes(1);
    intervalSpy.mockRestore();
  });
});
