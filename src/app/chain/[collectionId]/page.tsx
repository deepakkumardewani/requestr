"use client";

import { useTranslations } from "next-intl";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/react/shallow";
import { CanvasBanner } from "@/components/chain/canvas/CanvasBanner";
import type { CanvasFocusApi } from "@/components/chain/canvas/CanvasFocusBridge";
import { ChainCanvas } from "@/components/chain/canvas/ChainCanvas";
import { getInvalidMergeNodeIds } from "@/components/chain/canvas/hooks/useChainConnect";
import { ApiPickerDialog } from "@/components/chain/dialogs/ApiPickerDialog";
import { MigrationRecovery } from "@/components/chain/MigrationRecovery";
import { RunLogDock } from "@/components/chain/run-log/RunLogDock";
import { RunSelect } from "@/components/chain/run-log/RunSelect";
import { RunSummaryHeader } from "@/components/chain/run-log/RunSummaryHeader";
import { RunsList } from "@/components/chain/run-log/RunsList";
import { StepDetail } from "@/components/chain/run-log/StepDetail";
import { StepsTimeline } from "@/components/chain/run-log/StepsTimeline";
import { CommandPalette } from "@/components/common/CommandPalette";
import { ConfirmDeleteDialog } from "@/components/common/ConfirmDeleteDialog";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { KeyboardShortcutsModal } from "@/components/layout/KeyboardShortcutsModal";
import { useChainRequests } from "@/hooks/useChainRequests";
import { useChainRun } from "@/hooks/useChainRun";
import { useEmptyChainUndoShortcuts } from "@/hooks/useEmptyChainUndoShortcuts";
import { useHydrateChainPreferences } from "@/hooks/useHydrateChainPreferences";
import { getChainDisplayName } from "@/lib/chainDisplayName";
import { MigrationError } from "@/lib/chainMigration";
import { countRunnableNodes, getRunBlockReason } from "@/lib/chainRunBlock";
import {
  type ChainGraph,
  graphFromBlocks,
  groupBlocks,
} from "@/lib/chainRunner/runGraph";
import {
  pickLatestRun,
  resolveNodeMeta,
} from "@/lib/chainRunner/stepRecording";
import { collectDeclaredNamespace } from "@/lib/chainValueNamespace";
import { generateId } from "@/lib/utils";
import { useChainRunStore } from "@/stores/useChainRunStore";
import { getNode, useChainStore } from "@/stores/useChainStore";
import { useCollectionsStore } from "@/stores/useCollectionsStore";
import { useEnvironmentsStore } from "@/stores/useEnvironmentsStore";
import { useHistoryStore } from "@/stores/useHistoryStore";
import { useUIStore } from "@/stores/useUIStore";
import type { RequestModel } from "@/types";
import type {
  AddApiIntent,
  ChainBlock,
  ChainHistoryNode,
  EnvPromotion,
  HistoryBlock,
} from "@/types/chain";
import { ChainPageFooter } from "./ChainPageFooter";
import { ChainPageHeader, getRunBlockTitleKey } from "./ChainPageHeader";
import { ChainValidationBanners } from "./ChainValidationBanners";
import { useChainCycle } from "./useChainCycle";
import { useChainStructureValidation } from "./useChainStructureValidation";
import { useFlushChainOnLeave } from "./useFlushChainOnLeave";

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

