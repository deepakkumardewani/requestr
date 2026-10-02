import type {
  RunCounts,
  RunStatus,
  RunStep,
  RunSummary,
  RunTrigger,
} from "./chainRunHistory";

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
const TENTHS_PER_SECOND = 10;

export type RunCountKind = "passed" | "failed" | "skipped" | "stopped";
export type RunCountBucket = { kind: RunCountKind; count: number };

/** Display order of the count buckets; zero buckets are hidden. */
const COUNT_ORDER = ["passed", "failed", "skipped"] as const;

/** `chain` namespace keys for the status word shown in the header and collapsed bar. */
export const RUN_STATUS_WORD_KEYS = {
  passed: "runLogCollapsedStatusPassed",
  failed: "runLogCollapsedStatusFailed",
  stopped: "runLogCollapsedStatusStopped",
  running: "runLogCollapsedStatusRunning",
} as const satisfies Record<RunStatus, string>;

export type RunSummaryView = {
  statusWord: RunStatus;
  statusKey: (typeof RUN_STATUS_WORD_KEYS)[RunStatus];
  buckets: RunCountBucket[];
  /** Undefined while the run has not finished. */
  durationMs: number | undefined;
};

/**
 * Non-zero count buckets in passed/failed/skipped order. A run whose only
 * activity was aborted steps reports a single `stopped` bucket; a run with no
 * steps at all yields none.
 */
export function formatRunCounts(counts: RunCounts): RunCountBucket[] {
  const buckets = COUNT_ORDER.filter((kind) => counts[kind] > 0).map(
    (kind) => ({ kind, count: counts[kind] }),
  );
  if (buckets.length > 0) return buckets;
  return counts.aborted > 0 ? [{ kind: "stopped", count: counts.aborted }] : [];
}

