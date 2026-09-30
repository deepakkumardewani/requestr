import { describe, expect, it } from "vitest";
import {
  capRun,
  MAX_BODY_BYTES,
  MAX_CHAIN_HISTORY_BYTES,
  MAX_RUN_BYTES,
  MAX_RUNS_PER_CHAIN,
  pruneRuns,
  type RunStep,
  type RunSummary,
  truncateBody,
} from "./chainRunHistory";

function makeStep(overrides: Partial<RunStep> = {}): RunStep {
  return {
    id: `step-${Math.random()}`,
    nodeId: "node-1",
    nodeType: "api",
    label: "GET /users",
    state: "passed",
    startedAt: Date.now(),
    durationMs: 10,
    extractedValues: {},
    unresolvedVars: [],
    ...overrides,
  };
}

function makeRun(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    id: `run-${Math.random()}`,
    chainId: "chain-1",
    startedAt: Date.now(),
    status: "passed",
    trigger: "full",
    counts: { passed: 1, failed: 0, skipped: 0, aborted: 0 },
    bytes: 0,
    schemaVersion: 1,
    steps: [makeStep()],
    ...overrides,
  };
}

describe("truncateBody", () => {
  it("leaves a body under the cap untouched", () => {
    const body = "x".repeat(100);
    expect(truncateBody(body)).toEqual({ body, truncated: false });
  });

  it("caps a 1 MB body at MAX_BODY_BYTES and flags it truncated", () => {
    const body = "a".repeat(1024 * 1024);
    const result = truncateBody(body);
    expect(result.truncated).toBe(true);
    expect(new TextEncoder().encode(result.body).length).toBeLessThanOrEqual(
      MAX_BODY_BYTES,
    );
  });
});

describe("capRun", () => {
  it("leaves a small run untouched with bytes computed and no stepsTruncated", () => {
    const run = makeRun();
    const result = capRun(run);
    expect(result.stepsTruncated).toBeUndefined();
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.steps).toHaveLength(1);
  });

  it("sheds oldest steps from a 3 MB run until it fits MAX_RUN_BYTES", () => {
    const bigBody = "b".repeat(300 * 1024);
    const steps: RunStep[] = Array.from({ length: 10 }, (_, i) =>
      makeStep({
        id: `step-${i}`,
        startedAt: i,
        response: {
          status: 200,
          statusText: "OK",
          headers: {},
          body: bigBody,
          duration: 1,
          size: bigBody.length,
          url: "https://example.com",
          method: "GET",
          timestamp: i,
        },
      }),
    );
    const run = makeRun({ steps });

    const result = capRun(run);

    expect(result.bytes).toBeLessThanOrEqual(MAX_RUN_BYTES);
    expect(result.stepsTruncated).toBeGreaterThan(0);
    expect(result.steps.length).toBeLessThan(steps.length);
    // Oldest steps (lowest startedAt) are dropped first.
    const remainingIds = result.steps.map((s) => s.id);
    expect(remainingIds).not.toContain("step-0");
  });
});

describe("pruneRuns", () => {
  it("keeps runs under both limits untouched", () => {
    const runs = [makeRun({ id: "a", startedAt: 1, bytes: 100 })];
    expect(pruneRuns(runs)).toEqual(runs);
  });

  it("drops oldest runs beyond MAX_RUNS_PER_CHAIN (51-run fixture)", () => {
    const runs = Array.from({ length: MAX_RUNS_PER_CHAIN + 1 }, (_, i) =>
      makeRun({ id: `run-${i}`, startedAt: i, bytes: 10 }),
    );

    const result = pruneRuns(runs);

    expect(result).toHaveLength(MAX_RUNS_PER_CHAIN);
    expect(result.map((r) => r.id)).not.toContain("run-0");
    expect(result.map((r) => r.id)).toContain(`run-${MAX_RUNS_PER_CHAIN}`);
  });

  it("drops oldest runs beyond MAX_CHAIN_HISTORY_BYTES (60 MB history fixture)", () => {
    const bytesPerRun = 1024 * 1024; // 1 MB per run, 60 runs = 60 MB
    const runCount = 60;
    const runs = Array.from({ length: runCount }, (_, i) =>
      makeRun({ id: `run-${i}`, startedAt: i, bytes: bytesPerRun }),
    );

    const result = pruneRuns(runs);

    const totalBytes = result.reduce((sum, r) => sum + r.bytes, 0);
    expect(totalBytes).toBeLessThanOrEqual(MAX_CHAIN_HISTORY_BYTES);
    expect(result.length).toBeLessThan(runCount);
    expect(result.map((r) => r.id)).not.toContain("run-0");
  });

  it("applies both limits together, keeping only the most recent runs", () => {
    const runs = Array.from({ length: MAX_RUNS_PER_CHAIN + 5 }, (_, i) =>
      makeRun({ id: `run-${i}`, startedAt: i, bytes: 1024 }),
    );

    const result = pruneRuns(runs);

    expect(result.length).toBeLessThanOrEqual(MAX_RUNS_PER_CHAIN);
    const totalBytes = result.reduce((sum, r) => sum + r.bytes, 0);
    expect(totalBytes).toBeLessThanOrEqual(MAX_CHAIN_HISTORY_BYTES);
  });
});
