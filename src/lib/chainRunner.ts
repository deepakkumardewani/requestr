import { LOOP_BODY_HANDLE_ID } from "@/components/chain/nodes/LoopNode";
import type { RequestModel } from "@/types";
import type {
  ChainAssertion,
  ChainEdge,
  ChainRunState,
  CollectBlock,
  ConditionNodeConfig,
  DelayNodeConfig,
  DisplayBlock,
  EnvPromotion,
  EvaluateBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import { getExecutor } from "./chainRunner/executors";
import { type LoopBodyGraph, loopExecutor } from "./chainRunner/executors/loop";
import { shouldSkipMerge } from "./chainRunner/executors/merge";
import {
  type ReferencedChainGraph,
  subchainExecutor,
} from "./chainRunner/executors/subchain";
import type {
  ExecutionContext,
  OnUpdateFn,
  RunOptions,
} from "./chainRunner/types";
import { InjectionError } from "./chainRunner/utils";

export { InjectionError };

/** Default number of nodes the scheduler dispatches concurrently when `concurrency` is omitted. */
export const DEFAULT_CONCURRENCY = 4;

/**
 * Upper bound on nested scheduler invocations (e.g. a chain-of-chains style
 * embed) to prevent runaway recursion. `runChain` itself never recurses
 * today, but every caller that might wrap another `runChain` call must pass
 * an incremented `schedulerDepth` so this guard stays meaningful.
 */
export const MAX_SCHEDULER_DEPTH = 8;

export class SchedulerDepthExceededError extends Error {
  constructor() {
    super(
      `Scheduler depth exceeded MAX_SCHEDULER_DEPTH (${MAX_SCHEDULER_DEPTH})`,
    );
    this.name = "SchedulerDepthExceededError";
  }
}

export class CircularDependencyError extends Error {
  readonly nodeIds: string[];

  constructor(nodeIds: string[] = []) {
    super("Circular dependency detected in chain");
    this.name = "CircularDependencyError";
    this.nodeIds = nodeIds;
  }
}

/**
 * Topological sort (Kahn's algorithm) returning an ordered array of node IDs.
 * `extraNodeIds` adds delay/condition node IDs into the topology alongside API requests.
 * Throws CircularDependencyError if a cycle is detected.
 */
export function buildExecutionOrder(
  requests: RequestModel[],
  edges: ChainEdge[],
  extraNodeIds: string[] = [],
): string[] {
  const ids = [...requests.map((r) => r.id), ...extraNodeIds];
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of ids) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    const src = edge.sourceRequestId;
    const tgt = edge.targetRequestId;
    if (!inDegree.has(src) || !inDegree.has(tgt)) continue;
    inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1);
    adjacency.get(src)?.push(tgt);
  }

  const queue = ids.filter((id) => (inDegree.get(id) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    order.push(node);
    for (const neighbour of adjacency.get(node) ?? []) {
      const deg = (inDegree.get(neighbour) ?? 0) - 1;
      inDegree.set(neighbour, deg);
      if (deg === 0) queue.push(neighbour);
    }
  }

  if (order.length !== ids.length) {
    // Collect the node IDs that are part of the cycle (not in the order)
    const cycleNodeIds = ids.filter((id) => !order.includes(id));
    throw new CircularDependencyError(cycleNodeIds);
  }

  return order;
}

/**
 * Every node reachable from a Loop's `body` handle, stopping at (and
 * excluding) its paired Collect — the boundary of the loop body subgraph.
 */
function collectLoopBodyNodeIds(
  loopId: string,
  collectId: string,
  edges: ChainEdge[],
): Set<string> {
  const visited = new Set<string>();
  const queue = edges
    .filter(
      (e) => e.sourceRequestId === loopId && e.branchId === LOOP_BODY_HANDLE_ID,
    )
    .map((e) => e.targetRequestId);

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || id === collectId || visited.has(id)) continue;
    visited.add(id);
    for (const edge of edges) {
      if (edge.sourceRequestId === id && edge.targetRequestId !== collectId) {
        queue.push(edge.targetRequestId);
      }
    }
  }

  return visited;
}

