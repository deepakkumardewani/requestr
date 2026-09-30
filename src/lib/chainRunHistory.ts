import type { HttpMethod, ResponseData } from "@/types";
import type {
  AssertionResult,
  ChainNodeState,
  ChainNodeType,
} from "@/types/chain";

/** Single body cap — response bodies over this are truncated with a `truncated` flag. */
export const MAX_BODY_BYTES = 256 * 1024;
/** Single run cap — a run over this sheds its oldest steps until it fits. */
export const MAX_RUN_BYTES = 2 * 1024 * 1024;
/** Per-chain run count retention — oldest runs are pruned once this is exceeded. */
export const MAX_RUNS_PER_CHAIN = 50;
/** Per-chain total history byte budget — oldest runs are pruned once this is exceeded. */
export const MAX_CHAIN_HISTORY_BYTES = 50 * 1024 * 1024;

/** Schema version for persisted `RunSummary` records. */
export const RUN_SUMMARY_SCHEMA_VERSION = 1;

export type SerialisedRequest = {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
};

export type SerialisedResponse = ResponseData & { truncated?: boolean };

export type RunStep = {
  id: string;
  nodeId: string;
  nodeType: ChainNodeType;
  label: string;
  state: ChainNodeState;
  startedAt: number;
  durationMs: number;
  request?: SerialisedRequest;
  response?: SerialisedResponse;
  error?: string;
  assertionResults?: AssertionResult[];
  extractedValues: Record<string, unknown>;
  unresolvedVars: string[];
  parentStepId?: string;
  iteration?: number;
  lane?: number;
};

export type RunTrigger = "full" | "upTo" | "fromHere" | "single";
export type RunStatus = "running" | "passed" | "failed" | "stopped";

export type RunCounts = {
  passed: number;
  failed: number;
  skipped: number;
  aborted: number;
};

export type RunSummary = {
  id: string;
  chainId: string;
  startedAt: number;
  finishedAt?: number;
  status: RunStatus;
  trigger: RunTrigger;
  counts: RunCounts;
  /** Serialized size in bytes at write time, used by byte-budget pruning. */
  bytes: number;
  schemaVersion: typeof RUN_SUMMARY_SCHEMA_VERSION;
  steps: RunStep[];
  /** Set when `capRun` has dropped oldest steps to fit `MAX_RUN_BYTES`. */
  stepsTruncated?: number;
};

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Caps a response body at `MAX_BODY_BYTES`, flagging truncation. Byte-safe for UTF-8. */
export function truncateBody(body: string): {
  body: string;
  truncated: boolean;
} {
  const encoded = new TextEncoder().encode(body);
  if (encoded.length <= MAX_BODY_BYTES) return { body, truncated: false };
  const capped = encoded.slice(0, MAX_BODY_BYTES);
  return { body: new TextDecoder().decode(capped), truncated: true };
}

function measureRunBytes(run: Omit<RunSummary, "bytes">): number {
  return byteLength(JSON.stringify(run));
}

/** Drops the run's oldest steps until it fits `MAX_RUN_BYTES`, recording `stepsTruncated` and `bytes`. */
export function capRun(run: RunSummary): RunSummary {
  const steps = [...run.steps];
  let stepsTruncated = 0;
  let bytes = measureRunBytes({ ...run, steps });

  while (bytes > MAX_RUN_BYTES && steps.length > 0) {
    steps.shift();
    stepsTruncated += 1;
    bytes = measureRunBytes({ ...run, steps });
  }

  return {
    ...run,
    steps,
    bytes,
    ...(stepsTruncated > 0 ? { stepsTruncated } : {}),
  };
}

/** Drops oldest-by-`startedAt` runs until both `MAX_RUNS_PER_CHAIN` and `MAX_CHAIN_HISTORY_BYTES` hold. */
export function pruneRuns(runs: RunSummary[]): RunSummary[] {
  const sorted = [...runs].sort((a, b) => a.startedAt - b.startedAt);

  while (sorted.length > MAX_RUNS_PER_CHAIN) {
    sorted.shift();
  }

  let totalBytes = sorted.reduce((sum, run) => sum + run.bytes, 0);
  while (totalBytes > MAX_CHAIN_HISTORY_BYTES && sorted.length > 0) {
    const removed = sorted.shift();
    if (removed) totalBytes -= removed.bytes;
  }

  return sorted;
}
