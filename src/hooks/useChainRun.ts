import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  type RunStatus,
  type RunStep,
  type RunSummary,
  type RunTrigger,
  type SerialisedRequest,
  type SerialisedResponse,
  truncateBody,
} from "@/lib/chainRunHistory";
import {
  buildExecutionOrder,
  CircularDependencyError,
  runChain,
} from "@/lib/chainRunner";
import type { ReferencedChainGraph } from "@/lib/chainRunner/executors/subchain";
import { sliceChain } from "@/lib/chainSlice";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { RequestModel, ResponseData } from "@/types";
import type {
  AssertionResult,
  ChainAssertion,
  ChainBlock,
  ChainEdge,
  ChainNodeState,
  ChainNodeType,
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

/** Narrows `blocks` to those matching `type`, mirroring `page.tsx`'s local helper of the same shape. */
function blocksOfType<T extends ChainBlock>(
  blocks: ChainBlock[],
  type: T["type"],
): T[] {
  return blocks.filter((b) => b.type === type) as T[];
}

function notifyExecutionOrderFailure(err: unknown): void {
  console.error("buildExecutionOrder failed", err);
  const message =
    err instanceof CircularDependencyError
      ? "This chain has a circular dependency. Remove the cycle to run."
      : "Could not determine run order for this chain.";
  toast.error(message);
}

type NodeUpdateData = {
  extractedValues?: Record<string, string | null>;
  response?: ResponseData;
  error?: string;
  assertionResults?: AssertionResult[];
  activeBranchId?: string;
  unresolvedVars?: string[];
  /** Set on loop-body iteration updates: the Loop step id this sub-step nests under. */
  parentStepId?: string;
  /** Set on loop-body iteration updates: the zero-based iteration index. */
  iteration?: number;
};

/** Stable per-iteration step key — loop-body nodes re-run their nodeId every
 * iteration, so `nodeId` alone would collide across iterations. */
function stepKey(nodeId: string, data: NodeUpdateData): string {
  return data.parentStepId !== undefined && data.iteration !== undefined
    ? `${nodeId}::${data.parentStepId}::${data.iteration}`
    : nodeId;
}

type NodeMeta = { nodeType: ChainNodeType; label: string };

function resolveNodeMeta(
  nodeId: string,
  requests: RequestModel[],
  delayNodes: DelayNodeConfig[],
  conditionNodes: ConditionNodeConfig[],
  displayNodes: DisplayBlock[],
  startBlock?: StartBlock,
  evaluateNodes: EvaluateBlock[] = [],
  validateNodes: ValidateBlock[] = [],
  mergeNodes: MergeBlock[] = [],
  loopNodes: LoopBlock[] = [],
  collectNodes: CollectBlock[] = [],
): NodeMeta {
  const req = requests.find((r) => r.id === nodeId);
  if (req) return { nodeType: "api", label: req.name };
  if (delayNodes.some((n) => n.id === nodeId)) {
    return { nodeType: "delay", label: "Delay" };
  }
  if (conditionNodes.some((n) => n.id === nodeId)) {
    return { nodeType: "condition", label: "Condition" };
  }
  if (displayNodes.some((n) => n.id === nodeId)) {
    return { nodeType: "display", label: "Display" };
  }
  if (evaluateNodes.some((n) => n.id === nodeId)) {
    return { nodeType: "evaluate", label: "Evaluate" };
  }
  if (validateNodes.some((n) => n.id === nodeId)) {
    return { nodeType: "validate", label: "Validate" };
  }
  if (mergeNodes.some((n) => n.id === nodeId)) {
    return { nodeType: "merge", label: "Merge" };
  }
  if (loopNodes.some((n) => n.id === nodeId)) {
    return { nodeType: "loop", label: "Loop" };
  }
  if (collectNodes.some((n) => n.id === nodeId)) {
    return { nodeType: "collect", label: "Collect" };
  }
  if (startBlock?.id === nodeId) {
    return { nodeType: "start", label: "Start" };
  }
  return { nodeType: "api", label: nodeId };
}

function serialiseRequest(req?: RequestModel): SerialisedRequest | undefined {
  if (!req) return undefined;
  return {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(
      req.headers.filter((h) => h.enabled).map((h) => [h.key, h.value]),
    ),
    body: req.body?.content,
  };
}

function serialiseResponse(
  response?: ResponseData,
): SerialisedResponse | undefined {
  if (!response) return undefined;
  const { body, truncated } = truncateBody(response.body);
  return { ...response, body, truncated };
}

/** Per-node step timers, keyed by nodeId — tracks when a node started running so `finishRun` can compute duration. */
function makeRunStep(
  nodeId: string,
  state: ChainNodeState,
  data: NodeUpdateData,
  meta: NodeMeta,
  request: RequestModel | undefined,
  startedAt: number,
): RunStep {
  return {
    // Stable per-(node, iteration) id so `recordStep` can upsert the
    // running → terminal transition into a single row instead of appending
    // a duplicate, while keeping loop-body iterations from colliding.
    id: stepKey(nodeId, data),
    nodeId,
    nodeType: meta.nodeType,
    label: meta.label,
    state,
    startedAt,
    durationMs: Math.max(0, Date.now() - startedAt),
    request: serialiseRequest(request),
    response: serialiseResponse(data.response),
    error: data.error,
    assertionResults: data.assertionResults,
    extractedValues: data.extractedValues ?? {},
    unresolvedVars: data.unresolvedVars ?? [],
    parentStepId: data.parentStepId,
    iteration: data.iteration,
  };
}

/** Latest state per node, derived from a persisted run's steps (execution order). */
function deriveRunStateFromSteps(steps: RunStep[]): ChainRunState {
  const next: ChainRunState = {};
  for (const step of steps) {
    next[step.nodeId] = {
      state: step.state,
      extractedValues: (step.extractedValues ?? {}) as Record<
        string,
        string | null
      >,
      response: step.response,
      error: step.error,
      assertionResults: step.assertionResults,
      unresolvedVars: step.unresolvedVars,
    };
  }
  return next;
}

function pickLatestRun(runs: RunSummary[]): RunSummary | undefined {
  return [...runs].sort((a, b) => b.startedAt - a.startedAt)[0];
}

export type UseChainRunParams = {
  /** Keys run history in `useChainRunStore`. */
  chainId: string;
  chainRequests: RequestModel[];
  edges: ChainEdge[];
  delayNodes: DelayNodeConfig[];
  conditionNodes: ConditionNodeConfig[];
  displayNodes: DisplayBlock[];
  evaluateNodes?: EvaluateBlock[];
  validateNodes?: ValidateBlock[];
  mergeNodes?: MergeBlock[];
  loopNodes?: LoopBlock[];
  collectNodes?: CollectBlock[];
  subChainNodes?: SubChainBlock[];
  nodeAssertions?: Record<string, ChainAssertion[]>;
  envPromotions?: EnvPromotion[];
  onPromoteToEnv: (envId: string, varName: string, value: string) => void;
  resolveVariables?: (text: string) => string;
  /** The chain's Start block, if any — resolved before every full run and its inputs recorded as a step. */
  startBlock?: StartBlock;
};

export type UseChainRunResult = {
  runState: ChainRunState;
  isRunning: boolean;
  /** Runs the full chain. `startOverrides` win over each Start input's `defaultValue`. */
  handleRun: (startOverrides?: Record<string, string>) => Promise<void>;
  handleRunUpTo: (requestId: string) => Promise<void>;
  handleRunFromHere: (requestId: string) => Promise<void>;
  handleRunSingleNode: (requestId: string) => Promise<void>;
  handleStop: () => void;
  clearRunState: () => void;
  rerun: (runId: string) => Promise<void>;
};

/** Extracted from `page.tsx` (P1.12) — owns run state and the four run triggers, behavior-identical. */
export function useChainRun({
  chainId,
  chainRequests,
  edges,
  delayNodes,
  conditionNodes,
  displayNodes,
  evaluateNodes = [],
  validateNodes = [],
  mergeNodes = [],
  loopNodes = [],
  collectNodes = [],
  subChainNodes = [],
  nodeAssertions,
  envPromotions,
  onPromoteToEnv,
  resolveVariables,
  startBlock,
}: UseChainRunParams): UseChainRunResult {
  const [runState, setRunState] = useState<ChainRunState>({});
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stepStartTimes = useRef<Map<string, number>>(new Map());
  const chainConcurrency = useUIStore((s) => s.chainConcurrency);
  const chains = useChainStore((s) => s.chains);
  const collectionRequests = useCollectionsStore((s) => s.requests);

  /** Resolves a sub-chain's `chainId` into the nested `runChain` graph shape — undefined when the reference is deleted/unresolvable, so the executor fails that node instead of throwing. */
  const resolveSubChainGraph = useCallback(
    (referencedChainId: string): ReferencedChainGraph | undefined => {
      const referenced = chains[referencedChainId];
      if (!referenced) return undefined;
      const blocks = referenced.blocks;
      const byId = new Map(collectionRequests.map((r) => [r.id, r]));
      const requests = referenced.nodeIds
        .map((nodeId) => byId.get(nodeId))
        .filter((r): r is RequestModel => r !== undefined);
      return {
        requests,
        edges: referenced.edges,
        nodeAssertions: referenced.nodeAssertions,
        delayNodes: blocksOfType<DelayNodeConfig>(blocks, "delay"),
        conditionNodes: blocksOfType<ConditionNodeConfig>(blocks, "condition"),
        displayNodes: blocksOfType<DisplayBlock>(blocks, "display"),
        evaluateNodes: blocksOfType<EvaluateBlock>(blocks, "evaluate"),
        validateNodes: blocksOfType<ValidateBlock>(blocks, "validate"),
        mergeNodes: blocksOfType<MergeBlock>(blocks, "merge"),
        loopNodes: blocksOfType<LoopBlock>(blocks, "loop"),
        collectNodes: blocksOfType<CollectBlock>(blocks, "collect"),
        startBlock: blocksOfType<StartBlock>(blocks, "start")[0],
      };
    },
    [chains, collectionRequests],
  );

  const startRun = useChainRunStore((s) => s.startRun);
  const recordStep = useChainRunStore((s) => s.recordStep);
  const finishRun = useChainRunStore((s) => s.finishRun);
  const loadRuns = useChainRunStore((s) => s.loadRuns);
  const chainRunsForChain = useChainRunStore((s) => s.runs[chainId]);
  const selectedRunId = useChainRunStore((s) => s.selectedRunId);
  // Tracks the chainId this hook instance already "owns" live state for
  // (either restored history or a run started in this session), so the
  // history-restore effect below only seeds colors once per chain and
  // never clobbers live run state after a run started here finishes.
  const ownedChainIdRef = useRef<string | null>(null);

  // Load persisted run history for this chain whenever it changes.
  useEffect(() => {
    void loadRuns(chainId);
  }, [chainId, loadRuns]);

  // A run started in this hook instance owns the chain's live state from
  // that point on — stop auto-restoring from history for it.
  useEffect(() => {
    if (isRunning) ownedChainIdRef.current = chainId;
  }, [isRunning, chainId]);

  // Restore node colors from the selected (or latest) persisted run so
  // navigating away and back to the chain shows the last run's outcome.
  useEffect(() => {
    if (isRunning) return;
    if (ownedChainIdRef.current === chainId) return;
    const runs = chainRunsForChain ?? [];
    if (runs.length === 0) return;
    const target =
      runs.find((run) => run.id === selectedRunId) ?? pickLatestRun(runs);
    if (!target) return;
    ownedChainIdRef.current = chainId;
    setRunState(deriveRunStateFromSteps(target.steps));
  }, [chainId, chainRunsForChain, selectedRunId, isRunning]);

  const trackAndRecordStep = useCallback(
    (nodeId: string, state: ChainNodeState, data: NodeUpdateData) => {
      const now = Date.now();
      const key = stepKey(nodeId, data);
      if (state === "running") stepStartTimes.current.set(key, now);
      const startedAt = stepStartTimes.current.get(key) ?? now;
      const meta = resolveNodeMeta(
        nodeId,
        chainRequests,
        delayNodes,
        conditionNodes,
        displayNodes,
        startBlock,
        evaluateNodes,
        validateNodes,
        mergeNodes,
        loopNodes,
        collectNodes,
      );
      // A sub-chain's nested steps (P9.8/P9.9) carry `nodeId`s from the
      // *referenced* chain's own graph, not this chain's `chainRequests` — so
      // the host-chain lookup above always misses and falls back to the raw
      // id as the label. Re-resolve against the referenced chain's own
      // requests/blocks when this step nests under a Sub-chain node.
      const parentSubChainNode = subChainNodes.find(
        (n) => n.id === data.parentStepId,
      );
      const nestedGraph = parentSubChainNode
        ? resolveSubChainGraph(parentSubChainNode.chainId)
        : undefined;
      const effectiveMeta = nestedGraph
        ? resolveNodeMeta(
            nodeId,
            nestedGraph.requests,
            nestedGraph.delayNodes ?? [],
            nestedGraph.conditionNodes ?? [],
            nestedGraph.displayNodes ?? [],
            nestedGraph.startBlock,
            nestedGraph.evaluateNodes ?? [],
            nestedGraph.validateNodes ?? [],
            nestedGraph.mergeNodes ?? [],
            nestedGraph.loopNodes ?? [],
            nestedGraph.collectNodes ?? [],
          )
        : meta;
      const request = nestedGraph
        ? nestedGraph.requests.find((r) => r.id === nodeId)
        : chainRequests.find((r) => r.id === nodeId);
      recordStep(
        makeRunStep(nodeId, state, data, effectiveMeta, request, startedAt),
      );
    },
    [
      chainRequests,
      delayNodes,
      conditionNodes,
      displayNodes,
      startBlock,
      evaluateNodes,
      validateNodes,
      mergeNodes,
      loopNodes,
      collectNodes,
      subChainNodes,
      resolveSubChainGraph,
      recordStep,
    ],
  );

  const finishRunFor = useCallback(
    async (hadFailure: boolean, aborted: boolean) => {
      const status: RunStatus = aborted
        ? "stopped"
        : hadFailure
          ? "failed"
          : "passed";
      await finishRun(status);
    },
    [finishRun],
  );

  const handleRunSubset = useCallback(
    async (
      subsetRequests: RequestModel[],
      subsetEdges: ChainEdge[],
      subsetDelayNodes?: DelayNodeConfig[],
      subsetConditionNodes?: ConditionNodeConfig[],
      subsetDisplayNodes?: DisplayBlock[],
      trigger: RunTrigger = "full",
      subsetEvaluateNodes?: EvaluateBlock[],
      subsetValidateNodes?: ValidateBlock[],
      subsetMergeNodes?: MergeBlock[],
      subsetLoopNodes?: LoopBlock[],
      subsetCollectNodes?: CollectBlock[],
      subsetSubChainNodes?: SubChainBlock[],
    ) => {
      if (isRunning) return;
      setIsRunning(true);
      startRun(chainId, trigger);
      const controller = new AbortController();
      abortRef.current = controller;
      let hadFailure = false;
      try {
        await runChain(
          subsetRequests,
          subsetEdges,
          (nodeId, state, data) => {
            if (state === "failed") hadFailure = true;
            setRunState((prev) => ({
              ...prev,
              [nodeId]: {
                state,
                extractedValues: data.extractedValues ?? {},
                response: data.response,
                error: data.error,
                assertionResults: data.assertionResults,
                activeBranchId: data.activeBranchId,
                unresolvedVars: data.unresolvedVars,
              },
            }));
            trackAndRecordStep(nodeId, state, data);
          },
          controller.signal,
          nodeAssertions,
          subsetDelayNodes,
          subsetConditionNodes,
          envPromotions,
          onPromoteToEnv,
          subsetDisplayNodes,
          resolveVariables,
          undefined,
          undefined,
          subsetEvaluateNodes,
          subsetValidateNodes,
          undefined,
          subsetMergeNodes,
          chainConcurrency,
          0,
          subsetLoopNodes,
          subsetCollectNodes,
          subsetSubChainNodes,
          resolveSubChainGraph,
        );
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        await finishRunFor(hadFailure, controller.signal.aborted);
      }
    },
    [
      isRunning,
      chainId,
      startRun,
      nodeAssertions,
      envPromotions,
      onPromoteToEnv,
      resolveVariables,
      trackAndRecordStep,
      finishRunFor,
      chainConcurrency,
      resolveSubChainGraph,
    ],
  );

  const runSliced = useCallback(
    async (requestId: string, direction: "upTo" | "fromHere") => {
      if (isRunning) return;
      const cfIds = [
        ...delayNodes.map((n) => n.id),
        ...conditionNodes.map((n) => n.id),
        ...displayNodes.map((n) => n.id),
        ...evaluateNodes.map((n) => n.id),
        ...validateNodes.map((n) => n.id),
        ...mergeNodes.map((n) => n.id),
        ...loopNodes.map((n) => n.id),
        ...collectNodes.map((n) => n.id),
        ...subChainNodes.map((n) => n.id),
      ];
      let order: string[];
      try {
        order = buildExecutionOrder(chainRequests, edges, cfIds);
      } catch (err) {
        notifyExecutionOrderFailure(err);
        return;
      }
      const subsetIds = sliceChain(order, requestId, direction);
      if (!subsetIds) return;

      const subsetRequests = chainRequests.filter((r) => subsetIds.has(r.id));
      const subsetEdges = edges.filter(
        (e) =>
          subsetIds.has(e.sourceRequestId) && subsetIds.has(e.targetRequestId),
      );
      const subsetDelay = delayNodes.filter((n) => subsetIds.has(n.id));
      const subsetCondition = conditionNodes.filter((n) => subsetIds.has(n.id));
      const subsetDisplay = displayNodes.filter((n) => subsetIds.has(n.id));
      const subsetEvaluate = evaluateNodes.filter((n) => subsetIds.has(n.id));
      const subsetValidate = validateNodes.filter((n) => subsetIds.has(n.id));
      const subsetMerge = mergeNodes.filter((n) => subsetIds.has(n.id));
      const subsetLoop = loopNodes.filter((n) => subsetIds.has(n.id));
      const subsetCollect = collectNodes.filter((n) => subsetIds.has(n.id));
      const subsetSubChain = subChainNodes.filter((n) => subsetIds.has(n.id));

      if (direction === "upTo") {
        const initial: ChainRunState = {};
        for (const nodeId of subsetIds) {
          initial[nodeId] = { state: "idle", extractedValues: {} };
        }
        setRunState(initial);
      } else {
        setRunState((prev) => {
          const next = { ...prev };
          for (const nodeId of subsetIds) {
            next[nodeId] = { state: "idle", extractedValues: {} };
          }
          return next;
        });
      }

      await handleRunSubset(
        subsetRequests,
        subsetEdges,
        subsetDelay,
        subsetCondition,
        subsetDisplay,
        direction,
        subsetEvaluate,
        subsetValidate,
        subsetMerge,
        subsetLoop,
        subsetCollect,
        subsetSubChain,
      );
    },
    [
      isRunning,
      chainRequests,
      edges,
      delayNodes,
      conditionNodes,
      displayNodes,
      evaluateNodes,
      validateNodes,
      mergeNodes,
      loopNodes,
      collectNodes,
      subChainNodes,
      handleRunSubset,
    ],
  );

  const handleRunUpTo = useCallback(
    (requestId: string) => runSliced(requestId, "upTo"),
    [runSliced],
  );

  const handleRunFromHere = useCallback(
    (requestId: string) => runSliced(requestId, "fromHere"),
    [runSliced],
  );

  const handleRun = useCallback(
    async (startOverrides?: Record<string, string>) => {
      if (isRunning) return;

      const initial: ChainRunState = {};
      for (const req of chainRequests) {
        initial[req.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of delayNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of conditionNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of displayNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of evaluateNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of validateNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of mergeNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of loopNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of collectNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      for (const n of subChainNodes) {
        initial[n.id] = { state: "idle", extractedValues: {} };
      }
      if (startBlock) {
        initial[startBlock.id] = { state: "idle", extractedValues: {} };
      }
      setRunState(initial);
      setIsRunning(true);
      startRun(chainId, "full");

      const controller = new AbortController();
      abortRef.current = controller;
      let hadFailure = false;

      try {
        await runChain(
          chainRequests,
          edges,
          (nodeId, state, data) => {
            if (state === "failed") hadFailure = true;
            setRunState((prev) => ({
              ...prev,
              [nodeId]: {
                state,
                extractedValues: data.extractedValues ?? {},
                response: data.response,
                error: data.error,
                assertionResults: data.assertionResults,
                activeBranchId: data.activeBranchId,
                unresolvedVars: data.unresolvedVars,
              },
            }));
            trackAndRecordStep(nodeId, state, data);
          },
          controller.signal,
          nodeAssertions,
          delayNodes,
          conditionNodes,
          envPromotions,
          onPromoteToEnv,
          displayNodes,
          resolveVariables,
          startBlock,
          startOverrides,
          evaluateNodes,
          validateNodes,
          undefined,
          mergeNodes,
          chainConcurrency,
          0,
          loopNodes,
          collectNodes,
          subChainNodes,
          resolveSubChainGraph,
        );
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        await finishRunFor(hadFailure, controller.signal.aborted);
      }
    },
    [
      isRunning,
      chainId,
      startRun,
      chainRequests,
      edges,
      delayNodes,
      conditionNodes,
      displayNodes,
      evaluateNodes,
      validateNodes,
      mergeNodes,
      loopNodes,
      collectNodes,
      subChainNodes,
      nodeAssertions,
      envPromotions,
      onPromoteToEnv,
      resolveVariables,
      startBlock,
      trackAndRecordStep,
      finishRunFor,
      chainConcurrency,
      resolveSubChainGraph,
    ],
  );

  const handleRunSingleNode = useCallback(
    async (requestId: string) => {
      if (isRunning) return;
      const req = chainRequests.find((r) => r.id === requestId);
      if (!req) return;

      setIsRunning(true);
      startRun(chainId, "single");
      setRunState((prev) => ({
        ...prev,
        [requestId]: { ...prev[requestId], state: "running" },
      }));

      const controller = new AbortController();
      abortRef.current = controller;
      let hadFailure = false;

      try {
        // Run just this single request with no edges
        await runChain(
          [req],
          [],
          (id, state, data) => {
            if (state === "failed") hadFailure = true;
            setRunState((prev) => ({
              ...prev,
              [id]: {
                state,
                extractedValues: data.extractedValues ?? {},
                response: data.response,
                error: data.error,
                unresolvedVars: data.unresolvedVars,
              },
            }));
            trackAndRecordStep(id, state, data);
          },
          controller.signal,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          resolveVariables,
        );
      } catch (err) {
        console.error("Failed to run single node", err);
        hadFailure = true;
        setRunState((prev) => ({
          ...prev,
          [requestId]: { ...prev[requestId], state: "failed" },
        }));
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        await finishRunFor(hadFailure, controller.signal.aborted);
      }
    },
    [
      isRunning,
      chainId,
      startRun,
      chainRequests,
      resolveVariables,
      trackAndRecordStep,
      finishRunFor,
    ],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearRunState = useCallback(() => setRunState({}), []);

  /** Re-executes the exact node subset a persisted run touched, preserving its original trigger. */
  const rerun = useCallback(
    async (runId: string) => {
      if (isRunning) return;
      const run = (chainRunsForChain ?? []).find((r) => r.id === runId);
      if (!run) return;

      const subsetIds = new Set(run.steps.map((step) => step.nodeId));
      if (subsetIds.size === 0) return;

      const subsetRequests = chainRequests.filter((r) => subsetIds.has(r.id));
      const subsetEdges = edges.filter(
        (e) =>
          subsetIds.has(e.sourceRequestId) && subsetIds.has(e.targetRequestId),
      );
      const subsetDelay = delayNodes.filter((n) => subsetIds.has(n.id));
      const subsetCondition = conditionNodes.filter((n) => subsetIds.has(n.id));
      const subsetDisplay = displayNodes.filter((n) => subsetIds.has(n.id));
      const subsetEvaluate = evaluateNodes.filter((n) => subsetIds.has(n.id));
      const subsetValidate = validateNodes.filter((n) => subsetIds.has(n.id));
      const subsetMerge = mergeNodes.filter((n) => subsetIds.has(n.id));
      const subsetLoop = loopNodes.filter((n) => subsetIds.has(n.id));
      const subsetCollect = collectNodes.filter((n) => subsetIds.has(n.id));
      const subsetSubChain = subChainNodes.filter((n) => subsetIds.has(n.id));

      const initial: ChainRunState = {};
      for (const nodeId of subsetIds) {
        initial[nodeId] = { state: "idle", extractedValues: {} };
      }
      setRunState(initial);

      await handleRunSubset(
        subsetRequests,
        subsetEdges,
        subsetDelay,
        subsetCondition,
        subsetDisplay,
        run.trigger,
        subsetEvaluate,
        subsetValidate,
        subsetMerge,
        subsetLoop,
        subsetCollect,
        subsetSubChain,
      );
    },
    [
      isRunning,
      chainRunsForChain,
      chainRequests,
      edges,
      delayNodes,
      conditionNodes,
      displayNodes,
      evaluateNodes,
      validateNodes,
      mergeNodes,
      loopNodes,
      collectNodes,
      subChainNodes,
      handleRunSubset,
    ],
  );

  return {
    runState,
    isRunning,
    handleRun,
    handleRunUpTo,
    handleRunFromHere,
    handleRunSingleNode,
    handleStop,
    clearRunState,
    rerun,
  };
}