/** "412 ms", "1.2s", "2m 5s". */
export function formatDuration(ms: number): string {
  if (ms < MS_PER_SECOND) return `${Math.round(ms)} ms`;
  const tenths = Math.round((ms / MS_PER_SECOND) * TENTHS_PER_SECOND);
  // Rounding 59.96s up must not render as "60.0s".
  if (ms < MS_PER_MINUTE && tenths < SECONDS_PER_MINUTE * TENTHS_PER_SECOND) {
    return `${(tenths / TENTHS_PER_SECOND).toFixed(1)}s`;
  }
  const totalSeconds = Math.round(ms / MS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  return `${minutes}m ${totalSeconds % SECONDS_PER_MINUTE}s`;
}

/** Stopped stays distinct from failed so an aborted run never reads as a failure. */
export function deriveRunStatusWord(
  run: Pick<RunSummary, "status">,
): RunStatus {
  return run.status;
}

export function summarizeRun(
  run: Pick<RunSummary, "status" | "counts" | "startedAt" | "finishedAt">,
): RunSummaryView {
  const statusWord = deriveRunStatusWord(run);
  return {
    statusWord,
    statusKey: RUN_STATUS_WORD_KEYS[statusWord],
    buckets: formatRunCounts(run.counts),
    durationMs:
      run.finishedAt === undefined
        ? undefined
        : Math.max(0, run.finishedAt - run.startedAt),
  };
}

/** The one step-selection rule for opening a run: first failed step, else first, else none. */
export function selectInitialStep(
  run: Pick<RunSummary, "steps">,
): RunStep | null {
  return (
    run.steps.find((step) => step.state === "failed") ?? run.steps[0] ?? null
  );
}

/**
 * Drops entries whose node no longer exists. Returns the same reference when
 * nothing was removed so selectors do not re-render.
 */
export function pruneRunState<T>(
  runState: Record<string, T>,
  liveNodeIds: ReadonlySet<string>,
): Record<string, T> {
  const staleIds = Object.keys(runState).filter((id) => !liveNodeIds.has(id));
  if (staleIds.length === 0) return runState;
  return Object.fromEntries(
    Object.entries(runState).filter(([id]) => liveNodeIds.has(id)),
  );
}

export type RunStatusTone = "success" | "danger" | "warning" | "info";

/** Stopped is a warning, never the failure tone, so an aborted run never reads as an error. */
export const RUN_STATUS_TONES = {
  passed: "success",
  failed: "danger",
  stopped: "warning",
  running: "info",
} as const satisfies Record<RunStatus, RunStatusTone>;

export type RunStatusDisplay = {
  word: RunStatus;
  key: (typeof RUN_STATUS_WORD_KEYS)[RunStatus];
  tone: RunStatusTone;
};

/** Word, i18n key and tone for a run; a finished run with only aborted steps is "stopped". */
export function getRunStatusDisplay(
  run: Pick<RunSummary, "status" | "counts">,
): RunStatusDisplay {
  const isOnlyAborted =
    run.status !== "running" &&
    run.status !== "failed" &&
    formatRunCounts(run.counts).every((bucket) => bucket.kind === "stopped") &&
    run.counts.aborted > 0;
  const word = isOnlyAborted ? "stopped" : deriveRunStatusWord(run);
  return {
    word,
    key: RUN_STATUS_WORD_KEYS[word],
    tone: RUN_STATUS_TONES[word],
  };
}

export type AnchorLabel = {
  key:
    | "runLogTriggerFull"
    | "runLogTriggerUpTo"
    | "runLogTriggerFromHere"
    | "runLogTriggerSingle"
    | "runLogDeletedNode";
  /** ICU values for the key; absent for a full run and the deleted fallback. */
  values?: { node: string };
};

const ANCHORED_TRIGGER_KEYS = {
  upTo: "runLogTriggerUpTo",
  fromHere: "runLogTriggerFromHere",
  single: "runLogTriggerSingle",
} as const satisfies Record<Exclude<RunTrigger, "full">, AnchorLabel["key"]>;

/**
 * Trigger label for a run. An anchored run whose node no longer exists (or
 * was never recorded) falls back to the deleted-node key.
 */
export function resolveAnchorLabel(
  run: Pick<RunSummary, "trigger" | "anchorNodeId">,
  nodeLabels: ReadonlyMap<string, string> | Record<string, string>,
): AnchorLabel {
  if (run.trigger === "full") return { key: "runLogTriggerFull" };
  const label =
    run.anchorNodeId === undefined
      ? undefined
      : nodeLabels instanceof Map
        ? nodeLabels.get(run.anchorNodeId)
        : (nodeLabels as Record<string, string>)[run.anchorNodeId];
  if (label === undefined) return { key: "runLogDeletedNode" };
  return { key: ANCHORED_TRIGGER_KEYS[run.trigger], values: { node: label } };
}

/** Single source for the row menu and the summary header Re-run enablement. */
export function canRerun(
  run: Pick<RunSummary, "trigger" | "anchorNodeId">,
  liveNodeIds: ReadonlySet<string>,
): boolean {
  if (run.trigger === "full") return true;
  return run.anchorNodeId !== undefined && liveNodeIds.has(run.anchorNodeId);
}

export type RunLogEmptyKind =
  | "error"
  | "loading"
  | "noRuns"
  | "noSteps"
  | "filtered"
  | "noStepSelected";

export type RunLogEmptyInput = {
  runs: readonly unknown[];
  selectedRun: unknown | null;
  steps: readonly unknown[];
  filteredSteps: readonly unknown[];
  selectedStep: unknown | null;
  loading: boolean;
  error: unknown | null;
};

/** Which placeholder the run log shows, or `null` when a step can be rendered. */
export function getRunLogEmptyKind(
  input: RunLogEmptyInput,
): RunLogEmptyKind | null {
  if (input.error) return "error";
  if (input.loading) return "loading";
  if (input.runs.length === 0) return "noRuns";
  if (!input.selectedRun) return "noStepSelected";
  if (input.steps.length === 0) return "noSteps";
  if (input.filteredSteps.length === 0) return "filtered";
  if (!input.selectedStep) return "noStepSelected";
  return null;
}
