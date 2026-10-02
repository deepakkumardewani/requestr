import { describe, expect, it } from "vitest";
import type { RunCounts, RunStep, RunSummary } from "./chainRunHistory";
import {
  canRerun,
  deriveRunStatusWord,
  formatDuration,
  formatRunCounts,
  getRunLogEmptyKind,
  getRunStatusDisplay,
  pruneRunState,
  resolveAnchorLabel,
  selectInitialStep,
  summarizeRun,
} from "./chainRunSummary";

const counts = (overrides: Partial<RunCounts> = {}): RunCounts => ({
  passed: 0,
  failed: 0,
  skipped: 0,
  aborted: 0,
  ...overrides,
});

const step = (id: string, state: RunStep["state"]): RunStep =>
  ({ id, state } as RunStep);

describe("formatRunCounts", () => {
  it("returns no buckets when there are no steps", () => {
    expect(formatRunCounts(counts())).toEqual([]);
  });

  it("hides zero buckets and keeps passed, failed, skipped order", () => {
    expect(formatRunCounts(counts({ passed: 2, skipped: 1 }))).toEqual([
      { kind: "passed", count: 2 },
      { kind: "skipped", count: 1 },
    ]);
    expect(
      formatRunCounts(counts({ passed: 2, failed: 1, skipped: 1 }))
    ).toEqual([
      { kind: "passed", count: 2 },
      { kind: "failed", count: 1 },
      { kind: "skipped", count: 1 },
    ]);
  });

  it("reports stopped when only aborted steps exist", () => {
    expect(formatRunCounts(counts({ aborted: 3 }))).toEqual([
      { kind: "stopped", count: 3 },
    ]);
  });

  it("prefers real buckets over aborted when both are present", () => {
    expect(formatRunCounts(counts({ failed: 1, aborted: 2 }))).toEqual([
      { kind: "failed", count: 1 },
    ]);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0 ms"],
    [412, "412 ms"],
    [999, "999 ms"],
    [1000, "1.0s"],
    [1234, "1.2s"],
    [59_900, "59.9s"],
    [59_960, "1m 0s"],
    [60_000, "1m 0s"],
    [125_000, "2m 5s"],
  ])("formats %d ms as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("summarizeRun / deriveRunStatusWord", () => {
  it("keeps stopped distinct from failed", () => {
    expect(deriveRunStatusWord({ status: "stopped" })).toBe("stopped");
    expect(deriveRunStatusWord({ status: "failed" })).toBe("failed");
  });

  it("combines status key, buckets and duration", () => {
    expect(
      summarizeRun({
        status: "failed",
        counts: counts({ passed: 2, failed: 1 }),
        startedAt: 1000,
        finishedAt: 2500,
      })
    ).toEqual({
      statusWord: "failed",
      statusKey: "runLogCollapsedStatusFailed",
      buckets: [
        { kind: "passed", count: 2 },
        { kind: "failed", count: 1 },
      ],
      durationMs: 1500,
    });
  });

  it("has no duration while running and clamps negative spans", () => {
    const base = { counts: counts(), startedAt: 5000 };
    expect(
      summarizeRun({ ...base, status: "running" }).durationMs
    ).toBeUndefined();
    expect(
      summarizeRun({ ...base, status: "passed", finishedAt: 4000 }).durationMs
    ).toBe(0);
  });
});

describe("selectInitialStep", () => {
  it("returns the first failed step", () => {
    const steps = [
      step("a", "passed"),
      step("b", "failed"),
      step("c", "failed"),
    ];
    expect(selectInitialStep({ steps })?.id).toBe("b");
  });

  it("falls back to the first step when none failed", () => {
    expect(
      selectInitialStep({ steps: [step("a", "passed"), step("b", "skipped")] })
        ?.id
    ).toBe("a");
  });

  it("returns null with no steps", () => {
    expect(selectInitialStep({ steps: [] })).toBeNull();
  });
});

describe("pruneRunState", () => {
  const runState = { a: { v: 1 }, b: { v: 2 }, c: { v: 3 } };

  it("removes ids that are no longer live and keeps the rest", () => {
    expect(pruneRunState(runState, new Set(["a", "c"]))).toEqual({
      a: { v: 1 },
      c: { v: 3 },
    });
  });

  it("returns the same reference when nothing is pruned", () => {
    expect(pruneRunState(runState, new Set(["a", "b", "c", "d"]))).toBe(
      runState
    );
  });

  it("returns an empty object when no node is live", () => {
    expect(pruneRunState(runState, new Set())).toEqual({});
  });
});

describe("getRunStatusDisplay", () => {
  it("maps each status to its word, key and tone", () => {
    expect(
      getRunStatusDisplay({ status: "passed", counts: counts({ passed: 1 }) })
    ).toEqual({
      word: "passed",
      key: "runLogCollapsedStatusPassed",
      tone: "success",
    });
    expect(
      getRunStatusDisplay({ status: "failed", counts: counts({ failed: 1 }) })
        .tone
    ).toBe("danger");
    expect(
      getRunStatusDisplay({ status: "running", counts: counts() }).tone
    ).toBe("info");
  });

  it("keeps stopped distinct from failed", () => {
    const stopped = getRunStatusDisplay({
      status: "stopped",
      counts: counts({ aborted: 2 }),
    });
    expect(stopped).toMatchObject({ word: "stopped", tone: "warning" });
    expect(stopped.tone).not.toBe(
      getRunStatusDisplay({ status: "failed", counts: counts({ failed: 1 }) })
        .tone
    );
  });

  it("counts a passed-status run with only aborted steps as stopped", () => {
    expect(
      getRunStatusDisplay({ status: "passed", counts: counts({ aborted: 1 }) })
        .word
    ).toBe("stopped");
  });

  it("never downgrades a failed run to stopped", () => {
    expect(
      getRunStatusDisplay({ status: "failed", counts: counts({ aborted: 1 }) })
        .word
    ).toBe("failed");
  });
});

describe("resolveAnchorLabel", () => {
  const labels = new Map([["n1", "Login"]]);
  const run = (trigger: RunSummary["trigger"], anchorNodeId?: string) => ({
    trigger,
    anchorNodeId,
  });

  it("returns the full key without values for full runs", () => {
    expect(resolveAnchorLabel(run("full"), labels)).toEqual({
      key: "runLogTriggerFull",
    });
  });

  it.each([
    ["upTo", "runLogTriggerUpTo"],
    ["fromHere", "runLogTriggerFromHere"],
    ["single", "runLogTriggerSingle"],
  ] as const)("resolves %s with the node label", (trigger, key) => {
    expect(resolveAnchorLabel(run(trigger, "n1"), labels)).toEqual({
      key,
      values: { node: "Login" },
    });
  });

  it("accepts a plain record of labels", () => {
    expect(
      resolveAnchorLabel(run("single", "n1"), { n1: "Login" }).values
    ).toEqual({ node: "Login" });
  });

  it("falls back to the deleted key when the node is gone or unrecorded", () => {
    expect(resolveAnchorLabel(run("fromHere", "gone"), labels)).toEqual({
      key: "runLogDeletedNode",
    });
    expect(resolveAnchorLabel(run("upTo"), labels)).toEqual({
      key: "runLogDeletedNode",
    });
  });
});

describe("canRerun", () => {
  const live = new Set(["n1"]);

  it("is true for full runs regardless of live nodes", () => {
    expect(canRerun({ trigger: "full" }, new Set())).toBe(true);
  });

  it("is true when the anchor still exists", () => {
    expect(canRerun({ trigger: "single", anchorNodeId: "n1" }, live)).toBe(
      true
    );
  });

  it("is false when the anchor is gone or missing", () => {
    expect(canRerun({ trigger: "single", anchorNodeId: "x" }, live)).toBe(
      false
    );
    expect(canRerun({ trigger: "upTo" }, live)).toBe(false);
  });
});

describe("getRunLogEmptyKind", () => {
  const s = { id: "s" };
  const base = {
    runs: [{}],
    selectedRun: {},
    steps: [s],
    filteredSteps: [s],
    selectedStep: s,
    loading: false,
    error: null,
  };

  it("returns null when a step can be shown", () => {
    expect(getRunLogEmptyKind(base)).toBeNull();
  });

  it.each([
    ["error", { error: new Error("x") }],
    ["loading", { loading: true }],
    ["noRuns", { runs: [], selectedRun: null }],
    ["noStepSelected", { selectedRun: null }],
    ["noSteps", { steps: [], filteredSteps: [], selectedStep: null }],
    ["filtered", { filteredSteps: [], selectedStep: null }],
    ["noStepSelected", { selectedStep: null }],
  ] as const)("returns %s", (kind, override) => {
    expect(getRunLogEmptyKind({ ...base, ...override })).toBe(kind);
  });

  it("prioritises error over loading and empty runs", () => {
    expect(
      getRunLogEmptyKind({ ...base, runs: [], loading: true, error: "x" })
    ).toBe("error");
  });
});
