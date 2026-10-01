import { DEFAULT_CHAIN_CONCURRENCY } from "@/lib/chainConstants";
import type { RequestModel } from "@/types";
import type {
  ChainEdge,
  ChainNodeType,
  ChainRunState,
  CollectBlock,
} from "@/types/chain";
import {
  CHAIN_ERROR_CODE,
  type ChainErrorInfo,
  chainError,
} from "./chainRunner/errorCodes";
import { getExecutor } from "./chainRunner/executors";
import {
  collectByLoopId,
  type LoopBodyGraph,
  loopExecutor,
} from "./chainRunner/executors/loop";
import { subchainExecutor } from "./chainRunner/executors/subchain";
import {
  collectLoopBodyNodeIds,
  findLoopBodyTerminalIds,
  withImplicitLoopCollectEdges,
} from "./chainRunner/loopBody";
import { blockGroups, controlFlowNodeIds } from "./chainRunner/runGraph";
import {
  createScheduler,
  type NodeScope,
  type Scheduler,
} from "./chainRunner/scheduler";
import {
  ERROR_KIND,
  type ExecutionContext,
  MAX_SCHEDULER_DEPTH,
  type RunChainOptions,
  type RunOptions,
} from "./chainRunner/types";
import { findCyclicNodeIds, InjectionError } from "./chainRunner/utils";

export { InjectionError };

export { DEFAULT_CHAIN_CONCURRENCY as DEFAULT_CONCURRENCY };

export { MAX_SCHEDULER_DEPTH };

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
    // Kahn leaves nodes downstream of a cycle unordered too; report only true cycle members.
    throw new CircularDependencyError(findCyclicNodeIds(ids, edges));
  }

  return order;
}

/** Builds the `LoopBodyGraph` a Loop's executor runs once per item, sliced out of the full chain. */
function buildLoopBodyGraph(
  loopId: string,
  collectId: string,
  opts: RunChainOptions,
): LoopBodyGraph {
  const bodyIds = collectLoopBodyNodeIds(loopId, collectId, opts.edges);
  const has = (id: string) => bodyIds.has(id);
  const inBody = <T extends { id: string }>(nodes: T[] = []) =>
    nodes.filter((n) => has(n.id));

  return {
    terminalNodeIds: findLoopBodyTerminalIds(bodyIds, collectId, opts.edges),
    requests: opts.requests.filter((r) => has(r.id)),
    edges: opts.edges.filter(
      (e) => has(e.sourceRequestId) && has(e.targetRequestId),
    ),
    nodeAssertions: opts.nodeAssertions
      ? Object.fromEntries(
          Object.entries(opts.nodeAssertions).filter(([id]) => has(id)),
        )
      : undefined,
    delayNodes: inBody(opts.delayNodes),
    conditionNodes: inBody(opts.conditionNodes),
    displayNodes: inBody(opts.displayNodes),
    evaluateNodes: inBody(opts.evaluateNodes),
    validateNodes: inBody(opts.validateNodes),
    mergeNodes: inBody(opts.mergeNodes),
    loopNodes: inBody(opts.loopNodes),
    collectNodes: inBody(opts.collectNodes),
    subChainBlocks: inBody(opts.subChainBlocks),
  };
}

function collectControlFlowIds(opts: RunChainOptions): string[] {
  return [
    ...controlFlowNodeIds(opts),
    ...(opts.startBlock ? [opts.startBlock.id] : []),
  ];
}

/** Maps every non-API node id to its block type; ids absent from the map are API requests. */
function buildBlockTypeById(opts: RunChainOptions): Map<string, ChainNodeType> {
  const byId = new Map<string, ChainNodeType>();
  if (opts.startBlock) byId.set(opts.startBlock.id, "start");
  for (const [type, nodes] of blockGroups(opts)) {
    for (const node of nodes) {
      if (!byId.has(node.id)) byId.set(node.id, type);
    }
  }
  return byId;
}

function toIdMap<T extends { id: string }>(nodes: T[] = []): Map<string, T> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * Cycle detection is validated up front. On a cycle, the nodes in it are
 * reported `failed` (so the run is recorded as failed, not passed) and the
 * run is abandoned. Returns true when the graph is acyclic and safe to schedule.
 */
