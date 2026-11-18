"use client";

import { useCallback } from "react";
import { selectInitialStep } from "@/lib/chainRunSummary";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { useUIStore } from "@/stores/useUIStore";

/**
 * Returns `openRun(runId)`: expands the run-log dock, selects the run, then
 * selects its initial step (first failed, else first, else none).
 */
export function useOpenRun() {
  const setCollapsed = useUIStore((state) => state.setChainRunLogCollapsed);

  return useCallback(
    (runId: string) => {
      const { runs, selectRun, selectStep } = useChainRunStore.getState();
      const run = Object.values(runs)
        .flat()
        .find((candidate) => candidate.id === runId);
      setCollapsed(false);
      selectRun(runId);
      const step = run ? selectInitialStep(run) : null;
      if (step) selectStep(step.id, "timeline");
    },
    [setCollapsed],
  );
}
