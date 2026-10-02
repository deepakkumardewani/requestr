/** @vitest-environment happy-dom */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { RunStep, RunSummary } from "@/lib/chainRunHistory";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { useUIStore } from "@/stores/useUIStore";
import { useOpenRun } from "./useOpenRun";

const CHAIN_ID = "chain-1";

function step(id: string, state: RunStep["state"]): RunStep {
  return {
    id,
    nodeId: `node-${id}`,
    nodeType: "api",
    label: id,
    state,
    startedAt: 1,
    durationMs: 1,
    extractedValues: {},
    unresolvedVars: [],
  };
}

function run(id: string, steps: RunStep[]): RunSummary {
  return {
    id,
    chainId: CHAIN_ID,
    startedAt: 1,
    finishedAt: 2,
    status: "passed",
    trigger: "full",
    counts: { passed: 0, failed: 0, skipped: 0, aborted: 0 },
    bytes: 1,
    schemaVersion: 1,
    steps,
  } as RunSummary;
}

function seed(runs: RunSummary[]) {
  useChainRunStore.setState({
    runs: { [CHAIN_ID]: runs },
    selectedRunId: null,
    selectedStepId: null,
  });
}

describe("useOpenRun", () => {
  beforeEach(() => {
    useUIStore.setState({ chainRunLogCollapsed: true });
  });

  it("expands a collapsed dock and selects the run and its first failed step", () => {
    seed([run("r1", [step("s1", "passed"), step("s2", "failed")])]);
    const { result } = renderHook(() => useOpenRun());
    result.current("r1");
    expect(useUIStore.getState().chainRunLogCollapsed).toBe(false);
    expect(useChainRunStore.getState().selectedRunId).toBe("r1");
    expect(useChainRunStore.getState().selectedStepId).toBe("s2");
  });

  it("falls back to the first step when none failed", () => {
    seed([run("r1", [step("s1", "passed"), step("s2", "passed")])]);
    const { result } = renderHook(() => useOpenRun());
    result.current("r1");
    expect(useChainRunStore.getState().selectedStepId).toBe("s1");
  });

  it("handles a zero-step run without throwing", () => {
    seed([run("r1", [])]);
    const { result } = renderHook(() => useOpenRun());
    expect(() => result.current("r1")).not.toThrow();
    expect(useChainRunStore.getState().selectedRunId).toBe("r1");
    expect(useChainRunStore.getState().selectedStepId).toBeNull();
  });

  it("selects an unknown run id with no step", () => {
    seed([]);
    const { result } = renderHook(() => useOpenRun());
    result.current("missing");
    expect(useChainRunStore.getState().selectedRunId).toBe("missing");
    expect(useChainRunStore.getState().selectedStepId).toBeNull();
  });
});
