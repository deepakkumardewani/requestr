import type { ChainEdge, ChainRunState, MergeBlock } from "@/types/chain";
import {
  CHAIN_ERROR_CODE,
  type ChainErrorInfo,
  chainError,
} from "./errorCodes";
import { shouldSkipMergeForEdges } from "./executors/merge";
import {
  anyMergesFedBy,
  buildDependencyGraph,
  feedsOnly,
  predecessorsOf,
} from "./schedulerGraph";
import { createLaneRegistry, type NodeScope } from "./schedulerLanes";
import { type DrainOptions, drainQueue } from "./schedulerQueue";
import type { OnUpdateFn } from "./types";
import { isEdgeActive } from "./utils";

/** Nested runs (loop iterations, sub-chains) execute their nodes one at a time. */
export const SEQUENTIAL_CONCURRENCY = 1;

type SchedulerDeps = {
  /** Node ids the scheduler dispatches, in tie-break order (Start first). */
  ids: string[];
  edges: ChainEdge[];
  mergeNodes: MergeBlock[];
  runState: ChainRunState;
  onUpdate: OnUpdateFn;
};

export type { NodeScope };

export type Scheduler = {
  shouldSkipNode: (nodeId: string, incomingEdges: ChainEdge[]) => boolean;
  /** Records `nodeId` as skipped (notifying `onUpdate`) without dispatching it. */
  markSkipped: (nodeId: string, failure: ChainErrorInfo) => void;
  /** Decrements downstream in-degrees and enqueues newly-ready nodes. */
  advance: (nodeId: string) => void;
  /** Fires any "any"-mode Merge fed by a live lane from `nodeId`; call once `nodeId` has settled. */
  fireMergesFedBy: (nodeId: string) => void;
  /**
   * Scope for one dispatched node. Its signal follows `runSignal` and is also
   * aborted if an "any" Merge resolves while the node is still in flight.
   */
  openNodeScope: (
    nodeId: string,
    runSignal: AbortSignal,
    onUpdate: OnUpdateFn,
  ) => NodeScope;
  /**
   * Closes a dispatched node's scope. Returns true when an "any" Merge cut the
   * lane mid-flight, in which case the node has just been recorded `skipped`
   * (spec: remaining lanes are skipped) whatever its executor wrote.
   */
  settleNode: (nodeId: string) => boolean;
  drain: (
    processNode: (nodeId: string) => Promise<void>,
    options: DrainOptions,
  ) => Promise<void>;
};

/**
 * Ready-queue scheduler (Kahn's algorithm): nodes enter the queue once every
 * dependency has been processed. Up to `concurrency` nodes run in parallel;
 * FIFO dequeue means concurrency = 1 reduces to a strictly sequential walk.
 */
export function createScheduler(deps: SchedulerDeps): Scheduler {
  const { ids, edges, mergeNodes, runState, onUpdate } = deps;
  const { inDegree, adjacency } = buildDependencyGraph(ids, edges);
  const readyQueue: string[] = ids.filter(
    (id) => (inDegree.get(id) ?? 0) === 0,
  );
  const inFlight = new Map<string, Promise<void>>();
  const mergeNodeMap = new Map(mergeNodes.map((m) => [m.id, m]));
  const lanes = createLaneRegistry();

  // Merge nodes that have already resolved — normally or early (an "any" mode
  // Merge firing on its first passed branch). Guards against double-dispatch:
  // a Merge can still be pushed onto the ready queue later by an in-flight
  // sibling branch finishing after the early fire, and must be a no-op then.
  const firedMerges = new Set<string>();

  const advance = (nodeId: string): void => {
    for (const neighbour of adjacency.get(nodeId) ?? []) {
      const deg = (inDegree.get(neighbour) ?? 0) - 1;
      inDegree.set(neighbour, deg);
      if (deg === 0 && runState[neighbour] === undefined) {
        readyQueue.push(neighbour);
      }
    }
  };

  const removeFromQueue = (nodeId: string): void => {
    const idx = readyQueue.indexOf(nodeId);
    if (idx !== -1) readyQueue.splice(idx, 1);
  };

  const markSkipped = (nodeId: string, failure: ChainErrorInfo): void => {
    onUpdate(nodeId, "skipped", failure);
    runState[nodeId] = {
      state: "skipped",
      extractedValues: {},
      error: failure.error,
    };
  };

  /**
   * True when `nodeId`'s upstream state (ordinary skip-propagation, or
   * Merge-specific fan-in rules) means it must be skipped rather than run.
   * Every incoming edge's source has already written its final `runState`
   * entry because in-degree only reaches 0 after all predecessors finish.
   */
  const shouldSkipNode: Scheduler["shouldSkipNode"] = (
    nodeId,
    incomingEdges,
  ) => {
    const mergeBlock = mergeNodeMap.get(nodeId);
    if (mergeBlock) {
      return shouldSkipMergeForEdges(mergeBlock.mode, incomingEdges, runState);
    }
    return incomingEdges.some(
      (e) => !isEdgeActive(e, runState[e.sourceRequestId]),
    );
  };

  const settleNode: Scheduler["settleNode"] = (nodeId) => {
    if (!lanes.close(nodeId)) return false;
    markSkipped(nodeId, chainError(CHAIN_ERROR_CODE.MERGE_ALREADY_RESOLVED));
    return true;
  };

  /** Skips a lane that has not started, or aborts one that is in flight. */
  const cutLane = (nodeId: string, mergeId: string): void => {
    if (runState[nodeId] !== undefined || !feedsOnly(edges, nodeId, mergeId))
      return;
    if (inFlight.has(nodeId)) {
      lanes.cut(nodeId);
      return;
    }
    markSkipped(nodeId, chainError(CHAIN_ERROR_CODE.MERGE_ALREADY_RESOLVED));
    removeFromQueue(nodeId);
    advance(nodeId);
  };

  /**
   * "any" mode Merge semantics: fire as soon as the first incoming branch
   * passes. Every other lane that feeds only this Merge is skipped: one that
   * has not started is short-circuited, one in flight is aborted and recorded
   * `skipped`. A predecessor that also feeds other nodes is left to run for
   * those consumers.
   */
  const fireMergeEarly = (mergeId: string): void => {
    if (firedMerges.has(mergeId) || runState[mergeId] !== undefined) return;
    firedMerges.add(mergeId);

    onUpdate(mergeId, "running", {});
    runState[mergeId] = { state: "passed", extractedValues: {} };
    onUpdate(mergeId, "passed", { extractedValues: {} });

    for (const p of predecessorsOf(edges, mergeId)) cutLane(p, mergeId);

    removeFromQueue(mergeId);
    advance(mergeId);
  };

  const fireMergesFedBy: Scheduler["fireMergesFedBy"] = (nodeId) => {
    const fed = anyMergesFedBy(nodeId, {
      mergeNodes,
      edges,
      runState,
      firedMerges,
    });
    for (const mergeId of fed) fireMergeEarly(mergeId);
  };

  const drain: Scheduler["drain"] = (processNode, options) =>
    drainQueue({ readyQueue, inFlight, runState }, processNode, options);

  return {
    shouldSkipNode,
    markSkipped,
    advance,
    fireMergesFedBy,
    openNodeScope: lanes.open,
    settleNode,
    drain,
  };
}
