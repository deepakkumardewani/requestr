"use client";

import { useTranslations } from "next-intl";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasBanner } from "@/components/chain/canvas/CanvasBanner";
import { ChainCanvas } from "@/components/chain/canvas/ChainCanvas";
import { getInvalidMergeNodeIds } from "@/components/chain/canvas/hooks/useChainConnect";
import { ApiPickerDialog } from "@/components/chain/dialogs/ApiPickerDialog";
import { MigrationRecovery } from "@/components/chain/MigrationRecovery";
import { RunLogDock } from "@/components/chain/run-log/RunLogDock";
import { RunsList } from "@/components/chain/run-log/RunsList";
import { StepDetail } from "@/components/chain/run-log/StepDetail";
import { StepsTimeline } from "@/components/chain/run-log/StepsTimeline";
import { CommandPalette } from "@/components/common/CommandPalette";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { KeyboardShortcutsModal } from "@/components/layout/KeyboardShortcutsModal";
import { useChainRequests } from "@/hooks/useChainRequests";
import { useChainRun } from "@/hooks/useChainRun";
import { MigrationError } from "@/lib/chainMigration";
import {
  buildExecutionOrder,
  CircularDependencyError,
} from "@/lib/chainRunner";
import { generateId } from "@/lib/utils";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { getNode, persistChain, useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import type { RequestModel } from "@/types";
import type {
  ChainBlock,
  ChainHistoryNode,
  CollectBlock,
  ConditionBlock,
  DelayBlock,
  DisplayBlock,
  EnvPromotion,
  EvaluateBlock,
  HistoryBlock,
  LoopBlock,
  MergeBlock,
  StartBlock,
  SubChainBlock,
  ValidateBlock,
} from "@/types/chain";
import { ChainPageEmptyState } from "./ChainPageEmptyState";
import { ChainPageFooter } from "./ChainPageFooter";
import { ChainPageHeader } from "./ChainPageHeader";

type Props = {
  params: Promise<{ collectionId: string }>;
};

// Stable empty-array reference so the `runs[id] ?? []` selector doesn't
// return a new array identity on every store read (which would trip
// useSyncExternalStore's "getSnapshot should be cached" infinite-loop guard).
const EMPTY_RUNS: never[] = [];

function historyNodeToRequestModel(node: ChainHistoryNode): RequestModel {
  return {
    id: node.id,
    collectionId: "", // signals "not a saved collection request"
    name: node.name,
    method: node.method,
    url: node.url,
    params: node.params,
    headers: node.headers,
    auth: node.auth,
    body: node.body,
    preScript: "",
    postScript: "",
    createdAt: 0,
    updatedAt: 0,
  };
}

function blocksOfType<T extends ChainBlock>(
  blocks: ChainBlock[],
  type: T["type"],
): T[] {
  return blocks.filter((b) => b.type === type) as T[];
}

export default function ChainPage({ params }: Props) {
  const { collectionId: id } = use(params);
  const t = useTranslations("chain");

  const {
    collections,
    hydrate: hydrateCollections,
    addRequest,
    updateRequest,
  } = useCollectionsStore();
  const { hydrate: hydrateHistory } = useHistoryStore();
  const {
    ensureCollectionChain,
    addRequestNode,
    removeNode,
    upsertBlock,
    upsertEdge,
    deleteEdge,
    clearEdges,
    updateNodePosition,
    upsertNodeAssertions,
    upsertEnvPromotion,
    deleteEnvPromotion,
  } = useChainStore();
  const chain = useChainStore((s) => s.chains[id]);
  const chainsHydrated = useChainStore((s) => s.hydrated);

  const { environments, updateEnv, resolveVariables } = useEnvironmentsStore();

  const loadRuns = useChainRunStore((s) => s.loadRuns);
  const selectRun = useChainRunStore((s) => s.selectRun);
  const selectStep = useChainRunStore((s) => s.selectStep);
  const deleteRun = useChainRunStore((s) => s.deleteRun);
  const clearRuns = useChainRunStore((s) => s.clearRuns);
  const runs = useChainRunStore((s) => s.runs[id] ?? EMPTY_RUNS);
  const activeRun = useChainRunStore((s) => s.activeRun);
  const selectedRunId = useChainRunStore((s) => s.selectedRunId);
  const selectedStepId = useChainRunStore((s) => s.selectedStepId);
  const syncSource = useChainRunStore((s) => s.syncSource);
  const runsLoading = useChainRunStore((s) => s.runsLoading);
  const runsError = useChainRunStore((s) => s.runsError);
  const chainRunLogAutoOpen = useUIStore((s) => s.chainRunLogAutoOpen);
  const keyboardShortcutsOpen = useUIStore((s) => s.keyboardShortcutsOpen);
  const setKeyboardShortcutsOpen = useUIStore(
    (s) => s.setKeyboardShortcutsOpen,
  );

  useEffect(() => {
    loadRuns(id);
  }, [id, loadRuns]);

  const lastRunAt = useMemo(
    () =>
      runs.length === 0
        ? undefined
        : Math.max(...runs.map((run) => run.startedAt)),
    [runs],
  );

  const lastRunSummary = useMemo(
    () =>
      runs.length === 0
        ? null
        : [...runs].sort((a, b) => b.startedAt - a.startedAt)[0],
    [runs],
  );

  const toggleDock = useCallback(() => setIsDockOpen((prev) => !prev), []);

  const selectedRun = useMemo(
    () =>
      activeRun?.id === selectedRunId
        ? activeRun
        : (runs.find((run) => run.id === selectedRunId) ?? null),
    [activeRun, selectedRunId, runs],
  );
  const selectedRunSteps = useMemo(
    () => selectedRun?.steps ?? EMPTY_RUNS,
    [selectedRun],
  );
  const selectedStep = useMemo(
    () => selectedRunSteps.find((step) => step.id === selectedStepId) ?? null,
    [selectedRunSteps, selectedStepId],
  );

  const [apiPickerOpen, setApiPickerOpen] = useState(false);
  // Tracks which node triggered "Add API after this" so the new node can be positioned relative to it
  const [addAfterNodeId, setAddAfterNodeId] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState<MigrationError | null>(
    null,
  );
  const [readOnly, setReadOnly] = useState(false);
  const [isDockOpen, setIsDockOpen] = useState(false);
  const [cycleNodeIds, setCycleNodeIds] = useState<string[]>([]);
  const [cycleEdgeId, setCycleEdgeId] = useState<string | null>(null);
  const [cycleBannerDismissed, setCycleBannerDismissed] = useState(false);
  const [mergeBannerDismissed, setMergeBannerDismissed] = useState(false);
  const [clearEdgesConfirmOpen, setClearEdgesConfirmOpen] = useState(false);

  const runMigration = useCallback(async () => {
    try {
      await useChainStore.getState().hydrate();
      setMigrationError(null);
    } catch (err) {
      if (err instanceof MigrationError) {
        setMigrationError(err);
      } else {
        console.error("Chain migration failed", err);
      }
    }
  }, []);

  // Always hydrate the unified chain store on mount — `hydrate()` internally
  // skips the migration step once `chainMigrationV5` is already set, but the
  // in-memory `chains` map still needs to be (re)loaded from IDB every time.
  useEffect(() => {
    runMigration();
  }, [runMigration]);

  // Force any pending debounced chain writes to flush before the tab/page is
  // torn down or navigated away from, so in-flight edits are never lost.
  useEffect(() => {
    const flushAll = () => {
      void persistChain.flush();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushAll();
    };
    window.addEventListener("beforeunload", flushAll);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", flushAll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      flushAll();
    };
  }, []);

  const handleOpenApiPicker = useCallback(() => setApiPickerOpen(true), []);

  const collection = collections.find((c) => c.id === id);

  useEffect(() => {
    hydrateCollections();
    hydrateHistory();
  }, [hydrateCollections, hydrateHistory]);

  // A collection's chain record is created lazily the first time its page is
  // opened. Gated on `chainsHydrated`: this effect fires as soon as
  // `collections` resolves, which can race ahead of `runMigration()`'s async
  // hydrate() — creating an empty chain here before migration has loaded (or
  // produced) the real one would make hydrate() see the in-flight `chains`
  // reference change and skip applying its own migrated data, silently
  // discarding a legacy chain's nodes/edges. Waiting for hydration to finish
  // guarantees any existing (migrated or otherwise) chain is already in the
  // store before we decide whether to create a blank one.
  useEffect(() => {
    if (collection && chainsHydrated)
      ensureCollectionChain(id, collection.name);
  }, [id, collection, chainsHydrated, ensureCollectionChain]);

  const { requests: resolvedRequests } = useChainRequests(chain);
  const blocks = useMemo(() => chain?.blocks ?? [], [chain?.blocks]);
  const delayNodes = useMemo(
    () => blocksOfType<DelayBlock>(blocks, "delay"),
    [blocks],
  );
  const conditionNodes = useMemo(
    () => blocksOfType<ConditionBlock>(blocks, "condition"),
    [blocks],
  );
  const displayNodes = useMemo(
    () => blocksOfType<DisplayBlock>(blocks, "display"),
    [blocks],
  );
  const evaluateNodes = useMemo(
    () => blocksOfType<EvaluateBlock>(blocks, "evaluate"),
    [blocks],
  );
  const validateNodes = useMemo(
    () => blocksOfType<ValidateBlock>(blocks, "validate"),
    [blocks],
  );
  const mergeNodes = useMemo(
    () => blocksOfType<MergeBlock>(blocks, "merge"),
    [blocks],
  );
  const loopNodes = useMemo(
    () => blocksOfType<LoopBlock>(blocks, "loop"),
    [blocks],
  );
  const collectNodes = useMemo(
    () => blocksOfType<CollectBlock>(blocks, "collect"),
    [blocks],
  );
  const subChainNodes = useMemo(
    () => blocksOfType<SubChainBlock>(blocks, "subchain"),
    [blocks],
  );
  const historyBlocks = useMemo(
    () => blocksOfType<HistoryBlock>(blocks, "history"),
    [blocks],
  );
  const startBlock = useMemo(
    () => blocksOfType<StartBlock>(blocks, "start")[0],
    [blocks],
  );

  const chainRequests = useMemo(
    () => [
      ...Object.values(resolvedRequests),
      ...historyBlocks.map(historyNodeToRequestModel),
    ],
    [resolvedRequests, historyBlocks],
  );

  // Detect cycles in the chain
  useEffect(() => {
    if (!chain) {
      setCycleNodeIds([]);
      setCycleEdgeId(null);
      setCycleBannerDismissed(false);
      return;
    }

    try {
      const controlFlowIds = [
        ...delayNodes.map((n) => n.id),
        ...conditionNodes.map((n) => n.id),
        ...displayNodes.map((n) => n.id),
        ...evaluateNodes.map((n) => n.id),
        ...validateNodes.map((n) => n.id),
        ...(startBlock ? [startBlock.id] : []),
      ];
      buildExecutionOrder(chainRequests, chain.edges, controlFlowIds);
      // No cycle detected
      setCycleNodeIds([]);
      setCycleEdgeId(null);
      setCycleBannerDismissed(false);
    } catch (err) {
      if (err instanceof CircularDependencyError) {
        // Cycle detected — find the offending edge
        setCycleNodeIds(err.nodeIds);
        // Find an edge that connects nodes in the cycle
        const cycleEdges = chain.edges.filter(
          (e) =>
            err.nodeIds.includes(e.sourceRequestId) &&
            err.nodeIds.includes(e.targetRequestId),
        );
        if (cycleEdges.length > 0) {
          setCycleEdgeId(cycleEdges[0].id);
        }
        setCycleBannerDismissed(false);
      }
    }
  }, [
    chain,
    chainRequests,
    delayNodes,
    conditionNodes,
    displayNodes,
    evaluateNodes,
    validateNodes,
    startBlock,
  ]);

  const invalidMergeIds = useMemo(
    () => getInvalidMergeNodeIds(mergeNodes, chain?.edges ?? []),
    [mergeNodes, chain?.edges],
  );

  // Re-arm the merge banner whenever the invalid set changes so a dismissed
  // banner reappears if a different (or newly-added) Merge becomes invalid.
  useEffect(() => {
    setMergeBannerDismissed(false);
  }, [invalidMergeIds]);

  // Runtime callback — writes an extracted value into an environment variable.
  // Uses currentValue so it doesn't permanently overwrite the saved initialValue.
  const handlePromoteToEnv = useCallback(
    (envId: string, varName: string, value: string) => {
      const env = environments.find((e) => e.id === envId);
      if (!env) return;
      const existingIdx = env.variables.findIndex((v) => v.key === varName);
      if (existingIdx >= 0) {
        const updatedVars = env.variables.map((v, idx) =>
          idx === existingIdx ? { ...v, currentValue: value } : v,
        );
        updateEnv(envId, { variables: updatedVars });
      } else {
        updateEnv(envId, {
          variables: [
            ...env.variables,
            {
              id: generateId(),
              key: varName,
              initialValue: value,
              currentValue: value,
              isSecret: false,
            },
          ],
        });
      }
    },
    [environments, updateEnv],
  );

  const {
    runState,
    isRunning,
    handleRun,
    handleRunUpTo,
    handleRunFromHere,
    handleRunSingleNode,
    handleStop,
    clearRunState,
    rerun,
  } = useChainRun({
    chainId: id,
    chainRequests,
    edges: chain?.edges ?? [],
    delayNodes,
    conditionNodes,
    displayNodes,
    evaluateNodes,
    validateNodes,
    mergeNodes,
    loopNodes,
    collectNodes,
    subChainNodes,
    nodeAssertions: chain?.nodeAssertions,
    envPromotions: chain?.envPromotions,
    onPromoteToEnv: handlePromoteToEnv,
    resolveVariables,
    startBlock,
  });

  const handleRunWithInputs = useCallback(
    (overrides: Record<string, string>) => handleRun(overrides),
    [handleRun],
  );

  // Auto-opens the dock the moment a run starts, honoring the persisted
  // preference — the manual header toggle still opens/closes it otherwise.
  const wasRunningRef = useRef(isRunning);
  useEffect(() => {
    if (!wasRunningRef.current && isRunning && chainRunLogAutoOpen) {
      setIsDockOpen(true);
    }
    wasRunningRef.current = isRunning;
  }, [isRunning, chainRunLogAutoOpen]);

  // Unified node/edge operation delegates — every action targets the one `chain` record.
  const handleAddNode = useCallback(
    (requestId: string) => addRequestNode(id, requestId),
    [id, addRequestNode],
  );

  const handleAddHistoryNode = useCallback(
    (node: ChainHistoryNode) => {
      upsertBlock(id, { ...node, type: "history" });
      setApiPickerOpen(false);
    },
    [id, upsertBlock],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => removeNode(id, nodeId),
    [id, removeNode],
  );

  const handleDuplicateNode = useCallback(
    (requestId: string) => {
      const source = chainRequests.find((r) => r.id === requestId);
      if (!source) return;
      const newRequest = addRequest(source.collectionId || id, {
        tabId: generateId(),
        requestId: null,
        isDirty: false,
        type: "http",
        name: `${source.name} (copy)`,
        method: source.method,
        url: source.url,
        params: source.params,
        headers: source.headers,
        auth: source.auth,
        body: source.body,
        preScript: source.preScript,
        postScript: source.postScript,
      });
      addRequestNode(id, newRequest.id);
    },
    [chainRequests, addRequest, id, addRequestNode],
  );

  const handleUpsertBlock = useCallback(
    (node: ChainBlock) => upsertBlock(id, node),
    [id, upsertBlock],
  );

  const handleRemoveConditionNode = useCallback(
    (nodeId: string) => removeNode(id, nodeId),
    [id, removeNode],
  );

  const handleUpsertEdge = useCallback(
    (edge: Parameters<typeof upsertEdge>[1]) => upsertEdge(id, edge),
    [id, upsertEdge],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => deleteEdge(id, edgeId),
    [id, deleteEdge],
  );

  const handleUpdateNodePosition = useCallback(
    (nodeId: string, pos: { x: number; y: number }) =>
      updateNodePosition(id, nodeId, pos),
    [id, updateNodePosition],
  );

  const handleUpsertNodeAssertions = useCallback(
    (
      requestId: string,
      assertions: Parameters<typeof upsertNodeAssertions>[2],
    ) => upsertNodeAssertions(id, requestId, assertions),
    [id, upsertNodeAssertions],
  );

  const handleAddAfterNode = useCallback((requestId: string) => {
    setAddAfterNodeId(requestId);
    setApiPickerOpen(true);
  }, []);

  const handleUpsertEnvPromotion = useCallback(
    (promotion: EnvPromotion) => upsertEnvPromotion(id, promotion),
    [id, upsertEnvPromotion],
  );

  const handleDeleteEnvPromotion = useCallback(
    (edgeId: string) => deleteEnvPromotion(id, edgeId),
    [id, deleteEnvPromotion],
  );

  const handleRerun = useCallback(
    (run: { id: string }) => rerun(run.id),
    [rerun],
  );

  const handleDeleteRun = useCallback(
    (runId: string) => deleteRun(id, runId),
    [id, deleteRun],
  );

  const handleClearAllRuns = useCallback(() => clearRuns(id), [id, clearRuns]);

  const handleRetryLoadRuns = useCallback(() => loadRuns(id), [id, loadRuns]);

  // Wraps handleAddNode to also position the new node 320px right of the source
  const handlePickerAddRequest = useCallback(
    (requestId: string) => {
      handleAddNode(requestId);
      if (addAfterNodeId !== null) {
        const sourcePos = chain?.nodePositions?.[addAfterNodeId];
        if (sourcePos) {
          handleUpdateNodePosition(requestId, {
            x: sourcePos.x + 320,
            y: sourcePos.y,
          });
        }
        setAddAfterNodeId(null);
      }
      setApiPickerOpen(false);
    },
    [addAfterNodeId, handleAddNode, handleUpdateNodePosition, chain],
  );

  const handlePickerClose = useCallback(() => {
    setApiPickerOpen(false);
    setAddAfterNodeId(null);
  }, []);

  const handleSaveRequest = useCallback(
    (nodeId: string, patch: Partial<RequestModel>) => {
      const block = chain ? getNode(chain, nodeId) : undefined;
      if (block?.type === "history") {
        upsertBlock(id, { ...block, ...patch } as HistoryBlock);
      } else {
        updateRequest(nodeId, patch);
      }
    },
    [id, chain, upsertBlock, updateRequest],
  );

  const handleClearEdges = useCallback(() => {
    setClearEdgesConfirmOpen(true);
  }, []);

  const handleConfirmClearEdges = useCallback(() => {
    clearEdges(id);
    clearRunState();
    setClearEdgesConfirmOpen(false);
  }, [id, clearEdges, clearRunState]);

  const passedCount = Object.values(runState).filter(
    (s) => s.state === "passed",
  ).length;
  const failedCount = Object.values(runState).filter(
    (s) => s.state === "failed",
  ).length;
  const skippedCount = Object.values(runState).filter(
    (s) => s.state === "skipped",
  ).length;
  const hasRunResult = Object.keys(runState).length > 0;

  const chainTitle = chain?.name || collection?.name || "Chain";

  const alreadyAddedIds = new Set([
    ...(chain?.nodeIds ?? []),
    ...historyBlocks.flatMap((n) => [n.id, n.historyEntryId]),
  ]);

  // Get node names for the cycle banner
  const cycleNodeNames = cycleNodeIds.map((nodeId) => {
    const req = chainRequests.find((r) => r.id === nodeId);
    return req?.name || nodeId;
  });

  // Get node names for the merge validation banner
  const invalidMergeNames = invalidMergeIds.map((nodeId, idx) => {
    const position = mergeNodes.findIndex((n) => n.id === nodeId);
    return `Merge ${position >= 0 ? position + 1 : idx + 1}`;
  });

  if (migrationError && !readOnly) {
    return (
      <MigrationRecovery
        error={migrationError}
        onRetry={runMigration}
        onOpenReadOnly={() => setReadOnly(true)}
      />
    );
  }

  const noop = () => {};

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <ChainPageHeader
        chainTitle={chainTitle}
        requestCount={chainRequests.length}
        hasRunResult={hasRunResult}
        isRunning={isRunning}
        passedCount={passedCount}
        failedCount={failedCount}
        skippedCount={skippedCount}
        hasCycle={cycleNodeIds.length > 0}
        hasInvalidMerge={invalidMergeIds.length > 0}
        lastRunAt={lastRunAt}
        isDockOpen={isDockOpen}
        startInputs={startBlock?.inputs}
        onToggleDock={toggleDock}
        onClearEdges={handleClearEdges}
        onStop={handleStop}
        onRun={handleRun}
        onRunWithInputs={handleRunWithInputs}
      />

      <ConfirmDeleteDialog
        open={clearEdgesConfirmOpen}
        onOpenChange={setClearEdgesConfirmOpen}
        title={t("clearEdgesConfirmTitle")}
        description={t("clearEdgesConfirmDescription")}
        confirmLabel={t("clearEdgesConfirmButton")}
        onConfirm={handleConfirmClearEdges}
      />

      {cycleNodeIds.length > 0 && !cycleBannerDismissed && (
        <CanvasBanner
          type="cycle"
          nodeNames={cycleNodeNames}
          onDismiss={() => setCycleBannerDismissed(true)}
        />
      )}

      {invalidMergeIds.length > 0 && !mergeBannerDismissed && (
        <CanvasBanner
          type="merge"
          nodeNames={invalidMergeNames}
          onDismiss={() => setMergeBannerDismissed(true)}
        />
      )}

      <main
        id="app-main"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        {chainRequests.length === 0 ? (
          <ChainPageEmptyState onAddApi={handleOpenApiPicker} />
        ) : (
          <ErrorBoundary fallbackTitle="Chain editor crashed">
            <ChainCanvas
              chainId={id}
              requests={chainRequests}
              edges={chain?.edges ?? []}
              nodePositions={chain?.nodePositions ?? {}}
              nodeAssertions={chain?.nodeAssertions ?? {}}
              runState={runState}
              isRunning={isRunning}
              delayNodes={delayNodes}
              conditionNodes={conditionNodes}
              cycleNodeIds={cycleNodeIds}
              cycleEdgeId={cycleEdgeId ?? undefined}
              onAddApiClick={readOnly ? noop : handleOpenApiPicker}
              onDeleteNode={readOnly ? noop : handleDeleteNode}
              onDuplicateNode={readOnly ? noop : handleDuplicateNode}
              onUpsertEdge={readOnly ? noop : handleUpsertEdge}
              onDeleteEdge={readOnly ? noop : handleDeleteEdge}
              onUpdateNodePosition={readOnly ? noop : handleUpdateNodePosition}
              onUpsertNodeAssertions={
                readOnly ? noop : handleUpsertNodeAssertions
              }
              onRunNode={handleRunSingleNode}
              onRunUpTo={handleRunUpTo}
              onRunFromHere={handleRunFromHere}
              onAddAfterNode={readOnly ? noop : handleAddAfterNode}
              onUpsertDelayNode={readOnly ? noop : handleUpsertBlock}
              onUpsertConditionNode={readOnly ? noop : handleUpsertBlock}
              onRemoveConditionNode={
                readOnly ? noop : handleRemoveConditionNode
              }
              displayNodes={displayNodes}
              onUpsertDisplayNode={readOnly ? noop : handleUpsertBlock}
              evaluateNodes={evaluateNodes}
              onUpsertEvaluateNode={readOnly ? noop : handleUpsertBlock}
              validateNodes={validateNodes}
              onUpsertValidateNode={readOnly ? noop : handleUpsertBlock}
              mergeNodes={mergeNodes}
              onUpsertMergeNode={readOnly ? noop : handleUpsertBlock}
              loopNodes={loopNodes}
              onUpsertLoopNode={readOnly ? noop : handleUpsertBlock}
              collectNodes={collectNodes}
              onUpsertCollectNode={readOnly ? noop : handleUpsertBlock}
              subChainNodes={subChainNodes}
              onUpsertSubChainNode={readOnly ? noop : handleUpsertBlock}
              startBlock={startBlock}
              onUpsertStartBlock={readOnly ? noop : handleUpsertBlock}
              onRemoveStartBlock={readOnly ? noop : handleDeleteNode}
              envPromotions={chain?.envPromotions ?? []}
              onSavePromotion={readOnly ? noop : handleUpsertEnvPromotion}
              onRemovePromotion={readOnly ? noop : handleDeleteEnvPromotion}
              onSaveRequest={readOnly ? noop : handleSaveRequest}
              resolveVariables={resolveVariables}
              runSteps={selectedRunSteps}
              selectedStepId={selectedStepId}
              syncSource={syncSource}
              onSelectStep={selectStep}
            />
          </ErrorBoundary>
        )}
      </main>

      {isDockOpen && (
        <RunLogDock
          isRunning={isRunning}
          runCount={runs.length}
          latestRun={activeRun ?? lastRunSummary}
        >
          <div className="flex h-full min-h-0">
            <div className="w-64 shrink-0 overflow-hidden border-r border-border">
              <RunsList
                runs={runs}
                activeRun={activeRun}
                selectedRunId={selectedRunId}
                runsLoading={runsLoading}
                runsError={runsError}
                onRetryLoad={handleRetryLoadRuns}
                onSelectRun={selectRun}
                onRerun={handleRerun}
                onDeleteRun={handleDeleteRun}
                onClearAll={handleClearAllRuns}
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                <StepsTimeline
                  steps={selectedRunSteps}
                  onCollapseDock={() => setIsDockOpen(false)}
                />
              </div>
              {selectedStep && (
                <div className="h-1/2 min-h-0 shrink-0 border-t border-border">
                  <StepDetail step={selectedStep} />
                </div>
              )}
            </div>
          </div>
        </RunLogDock>
      )}

      <ChainPageFooter
        edges={chain?.edges}
        runState={runState}
        requests={chainRequests}
        resolveVariables={resolveVariables}
      />

      <ApiPickerDialog
        open={apiPickerOpen}
        onClose={handlePickerClose}
        onAddRequest={handlePickerAddRequest}
        onAddHistoryNode={handleAddHistoryNode}
        alreadyAddedIds={alreadyAddedIds}
      />

      {/* MainLayout only mounts on /app — the chain route needs its own
          instances so ⌘K and ? work here too (both are store-driven, so
          state stays in sync no matter which route mounted them). */}
      <CommandPalette />
      <KeyboardShortcutsModal
        open={keyboardShortcutsOpen}
        onOpenChange={setKeyboardShortcutsOpen}
      />
    </div>
  );
}
