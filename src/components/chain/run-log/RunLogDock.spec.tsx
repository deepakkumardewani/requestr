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
import { useUIStore } from "@/stores/useUIStore";
import { RunLogDock } from "./RunLogDock";

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

afterEach(() => {
  cleanup();
  for (const k of Object.keys(localStore)) delete localStore[k];
  vi.unstubAllGlobals();
});

describe("RunLogDock", () => {
  it("starts collapsed to the 32px strip", () => {
    render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    const dock = screen.getByTestId("run-log-dock");
    expect(dock.style.height).toBe("32px");
    expect(screen.queryByText("body")).not.toBeInTheDocument();
  });

  it("expands to the persisted height when the expand button is clicked", () => {
    render(
      <RunLogDock isRunning={false} runCount={2}>
        <div>body</div>
      </RunLogDock>,
    );
    fireEvent.click(screen.getByLabelText("Expand run log"));
    const dock = screen.getByTestId("run-log-dock");
    expect(dock.style.height).toBe("280px");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("collapses back to the strip when the collapse button is clicked", () => {
    render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    fireEvent.click(screen.getByLabelText("Expand run log"));
    fireEvent.click(screen.getByLabelText("Collapse run log"));
    expect(screen.getByTestId("run-log-dock").style.height).toBe("32px");
  });

  it("auto-opens when a run starts and the preference is enabled", () => {
    const { rerender } = render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    expect(screen.getByTestId("run-log-dock").style.height).toBe("32px");
    rerender(
      <RunLogDock isRunning={true} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    expect(screen.getByTestId("run-log-dock").style.height).toBe("280px");
  });

  it("does not auto-open when the preference is disabled", () => {
    useUIStore.setState({ chainRunLogAutoOpen: false });
    const { rerender } = render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    rerender(
      <RunLogDock isRunning={true} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    expect(screen.getByTestId("run-log-dock").style.height).toBe("32px");
  });

  it("toggles the auto-open preference from the overflow menu", async () => {
    const user = userEvent.setup();
    render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    await user.click(screen.getByLabelText("Expand run log"));
    await user.click(screen.getByLabelText("More options"));
    const menu = screen.getByText("Auto-open on run").closest("label");
    expect(menu).not.toBeNull();
    const toggle = within(menu as HTMLElement).getByRole("switch");
    await user.click(toggle);
    expect(useUIStore.getState().chainRunLogAutoOpen).toBe(false);
    expect(localStore.rq_chain_run_log_auto_open).toBe("false");
  });

  it("resizes via the drag handle and persists the new height on mouseup", () => {
    render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    fireEvent.click(screen.getByLabelText("Expand run log"));
    const handle = screen.getByLabelText("Resize run log");

    fireEvent.mouseDown(handle, { clientY: 500 });
    fireEvent.mouseMove(window, { clientY: 400 }); // drag up 100px -> taller
    fireEvent.mouseUp(window);

    expect(useUIStore.getState().chainRunLogHeight).toBe(380);
    expect(localStore.rq_chain_run_log_height).toBe("380");
  });

  it("clamps resize below the 160px minimum", () => {
    render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    fireEvent.click(screen.getByLabelText("Expand run log"));
    const handle = screen.getByLabelText("Resize run log");

    fireEvent.mouseDown(handle, { clientY: 500 });
    fireEvent.mouseMove(window, { clientY: 900 }); // drag down far past min
    fireEvent.mouseUp(window);

    expect(useUIStore.getState().chainRunLogHeight).toBe(160);
  });

  it("collapsed strip renders status, run label, counts, and expand chevron", () => {
    const latestRun = makeRunSummary();
    render(
      <RunLogDock isRunning={false} runCount={1} latestRun={latestRun}>
        <div>body</div>
      </RunLogDock>,
    );
    const strip = screen.getByTestId("run-log-strip");
    expect(strip).toHaveTextContent("Full run");
    expect(strip).toHaveTextContent("3 ✓ 1 ✗ 0 skipped");
    expect(screen.getByLabelText("Expand run log")).toBeInTheDocument();
  });

  it("persists the collapsed state across remounts", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    await user.click(screen.getByLabelText("Expand run log"));
    expect(useUIStore.getState().chainRunLogCollapsed).toBe(false);
    expect(localStore.rq_chain_run_log_collapsed).toBe("false");
    unmount();

    render(
      <RunLogDock isRunning={false} runCount={0}>
        <div>body</div>
      </RunLogDock>,
    );
    expect(screen.getByTestId("run-log-dock").style.height).toBe("280px");
  });
});
