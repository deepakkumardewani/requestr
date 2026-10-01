"use client";

import { create } from "zustand";
import type { SyncSource as CanvasSyncSource } from "@/components/chain/canvas/hooks/useRunSelectionSync";
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
import { describeError, toastStoreError } from "@/lib/storeToast";
import { generateId } from "@/lib/utils";

// Single definition shared with the canvas selection-sync hook.
type SyncSource = CanvasSyncSource;

type ChainRunStoreState = {
  runs: Record<string, RunSummary[]>;
  activeRun: RunSummary | null;
  selectedRunId: string | null;
  selectedStepId: string | null;
  /** Keyed by chain id so one chain's load never shows as another's skeleton/error. */
  runsLoading: Record<string, boolean>;
  runsError: Record<string, string | null>;
  syncSource: SyncSource;
  /** In-flight run's abort controller per chain, so deleting a chain can stop it. */
  abortControllers: Record<string, AbortController>;
};

type StartRunOptions = {
  abortController?: AbortController;
  /** Node the run was invoked on — persisted so Re-run can replay it. */
  anchorNodeId?: string;
};

type ChainRunStoreActions = {
  startRun: (
    chainId: string,
    trigger: RunTrigger,
    options?: StartRunOptions,
  ) => void;
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
    toastStoreError("saveRunHistoryFailed", { cause: error });
  }
}

async function deleteRunFromDB(runId: string): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    await instance.delete("chainRuns", runId);
  } catch (error) {
    toastStoreError("deleteRunFailed", { cause: error });
  }
}

/** Deletes every persisted run of a chain by its `by-chain` index, regardless of what was loaded into memory. */
async function purgeChainRunsFromDB(chainId: string): Promise<void> {
  const db = getDB();
  if (!db) return;
  try {
    const instance = await db;
    const tx = instance.transaction("chainRuns", "readwrite");
    const keys = await tx.store.index("by-chain").getAllKeys(chainId);
    await Promise.all(keys.map((key) => tx.store.delete(key)));
    await tx.done;
  } catch (error) {
    toastStoreError("deleteRunHistoryFailed", { cause: error });
  }
}

async function loadRunsFromDB(chainId: string): Promise<RunSummary[]> {
  const db = getDB();
  if (!db) return [];
  const instance = await db;
  return instance.getAllFromIndex("chainRuns", "by-chain", chainId);
}

/** Union by run id; the in-memory copy wins since it is at least as fresh as storage. */
function mergeRuns(inMemory: RunSummary[], loaded: RunSummary[]): RunSummary[] {
  const inMemoryIds = new Set(inMemory.map((run) => run.id));
  return [...inMemory, ...loaded.filter((run) => !inMemoryIds.has(run.id))];
}

export const useChainRunStore = create<ChainRunStore>((set, get) => ({
  runs: {},
  activeRun: null,
  selectedRunId: null,
  selectedStepId: null,
  runsLoading: {},
  runsError: {},
  syncSource: null,
  abortControllers: {},

  startRun(chainId, trigger, { abortController, anchorNodeId } = {}) {
    const run: RunSummary = {
      id: generateId(),
      chainId,
      startedAt: Date.now(),
      status: "running",
      trigger,
      ...(anchorNodeId === undefined ? {} : { anchorNodeId }),
      counts: emptyCounts(),
      bytes: 0,
      schemaVersion: RUN_SUMMARY_SCHEMA_VERSION,
      steps: [],
    };
    set((state) => ({
      activeRun: run,
      selectedRunId: run.id,
      selectedStepId: null,
      abortControllers: abortController
        ? { ...state.abortControllers, [chainId]: abortController }
        : state.abortControllers,
    }));
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
      const { [finished.chainId]: _finished, ...abortControllers } =
        state.abortControllers;
      return {
        activeRun: null,
        abortControllers,
        runs: { ...state.runs, [finished.chainId]: chainRuns },
      };
    });
  },

  async loadRuns(chainId) {
    set((state) => ({
      runsLoading: { ...state.runsLoading, [chainId]: true },
      runsError: { ...state.runsError, [chainId]: null },
    }));
    try {
      const loaded = await loadRunsFromDB(chainId);
      set((state) => ({
        // Merge rather than overwrite: a run finished while this read was in
        // flight is in memory but may not be in the snapshot we just loaded.
        runs: {
          ...state.runs,
          [chainId]: mergeRuns(state.runs[chainId] ?? [], loaded),
        },
        runsLoading: { ...state.runsLoading, [chainId]: false },
      }));
    } catch (error) {
      set((state) => ({
        runsLoading: { ...state.runsLoading, [chainId]: false },
        runsError: { ...state.runsError, [chainId]: describeError(error) },
      }));
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
    // Abort first so the executor stops issuing requests. The run is then
    // discarded rather than finished: persisting it would resurrect a run row
    // for a chain that no longer exists (the hook's own `finishRun` afterwards
    // is a no-op because `activeRun` is already cleared).
    get().abortControllers[chainId]?.abort();
    const discardActive = get().activeRun?.chainId === chainId;
    const removed = get().runs[chainId] ?? [];
    set((state) => {
      const { [chainId]: _controller, ...abortControllers } =
        state.abortControllers;
      const { [chainId]: _runs, ...runs } = state.runs;
      const droppedSelectedRun = removed.some(
        (r) => r.id === state.selectedRunId,
      );
      return {
        abortControllers,
        runs,
        activeRun: discardActive ? null : state.activeRun,
        selectedRunId:
          droppedSelectedRun || discardActive ? null : state.selectedRunId,
      };
    });
    await purgeChainRunsFromDB(chainId);
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
