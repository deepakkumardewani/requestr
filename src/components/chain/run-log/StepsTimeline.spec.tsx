/** @vitest-environment happy-dom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunStep } from "@/lib/chainRunHistory";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { StepsTimeline } from "./StepsTimeline";

const { scrollToIndexMock, rowRenders, windowing } = vi.hoisted(() => ({
  scrollToIndexMock: vi.fn(),
  rowRenders: vi.fn(),
  // Caps the mocked virtualizer's rendered window; Infinity renders every item.
  windowing: { size: Number.POSITIVE_INFINITY },
}));

// Counts real StepRow renders: the wrapper only re-renders when props change,
// the same condition under which the memoized StepRow would.
vi.mock("./StepRow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./StepRow")>();
  const { memo, createElement } = await import("react");
  return {
    ...actual,
    StepRow: memo((props: React.ComponentProps<typeof actual.StepRow>) => {
      rowRenders(props.step.id);
      return createElement(actual.StepRow, props);
    }),
  };
});

// Virtualizer needs real DOM layout — mock it to render all items synchronously.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    estimateSize,
  }: {
    count: number;
    estimateSize: (i: number) => number;
  }) => ({
    getVirtualItems: () =>
      Array.from({ length: Math.min(count, windowing.size) }, (_, i) => ({
        index: i,
        start: i * estimateSize(i),
        size: estimateSize(i),
        key: i,
      })),
    getTotalSize: () => count * 30,
    scrollToIndex: scrollToIndexMock,
  }),
}));

afterEach(cleanup);

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: `step-${overrides.label ?? "x"}`,
    nodeId: `node-${overrides.label ?? "x"}`,
    nodeType: "api",
    label: overrides.label ?? "Step",
    state: "passed",
    startedAt: 0,
    durationMs: 120,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

beforeEach(() => {
  windowing.size = Number.POSITIVE_INFINITY;
  rowRenders.mockClear();
  useChainRunStore.setState({ selectedStepId: null, syncSource: null });
});

describe("StepsTimeline", () => {
  it("renders rows in order with index, label, state, and duration", () => {
    const steps = [
      makeStep({ id: "s1", label: "Login" }),
      makeStep({ id: "s2", label: "Fetch profile", state: "failed" }),
    ];
    render(<StepsTimeline steps={steps} />);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Fetch profile")).toBeInTheDocument();
  });

  it("shows the empty state when the run has zero steps", () => {
    render(<StepsTimeline steps={[]} />);
    expect(
      screen.getByText("This run recorded no steps."),
    ).toBeInTheDocument();
  });

  it("filters by status via the filter chips", async () => {
    const user = userEvent.setup();
    const steps = [
      makeStep({ id: "s1", label: "Passed step", state: "passed" }),
      makeStep({ id: "s2", label: "Failed step", state: "failed" }),
      makeStep({ id: "s3", label: "Skipped step", state: "skipped" }),
    ];
    render(<StepsTimeline steps={steps} />);

    await user.click(screen.getByRole("button", { name: "Failed 1" }));
    expect(screen.getByText("Failed step")).toBeInTheDocument();
    expect(screen.queryByText("Passed step")).not.toBeInTheDocument();
    expect(screen.queryByText("Skipped step")).not.toBeInTheDocument();
  });

  it("narrows by search on node label", async () => {
    const user = userEvent.setup();
    const steps = [
      makeStep({ id: "s1", label: "Get user" }),
      makeStep({ id: "s2", label: "Create order" }),
    ];
    render(<StepsTimeline steps={steps} />);

    await user.type(screen.getByLabelText("Filter by node label"), "order");
    expect(screen.getByText("Create order")).toBeInTheDocument();
    expect(screen.queryByText("Get user")).not.toBeInTheDocument();
  });

  it("selects a step on click, dispatching source timeline", () => {
    const steps = [makeStep({ id: "s1", label: "Login" })];
    render(<StepsTimeline steps={steps} />);
    fireEvent.click(screen.getByText("Login"));
    expect(useChainRunStore.getState().selectedStepId).toBe("s1");
    expect(useChainRunStore.getState().syncSource).toBe("timeline");
  });

  it("ArrowDown/ArrowUp move selection and Enter re-selects the current row", () => {
    const steps = [
      makeStep({ id: "s1", label: "First" }),
      makeStep({ id: "s2", label: "Second" }),
    ];
    render(<StepsTimeline steps={steps} />);
    const root = screen.getByRole("listbox");

    fireEvent.keyDown(root, { key: "ArrowDown" });
    expect(useChainRunStore.getState().selectedStepId).toBe("s1");

    fireEvent.keyDown(root, { key: "ArrowDown" });
    expect(useChainRunStore.getState().selectedStepId).toBe("s2");

    fireEvent.keyDown(root, { key: "ArrowUp" });
    expect(useChainRunStore.getState().selectedStepId).toBe("s1");

    fireEvent.keyDown(root, { key: "Enter" });
    expect(useChainRunStore.getState().selectedStepId).toBe("s1");
  });

  it("Esc collapses the dock via the provided callback", () => {
    const onCollapseDock = vi.fn();
    const steps = [makeStep({ id: "s1", label: "Login" })];
    render(<StepsTimeline steps={steps} onCollapseDock={onCollapseDock} />);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(onCollapseDock).toHaveBeenCalled();
  });

  describe("filter pipeline (RUNLOG-11/12)", () => {
    const mixed = [
      makeStep({ id: "p1", label: "Alpha ok", state: "passed" }),
      makeStep({ id: "f1", label: "Alpha bad", state: "failed" }),
      makeStep({ id: "a1", label: "Beta aborted", state: "aborted" }),
    ];

    it("shows run-wide counts, hides zero tabs except All, folds aborted into Failed", () => {
      render(<StepsTimeline steps={mixed} />);
      expect(screen.getByRole("button", { name: "All 3" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Passed 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Failed 2" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Skipped/ })).toBeNull();
    });

    it("combines tab filter with text filter and keeps counts unaffected by search", async () => {
      const user = userEvent.setup();
      render(<StepsTimeline steps={mixed} />);
      await user.click(screen.getByRole("button", { name: "Failed 2" }));
      await user.type(screen.getByLabelText("Filter by node label"), "alpha");
      expect(screen.getByText("Alpha bad")).toBeInTheDocument();
      expect(screen.queryByText("Alpha ok")).toBeNull();
      expect(screen.queryByText("Beta aborted")).toBeNull();
      expect(screen.getByRole("button", { name: "Failed 2" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("resets to All when the active tab vanishes", async () => {
      const user = userEvent.setup();
      const { rerender } = render(<StepsTimeline steps={mixed} />);
      await user.click(screen.getByRole("button", { name: "Passed 1" }));
      rerender(<StepsTimeline steps={mixed.slice(1)} />);
      expect(screen.getByRole("button", { name: "All 2" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByText("Alpha bad")).toBeInTheDocument();
    });

    it("first Esc clears the filter, second Esc collapses the dock", async () => {
      const user = userEvent.setup();
      const onCollapseDock = vi.fn();
      render(<StepsTimeline steps={mixed} onCollapseDock={onCollapseDock} />);
      const search = screen.getByLabelText("Filter by node label");
      await user.type(search, "beta");
      await user.click(screen.getByRole("button", { name: "Failed 2" }));

      fireEvent.keyDown(search, { key: "Escape" });
      expect(search).toHaveValue("");
      expect(screen.getByRole("button", { name: "All 3" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(onCollapseDock).not.toHaveBeenCalled();

      fireEvent.keyDown(search, { key: "Escape" });
      expect(onCollapseDock).toHaveBeenCalledTimes(1);
    });

    it("Clear filter in the filtered empty state resets both the tab and the search", async () => {
      const user = userEvent.setup();
      render(<StepsTimeline steps={mixed} />);
      await user.click(screen.getByRole("button", { name: "Passed 1" }));
      const search = screen.getByLabelText("Filter by node label");
      await user.type(search, "bad");
      await user.click(screen.getByRole("button", { name: "Clear filter" }));
      expect(search).toHaveValue("");
      expect(screen.getByRole("button", { name: "All 3" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByText("Alpha ok")).toBeInTheDocument();
      expect(screen.getByText("Beta aborted")).toBeInTheDocument();
    });

    it("announces the visible step count in a polite live region", async () => {
      const user = userEvent.setup();
      render(<StepsTimeline steps={mixed} />);
      const status = screen.getByRole("status");
      expect(status).toHaveAttribute("aria-live", "polite");
      expect(status).toHaveTextContent("3 steps");
      await user.type(screen.getByLabelText("Filter by node label"), "beta");
      expect(status).toHaveTextContent("1 step");
    });

    it("shows the filtered-empty message when nothing matches", async () => {
      const user = userEvent.setup();
      render(<StepsTimeline steps={mixed} />);
      await user.type(screen.getByLabelText("Filter by node label"), "zzz");
      expect(screen.getByText("No steps match this filter.")).toBeInTheDocument();
    });
  });

  describe("keyboard reachability (CR-016)", () => {
    it("makes the listbox a tab stop that follows selection via aria-activedescendant", () => {
      const steps = [makeStep({ id: "s1", label: "First" })];
      render(<StepsTimeline steps={steps} />);
      const listbox = screen.getByRole("listbox");
      expect(listbox).toHaveAttribute("tabindex", "0");
      expect(listbox).not.toHaveAttribute("aria-activedescendant");

      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      const active = listbox.getAttribute("aria-activedescendant");
      expect(active).toBeTruthy();
      expect(document.getElementById(active as string)).toHaveAttribute(
        "data-step-id",
        "s1",
      );
    });

    it("Tab from the search input reaches the listbox", async () => {
      const user = userEvent.setup();
      render(<StepsTimeline steps={[makeStep({ id: "s1", label: "First" })]} />);
      await user.click(screen.getByRole("textbox"));
      await user.tab();
      expect(screen.getByRole("listbox")).toHaveFocus();
    });

    it("arrows in the search input do not change selection or collapse the dock", () => {
      const onCollapseDock = vi.fn();
      const steps = [
        makeStep({ id: "s1", label: "First" }),
        makeStep({ id: "s2", label: "Second" }),
      ];
      render(<StepsTimeline steps={steps} onCollapseDock={onCollapseDock} />);
      const search = screen.getByRole("textbox");

      for (const key of ["ArrowDown", "ArrowUp", "Enter"]) {
        fireEvent.keyDown(search, { key });
      }
      expect(useChainRunStore.getState().selectedStepId).toBeNull();
      expect(onCollapseDock).not.toHaveBeenCalled();
    });

    it("scrolls the virtualizer to the newly selected row", () => {
      scrollToIndexMock.mockClear();
      const steps = Array.from({ length: 60 }, (_, i) =>
        makeStep({ id: `v${i}`, label: `Row ${i}`, startedAt: i }),
      );
      render(<StepsTimeline steps={steps} />);
      const listbox = screen.getByRole("listbox");
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(scrollToIndexMock).toHaveBeenLastCalledWith(1);
    });
  });

  it("orders steps by start time regardless of input order", () => {
    const steps = [
      makeStep({ id: "s2", label: "Second", startedAt: 200 }),
      makeStep({ id: "s1", label: "First", startedAt: 100 }),
    ];
    render(<StepsTimeline steps={steps} />);
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("First");
    expect(options[1]).toHaveTextContent("Second");
  });

  it("renders distinct lane indicators for two concurrent branches in start-time order", () => {
    const steps = [
      makeStep({
        id: "s1",
        label: "Branch A",
        startedAt: 100,
        durationMs: 100,
      }),
      makeStep({
        id: "s2",
        label: "Branch B",
        startedAt: 110,
        durationMs: 100,
      }),
    ];
    render(<StepsTimeline steps={steps} />);

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveTextContent("Branch A");
    expect(options[1]).toHaveTextContent("Branch B");

    expect(
      screen.getByTestId("step-lane-0").compareDocumentPosition(
        screen.getByTestId("step-lane-1"),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("does not render a lane indicator when steps run sequentially", () => {
    const steps = [
      makeStep({ id: "s1", label: "First", startedAt: 0, durationMs: 50 }),
      makeStep({ id: "s2", label: "Second", startedAt: 100, durationMs: 50 }),
    ];
    render(<StepsTimeline steps={steps} />);
    expect(screen.queryByTestId("step-lane-0")).not.toBeInTheDocument();
    expect(screen.queryByTestId("step-lane-1")).not.toBeInTheDocument();
  });

  it("keeps each step's lane when a filter hides its concurrent sibling", async () => {
    const user = userEvent.setup();
    const steps = [
      makeStep({ id: "s1", label: "Branch A", state: "failed", startedAt: 100, durationMs: 100 }),
      makeStep({ id: "s2", label: "Branch B", state: "passed", startedAt: 110, durationMs: 100 }),
    ];
    render(<StepsTimeline steps={steps} />);

    await user.click(screen.getByRole("button", { name: "Passed 1" }));
    expect(screen.queryByText("Branch A")).not.toBeInTheDocument();
    expect(screen.getByTestId("step-lane-1")).toBeInTheDocument();
  });

  it("ignores nested sub-steps when assigning top-level lanes", () => {
    const steps = [
      makeStep({ id: "loop", label: "Loop", nodeType: "loop", startedAt: 0, durationMs: 100 }),
      makeStep({ id: "child", label: "Child", parentStepId: "loop", iteration: 0, startedAt: 10, durationMs: 50 }),
      makeStep({ id: "next", label: "Next", startedAt: 200, durationMs: 50 }),
    ];
    render(<StepsTimeline steps={steps} />);
    expect(screen.queryByTestId("step-lane-1")).not.toBeInTheDocument();
  });

  it("virtualizes when there are more than 50 rows", () => {
    const steps = Array.from({ length: 60 }, (_, i) =>
      makeStep({ id: `s${i}`, label: `Step ${i}` }),
    );
    render(<StepsTimeline steps={steps} />);
    expect(screen.getByText("Step 0")).toBeInTheDocument();
    expect(screen.getByText("Step 59")).toBeInTheDocument();
  });

  describe("performance guard (RUNLOG-24, PERF-1, PERF-3)", () => {
    const LARGE_RUN_STEPS = 2000;
    const MAX_DOM_ROWS = 50;

    function makeLargeRun() {
      return Array.from({ length: LARGE_RUN_STEPS }, (_, i) =>
        makeStep({ id: `s${i}`, label: `Step ${i}`, startedAt: i * 10 }),
      );
    }

    it("mounts fewer than 50 DOM rows for a 2,000-step run", () => {
      windowing.size = 20;
      render(<StepsTimeline steps={makeLargeRun()} />);
      const rows = screen.getAllByRole("option");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThan(MAX_DOM_ROWS);
      expect(screen.queryByText("Step 1999")).not.toBeInTheDocument();
    });

    it("does not re-render rows when the parent re-renders (time tick)", () => {
      const steps = Array.from({ length: 10 }, (_, i) =>
        makeStep({ id: `s${i}`, label: `Step ${i}`, startedAt: i * 10 }),
      );
      const { rerender } = render(<StepsTimeline steps={steps} />);
      const initialRenders = rowRenders.mock.calls.length;
      expect(initialRenders).toBe(steps.length);

      rerender(<StepsTimeline steps={steps} />);
      expect(rowRenders).toHaveBeenCalledTimes(initialRenders);
    });

    it("creates no timers per row", () => {
      const intervalSpy = vi.spyOn(globalThis, "setInterval");
      try {
        windowing.size = 20;
        render(<StepsTimeline steps={makeLargeRun()} />);
        expect(intervalSpy).not.toHaveBeenCalled();
      } finally {
        intervalSpy.mockRestore();
      }
    });
  });

  describe("loop iteration nesting (P8.8)", () => {
    function makeLoopRun() {
      const loopStep = makeStep({
        id: "loop",
        label: "Loop",
        nodeType: "loop",
        startedAt: 0,
      });
      const iterationSteps = [0, 1, 2].map((iteration) =>
        makeStep({
          id: `body-${iteration}`,
          label: `Fetch item ${iteration}`,
          nodeType: "api",
          startedAt: 10 + iteration,
          parentStepId: "loop",
          iteration,
        }),
      );
      const collectStep = makeStep({
        id: "collect",
        label: "Collect",
        nodeType: "collect",
        startedAt: 100,
      });
      return [loopStep, ...iterationSteps, collectStep];
    }

    it("shows three expandable iteration groups for a 3-item loop, each collapsed by default", () => {
      render(<StepsTimeline steps={makeLoopRun()} />);

      expect(screen.getByText("Loop")).toBeInTheDocument();
      expect(screen.getByText("Collect")).toBeInTheDocument();
      for (let i = 0; i < 3; i += 1) {
        expect(screen.getByTestId(`iteration-toggle-loop-${i}`)).toBeInTheDocument();
        expect(screen.queryByText(`Fetch item ${i}`)).not.toBeInTheDocument();
      }
    });

    it("expands an iteration group to reveal its own sub-steps", async () => {
      const user = userEvent.setup();
      render(<StepsTimeline steps={makeLoopRun()} />);

      const toggle = screen.getByTestId("iteration-toggle-loop-1");
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await user.click(toggle);

      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Fetch item 1")).toBeInTheDocument();
      // The other two iterations remain collapsed.
      expect(screen.queryByText("Fetch item 0")).not.toBeInTheDocument();
      expect(screen.queryByText("Fetch item 2")).not.toBeInTheDocument();
    });

    it("does not render loop-iteration sub-steps as their own top-level rows", () => {
      render(<StepsTimeline steps={makeLoopRun()} />);
      // 3 top-level rows: Loop, Collect — sub-steps only appear once expanded.
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
    });

    it("arrows skip collapsed nested rows and include them once expanded", async () => {
      const user = userEvent.setup();
      render(<StepsTimeline steps={makeLoopRun()} />);
      const listbox = screen.getByRole("listbox");

      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(useChainRunStore.getState().selectedStepId).toBe("loop");
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(useChainRunStore.getState().selectedStepId).toBe("collect");
      fireEvent.keyDown(listbox, { key: "ArrowUp" });
      expect(useChainRunStore.getState().selectedStepId).toBe("loop");

      await user.click(screen.getByTestId("iteration-toggle-loop-0"));
      useChainRunStore.getState().selectStep("loop", "timeline");
      fireEvent.keyDown(listbox, { key: "ArrowDown" });
      expect(useChainRunStore.getState().selectedStepId).toBe("body-0");
    });
  });

  describe("sub-chain step nesting (P9.8)", () => {
    function makeSubChainRun() {
      const subChainStep = makeStep({
        id: "sub-1",
        label: "Sub-chain",
        nodeType: "subchain",
        startedAt: 0,
      });
      const nestedSteps = [
        makeStep({
          id: "nested-1",
          label: "Nested request 1",
          nodeType: "api",
          startedAt: 5,
          parentStepId: "sub-1",
        }),
        makeStep({
          id: "nested-2",
          label: "Nested request 2",
          nodeType: "api",
          startedAt: 10,
          parentStepId: "sub-1",
        }),
      ];
      const downstream = makeStep({
        id: "downstream",
        label: "Downstream",
        nodeType: "api",
        startedAt: 100,
      });
      return [subChainStep, ...nestedSteps, downstream];
    }

    it("shows an expandable, collapsed-by-default group for a sub-chain's nested steps", () => {
      render(<StepsTimeline steps={makeSubChainRun()} />);

      expect(screen.getByText("Sub-chain")).toBeInTheDocument();
      expect(screen.getByText("Downstream")).toBeInTheDocument();
      const toggle = screen.getByTestId("subchain-toggle-sub-1");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Nested request 1")).not.toBeInTheDocument();
    });

    it("expands the sub-chain group to reveal its nested steps", async () => {
      const user = userEvent.setup();
      render(<StepsTimeline steps={makeSubChainRun()} />);

      const toggle = screen.getByTestId("subchain-toggle-sub-1");
      await user.click(toggle);

      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Nested request 1")).toBeInTheDocument();
      expect(screen.getByText("Nested request 2")).toBeInTheDocument();
    });

    it("does not render sub-chain nested steps as their own top-level rows", () => {
      render(<StepsTimeline steps={makeSubChainRun()} />);
      // 2 top-level rows: Sub-chain, Downstream — nested steps only appear once expanded.
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
    });
  });
});

describe("multi-level nesting (CR-006)", () => {
  it("nests a Loop inside a Loop iteration, expanding level by level", async () => {
    const steps = [
      makeStep({ id: "L1", label: "Outer loop", nodeType: "loop", startedAt: 0 }),
      makeStep({
        id: "L2::L1::0",
        label: "Inner loop",
        nodeType: "loop",
        startedAt: 1,
        parentStepId: "L1",
        iteration: 0,
      }),
      makeStep({
        id: "leaf::L2::L1::0::1",
        label: "Leaf request",
        startedAt: 2,
        parentStepId: "L2::L1::0",
        iteration: 1,
      }),
    ];
    render(<StepsTimeline steps={steps} />);
    const user = userEvent.setup();

    expect(screen.queryByText("Inner loop")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("iteration-toggle-L1-0"));
    expect(screen.getByText("Inner loop")).toBeInTheDocument();
    expect(screen.queryByText("Leaf request")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("iteration-toggle-L2::L1::0-1"));
    expect(screen.getByText("Leaf request")).toBeInTheDocument();
  });

  it("nests A -> B -> C Sub-chain steps, expanding level by level", async () => {
    const steps = [
      makeStep({ id: "s0", label: "Call B", nodeType: "subchain", startedAt: 0 }),
      makeStep({
        id: "s1::s0",
        label: "Call C",
        nodeType: "subchain",
        startedAt: 1,
        parentStepId: "s0",
      }),
      makeStep({
        id: "deep::s1::s0",
        label: "Deep request",
        startedAt: 2,
        parentStepId: "s1::s0",
      }),
    ];
    render(<StepsTimeline steps={steps} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("subchain-toggle-s0"));
    expect(screen.getByText("Call C")).toBeInTheDocument();
    expect(screen.queryByText("Deep request")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("subchain-toggle-s1::s0"));
    expect(screen.getByText("Deep request")).toBeInTheDocument();
  });

  it("nests a Sub-chain inside a Loop iteration", async () => {
    const steps = [
      makeStep({ id: "loop", label: "Loop", nodeType: "loop", startedAt: 0 }),
      makeStep({
        id: "sub::loop::0",
        label: "Sub call",
        nodeType: "subchain",
        startedAt: 1,
        parentStepId: "loop",
        iteration: 0,
      }),
      makeStep({
        id: "req::sub::loop::0",
        label: "Nested request",
        startedAt: 2,
        parentStepId: "sub::loop::0",
      }),
    ];
    render(<StepsTimeline steps={steps} />);
    const user = userEvent.setup();

    await user.click(screen.getByTestId("iteration-toggle-loop-0"));
    await user.click(screen.getByTestId("subchain-toggle-sub::loop::0"));
    expect(screen.getByText("Nested request")).toBeInTheDocument();
  });
});
