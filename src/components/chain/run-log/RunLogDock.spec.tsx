/** @vitest-environment happy-dom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUIStore } from "@/stores/useUIStore";
import { useRelativeNowValue } from "@/components/chain/RelativeNowProvider";
import { RelativeTime } from "@/components/chain/RelativeTime";
import { RunFilterTabs } from "./RunFilterTabs";
import type { ComponentProps } from "react";
import { RunLogDock } from "./RunLogDock";

// Real implementations wrapped with render counters: these are components the
// dock itself renders, so a tick re-rendering the shell shows up here.
const shellRenders = vi.hoisted(() => ({
  header: 0,
  split: 0,
  consumer: 0,
}));

vi.mock("./RunLogHeader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./RunLogHeader")>();
  return {
    ...actual,
    RunLogHeader: (props: ComponentProps<typeof actual.RunLogHeader>) => {
      shellRenders.header += 1;
      return actual.RunLogHeader(props);
    },
  };
});

vi.mock("./RunLogSplit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./RunLogSplit")>();
  return {
    ...actual,
    RunLogSplit: (props: ComponentProps<typeof actual.RunLogSplit>) => {
      shellRenders.split += 1;
      return actual.RunLogSplit(props);
    },
  };
});

function Consumer() {
  shellRenders.consumer += 1;
  useRelativeNowValue();
  return <div>consumer</div>;
}

const localStore: Record<string, string> = {};

function mockLocalStorage() {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => localStore[k] ?? null,
    setItem: (k: string, v: string) => {
      localStore[k] = v;
    },
    removeItem: (k: string) => {
      delete localStore[k];
    },
  });
}

beforeEach(() => {
  mockLocalStorage();
  useUIStore.setState({
    chainRunLogHeight: 280,
    chainRunLogAutoOpen: true,
    chainRunLogCollapsed: true,
  });
});

function makeRunSummary(
  overrides: Partial<import("@/lib/chainRunHistory").RunSummary> = {},
): import("@/lib/chainRunHistory").RunSummary {
  return {
    id: "run-1",
    chainId: "chain-1",
    startedAt: Date.now() - 1000,
    finishedAt: Date.now(),
    status: "passed",
    trigger: "full",
    counts: { passed: 3, failed: 1, skipped: 0, aborted: 0 },
    bytes: 10,
    schemaVersion: 1,
    steps: [
      {
        id: "s1",
        nodeId: "req-1",
        nodeType: "api",
        label: "req-1",
        state: "passed",
        startedAt: Date.now() - 500,
        durationMs: 10,
        extractedValues: {},
        unresolvedVars: [],
      },
    ],
    ...overrides,
  };
}

const baseProps = {
  isRunning: false,
  runCount: 0,
  onClearAll: () => {},
  list: <div>list-slot</div>,
  steps: <div>body</div>,
  detail: <div>detail-slot</div>,
};

afterEach(() => {
  cleanup();
  for (const k of Object.keys(localStore)) delete localStore[k];
  vi.unstubAllGlobals();
});

describe("RunLogDock", () => {
  it("starts collapsed to the 32px strip", () => {
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    const dock = screen.getByTestId("run-log-dock");
    expect(dock.style.height).toBe("32px");
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("expands to the persisted height when the expand button is clicked", () => {
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={2} />,
    );
    fireEvent.click(screen.getByTestId("run-log-strip"));
    const dock = screen.getByTestId("run-log-dock");
    expect(dock.style.height).toBe("280px");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("collapses back to the strip when the collapse button is clicked", () => {
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    fireEvent.click(screen.getByTestId("run-log-strip"));
    fireEvent.click(screen.getByLabelText("Collapse run log"));
    expect(screen.getByTestId("run-log-dock").style.height).toBe("32px");
  });

  it("auto-opens when a run starts and the preference is enabled", () => {
    const { rerender } = render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    expect(screen.getByTestId("run-log-dock").style.height).toBe("32px");
    rerender(
      <RunLogDock {...baseProps} isRunning={true} runCount={0} />,
    );
    expect(screen.getByTestId("run-log-dock").style.height).toBe("280px");
  });

  it("does not auto-open when the preference is disabled", () => {
    useUIStore.setState({ chainRunLogAutoOpen: false });
    const { rerender } = render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    rerender(
      <RunLogDock {...baseProps} isRunning={true} runCount={0} />,
    );
    expect(screen.getByTestId("run-log-dock").style.height).toBe("32px");
  });

  it("toggles the auto-open preference from the overflow menu", async () => {
    const user = userEvent.setup();
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    await user.click(screen.getByTestId("run-log-strip"));
    await user.click(screen.getByLabelText("Run Log options"));
    await user.click(
      await screen.findByRole("menuitemcheckbox", { name: "Auto-open on run" }),
    );
    expect(useUIStore.getState().chainRunLogAutoOpen).toBe(false);
    expect(localStore.rq_chain_run_log_auto_open).toBe("false");
  });

  it("resizes via the drag handle and persists the new height on pointerup", () => {
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    fireEvent.click(screen.getByTestId("run-log-strip"));
    const handle = screen.getByRole("separator", { name: "Resize run log" });

    fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 400, pointerId: 1 }); // up 100px -> taller
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(useUIStore.getState().chainRunLogHeight).toBe(380);
    expect(localStore.rq_chain_run_log_height).toBe("380");
  });

  it("clamps resize below the 160px minimum", () => {
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    fireEvent.click(screen.getByTestId("run-log-strip"));
    const handle = screen.getByRole("separator", { name: "Resize run log" });

    fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 900, pointerId: 1 }); // down far past min
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(useUIStore.getState().chainRunLogHeight).toBe(160);
  });

  it("resizes from the keyboard with ArrowUp and ArrowDown", () => {
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    fireEvent.click(screen.getByTestId("run-log-strip"));
    const handle = screen.getByRole("separator", { name: "Resize run log" });

    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(useUIStore.getState().chainRunLogHeight).toBe(296);
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(useUIStore.getState().chainRunLogHeight).toBe(264);
  });

  it("follows the store's collapsed flag as its single source of truth", () => {
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();

    act(() => useUIStore.getState().setChainRunLogCollapsed(false));
    expect(screen.getByText("body")).toBeInTheDocument();

    act(() => useUIStore.getState().setChainRunLogCollapsed(true));
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("collapsed strip renders status, run label, counts, and expand chevron", () => {
    const latestRun = makeRunSummary();
    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={1} latestRun={latestRun} />,
    );
    const strip = screen.getByTestId("run-log-strip");
    expect(strip).toHaveTextContent("Run Log");
    expect(strip).toHaveTextContent("Last run passed");
    expect(strip).toHaveAttribute("aria-expanded", "false");
  });

  it("persists the collapsed state across remounts", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    await user.click(screen.getByTestId("run-log-strip"));
    expect(useUIStore.getState().chainRunLogCollapsed).toBe(false);
    expect(localStore.rq_chain_run_log_collapsed).toBe("false");
    unmount();

    render(
      <RunLogDock {...baseProps} isRunning={false} runCount={0} />,
    );
    expect(screen.getByTestId("run-log-dock").style.height).toBe("280px");
  });

  it("is a region named Run Log", () => {
    render(<RunLogDock {...baseProps} />);
    expect(screen.getByRole("region", { name: "Run Log" })).toBe(
      screen.getByTestId("run-log-dock"),
    );
  });

  it("orders focus header, list, filters, steps, detail", () => {
    useUIStore.setState({ chainRunLogCollapsed: false });
    render(
      <RunLogDock
        {...baseProps}
        list={<button type="button">list-btn</button>}
        steps={
          <>
            <RunFilterTabs
              counts={{ all: 3, passed: 2, failed: 1, skipped: 0 }}
              value="all"
              onChange={() => {}}
            />
            <button type="button">steps-btn</button>
          </>
        }
        detail={<button type="button">detail-btn</button>}
      />,
    );
    const nameOf = (b: HTMLElement) =>
      b.getAttribute("aria-label") ?? b.textContent ?? "";
    const buttons = screen.getAllByRole("button").map(nameOf);
    const idx = (name: string) => buttons.findIndex((n) => n === name);
    const filterNames = buttons.filter((n) => /^(All|Passed|Failed)\b/.test(n));
    expect(filterNames.length).toBe(3);
    const order = [
      idx("Run Log options"),
      idx("list-btn"),
      ...filterNames.map((n) => idx(n)),
      idx("steps-btn"),
      idx("detail-btn"),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("swaps the runs list for the run select in a narrow dock", () => {
    useUIStore.setState({ chainRunLogCollapsed: false });
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({ width: 400, height: 300 } as DOMRect);
    render(<RunLogDock {...baseProps} runSelect={<div>select-slot</div>} />);
    expect(screen.getByText("select-slot")).toBeInTheDocument();
    expect(screen.queryByText("list-slot")).not.toBeInTheDocument();
    rectSpy.mockRestore();
  });

  it("a tick updates only the time text; RunLogHeader/RunLogSplit do not re-render", () => {
    vi.useFakeTimers();
    useUIStore.setState({ chainRunLogCollapsed: false });
    const startedAt = Date.now();
    render(
      <RunLogDock
        {...baseProps}
        steps={<RelativeTime timestamp={startedAt} />}
        detail={<Consumer />}
      />,
    );
    const timeText = () => document.querySelector("time")?.textContent;
    const before = { ...shellRenders };
    const consumerBefore = shellRenders.consumer;
    const textBefore = timeText();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    // Control: a tick does reach context consumers in this tree.
    expect(shellRenders.consumer).toBeGreaterThan(consumerBefore);
    expect(shellRenders.split).toBe(before.split);
    expect(shellRenders.header).toBe(before.header);
    expect(timeText()).not.toBe(textBefore);
    vi.useRealTimers();
  });
});