/** Builds the `LoopBodyGraph` a Loop's executor runs once per item, sliced out of the full chain. */
function buildLoopBodyGraph(
  loopId: string,
  collectId: string,
  requests: RequestModel[],
  edges: ChainEdge[],
  nodeAssertions: Record<string, ChainAssertion[]> | undefined,
  delayNodes: DelayNodeConfig[],
  conditionNodes: ConditionNodeConfig[],
  displayNodes: DisplayBlock[],
  evaluateNodes: EvaluateBlock[],
  validateNodes: ValidateBlock[],
  mergeNodes: MergeBlock[],
): LoopBodyGraph {
  const bodyIds = collectLoopBodyNodeIds(loopId, collectId, edges);
  const has = (id: string) => bodyIds.has(id);

  return {
    requests: requests.filter((r) => has(r.id)),
    edges: edges.filter(
      (e) => has(e.sourceRequestId) && has(e.targetRequestId),
    ),
    nodeAssertions: nodeAssertions
      ? Object.fromEntries(
          Object.entries(nodeAssertions).filter(([id]) => has(id)),
        )
      : undefined,
    delayNodes: delayNodes.filter((n) => has(n.id)),
    conditionNodes: conditionNodes.filter((n) => has(n.id)),
    displayNodes: displayNodes.filter((n) => has(n.id)),
    evaluateNodes: evaluateNodes.filter((n) => has(n.id)),
    validateNodes: validateNodes.filter((n) => has(n.id)),
    mergeNodes: mergeNodes.filter((n) => has(n.id)),
  };
}

/**
 * Run a full request chain in dependency order, calling onUpdate for each step.
 * Delay and condition nodes are handled alongside API request nodes.
 */