function isRunnableGraph(
  opts: RunChainOptions,
  controlFlowIds: string[],
): boolean {
  try {
    buildExecutionOrder(opts.requests, opts.edges, controlFlowIds);
    return true;
  } catch (err) {
    if (!(err instanceof CircularDependencyError)) throw err;
    for (const id of err.nodeIds) {
      opts.onUpdate(id, "failed", {
        ...chainError(CHAIN_ERROR_CODE.CIRCULAR_DEPENDENCY),
        errorKind: ERROR_KIND.GENERIC,
      });
    }
    return false;
  }
}

/**
 * Ids the top-level scheduler dispatches. Nodes inside a Loop's body subgraph
 * run once per iteration via the Loop's own nested `runChain` call — they must
 * never also be dispatched here, or they'd execute twice. The Start block is
 * placed first so Kahn's algorithm dequeues it ahead of same-in-degree
 * siblings: chain inputs must be populated before any other node resolves
 * variables (Start has no incoming edges).
 */
function buildScheduledIds(
  opts: RunChainOptions,
  controlFlowIds: string[],
): string[] {
  const loopBodyNodeIds = new Set<string>();
  for (const collectBlock of opts.collectNodes ?? []) {
    for (const id of collectLoopBodyNodeIds(
      collectBlock.loopId,
      collectBlock.id,
      opts.edges,
    )) {
      loopBodyNodeIds.add(id);
    }
  }
  const startId = opts.startBlock?.id;
  return [
    ...(startId ? [startId] : []),
    ...opts.requests.map((r) => r.id).filter((id) => !loopBodyNodeIds.has(id)),
    ...controlFlowIds.filter(
      (id) => id !== startId && !loopBodyNodeIds.has(id),
    ),
  ];
}

/** Everything `processNode` shares across nodes of one `runChain` invocation. */
type RunEnv = {
  opts: RunChainOptions;
  runState: ChainRunState;
  runOptions: RunOptions;
  scheduler: Scheduler;
  blockTypeById: Map<string, ChainNodeType>;
  requestMap: Map<string, RequestModel>;
  delayNodeMap: ExecutionContext["delayNodeMap"];
  conditionNodeMap: ExecutionContext["conditionNodeMap"];
  displayNodeMap: ExecutionContext["displayNodeMap"];
  evaluateNodeMap: NonNullable<ExecutionContext["evaluateNodeMap"]>;
  validateNodeMap: NonNullable<ExecutionContext["validateNodeMap"]>;
  loopNodeMap: Map<string, NonNullable<RunChainOptions["loopNodes"]>[number]>;
  collectNodes: CollectBlock[];
  subChainNodeMap: Map<
    string,
    NonNullable<RunChainOptions["subChainBlocks"]>[number]
  >;
};

function findPairedCollect(env: RunEnv, loopId: string) {
  return collectByLoopId(env.collectNodes, loopId);
}

/** `failure` is typed for runner-raised failures; a thrown exception's message is data and carries no code. */
function failNode(
  env: RunEnv,
  nodeId: string,
  failure: Pick<ChainErrorInfo, "error"> & Partial<ChainErrorInfo>,
): void {
  env.runState[nodeId] = {
    state: "failed",
    extractedValues: {},
    error: failure.error,
  };
  env.opts.onUpdate(nodeId, "failed", {
    ...failure,
    errorKind: ERROR_KIND.GENERIC,
  });
}

/** Skips `nodeId`; a skipped Loop also skips its paired Collect so downstream nodes don't wait on it. */
function skipNode(env: RunEnv, nodeId: string, blockType: ChainNodeType): void {
  env.scheduler.markSkipped(
    nodeId,
    chainError(CHAIN_ERROR_CODE.UPSTREAM_SKIPPED),
  );
  if (blockType !== "loop") return;
  const collectBlock = findPairedCollect(env, nodeId);
  if (!collectBlock) return;
  env.scheduler.markSkipped(
    collectBlock.id,
    chainError(CHAIN_ERROR_CODE.UPSTREAM_SKIPPED),
  );
  env.scheduler.advance(collectBlock.id);
}