export default function ChainPage({ params }: Props) {
  const { collectionId: id } = use(params);
  const t = useTranslations("chain");

  const {
    collections,
    hydrate: hydrateCollections,
    addRequest,
    updateRequest,
  } = useCollectionsStore(
    useShallow((s) => ({
      collections: s.collections,
      hydrate: s.hydrate,
      addRequest: s.addRequest,
      updateRequest: s.updateRequest,
    })),
  );
  const hydrateHistory = useHistoryStore((s) => s.hydrate);
  const {
    ensureCollectionChain,
    addRequestNode,
    removeNode,
    upsertBlock,
    upsertEdge,
    deleteEdge,
    clearEdges,
    clearNodes,
    updateNodePosition,
    upsertNodeAssertions,
    upsertEnvPromotion,
    deleteEnvPromotion,
  } = useChainStore(
    useShallow((s) => ({
      ensureCollectionChain: s.ensureCollectionChain,
      addRequestNode: s.addRequestNode,
      removeNode: s.removeNode,
      upsertBlock: s.upsertBlock,
      upsertEdge: s.upsertEdge,
      deleteEdge: s.deleteEdge,
      clearEdges: s.clearEdges,
      clearNodes: s.clearNodes,
      updateNodePosition: s.updateNodePosition,
      upsertNodeAssertions: s.upsertNodeAssertions,
      upsertEnvPromotion: s.upsertEnvPromotion,
      deleteEnvPromotion: s.deleteEnvPromotion,
    })),
  );
  const chain = useChainStore((s) => s.chains[id]);
  const chainsHydrated = useChainStore((s) => s.hydrated);

  const { environments, updateEnv, resolveVariables } = useEnvironmentsStore(
    useShallow((s) => ({
      environments: s.environments,
      updateEnv: s.updateEnv,
      resolveVariables: s.resolveVariables,
    })),
  );

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
  const runsLoading = useChainRunStore((s) => s.runsLoading[id] ?? false);
  const runsError = useChainRunStore((s) => s.runsError[id] ?? null);
  // The dock's own persisted collapsed flag is the only open/closed state.
  const dockCollapsed = useUIStore((s) => s.chainRunLogCollapsed);
  const setDockCollapsed = useUIStore((s) => s.setChainRunLogCollapsed);
  const keyboardShortcutsOpen = useUIStore((s) => s.keyboardShortcutsOpen);
  const setKeyboardShortcutsOpen = useUIStore(
    (s) => s.setKeyboardShortcutsOpen,
  );

  useEffect(() => {
    loadRuns(id);
  }, [id, loadRuns]);

  const latestRun = useMemo(() => pickLatestRun(runs) ?? null, [runs]);

  const toggleDock = useCallback(
    () => setDockCollapsed(!dockCollapsed),
    [dockCollapsed, setDockCollapsed],
  );
  const collapseDock = useCallback(
    () => setDockCollapsed(true),
    [setDockCollapsed],
  );

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
  // Steps nested in a Sub-chain extract over another chain's edges; only this chain's can be promoted.
  const chainEdgeIds = useMemo(
    () => new Set((chain?.edges ?? []).map((edge) => edge.id)),
    [chain?.edges],
  );
  const selectedStep = useMemo(
    () => selectedRunSteps.find((step) => step.id === selectedStepId) ?? null,
    [selectedRunSteps, selectedStepId],
  );

  const [apiPickerOpen, setApiPickerOpen] = useState(false);
  const canvasFocusRef = useRef<CanvasFocusApi | null>(null);
  const handleCanvasFocusReady = useCallback((api: CanvasFocusApi) => {
    canvasFocusRef.current = api;
  }, []);
  const handlePickerNodesAdded = useCallback(
    (nodeIds: string[]) => canvasFocusRef.current?.fitNodes(nodeIds),
    [],
  );
  const handlePickerShowOnCanvas = useCallback(
    (nodeId: string) => canvasFocusRef.current?.showNode(nodeId),
    [],
  );
  // Where/how the next picker adds land; cleared by the single close handler.
  const [apiPickerIntent, setApiPickerIntent] = useState<
    AddApiIntent | undefined
  >(undefined);
  const [migrationError, setMigrationError] = useState<MigrationError | null>(
    null,
  );
  const [readOnly, setReadOnly] = useState(false);
  // Keyed by the cycle's node ids so editing the cycle re-shows the banner.
  const [dismissedCycleKey, setDismissedCycleKey] = useState<string | null>(
    null,
  );
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

  useFlushChainOnLeave();
  useHydrateChainPreferences();

  const handleOpenApiPicker = useCallback((intent?: AddApiIntent) => {
    setApiPickerIntent(intent);
    setApiPickerOpen(true);
  }, []);

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
  const { mergeNodes, historyBlocks, startBlock } = useMemo(
    () => groupBlocks(blocks),
    [blocks],
  );

  const declaredNamespace = useMemo(
    () => collectDeclaredNamespace(blocks, chain?.edges ?? []),
    [blocks, chain?.edges],
  );

  const chainRequests = useMemo(
    () => [
      ...Object.values(resolvedRequests),
      ...historyBlocks.map(historyNodeToRequestModel),
    ],
    [resolvedRequests, historyBlocks],
  );

  const liveNodeIds = useMemo(
    () => new Set([...chainRequests, ...blocks].map((node) => node.id)),
    [chainRequests, blocks],
  );

  const isChainEmpty = chainRequests.length + blocks.length === 0;
  useEmptyChainUndoShortcuts(id, isChainEmpty);

  const chainGraph = useMemo<ChainGraph>(
    () => graphFromBlocks(blocks, chainRequests, chain?.edges ?? []),
    [blocks, chainRequests, chain?.edges],
  );

  // Anchor names for run triggers; ids missing here read as deleted nodes.
  const nodeLabels = useMemo(
    () =>
      Object.fromEntries(
        [...chainRequests, ...blocks].map((node) => [
          node.id,
          resolveNodeMeta(node.id, chainGraph).label,
        ]),
      ),
    [chainRequests, blocks, chainGraph],
  );

  const cycle = useChainCycle(chainGraph);
  const cycleKey = cycle.nodeIds.join("|");

  const invalidMergeIds = useMemo(
    () => getInvalidMergeNodeIds(mergeNodes, chain?.edges ?? []),
    [mergeNodes, chain?.edges],
  );

  const structureValidation = useChainStructureValidation(id, chain);

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
    blocks,
    nodeAssertions: chain?.nodeAssertions,
    envPromotions: chain?.envPromotions,
    onPromoteToEnv: handlePromoteToEnv,
    resolveVariables,
  });

  const handleRunWithInputs = useCallback(
    (overrides: Record<string, string>) => handleRun(overrides),
    [handleRun],
  );

  // One rule for the Run button and the ⌘↩ shortcut so neither can bypass it.
  const runBlockReason = getRunBlockReason({
    runnableNodeCount: countRunnableNodes(chainRequests.length, blocks),
    hasCycle: cycle.nodeIds.length > 0,
    hasInvalidMerge: invalidMergeIds.length > 0,
    hasUnpairedLoop: structureValidation.unpairedLoopIds.length > 0,
    hasUnresolvedCollect: structureValidation.unresolvedCollectIds.length > 0,
    hasLoopNestingViolation: structureValidation.hasLoopNesting,
    hasInvalidSubChain: structureValidation.invalidSubChainIds.length > 0,
  });

  const runChainShortcut = useCallback(() => {
    void handleRun();
  }, [handleRun]);

  // Subset and per-node runs must obey the same validity flags as the Run
  // button, otherwise a context-menu run could execute a broken graph.
  const gateRun = useCallback(
    (run: (nodeId: string) => Promise<void>) => (nodeId: string) => {
      const titleKey = getRunBlockTitleKey(runBlockReason);
      if (runBlockReason !== null) {
        if (titleKey) toast.error(t(titleKey));
        return;
      }
      void run(nodeId);
    },
    [runBlockReason, t],
  );
  const gatedRunUpTo = useMemo(
    () => gateRun(handleRunUpTo),
    [gateRun, handleRunUpTo],
  );
  const gatedRunFromHere = useMemo(
    () => gateRun(handleRunFromHere),
    [gateRun, handleRunFromHere],
  );
  const gatedRunNode = useMemo(
    () => gateRun(handleRunSingleNode),
    [gateRun, handleRunSingleNode],
  );

  // Unified node/edge operation delegates — every action targets the one `chain` record.
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

  const handleAddAfterNode = useCallback(
    (nodeId: string) => handleOpenApiPicker({ anchorNodeId: nodeId }),
    [handleOpenApiPicker],
  );

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

  const handlePickerClose = useCallback(() => {
    setApiPickerOpen(false);
    setApiPickerIntent(undefined);
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

  // Clearing nodes removes the nodes the canvas panels and selection point at,
  // so they close; only run badges outlive it. Undo/redo stay bound via
  // useEmptyChainUndoShortcuts so the clear is reversible from outside the canvas.
  const handleClearNodes = useCallback(() => {
    clearNodes(id);
    clearRunState();
    useChainRunStore.getState().pruneChainRunState(id, new Set());
  }, [id, clearNodes, clearRunState]);

  const handleClearRunResults = useCallback(() => {
    clearRunState();
    useChainRunStore.getState().clearRunResults(id);
  }, [id, clearRunState]);

  const hasRunResult = Object.keys(runState).length > 0;

  const chainTitle = chain
    ? getChainDisplayName(chain, collections)
    : (collection?.name ?? t("chainTitleFallback"));

  const alreadyAddedIds = new Set([
    ...(chain?.nodeIds ?? []),
    ...historyBlocks.flatMap((n) => [n.id, n.historyEntryId]),
  ]);

  // Get node names for the merge validation banner
  const invalidMergeNames = invalidMergeIds.map((nodeId, idx) => {
    const position = mergeNodes.findIndex((n) => n.id === nodeId);
    return `${t("blockMenuMergeName")} ${
      position >= 0 ? position + 1 : idx + 1
    }`;
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
        chainId={id}
        chainTitle={chainTitle}
        nodeCount={(chain?.nodeIds.length ?? 0) + blocks.length}
        edgeCount={chain?.edges.length ?? 0}
        hasRunResult={hasRunResult}
        isRunning={isRunning}
        runBlockReason={runBlockReason}
        isDockOpen={!dockCollapsed}
        startInputs={startBlock?.inputs}
        onToggleDock={toggleDock}
        onClearNodes={handleClearNodes}
        onClearRunResults={handleClearRunResults}
        onClearEdges={handleClearEdges}
        onStop={handleStop}
        onRun={handleRun}
        onRunWithInputs={handleRunWithInputs}
      />

      <ConfirmDeleteDialog
        open={clearEdgesConfirmOpen}
        onOpenChange={setClearEdgesConfirmOpen}
        title={t("clearEdgesConfirmTitle")}
        description={t("clearEdgesDescription")}
        confirmLabel={t("clearEdgesConfirmButton")}
        onConfirm={handleConfirmClearEdges}
      />

      {cycle.nodeIds.length > 0 && dismissedCycleKey !== cycleKey && (
        <CanvasBanner
          type="cycle"
          nodeNames={cycle.nodeNames}
          onDismiss={() => setDismissedCycleKey(cycleKey)}
        />
      )}

      {invalidMergeIds.length > 0 && !mergeBannerDismissed && (
        <CanvasBanner
          type="merge"
          nodeNames={invalidMergeNames}
          onDismiss={() => setMergeBannerDismissed(true)}
        />
      )}

      <ChainValidationBanners
        validation={structureValidation}
        blocks={blocks}
      />

      <main
        id="app-main"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <ErrorBoundary fallbackTitle={t("chainEditorCrashed")}>
          <ChainCanvas
            chainId={id}
            requests={chainRequests}
            edges={chain?.edges ?? []}
            nodePositions={chain?.nodePositions ?? {}}
            nodeAssertions={chain?.nodeAssertions ?? {}}
            runState={runState}
            isRunning={isRunning}
            blocks={blocks}
            cycleNodeIds={cycle.nodeIds}
            cycleEdgeId={cycle.edgeId}
            onAddApiClick={readOnly ? noop : handleOpenApiPicker}
            onDeleteNode={readOnly ? noop : handleDeleteNode}
            onDuplicateNode={readOnly ? noop : handleDuplicateNode}
            onUpsertEdge={readOnly ? noop : handleUpsertEdge}
            onDeleteEdge={readOnly ? noop : handleDeleteEdge}
            onUpdateNodePosition={readOnly ? noop : handleUpdateNodePosition}
            onUpsertNodeAssertions={
              readOnly ? noop : handleUpsertNodeAssertions
            }
            onRunNode={gatedRunNode}
            onRunChain={
              isRunning || runBlockReason !== null
                ? undefined
                : runChainShortcut
            }
            onStopChain={isRunning ? handleStop : undefined}
            onRunUpTo={gatedRunUpTo}
            onRunFromHere={gatedRunFromHere}
            onAddAfterNode={readOnly ? noop : handleAddAfterNode}
            onUpsertBlock={readOnly ? noop : handleUpsertBlock}
            onRemoveConditionNode={readOnly ? noop : handleRemoveConditionNode}
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
            onCanvasFocusReady={handleCanvasFocusReady}
          />
        </ErrorBoundary>
      </main>

      <RunLogDock
        isRunning={isRunning}
        runCount={runs.length}
        latestRun={activeRun ?? latestRun}
        onClearAll={handleClearAllRuns}
        list={
          <RunsList
            runs={runs}
            activeRun={activeRun}
            selectedRunId={selectedRunId}
            runsLoading={runsLoading}
            runsError={runsError}
            onRetryLoad={handleRetryLoadRuns}
            nodeLabels={nodeLabels}
            runBlockReason={runBlockReason}
            onRunFlow={runChainShortcut}
            onSelectRun={selectRun}
            onRerun={handleRerun}
            onDeleteRun={handleDeleteRun}
          />
        }
        runSelect={<RunSelect runs={runs} nodeLabels={nodeLabels} />}
        summary={
          selectedRun && (
            <RunSummaryHeader
              run={selectedRun}
              anchorLabel={
                selectedRun.anchorNodeId === undefined
                  ? undefined
                  : nodeLabels[selectedRun.anchorNodeId]
              }
              liveNodeIds={liveNodeIds}
              onRerun={handleRerun}
            />
          )
        }
        steps={
          <StepsTimeline
            steps={selectedRunSteps}
            onCollapseDock={collapseDock}
            liveNodeIds={liveNodeIds}
          />
        }
        detail={
          <StepDetail
            step={selectedStep ?? undefined}
            envPromotions={chain?.envPromotions}
            onSavePromotion={readOnly ? undefined : handleUpsertEnvPromotion}
            onRemovePromotion={readOnly ? undefined : handleDeleteEnvPromotion}
            promotableEdgeIds={chainEdgeIds}
          />
        }
      />

      <ChainPageFooter
        edges={chain?.edges}
        runState={runState}
        requests={chainRequests}
        resolveVariables={resolveVariables}
        declaredNamespace={declaredNamespace}
        isEmpty={isChainEmpty}
      />

      <ApiPickerDialog
        open={apiPickerOpen}
        onClose={handlePickerClose}
        chainId={id}
        alreadyAddedIds={alreadyAddedIds}
        intent={apiPickerIntent}
        onNodesAdded={handlePickerNodesAdded}
        onShowOnCanvas={handlePickerShowOnCanvas}
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
