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
import {
  pruneRunState,
  type RunSummaryView,
  selectInitialStep,
  summarizeRun,
} from "@/lib/chainRunSummary";
import { getDB } from "@/lib/idb";
import { describeError, toastStoreError } from "@/lib/storeToast";
import { generateId } from "@/lib/utils";
import type { ChainRunState } from "@/types/chain";

/** How long a deleted run stays restorable before the delete is committed (D10). */
export const RUN_DELETE_UNDO_MS = 6000;

// Single definition shared with the canvas selection-sync hook.
type SyncSource = CanvasSyncSource;

type ChainRunStoreState = {
  runs: Record<string, RunSummary[]>;
  activeRun: RunSummary | null;
  /** Live per-node badges, keyed by chain id. Ephemeral; persisted history is `runs`. */
  runState: Record<string, ChainRunState>;
  selectedRunId: string | null;
  selectedStepId: string | null;
  /** True once the user explicitly picked (or cleared) a run; `loadRuns` then never auto-selects. */
  userSelected: boolean;
  /** Soft-deleted runs awaiting commit, keyed by run id. Hidden from `runs`; restorable via `undoDeleteRun`. */
  pendingDeletes: Record<string, PendingDelete>;
  /** Keyed by chain id so one chain's load never shows as another's skeleton/error. */
  runsLoading: Record<string, boolean>;
  runsError: Record<string, string | null>;
  syncSource: SyncSource;
  /** In-flight run's abort controller per chain, so deleting a chain can stop it. */
  abortControllers: Record<string, AbortController>;
};

