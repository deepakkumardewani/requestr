"use client";

import { toast } from "sonner";
import { create } from "zustand";
import {
  capRun,
  pruneRuns,
  RUN_SUMMARY_SCHEMA_VERSION,
  type RunCounts,
  type RunStatus,
  type RunStep,
  type RunSummary,
  type RunTrigger,
} from "@/lib/chainRunHistory";
import { getDB } from "@/lib/idb";
import { generateId } from "@/lib/utils";

type SyncSource = "canvas" | "timeline" | null;

type ChainRunStoreState = {
  runs: Record<string, RunSummary[]>;
  activeRun: RunSummary | null;
  selectedRunId: string | null;
  selectedStepId: string | null;
  runsLoading: boolean;
  runsError: string | null;
  syncSource: SyncSource;
};

type ChainRunStoreActions = {
  startRun: (chainId: string, trigger: RunTrigger) => void;
  recordStep: (step: RunStep) => void;
  finishRun: (status: RunStatus) => Promise<void>;
  loadRuns: (chainId: string) => Promise<void>;
  deleteRun: (chainId: string, runId: string) => Promise<void>;
  clearRuns: (chainId: string) => Promise<void>;
  selectRun: (runId: string | null) => void;
  selectStep: (stepId: string | null, source?: SyncSource) => void;
  /** Aborts and purges any in-flight/persisted runs for a chain that's being deleted. */
  handleChainDeleted: (chainId: string) => Promise<void>;
};

export type ChainRunStore = ChainRunStoreState & ChainRunStoreActions;

function emptyCounts(): RunCounts {
  return { passed: 0, failed: 0, skipped: 0, aborted: 0 };
}

function tallyCounts(steps: RunStep[]): RunCounts {
  const counts = emptyCounts();
  for (const step of steps) {
    if (step.state === "passed") counts.passed += 1;
    else if (step.state === "failed") counts.failed += 1;
    else if (step.state === "skipped") counts.skipped += 1;
    else if (step.state === "aborted") counts.aborted += 1;
  }
  return counts;
}

async function persistRun(run: RunSummary): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    const tx = instance.transaction("chainRuns", "readwrite");
    const existing = await tx.store.index("by-chain").getAll(run.chainId);
    const pruned = pruneRuns([...existing.filter((r) => r.id !== run.id), run]);
    // Drop anything pruned out, then write the surviving set.
    const survivingIds = new Set(pruned.map((r) => r.id));
    await Promise.all(
      existing
        .filter((r) => !survivingIds.has(r.id))
        .map((r) => tx.store.delete(r.id)),
    );
    await Promise.all(pruned.map((r) => tx.store.put(r)));
    await tx.done;
  } catch (error) {
    toast.error("Failed to save run history", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function deleteRunFromDB(runId: string): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.delete("chainRuns", runId);
  } catch (error) {
    toast.error("Failed to delete run", {
      description: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function loadRunsFromDB(chainId: string): Promise<RunSummary[]> {
  const db = getDB();
  if (!db) return [];
  const instance = await db;
  return instance.getAllFromIndex("chainRuns", "by-chain", chainId);
}

export const useChainRunStore = create<ChainRunStore>((set, get) => ({
  runs: {},
  activeRun: null,
  selectedRunId: null,
  selectedStepId: null,
  runsLoading: false,
  runsError: null,
  syncSource: null,

  startRun(chainId, trigger) {
    const run: RunSummary = {
      id: generateId(),
      chainId,
      startedAt: Date.now(),
      status: "running",
      trigger,
      counts: emptyCounts(),
      bytes: 0,
      schemaVersion: RUN_SUMMARY_SCHEMA_VERSION,
      steps: [],
    };
    set({ activeRun: run, selectedRunId: run.id, selectedStepId: null });
  },

  recordStep(step) {
    const { activeRun } = get();
    if (!activeRun) return;
    // Upsert by id: a node's running → terminal transition reuses the same
    // step id, so it must replace its existing row rather than append a
    // second one (otherwise the timeline shows a stuck "running" duplicate).
    const index = activeRun.steps.findIndex((s) => s.id === step.id);
    const steps =
      index === -1
        ? [...activeRun.steps, step]
        : activeRun.steps.map((s, i) => (i === index ? step : s));
    set({ activeRun: { ...activeRun, steps } });
  },

  async finishRun(status) {
    const { activeRun } = get();
    if (!activeRun) return;

    const finished = capRun({
      ...activeRun,
      status,
      finishedAt: Date.now(),
      counts: tallyCounts(activeRun.steps),
    });

    await persistRun(finished);

    set((state) => {
      const chainRuns = pruneRuns([
        ...(state.runs[finished.chainId] ?? []).filter(
          (r) => r.id !== finished.id,
        ),
        finished,
      ]);
      return {
        activeRun: null,
        runs: { ...state.runs, [finished.chainId]: chainRuns },
      };
    });
  },

  async loadRuns(chainId) {
    set({ runsLoading: true, runsError: null });
    try {
      const runs = await loadRunsFromDB(chainId);
      set((state) => ({
        runs: { ...state.runs, [chainId]: runs },
        runsLoading: false,
      }));
    } catch (error) {
      set({
        runsLoading: false,
        runsError: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  async deleteRun(chainId, runId) {
    await deleteRunFromDB(runId);
    set((state) => ({
      runs: {
        ...state.runs,
        [chainId]: (state.runs[chainId] ?? []).filter((r) => r.id !== runId),
      },
      selectedRunId: state.selectedRunId === runId ? null : state.selectedRunId,
    }));
  },

  async clearRuns(chainId) {
    const runs = get().runs[chainId] ?? [];
    await Promise.all(runs.map((r) => deleteRunFromDB(r.id)));
    set((state) => ({
      runs: { ...state.runs, [chainId]: [] },
      selectedRunId: runs.some((r) => r.id === state.selectedRunId)
        ? null
        : state.selectedRunId,
    }));
  },

  selectRun(runId) {
    set({ selectedRunId: runId, selectedStepId: null });
  },

  selectStep(stepId, source = null) {
    set({ selectedStepId: stepId, syncSource: source });
  },

  async handleChainDeleted(chainId) {
    const { activeRun } = get();
    if (activeRun?.chainId === chainId) {
      await get().finishRun("stopped");
    }
    const runs = get().runs[chainId] ?? [];
    await Promise.all(runs.map((r) => deleteRunFromDB(r.id)));
    set((state) => {
      const nextRuns = { ...state.runs };
      delete nextRuns[chainId];
      return {
        runs: nextRuns,
        selectedRunId: runs.some((r) => r.id === state.selectedRunId)
          ? null
          : state.selectedRunId,
      };
    });
  },
}));

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    const { activeRun } = useChainRunStore.getState();
    if (!activeRun) return;
    const finished = capRun({
      ...activeRun,
      status: "stopped",
      finishedAt: Date.now(),
      counts: tallyCounts(activeRun.steps),
    });
    // Best-effort: fire-and-forget, the page may unload before this resolves.
    void persistRun(finished);
  });
}