async function runLoopNode(
  env: RunEnv,
  nodeId: string,
  incomingEdges: ChainEdge[],
): Promise<void> {
  const loopBlock = env.loopNodeMap.get(nodeId);
  const collectBlock = findPairedCollect(env, nodeId);
  if (!loopBlock || !collectBlock) {
    failNode(env, nodeId, chainError(CHAIN_ERROR_CODE.LOOP_NO_PAIRED_COLLECT));
    return;
  }
  const body = buildLoopBodyGraph(nodeId, collectBlock.id, env.opts);
  if (body.terminalNodeIds?.length === 0) {
    failNode(env, nodeId, chainError(CHAIN_ERROR_CODE.LOOP_BODY_UNCONNECTED));
    return;
  }
  await loopExecutor({
    nodeId,
    loopBlock,
    collectBlock,
    body,
    incomingEdges,
    runState: env.runState,
    onUpdate: env.opts.onUpdate,
    options: env.runOptions,
    runChain,
    schedulerDepth: env.opts.schedulerDepth ?? 0,
    loopDepth: env.opts.loopDepth ?? 0,
    resolveSubChainGraph: env.opts.resolveSubChainGraph,
  });
  // The Collect's state was written directly by `loopExecutor`, not via the
  // normal dispatch path, so its downstream neighbours must be advanced here.
  env.scheduler.advance(collectBlock.id);
}

async function runSubChainNode(
  env: RunEnv,
  nodeId: string,
  incomingEdges: ChainEdge[],
): Promise<void> {
  const subChainBlock = env.subChainNodeMap.get(nodeId);
  const referencedGraph = subChainBlock
    ? env.opts.resolveSubChainGraph?.(subChainBlock.chainId)
    : undefined;
  if (!subChainBlock || !referencedGraph) {
    failNode(
      env,
      nodeId,
      chainError(CHAIN_ERROR_CODE.SUBCHAIN_REFERENCE_UNRESOLVED),
    );
    return;
  }
  await subchainExecutor({
    nodeId,
    subChainBlock,
    chain: referencedGraph,
    incomingEdges,
    runState: env.runState,
    onUpdate: env.opts.onUpdate,
    options: env.runOptions,
    runChain,
    schedulerDepth: env.opts.schedulerDepth ?? 0,
    resolveSubChainGraph: env.opts.resolveSubChainGraph,
  });
}

// Deliberately not `async`: returning the executor's promise directly adds no
// microtask hops, which the concurrency ordering specs (Merge "any") depend on.
function runRegularNode(
  env: RunEnv,
  nodeId: string,
  blockType: ChainNodeType,
  incomingEdges: ChainEdge[],
): Promise<unknown> {
  const context: ExecutionContext = {
    nodeId,
    request: env.requestMap.get(nodeId),
    incomingEdges,
    runState: env.runState,
    requestMap: env.requestMap,
    displayNodeMap: env.displayNodeMap,
    delayNodeMap: env.delayNodeMap,
    conditionNodeMap: env.conditionNodeMap,
    evaluateNodeMap: env.evaluateNodeMap,
    validateNodeMap: env.validateNodeMap,
    startBlock: env.opts.startBlock,
    onUpdate: env.opts.onUpdate,
    options: env.runOptions,
  };
  return getExecutor(blockType)(context);
}

function dispatchNode(
  env: RunEnv,
  nodeId: string,
  blockType: ChainNodeType,
  incomingEdges: ChainEdge[],
): Promise<unknown> {
  if (blockType === "loop") return runLoopNode(env, nodeId, incomingEdges);
  if (blockType === "subchain") {
    return runSubChainNode(env, nodeId, incomingEdges);
  }
  return runRegularNode(env, nodeId, blockType, incomingEdges);
}

/**
 * `env` whose executors run under `scope`, so an "any" Merge can cut this
 * node's lane. Executors write run-wide state (e.g. Start's `chainInputs`)
 * back onto `RunOptions`, so the options are proxied, not copied: only reads
 * of `signal` are redirected and every write still lands on the shared object.
 */
function scopedEnv(env: RunEnv, scope: NodeScope): RunEnv {
  const runOptions = new Proxy(env.runOptions, {
    get: (target, key) =>
      key === "signal" ? scope.signal : Reflect.get(target, key),
  });
  return {
    ...env,
    opts: { ...env.opts, onUpdate: scope.onUpdate },
    runOptions,
  };
}

/**
 * An unexpected executor throw fails only its own node. Letting it reject
 * would abort the scheduler's `Promise.race` while sibling nodes are still in
 * flight, orphaning them and leaving the run recorded as passed.
 */
