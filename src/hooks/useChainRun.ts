import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useActiveEnvVars } from "@/hooks/useActiveEnvVars";
import type { RunStatus, RunSummary, RunTrigger } from "@/lib/chainRunHistory";
import {
  buildExecutionOrder,
  CircularDependencyError,
  runChain,
} from "@/lib/chainRunner";
import type { ReferencedChainGraph } from "@/lib/chainRunner/executors/subchain";
import {
  type ChainGraph,
  controlFlowNodeIds,
  countInjectedIncomingEdges,
  filterGraphByNodeIds,
  graphFromBlocks,
  graphNodeIds,
} from "@/lib/chainRunner/runGraph";
import {
  deriveRunStateFromSteps,
  idleRunState,
  makeOnUpdate,
  makeRunStep,
  type NodeUpdateData,
  pickLatestRun,
  resolveNodeMeta,
  resolveScopedGraph,
  stepKey,
} from "@/lib/chainRunner/stepRecording";
import type { RunChainOptions } from "@/lib/chainRunner/types";
import { pruneRunState } from "@/lib/chainRunSummary";
import { sliceChain } from "@/lib/chainSlice";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useUIStore } from "@/stores/useUIStore";
import type { RequestModel } from "@/types";
import type {
  ChainAssertion,
  ChainBlock,
  ChainEdge,
  ChainNodeState,
  ChainRunState,
  EnvPromotion,
} from "@/types/chain";

type Translate = (key: string) => string;

/** Maps a thrown runner error to its user-facing message (cycle vs. generic). */
function runFailureMessage(err: unknown, t: Translate): string {
  return err instanceof CircularDependencyError
    ? t("runFailedCycle")
    : t("runFailed");
}