export async function runChain(
  requests: RequestModel[],
  edges: ChainEdge[],
  onUpdate: OnUpdateFn,
  signal: AbortSignal,
  nodeAssertions?: Record<string, ChainAssertion[]>,
  delayNodes?: DelayNodeConfig[],
  conditionNodes?: ConditionNodeConfig[],
  envPromotions?: EnvPromotion[],
  onPromoteToEnv?: (envId: string, varName: string, value: string) => void,
  displayNodes?: DisplayBlock[],
  resolveVariables?: (text: string) => string,
  startBlock?: StartBlock,
  startOverrides?: Record<string, string>,
  evaluateNodes?: EvaluateBlock[],
  validateNodes?: ValidateBlock[],
  envVars?: Record<string, string>,
  mergeNodes?: MergeBlock[],
  concurrency: number = DEFAULT_CONCURRENCY,
  schedulerDepth = 0,
  loopNodes?: LoopBlock[],
  collectNodes?: CollectBlock[],
  subChainBlocks?: SubChainBlock[],
  /** Resolves a `SubChainBlock.chainId` into the referenced chain's execution graph. Undefined when the reference cannot be resolved (e.g. it was deleted) — the node fails rather than throwing. */
  resolveSubChainGraph?: (chainId: string) => ReferencedChainGraph | undefined,
): Promise<void> {
  if (schedulerDepth > MAX_SCHEDULER_DEPTH) {
    throw new SchedulerDepthExceededError();
  }

  const delayNodeMap = new Map<string, DelayNodeConfig>(
    (delayNodes ?? []).map((n) => [n.id, n]),
  );
  const conditionNodeMap = new Map<string, ConditionNodeConfig>(
    (conditionNodes ?? []).map((n) => [n.id, n]),
  );
  const displayNodeMap = new Map<string, DisplayBlock>(
    (displayNodes ?? []).map((n) => [n.id, n]),
  );
  const evaluateNodeMap = new Map<string, EvaluateBlock>(
    (evaluateNodes ?? []).map((n) => [n.id, n]),
  );
  const validateNodeMap = new Map<string, ValidateBlock>(
    (validateNodes ?? []).map((n) => [n.id, n]),
  );
  const mergeNodeMap = new Map<string, MergeBlock>(
    (mergeNodes ?? []).map((n) => [n.id, n]),
  );
  const loopNodeMap = new Map<string, LoopBlock>(
    (loopNodes ?? []).map((n) => [n.id, n]),
  );
  const collectNodeMap = new Map<string, CollectBlock>(
    (collectNodes ?? []).map((n) => [n.id, n]),
  );
  const subChainNodeMap = new Map<string, SubChainBlock>(
    (subChainBlocks ?? []).map((n) => [n.id, n]),
  );
  const controlFlowIds = [
    ...(delayNodes ?? []).map((n) => n.id),
    ...(conditionNodes ?? []).map((n) => n.id),
    ...(displayNodes ?? []).map((n) => n.id),
    ...(evaluateNodes ?? []).map((n) => n.id),
    ...(validateNodes ?? []).map((n) => n.id),
    ...(mergeNodes ?? []).map((n) => n.id),
    ...(loopNodes ?? []).map((n) => n.id),
    ...(collectNodes ?? []).map((n) => n.id),
    ...(subChainBlocks ?? []).map((n) => n.id),
    ...(startBlock ? [startBlock.id] : []),
  ];

  // Cycle detection — validated up front; the actual walk below is a
  // ready-queue scheduler (concurrency = 1) that reproduces the same
  // Kahn ordering incrementally so a future concurrency > 1 scheduler
  // (Phase 7) can reuse this structure without reworking dispatch.
  try {
    buildExecutionOrder(requests, edges, controlFlowIds);
  } catch (err) {
    if (err instanceof CircularDependencyError) {
      // Mark only the nodes in the cycle as skipped with a cycle error
      for (const id of err.nodeIds) {
        onUpdate(id, "skipped", { error: "Circular dependency detected" });
      }
      return;
    }
    throw err;
  }

  const requestMap = new Map<string, RequestModel>(
    requests.map((r) => [r.id, r]),
  );

  const runState: ChainRunState = {};

  const options: RunOptions = {
    signal,
    nodeAssertions,
    delayNodes,
    conditionNodes,
    envPromotions,
    onPromoteToEnv,
    displayNodes,
    resolveVariables,
    startOverrides,
    chainInputs: {},
    envVars,
    aliasValues: {},
  };

  const getBlockType = (nodeId: string): string => {
    if (startBlock?.id === nodeId) return "start";
    if (delayNodeMap.has(nodeId)) return "delay";
    if (conditionNodeMap.has(nodeId)) return "condition";
    if (displayNodeMap.has(nodeId)) return "display";
    if (evaluateNodeMap.has(nodeId)) return "evaluate";
    if (validateNodeMap.has(nodeId)) return "validate";
    if (mergeNodeMap.has(nodeId)) return "merge";
    if (loopNodeMap.has(nodeId)) return "loop";
    if (collectNodeMap.has(nodeId)) return "collect";
    if (subChainNodeMap.has(nodeId)) return "subchain";
    return "api";
  };

  // Ready-queue scheduler (Kahn's algorithm, concurrency = 1): nodes enter
  // the queue once every dependency has been processed, and are dispatched
  // one at a time to the executor registered for their block type.
  //
  // The Start block has no incoming edges (chain inputs are available to
  // every node, not just ones explicitly wired to Start) but must still
  // execute before any other node so `options.chainInputs` is populated
  // in time for variable resolution — it is placed first in `ids` so
  // Kahn's algorithm dequeues it ahead of same-in-degree siblings.
  // Nodes inside a Loop's body subgraph run once per iteration via the
  // Loop's own nested `runChain` call (below) — they must never also be
  // dispatched by this top-level scheduler, or they'd execute twice.
  const loopBodyNodeIds = new Set<string>();
  for (const collectBlock of collectNodes ?? []) {
    for (const id of collectLoopBodyNodeIds(
      collectBlock.loopId,
      collectBlock.id,
      edges,
    )) {
      loopBodyNodeIds.add(id);
    }
  }

  const ids = [
    ...(startBlock ? [startBlock.id] : []),
    ...requests.map((r) => r.id).filter((id) => !loopBodyNodeIds.has(id)),
    ...controlFlowIds.filter(
      (id) => id !== startBlock?.id && !loopBodyNodeIds.has(id),
    ),
  ];
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const id of ids) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }
  for (const edge of edges) {
    const src = edge.sourceRequestId;
    const tgt = edge.targetRequestId;
    if (!inDegree.has(src) || !inDegree.has(tgt)) continue;
    inDegree.set(tgt, (inDegree.get(tgt) ?? 0) + 1);
    adjacency.get(src)?.push(tgt);
  }

  const readyQueue: string[] = ids.filter(
    (id) => (inDegree.get(id) ?? 0) === 0,
  );

  /**
   * True when `nodeId`'s upstream state (ordinary skip-propagation, or
   * Merge-specific fan-in rules) means it must be skipped rather than run.
   * Every incoming edge's source is guaranteed to have finished already —
   * Kahn's algorithm only drops a node's in-degree to 0 once every
   * predecessor has written its final `runState` entry.
   */
  const shouldSkipNode = (
    nodeId: string,
    incomingEdges: ChainEdge[],
  ): boolean => {
    const mergeBlock = mergeNodeMap.get(nodeId);
    if (mergeBlock) {
      const upstreamStates = incomingEdges.map(
        (e) => runState[e.sourceRequestId],
      );
      return shouldSkipMerge(mergeBlock.mode, upstreamStates);
    }

    return incomingEdges.some((e) => {
      const srcState = runState[e.sourceRequestId];
      if (!srcState || srcState.state === "skipped") {
        return true;
      }

      // Success handle: only follow if source passed
      if (e.branchId === "success") {
        return srcState.state !== "passed";
      }

      // Fail handle: only follow if source failed (failed is the expected path here)
      if (e.branchId === "fail") {
        return srcState.state !== "failed";
      }

      // A failed source blocks non-conditional downstream nodes
      if (srcState.state === "failed") {
        return true;
      }

      // For routing edges from condition nodes: check winning branch
      if (e.branchId !== undefined && srcState.activeBranchId !== undefined) {
        return srcState.activeBranchId !== e.branchId;
      }
      return false;
    });
  };

  // Ready-queue scheduler: up to `concurrency` nodes run in parallel. FIFO
  // dequeue order means concurrency = 1 reduces to the original strictly
  // sequential walk (one node in flight at a time, next dispatch only after
  // it resolves), so existing byte-for-byte ordering assertions keep passing.
  const inFlight = new Map<string, Promise<void>>();

  // Merge nodes that have already resolved — either normally (via
  // `shouldSkipNode`/`mergeExecutor` once every incoming edge settled) or
  // early (an "any" mode Merge firing on its first passed branch, below).
  // Guards against double-dispatch: a Merge can still get pushed onto the
  // ready queue later by an in-flight sibling branch finishing after the
  // early fire, and must be a no-op at that point.
  const firedMerges = new Set<string>();

  /** Decrement `nodeId`'s downstream in-degree and enqueue newly-ready nodes. */
  const advance = (nodeId: string): void => {
    for (const neighbour of adjacency.get(nodeId) ?? []) {
      const deg = (inDegree.get(neighbour) ?? 0) - 1;
      inDegree.set(neighbour, deg);
      if (deg === 0 && runState[neighbour] === undefined) {
        readyQueue.push(neighbour);
      }
    }
  };

  /**
   * "any" mode Merge semantics (P7.4/spec): fire as soon as the first
   * incoming branch passes, rather than waiting for every branch to settle.
   * Any sibling lane that has not yet started (not in `runState`, not
   * dispatched) is short-circuited straight to `skipped` since its result
   * can no longer change the Merge's outcome. A lane that is already
   * in-flight is left to finish naturally (its work already started and
   * cannot be cancelled); when it completes it writes its own real result
   * and its downstream decrement is a no-op against the Merge, which is
   * already resolved.
   */
  const fireMergeEarly = (mergeId: string): void => {
    if (firedMerges.has(mergeId) || runState[mergeId] !== undefined) return;
    firedMerges.add(mergeId);

    onUpdate(mergeId, "running", {});
    runState[mergeId] = { state: "passed", extractedValues: {} };
    onUpdate(mergeId, "passed", { extractedValues: {} });

    const predecessors = edges
      .filter((e) => e.targetRequestId === mergeId)
      .map((e) => e.sourceRequestId);
    for (const p of predecessors) {
      if (runState[p] !== undefined || inFlight.has(p)) continue;
      const errMsg = "Merge already resolved on an earlier branch (any mode)";
      runState[p] = { state: "skipped", extractedValues: {}, error: errMsg };
      onUpdate(p, "skipped", { error: errMsg });
      const idx = readyQueue.indexOf(p);
      if (idx !== -1) readyQueue.splice(idx, 1);
      advance(p);
    }

    const mergeIdx = readyQueue.indexOf(mergeId);
    if (mergeIdx !== -1) readyQueue.splice(mergeIdx, 1);
    advance(mergeId);
  };

  const processNode = async (nodeId: string): Promise<void> => {
    const incomingEdges = edges.filter((e) => e.targetRequestId === nodeId);

    const blockType = getBlockType(nodeId);

    // A Collect node's runState is written directly by its paired Loop's
    // executor (below), never dispatched on its own — this only guards a
    // Collect reached with no runState yet, e.g. an invalid/unpaired graph
    // that validation (P8.5) should already have blocked.
    if (blockType === "collect" && runState[nodeId] === undefined) {
      const error = "Collect has no paired Loop result";
      runState[nodeId] = { state: "skipped", extractedValues: {}, error };
      onUpdate(nodeId, "skipped", { error });
      advance(nodeId);
      return;
    }
    if (blockType === "collect") {
      advance(nodeId);
      return;
    }

    if (shouldSkipNode(nodeId, incomingEdges)) {
      const errMsg = "Dependency failed or skipped upstream";
      onUpdate(nodeId, "skipped", { error: errMsg });
      runState[nodeId] = {
        state: "skipped",
        extractedValues: {},
        error: errMsg,
      };
      if (blockType === "loop") {
        const collectBlock = [...collectNodeMap.values()].find(
          (c) => c.loopId === nodeId,
        );
        if (collectBlock) {
          runState[collectBlock.id] = {
            state: "skipped",
            extractedValues: {},
            error: errMsg,
          };
          onUpdate(collectBlock.id, "skipped", { error: errMsg });
          advance(collectBlock.id);
        }
      }
    } else if (blockType === "loop") {
      const loopBlock = loopNodeMap.get(nodeId);
      const collectBlock = [...collectNodeMap.values()].find(
        (c) => c.loopId === nodeId,
      );
      if (!loopBlock || !collectBlock) {
        const error = "Loop has no paired Collect";
        runState[nodeId] = { state: "failed", extractedValues: {}, error };
        onUpdate(nodeId, "failed", { error, errorKind: "generic" });
      } else {
        const body = buildLoopBodyGraph(
          nodeId,
          collectBlock.id,
          requests,
          edges,
          nodeAssertions,
          delayNodes ?? [],
          conditionNodes ?? [],
          displayNodes ?? [],
          evaluateNodes ?? [],
          validateNodes ?? [],
          mergeNodes ?? [],
        );
        await loopExecutor({
          nodeId,
          loopBlock,
          collectBlock,
          body,
          incomingEdges,
          runState,
          onUpdate,
          options,
          schedulerDepth,
        });
        // The Collect's state was written directly by `loopExecutor` above,
        // not via the normal dispatch path, so its own downstream neighbours
        // must be advanced explicitly here.
        advance(collectBlock.id);
      }
    } else if (blockType === "subchain") {
      const subChainBlock = subChainNodeMap.get(nodeId);
      const referencedGraph = subChainBlock
        ? resolveSubChainGraph?.(subChainBlock.chainId)
        : undefined;
      if (!subChainBlock || !referencedGraph) {
        const error = "Sub-chain reference could not be resolved";
        runState[nodeId] = { state: "failed", extractedValues: {}, error };
        onUpdate(nodeId, "failed", { error, errorKind: "generic" });
      } else {
        await subchainExecutor({
          nodeId,
          subChainBlock,
          chain: referencedGraph,
          incomingEdges,
          runState,
          onUpdate,
          options,
          schedulerDepth,
        });
      }
    } else {
      const context: ExecutionContext = {
        nodeId,
        request: requestMap.get(nodeId),
        incomingEdges,
        runState,
        requestMap,
        displayNodeMap,
        delayNodeMap,
        conditionNodeMap,
        evaluateNodeMap,
        validateNodeMap,
        startBlock,
        onUpdate,
        options,
      };

      const executor = getExecutor(blockType);
      await executor(context);
    }

    if (runState[nodeId]?.state === "passed") {
      for (const merge of mergeNodes ?? []) {
        if (merge.mode !== "any" || firedMerges.has(merge.id)) continue;
        const feedsThisMerge = edges.some(
          (e) => e.targetRequestId === merge.id && e.sourceRequestId === nodeId,
        );
        if (feedsThisMerge) fireMergeEarly(merge.id);
      }
    }

    advance(nodeId);
  };

  while (readyQueue.length > 0 || inFlight.size > 0) {
    if (!signal.aborted) {
      while (readyQueue.length > 0 && inFlight.size < concurrency) {
        const nodeId = readyQueue.shift();
        if (nodeId === undefined) break;
        if (runState[nodeId] !== undefined) continue;
        const promise = processNode(nodeId).finally(() => {
          inFlight.delete(nodeId);
        });
        inFlight.set(nodeId, promise);
      }
    }

    if (inFlight.size === 0) break;
    await Promise.race(inFlight.values());
  }

  if (signal.aborted) {
    for (const id of ids) {
      if (!runState[id]) {
        onUpdate(id, "skipped", { error: "Run stopped" });
        runState[id] = { state: "skipped", extractedValues: {} };
      }
    }
  }
}