async function dispatchGuarded(
  env: RunEnv,
  nodeId: string,
  blockType: ChainNodeType,
  incomingEdges: ChainEdge[],
): Promise<void> {
  const { scheduler, opts } = env;
  const nodeEnv = scopedEnv(
    env,
    scheduler.openNodeScope(nodeId, opts.signal, opts.onUpdate),
  );
  try {
    await dispatchNode(nodeEnv, nodeId, blockType, incomingEdges);
  } catch (err) {
    console.error(`Node ${nodeId} (${blockType}) threw during execution`, err);
    failNode(nodeEnv, nodeId, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function processNode(env: RunEnv, nodeId: string): Promise<void> {
  const { runState, scheduler, opts } = env;
  const incomingEdges = opts.edges.filter((e) => e.targetRequestId === nodeId);
  const blockType = env.blockTypeById.get(nodeId) ?? "api";

  if (blockType === "collect") {
    // A Collect's runState is written directly by its paired Loop's executor,
    // never dispatched on its own. It only reaches the queue unwritten when
    // that Loop threw or the pairing is invalid (validation should have
    // blocked it) — skip it so downstream nodes are not left waiting.
    if (runState[nodeId] === undefined) {
      scheduler.markSkipped(
        nodeId,
        chainError(CHAIN_ERROR_CODE.COLLECT_NO_LOOP_RESULT),
      );
    }
    scheduler.advance(nodeId);
    return;
  }

  if (scheduler.shouldSkipNode(nodeId, incomingEdges)) {
    skipNode(env, nodeId, blockType);
  } else {
    await dispatchGuarded(env, nodeId, blockType, incomingEdges);
    // A lane cut by an "any" Merge ends skipped and must not fire anything.
    if (scheduler.settleNode(nodeId)) {
      scheduler.advance(nodeId);
      return;
    }
  }

  // Lane liveness (not just "passed") decides early fire, e.g. a fail handle.
  scheduler.fireMergesFedBy(nodeId);
  scheduler.advance(nodeId);
}

function buildRunEnv(
  opts: RunChainOptions,
  ids: string[],
  blockTypeById: Map<string, ChainNodeType>,
): RunEnv {
  const runState: ChainRunState = {};
  const runOptions: RunOptions = {
    signal: opts.signal,
    nodeAssertions: opts.nodeAssertions,
    delayNodes: opts.delayNodes,
    conditionNodes: opts.conditionNodes,
    envPromotions: opts.envPromotions,
    onPromoteToEnv: opts.onPromoteToEnv,
    displayNodes: opts.displayNodes,
    resolveVariables: opts.resolveVariables,
    startOverrides: opts.startOverrides,
    chainInputs: {},
    envVars: opts.envVars,
    aliasValues: {},
  };
  return {
    opts,
    runState,
    runOptions,
    blockTypeById,
    scheduler: createScheduler({
      ids,
      edges: withImplicitLoopCollectEdges(opts.edges, opts.collectNodes ?? []),
      mergeNodes: opts.mergeNodes ?? [],
      runState,
      onUpdate: opts.onUpdate,
    }),
    requestMap: toIdMap(opts.requests),
    delayNodeMap: toIdMap(opts.delayNodes),
    conditionNodeMap: toIdMap(opts.conditionNodes),
    displayNodeMap: toIdMap(opts.displayNodes),
    evaluateNodeMap: toIdMap(opts.evaluateNodes),
    validateNodeMap: toIdMap(opts.validateNodes),
    loopNodeMap: toIdMap(opts.loopNodes),
    collectNodes: opts.collectNodes ?? [],
    subChainNodeMap: toIdMap(opts.subChainBlocks),
  };
}

/**
 * Run a full request chain in dependency order, calling `onUpdate` for each
 * step. Every block type is handled alongside API request nodes.
 */
export async function runChain(opts: RunChainOptions): Promise<void> {
  const { signal, onUpdate, concurrency = DEFAULT_CHAIN_CONCURRENCY } = opts;
  if ((opts.schedulerDepth ?? 0) > MAX_SCHEDULER_DEPTH) {
    throw new SchedulerDepthExceededError();
  }

  const controlFlowIds = collectControlFlowIds(opts);
  if (!isRunnableGraph(opts, controlFlowIds)) return;

  const ids = buildScheduledIds(opts, controlFlowIds);
  const env = buildRunEnv(opts, ids, buildBlockTypeById(opts));
  await env.scheduler.drain((nodeId) => processNode(env, nodeId), {
    signal,
    concurrency,
  });

  if (!signal.aborted) return;
  for (const id of ids) {
    if (env.runState[id]) continue;
    const stopped = chainError(CHAIN_ERROR_CODE.RUN_STOPPED);
    onUpdate(id, "skipped", stopped);
    env.runState[id] = {
      state: "skipped",
      extractedValues: {},
      error: stopped.error,
    };
  }
}