export type UseChainRunParams = {
  /** Keys run history in `useChainRunStore`. */
  chainId: string;
  chainRequests: RequestModel[];
  edges: ChainEdge[];
  /** Every block in the chain (Start included) — the runnable graph is derived from it. */
  blocks: ChainBlock[];
  nodeAssertions?: Record<string, ChainAssertion[]>;
  envPromotions?: EnvPromotion[];
  onPromoteToEnv: (envId: string, varName: string, value: string) => void;
  resolveVariables?: (text: string) => string;
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

/** Everything `execute` needs beyond the abort controller and `onUpdate` it owns. */
type ExecuteParams = {
  trigger: RunTrigger;
  options: Omit<RunChainOptions, "onUpdate" | "signal">;
  /** Node the trigger was invoked on (up-to / from-here / single); persisted so Re-run can replay it. */
  anchorNodeId?: string;
  /** Extra handling for a thrown runner error; `execute` itself always records the failure and toasts. */
  onError?: (err: unknown) => void;
};

type ExecuteGraphParams = {
  graph: ChainGraph;
  trigger: RunTrigger;
  anchorNodeId?: string;
  /** Overrides layered on top of the chain-level config (e.g. Start input overrides). */
  runOptions?: Partial<RunChainOptions>;
};

type SubsetRunParams = {
  anchorNodeId: string;
  direction: "upTo" | "fromHere";
};

/** Extracted from `page.tsx` (P1.12) — owns run state and the run triggers, behavior-identical. */
export function useChainRun({
  chainId,
  chainRequests,
  edges,
  blocks,
  nodeAssertions,
  envPromotions,
  onPromoteToEnv,
  resolveVariables,
}: UseChainRunParams): UseChainRunResult {
  const t = useTranslations("chain");
  const [runState, setRunState] = useState<ChainRunState>({});
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const stepStartTimes = useRef<Map<string, number>>(new Map());
  const envVars = useActiveEnvVars();
  const chainConcurrency = useUIStore((s) => s.chainConcurrency);
  const chains = useChainStore((s) => s.chains);
  const collectionRequests = useCollectionsStore((s) => s.requests);

  const graph = useMemo<ChainGraph>(
    () => graphFromBlocks(blocks, chainRequests, edges),
    [blocks, chainRequests, edges],
  );

  // Live badges live in this hook's local state, so drop entries for nodes that
  // no longer exist (delete, clear, undo of an add); undo of a delete restores idle.
  useEffect(() => {
    const liveIds = new Set([
      ...chainRequests.map((r) => r.id),
      ...blocks.map((b) => b.id),
    ]);
    setRunState((prev) => pruneRunState(prev, liveIds));
  }, [chainRequests, blocks]);

  /** Resolves a sub-chain's `chainId` into the nested `runChain` graph shape — undefined when the reference is deleted/unresolvable, so the executor fails that node instead of throwing. */
  const resolveSubChainGraph = useCallback(
    (referencedChainId: string): ReferencedChainGraph | undefined => {
      const referenced = chains[referencedChainId];
      if (!referenced) return undefined;
      const byId = new Map(collectionRequests.map((r) => [r.id, r]));
      const requests = referenced.nodeIds
        .map((nodeId) => byId.get(nodeId))
        .filter((r): r is RequestModel => r !== undefined);
      return {
        ...graphFromBlocks(referenced.blocks, requests, referenced.edges),
        nodeAssertions: referenced.nodeAssertions,
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
      // Nested steps carry `nodeId`s from the referenced chain's own graph,
      // not this chain's — resolve through every Sub-chain they sit under.
      const lookupGraph = resolveScopedGraph(graph, data, resolveSubChainGraph);
      recordStep(
        makeRunStep({
          nodeId,
          state,
          data,
          meta: resolveNodeMeta(nodeId, lookupGraph),
          request: lookupGraph.requests.find((r) => r.id === nodeId),
          startedAt,
        }),
      );
    },
    [graph, resolveSubChainGraph, recordStep],
  );

  /**
   * The one run orchestration: owns `isRunning`, the abort controller, the
   * shared `onUpdate`, and persisting the finished run's status.
   */
  const execute = useCallback(
    async ({ trigger, options, anchorNodeId, onError }: ExecuteParams) => {
      setIsRunning(true);
      const controller = new AbortController();
      abortRef.current = controller;
      startRun(chainId, trigger, {
        abortController: controller,
        anchorNodeId,
      });
      // Start times are keyed by step id, which repeats across runs; a node
      // that never reports "running" (skipped/aborted) would otherwise pick
      // up a stale start time from an earlier run.
      stepStartTimes.current.clear();
      let hadFailure = false;
      const onUpdate = makeOnUpdate({
        setRunState,
        recordStep: trackAndRecordStep,
        onFailed: () => {
          hadFailure = true;
        },
      });
      try {
        await runChain({
          envVars,
          ...options,
          onUpdate,
          signal: controller.signal,
        });
      } catch (err) {
        // Never rethrow: callers are fire-and-forget UI handlers, and a
        // rejection here would surface as unhandled and record the run passed.
        hadFailure = true;
        console.error(`Chain run (${trigger}) failed`, err);
        toast.error(runFailureMessage(err, t));
        onError?.(err);
      } finally {
        setIsRunning(false);
        abortRef.current = null;
        const status: RunStatus = controller.signal.aborted
          ? "stopped"
          : hadFailure
            ? "failed"
            : "passed";
        await finishRun(status);
      }
    },
    [chainId, startRun, trackAndRecordStep, finishRun, envVars, t],
  );

  /** Runs `graph` with the chain-level config (assertions, promotions, concurrency, sub-chain resolver). */
  const executeGraph = useCallback(
    ({
      graph: runGraph,
      trigger,
      anchorNodeId,
      runOptions,
    }: ExecuteGraphParams) =>
      execute({
        trigger,
        anchorNodeId,
        options: {
          ...runGraph,
          nodeAssertions,
          envPromotions,
          onPromoteToEnv,
          resolveVariables,
          concurrency: chainConcurrency,
          resolveSubChainGraph,
          ...runOptions,
        },
      }),
    [
      execute,
      nodeAssertions,
      envPromotions,
      onPromoteToEnv,
      resolveVariables,
      chainConcurrency,
      resolveSubChainGraph,
    ],
  );

  const runSubset = useCallback(
    async ({ anchorNodeId, direction }: SubsetRunParams) => {
      if (isRunning) return;
      let order: string[];
      try {
        order = buildExecutionOrder(
          chainRequests,
          edges,
          controlFlowNodeIds(graph),
        );
      } catch (err) {
        console.error("buildExecutionOrder failed", err);
        toast.error(runFailureMessage(err, t));
        return;
      }
      const subsetIds = sliceChain(order, anchorNodeId, direction);
      if (!subsetIds) return;

      const idle = idleRunState(subsetIds);
      // "upTo" restarts the canvas; "fromHere" keeps upstream results visible.
      setRunState(
        direction === "upTo" ? idle : (prev) => ({ ...prev, ...idle }),
      );
      await executeGraph({
        graph: filterGraphByNodeIds(graph, subsetIds),
        trigger: direction,
        anchorNodeId,
      });
    },
    [isRunning, chainRequests, edges, graph, executeGraph, t],
  );

  const handleRunUpTo = useCallback(
    (requestId: string) =>
      runSubset({ anchorNodeId: requestId, direction: "upTo" }),
    [runSubset],
  );

  const handleRunFromHere = useCallback(
    (requestId: string) =>
      runSubset({ anchorNodeId: requestId, direction: "fromHere" }),
    [runSubset],
  );

  const handleRun = useCallback(
    async (startOverrides?: Record<string, string>) => {
      if (isRunning) return;
      setRunState(idleRunState(graphNodeIds(graph)));
      await executeGraph({
        graph,
        trigger: "full",
        runOptions: { startOverrides },
      });
    },
    [isRunning, graph, executeGraph],
  );

  const handleRunSingleNode = useCallback(
    async (requestId: string) => {
      if (isRunning) return;
      const req = chainRequests.find((r) => r.id === requestId);
      if (!req) return;

      // Injections come from upstream responses a single-node run never has.
      if (countInjectedIncomingEdges(edges, requestId) > 0) {
        toast.warning(t("singleRunInjectionsIgnored"));
      }
      setRunState((prev) => ({
        ...prev,
        [requestId]: { ...prev[requestId], state: "running" },
      }));
      // Just this request, with no edges and none of the chain-level config
      // (assertions, promotions, sub-chains) — it runs in isolation.
      await execute({
        trigger: "single",
        anchorNodeId: requestId,
        options: { requests: [req], edges: [], resolveVariables },
        onError: (err) => {
          console.error("Failed to run single node", err);
          setRunState((prev) => ({
            ...prev,
            [requestId]: { ...prev[requestId], state: "failed" },
          }));
        },
      });
    },
    [isRunning, chainRequests, edges, resolveVariables, execute, t],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearRunState = useCallback(() => setRunState({}), []);

  /** Runs recorded before `anchorNodeId` existed: fall back to the top-level nodes they touched (nested Loop/Sub-chain children belong to another scope). */
  const rerunLegacySubset = useCallback(
    async (run: RunSummary) => {
      const subsetIds = new Set(
        run.steps.filter((step) => !step.parentStepId).map((s) => s.nodeId),
      );
      if (subsetIds.size === 0) return;

      setRunState(idleRunState(subsetIds));
      await executeGraph({
        graph: filterGraphByNodeIds(graph, subsetIds),
        trigger: run.trigger,
      });
    },
    [graph, executeGraph],
  );

  /** Replays a persisted run through the same entry point that produced it, so edits since then are honored and deleted anchors are skipped. */
  const rerun = useCallback(
    async (runId: string) => {
      if (isRunning) return;
      const run = (chainRunsForChain ?? []).find((r) => r.id === runId);
      if (!run) return;

      if (run.trigger === "full") {
        await handleRun();
        return;
      }
      if (run.anchorNodeId === undefined) {
        await rerunLegacySubset(run);
        return;
      }
      if (run.trigger === "single") {
        await handleRunSingleNode(run.anchorNodeId);
        return;
      }
      await runSubset({
        anchorNodeId: run.anchorNodeId,
        direction: run.trigger,
      });
    },
    [
      isRunning,
      chainRunsForChain,
      handleRun,
      handleRunSingleNode,
      runSubset,
      rerunLegacySubset,
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