type PendingDelete = {
  chainId: string;
  run: RunSummary;
  /** Position in the chain's list, so undo restores the original order. */
  index: number;
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
  /** Hides the run immediately and commits the delete after `RUN_DELETE_UNDO_MS` unless undone. */
  deleteRun: (chainId: string, runId: string) => Promise<void>;
  undoDeleteRun: (runId: string) => void;
  /** Commits buffered deletes now (all chains, or just `chainId`). Call on unmount. */
  finalizePendingDeletes: (chainId?: string) => Promise<void>;
  clearRuns: (chainId: string) => Promise<void>;
  selectRun: (runId: string | null) => void;
  /** Replaces a chain's live node badges; drops the entry when `next` is empty. */
  setRunState: (chainId: string, next: ChainRunState) => void;
  /** Drops badges for nodes not in `liveNodeIds`; leaves state untouched when nothing is stale. */
  pruneChainRunState: (
    chainId: string,
    liveNodeIds: ReadonlySet<string>,
  ) => void;
  /** Clears live badges only (history untouched). No-op while that chain is running. */
  clearRunResults: (chainId: string) => void;
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

// Timers live outside the store: state stays serializable.
const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelDeleteTimer(runId: string): void {
  const timer = deleteTimers.get(runId);
  if (timer === undefined) return;
  clearTimeout(timer);
  deleteTimers.delete(runId);
}

function pendingIdsFor(
  pending: Record<string, PendingDelete>,
  chainId?: string,
): string[] {
  return Object.keys(pending).filter(
    (id) => chainId === undefined || pending[id].chainId === chainId,
  );
}

function withoutKeys<T>(
  record: Record<string, T>,
  keys: readonly string[],
): Record<string, T> {
  const drop = new Set(keys);
  return Object.fromEntries(
    Object.entries(record).filter(([k]) => !drop.has(k)),
  );
}

/** Empty results remove the chain's key so "no results" is a single shape. */
function withChainRunState(
  all: Record<string, ChainRunState>,
  chainId: string,
  next: ChainRunState,
): Record<string, ChainRunState> {
  if (Object.keys(next).length > 0) return { ...all, [chainId]: next };
  const { [chainId]: _cleared, ...rest } = all;
  return rest;
}

export type LatestRunSummary = RunSummaryView & {
  runId: string;
  startedAt: number;
  /** Persisted runs are always finished; falls back to `startedAt` for legacy rows. */
  finishedAt: number;
};

function findLatestRun(runs: readonly RunSummary[]): RunSummary | null {
  let latest: RunSummary | null = null;
  for (const run of runs) {
    const endedAt = run.finishedAt ?? run.startedAt;
    if (!latest || endedAt > (latest.finishedAt ?? latest.startedAt)) {
      latest = run;
    }
  }
  return latest;
}

// Memoized per run object so a zustand selector returns a stable reference
// until the underlying run changes (no extra renders).
const latestSummaryCache = new WeakMap<RunSummary, LatestRunSummary>();

/**
 * Summary of a chain's most recently finished persisted run, or null when it
 * has none. Use as `useChainRunStore(selectLatestRunSummary(chainId))`.
 */
export function selectLatestRunSummary(chainId: string) {
  return (state: Pick<ChainRunStoreState, "runs">): LatestRunSummary | null => {
    const latest = findLatestRun(state.runs[chainId] ?? []);
    if (!latest) return null;
    let summary = latestSummaryCache.get(latest);
    if (!summary) {
      summary = {
        ...summarizeRun(latest),
        runId: latest.id,
        startedAt: latest.startedAt,
        finishedAt: latest.finishedAt ?? latest.startedAt,
      };
      latestSummaryCache.set(latest, summary);
    }
    return summary;
  };
}

function findRun(
  runs: Record<string, RunSummary[]>,
  runId: string,
): RunSummary | null {
  for (const list of Object.values(runs)) {
    const found = list.find((r) => r.id === runId);
    if (found) return found;
  }
  return null;
}

/**
 * Selection patch for `loadRuns`: only when nothing is selected and the user
 * never chose; prefers the live run, else the latest finished one.
 */
function autoSelection(
  state: ChainRunStoreState,
  chainId: string,
  runs: readonly RunSummary[],
): Partial<ChainRunStoreState> {
  if (state.userSelected || state.selectedRunId) return {};
  const live = state.activeRun?.chainId === chainId ? state.activeRun : null;
  const target = live ?? findLatestRun(runs);
  if (!target) return {};
  return {
    selectedRunId: target.id,
    selectedStepId: selectInitialStep(target)?.id ?? null,
  };
}

/** Writes buffered deletes to storage now and forgets them. */
async function commitPendingDeletes(runIds: readonly string[]): Promise<void> {
  if (runIds.length === 0) return;
  runIds.forEach(cancelDeleteTimer);
  useChainRunStore.setState((state) => ({
    pendingDeletes: withoutKeys(state.pendingDeletes, runIds),
  }));
  await Promise.all(runIds.map(deleteRunFromDB));
}

export const useChainRunStore = create<ChainRunStore>((set, get) => ({
  runs: {},
  activeRun: null,
  runState: {},
  selectedRunId: null,
  selectedStepId: null,
  userSelected: false,
  pendingDeletes: {},
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
      // A new live run always takes the selection (also covers Re-run).
      userSelected: false,
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
      set((state) => {
        // Soft-deleted runs are still in storage until committed; keep them hidden.
        const visible = loaded.filter(
          (run) => !(run.id in state.pendingDeletes),
        );
        // Merge rather than overwrite: a run finished while this read was in
        // flight is in memory but may not be in the snapshot we just loaded.
        const merged = mergeRuns(state.runs[chainId] ?? [], visible);
        return {
          runs: { ...state.runs, [chainId]: merged },
          runsLoading: { ...state.runsLoading, [chainId]: false },
          ...autoSelection(state, chainId, merged),
        };
      });
    } catch (error) {
      set((state) => ({
        runsLoading: { ...state.runsLoading, [chainId]: false },
        runsError: { ...state.runsError, [chainId]: describeError(error) },
      }));
    }
  },

  async deleteRun(chainId, runId) {
    const list = get().runs[chainId] ?? [];
    const index = list.findIndex((r) => r.id === runId);
    if (index === -1) return;
    set((state) => ({
      runs: { ...state.runs, [chainId]: list.filter((r) => r.id !== runId) },
      pendingDeletes: {
        ...state.pendingDeletes,
        [runId]: { chainId, run: list[index], index },
      },
      selectedRunId: state.selectedRunId === runId ? null : state.selectedRunId,
      selectedStepId:
        state.selectedRunId === runId ? null : state.selectedStepId,
    }));
    cancelDeleteTimer(runId);
    deleteTimers.set(
      runId,
      setTimeout(() => {
        void commitPendingDeletes([runId]);
      }, RUN_DELETE_UNDO_MS),
    );
  },

  undoDeleteRun(runId) {
    const pending = get().pendingDeletes[runId];
    if (!pending) return;
    cancelDeleteTimer(runId);
    set((state) => {
      const list = [...(state.runs[pending.chainId] ?? [])];
      list.splice(Math.min(pending.index, list.length), 0, pending.run);
      return {
        runs: { ...state.runs, [pending.chainId]: list },
        pendingDeletes: withoutKeys(state.pendingDeletes, [runId]),
      };
    });
  },

  async finalizePendingDeletes(chainId) {
    await commitPendingDeletes(pendingIdsFor(get().pendingDeletes, chainId));
  },

  async clearRuns(chainId) {
    await get().finalizePendingDeletes(chainId);
    const runs = get().runs[chainId] ?? [];
    await Promise.all(runs.map((r) => deleteRunFromDB(r.id)));
    set((state) => ({
      runs: { ...state.runs, [chainId]: [] },
      selectedRunId: runs.some((r) => r.id === state.selectedRunId)
        ? null
        : state.selectedRunId,
    }));
  },

  setRunState(chainId, next) {
    set((state) => ({
      runState: withChainRunState(state.runState, chainId, next),
    }));
  },

  pruneChainRunState(chainId, liveNodeIds) {
    const current = get().runState[chainId];
    if (!current) return;
    const pruned = pruneRunState(current, liveNodeIds);
    if (pruned === current) return;
    set((state) => ({
      runState: withChainRunState(state.runState, chainId, pruned),
    }));
  },

  clearRunResults(chainId) {
    if (get().activeRun?.chainId === chainId) return;
    if (!get().runState[chainId]) return;
    set((state) => ({
      runState: withChainRunState(state.runState, chainId, {}),
    }));
  },

  selectRun(runId) {
    const run = runId ? findRun(get().runs, runId) : null;
    // Same rule as `useOpenRun`; never reimplemented here.
    const step = run ? selectInitialStep(run) : null;
    set({
      selectedRunId: runId,
      selectedStepId: step?.id ?? null,
      userSelected: true,
      ...(step ? { syncSource: "timeline" as const } : {}),
    });
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
    // The DB purge below covers buffered rows; just drop their timers/state.
    const pendingIds = pendingIdsFor(get().pendingDeletes, chainId);
    pendingIds.forEach(cancelDeleteTimer);
    set((state) => {
      const { [chainId]: _controller, ...abortControllers } =
        state.abortControllers;
      const { [chainId]: _runs, ...runs } = state.runs;
      const { [chainId]: _runState, ...runState } = state.runState;
      const droppedSelectedRun = removed.some(
        (r) => r.id === state.selectedRunId,
      );
      return {
        abortControllers,
        runs,
        runState,
        pendingDeletes: withoutKeys(state.pendingDeletes, pendingIds),
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
    const { activeRun, finalizePendingDeletes } = useChainRunStore.getState();
    void finalizePendingDeletes();
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
